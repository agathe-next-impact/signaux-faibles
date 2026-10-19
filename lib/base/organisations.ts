import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, organisations } from '@/lib/base/schema'
import { dateDeParis, type Offre } from '@/lib/domaine/parcours'
import { estUneDateISO, lundiDeLaSemaine } from '@/lib/domaine/semaines'

/**
 * L'entrée d'une nouvelle organisation dans le parcours d'essai (18 octobre
 * 2026), appelée par l'onboarding Cowork (`POST /api/veille/organisations`).
 *
 * Avant elle, rien ne créait une organisation dans Postgres hors de l'import de
 * la base Accès, qui la crée à l'état `abonnee` : un nouveau client y était un
 * « client historique », en accès complet et sans fin d'essai.
 *
 * **Un client historique n'est jamais rétrogradé.** Une organisation déjà
 * `abonnee`, `suspendue`, `ecartee` ou `test` garde son état : la route répond
 * `état-incompatible` et ne touche à rien. Seules `demande` et `generation`
 * passent en `essai`, plus un cas étroit : une organisation `abonnee` **née de
 * l'import après la mise en service de l'essai** (un import rejoué entre
 * l'étape A de l'onboarding et l'appel de la première lettre). On la reconnaît
 * à quatre signes réunis : créée après `MISE_EN_SERVICE_DE_L_ESSAI`, il y a
 * moins de quatorze jours, sans J0, sans aucun abonnement Stripe. Les clients
 * historiques ont tous été importés avant cette date : aucun ne peut y passer,
 * même sans lecteur actif.
 *
 * **J0 n'est pas posé ici.** Il est fixé par le passage quotidien du parcours
 * à la date de la première lettre publiée (`fixerJ0`), décision du 18/10/2026 :
 * c'est le moment où le client reçoit vraiment quelque chose. Tant qu'il est
 * nul, l'étape est « hors parcours » et la lecture reste complète.
 *
 * `relecture_requise` vaut faux : les courriers de fin d'essai vont au client.
 * Les lettres, elles, restent relues : elles arrivent en brouillon Gmail que
 * seule l'opératrice envoie.
 */

export type RésultatDOuverture =
  | { readonly sorte: 'créée' | 'passée-en-essai' | 'déjà-en-essai'; readonly organisationId: string }
  | { readonly sorte: 'état-incompatible'; readonly état: string }
  | { readonly sorte: 'registre-pris'; readonly slug: string }
  | { readonly sorte: 'registre-différent'; readonly registreActuel: string }

export async function ouvrirEnEssai(
  entrée: { readonly slug: string; readonly nom: string; readonly registreNotion: string },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<RésultatDOuverture> {
  const registreNotion = entrée.registreNotion.replaceAll('-', '').toLowerCase()
  return protéger('ouverture d’une organisation en essai', () =>
    db.transaction(async (tx) => {
      // Un verrou unique pour toutes les ouvertures : deux appels simultanés
      // (rejeu de la tâche) se suivent au lieu de se heurter sur l'unicité du
      // slug ou du registre, ce qui rendrait une panne au lieu d'un résultat.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ouvrir-en-essai'))`)

      const [autre] = await tx
        .select({ slug: organisations.slug })
        .from(organisations)
        .where(and(eq(organisations.registreNotion, registreNotion), ne(organisations.slug, entrée.slug)))
        .limit(1)
      if (autre) return { sorte: 'registre-pris', slug: autre.slug } as const

      const [existante] = await tx
        .select({
          id: organisations.id,
          état: organisations.état,
          crééeLe: organisations.crééeLe,
          activéeLe: organisations.activéeLe,
          registreNotion: organisations.registreNotion,
        })
        .from(organisations)
        .where(eq(organisations.slug, entrée.slug))
        .for('update')
        .limit(1)

      if (!existante) {
        const [créée] = await tx
          .insert(organisations)
          .values({
            slug: entrée.slug,
            nom: entrée.nom,
            registreNotion,
            état: 'essai',
            relectureRequise: false,
            essaiOuvertLe: maintenant,
          })
          .returning({ id: organisations.id })
        return { sorte: 'créée', organisationId: créée!.id } as const
      }

      if (existante.état === 'essai') {
        // Un rejeu peut corriger un registre faux (la page organisation collée à
        // la place de la ligne du registre) tant que J0 n'est pas posé. Après,
        // le registre est celui des lettres publiées : le changer serait une
        // autre organisation.
        if (existante.registreNotion !== registreNotion) {
          if (existante.activéeLe) return { sorte: 'registre-différent', registreActuel: existante.registreNotion ?? '' } as const
          await tx
            .update(organisations)
            .set({ registreNotion, nom: entrée.nom, modifiéeLe: maintenant })
            .where(eq(organisations.id, existante.id))
        }
        return { sorte: 'déjà-en-essai', organisationId: existante.id } as const
      }

      const reprise = existante.état === 'abonnee' && (await néeDeLImportPendantLOnboarding(tx, existante, maintenant))
      if (existante.état !== 'demande' && existante.état !== 'generation' && !reprise) {
        return { sorte: 'état-incompatible', état: existante.état } as const
      }
      await tx
        .update(organisations)
        .set({
          état: 'essai',
          nom: entrée.nom,
          registreNotion,
          relectureRequise: false,
          essaiOuvertLe: maintenant,
          modifiéeLe: maintenant,
        })
        .where(eq(organisations.id, existante.id))
      return { sorte: 'passée-en-essai', organisationId: existante.id } as const
    }),
  )
}

/** Les organisations importées avant cette date sont les clients historiques, d'avant l'offre. */
export const MISE_EN_SERVICE_DE_L_ESSAI = new Date('2026-10-18T00:00:00Z')
const FENÊTRE_DE_REPRISE_MS = 14 * 24 * 60 * 60 * 1000

async function néeDeLImportPendantLOnboarding(
  tx: Pick<Base, 'select'>,
  organisation: { readonly id: string; readonly crééeLe: Date; readonly activéeLe: Date | null },
  maintenant: Date,
): Promise<boolean> {
  if (organisation.activéeLe) return false
  if (organisation.crééeLe < MISE_EN_SERVICE_DE_L_ESSAI) return false
  if (maintenant.getTime() - organisation.crééeLe.getTime() > FENÊTRE_DE_REPRISE_MS) return false
  const [abonnement] = await tx
    .select({ id: abonnements.id })
    .from(abonnements)
    .where(eq(abonnements.organisationId, organisation.id))
    .limit(1)
  return !abonnement
}

/**
 * Les deux réglages que l'opératrice peut poser sur un parcours d'essai
 * (18 octobre 2026), par `PATCH /api/veille/organisations` :
 *
 *   · `prolonger` décale J0 d'une à trois semaines. C'est **le seul écrivain
 *     de J0 après `fixerJ0`**, et il ne le pose jamais après aujourd'hui (date
 *     de Paris) : au plus, l'essai repart de la semaine en cours, trois
 *     parutions complètes devant lui. Une organisation déjà réduite à
 *     « L'essentiel » ou suspendue par le calendrier retrouve la lecture
 *     complète si le décalage la ramène dans l'essai. Les courriers déjà
 *     partis ne repartent pas : le journal en tient un par destinataire.
 *   · `relecture` envoie les courriers de fin d'essai à l'adresse de relecture
 *     au lieu du client (ou les lui rend). Il ne change rien au calendrier.
 *
 * Rien d'autre n'est réglable ici : l'état de l'organisation, l'abonnement et
 * le registre restent tenus par leurs propres chemins.
 */
/**
 * Trois réglages de plus le 19 octobre 2026, par le même écrivain :
 *   · `offre` pose l'offre (standard, early adopter, accès offert). Un accès
 *     offert sur une organisation en essai la passe `abonnee` : rien ne doit
 *     plus se fermer pour elle ;
 *   · `parutions` règle le nombre de parutions complètes de l'essai (un essai à
 *     J+28 en compte quatre) ;
 *   · `parcours` fait entrer une organisation dans le parcours à une date
 *     choisie : la date de sa prochaine lettre et le nombre de parutions
 *     complètes qu'il lui reste, dont celle-là. J0 en découle, en semaines
 *     entières, et la mécanique existante fait le reste (courrier de dernière
 *     parution, « L'essentiel » seul, suspension). C'est **le chemin assumé
 *     pour un client historique qui devient payant** : `ouvrirEnEssai` refuse
 *     exprès de rétrograder un `abonnee`, et cette garde reste intacte ; ici,
 *     c'est une décision d'opératrice, derrière son privilège. Une
 *     organisation dont un abonnement Stripe est ouvert n'y entre pas.
 */
export type Réglage =
  | { readonly sorte: 'prolonger'; readonly semaines: 1 | 2 | 3 }
  | { readonly sorte: 'relecture'; readonly requise: boolean }
  | { readonly sorte: 'offre'; readonly offre: Offre }
  | { readonly sorte: 'parutions'; readonly parutions: number }
  | { readonly sorte: 'parcours'; readonly prochaineLettre: string; readonly restantes: number }

export type RésultatDuRéglage =
  | { readonly sorte: 'prolongé'; readonly ancienJ0: string; readonly nouveauJ0: string }
  | { readonly sorte: 'relecture-réglée'; readonly requise: boolean }
  | { readonly sorte: 'offre-posée'; readonly offre: Offre; readonly étatOrganisation: string }
  | { readonly sorte: 'parutions-réglées'; readonly parutions: number }
  | { readonly sorte: 'mis-en-parcours'; readonly j0: string; readonly parutions: number; readonly restantes: number }
  | { readonly sorte: 'inconnue' }
  | { readonly sorte: 'pas-en-essai'; readonly état: string }
  | { readonly sorte: 'sans-j0' }
  | { readonly sorte: 'au-delà-d-aujourdhui'; readonly j0Maximal: string }
  | { readonly sorte: 'abonnée-stripe' }
  | { readonly sorte: 'parutions-invalides'; readonly parutions: number }
  | { readonly sorte: 'date-invalide' }

const SEMAINE_MS = 7 * 24 * 60 * 60 * 1000
const PARUTIONS_MAX = 8
const ÉTATS_STRIPE_OUVERTS = new Set(['trialing', 'active', 'past_due'])

export async function réglerLeParcours(
  slug: string,
  réglage: Réglage,
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<RésultatDuRéglage> {
  return protéger('réglage du parcours d’une organisation', () =>
    db.transaction(async (tx) => {
      const [organisation] = await tx
        .select({
          id: organisations.id,
          état: organisations.état,
          activéeLe: organisations.activéeLe,
          essaiOuvertLe: organisations.essaiOuvertLe,
          parutionsDEssai: organisations.parutionsDEssai,
        })
        .from(organisations)
        .where(eq(organisations.slug, slug))
        .for('update')
        .limit(1)
      if (!organisation) return { sorte: 'inconnue' } as const

      if (réglage.sorte === 'offre') {
        const état = réglage.offre === 'gratuite' && organisation.état === 'essai' ? 'abonnee' : organisation.état
        await tx
          .update(organisations)
          .set({ offre: réglage.offre, état, modifiéeLe: maintenant })
          .where(eq(organisations.id, organisation.id))
        // `étatOrganisation` et non `état` : la route renvoie `état` pour la sorte,
        // et un même nom écraserait l'autre dans la réponse (constaté le 19/10/2026).
        return { sorte: 'offre-posée', offre: réglage.offre, étatOrganisation: état } as const
      }

      if (réglage.sorte === 'parutions') {
        if (!Number.isInteger(réglage.parutions) || réglage.parutions < 1 || réglage.parutions > PARUTIONS_MAX) {
          return { sorte: 'parutions-invalides', parutions: organisation.parutionsDEssai } as const
        }
        await tx
          .update(organisations)
          .set({ parutionsDEssai: réglage.parutions, modifiéeLe: maintenant })
          .where(eq(organisations.id, organisation.id))
        return { sorte: 'parutions-réglées', parutions: réglage.parutions } as const
      }

      if (réglage.sorte === 'parcours') {
        if (organisation.état !== 'essai' && organisation.état !== 'abonnee') {
          return { sorte: 'pas-en-essai', état: organisation.état } as const
        }
        const ouverts = await tx
          .select({ état: abonnements.état })
          .from(abonnements)
          .where(eq(abonnements.organisationId, organisation.id))
        if (ouverts.some((a) => ÉTATS_STRIPE_OUVERTS.has(a.état))) return { sorte: 'abonnée-stripe' } as const
        const parutions = organisation.parutionsDEssai
        if (!Number.isInteger(réglage.restantes) || réglage.restantes < 1 || réglage.restantes > parutions) {
          return { sorte: 'parutions-invalides', parutions } as const
        }
        if (!estUneDateISO(réglage.prochaineLettre)) return { sorte: 'date-invalide' } as const
        // J0 est le lundi de la semaine de la prochaine lettre, reculé d'autant
        // de semaines qu'il y a déjà eu de parutions « complètes » à compter :
        // avec trois parutions et une restante, J0 tombe deux semaines avant.
        const lundi = Date.parse(`${lundiDeLaSemaine(réglage.prochaineLettre)}T06:00:00Z`)
        const j0 = new Date(lundi - (parutions - réglage.restantes) * SEMAINE_MS)
        await tx
          .update(organisations)
          .set({
            état: 'essai',
            activéeLe: j0,
            essaiOuvertLe: organisation.essaiOuvertLe ?? maintenant,
            modifiéeLe: maintenant,
          })
          .where(eq(organisations.id, organisation.id))
        return { sorte: 'mis-en-parcours', j0: dateDeParis(j0), parutions, restantes: réglage.restantes } as const
      }

      if (réglage.sorte === 'relecture') {
        await tx
          .update(organisations)
          .set({ relectureRequise: réglage.requise, modifiéeLe: maintenant })
          .where(eq(organisations.id, organisation.id))
        return { sorte: 'relecture-réglée', requise: réglage.requise } as const
      }

      if (organisation.état !== 'essai') return { sorte: 'pas-en-essai', état: organisation.état } as const
      // Sans J0, le calendrier n'a pas démarré : il n'y a rien à prolonger.
      if (!organisation.activéeLe) return { sorte: 'sans-j0' } as const

      const nouveauJ0 = new Date(organisation.activéeLe.getTime() + réglage.semaines * SEMAINE_MS)
      const aujourdHui = dateDeParis(maintenant)
      if (dateDeParis(nouveauJ0) > aujourdHui) {
        // Le J0 le plus tardif admis est celui qui tombe aujourd'hui ou avant,
        // à la même heure que l'ancien : semaines entières seulement.
        const semainesPossibles = Math.floor((maintenant.getTime() - organisation.activéeLe.getTime()) / SEMAINE_MS)
        const j0Maximal = new Date(organisation.activéeLe.getTime() + Math.max(0, semainesPossibles) * SEMAINE_MS)
        return { sorte: 'au-delà-d-aujourdhui', j0Maximal: dateDeParis(j0Maximal) } as const
      }

      await tx
        .update(organisations)
        .set({ activéeLe: nouveauJ0, modifiéeLe: maintenant })
        .where(eq(organisations.id, organisation.id))
      return {
        sorte: 'prolongé',
        ancienJ0: dateDeParis(organisation.activéeLe),
        nouveauJ0: dateDeParis(nouveauJ0),
      } as const
    }),
  )
}

/** Fixe J0 d'une organisation en essai, une seule fois : une date déjà posée n'est jamais déplacée. */
export async function fixerJ0(organisationId: string, j0: Date, db: Base = base()): Promise<boolean> {
  return protéger('fixation de J0', async () => {
    const lignes = await db
      .update(organisations)
      .set({ activéeLe: j0, modifiéeLe: new Date() })
      .where(and(eq(organisations.id, organisationId), eq(organisations.état, 'essai'), isNull(organisations.activéeLe)))
      .returning({ id: organisations.id })
    return lignes.length > 0
  })
}
