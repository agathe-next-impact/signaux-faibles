import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, organisations } from '@/lib/base/schema'

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

const MISE_EN_SERVICE_DE_L_ESSAI = new Date('2026-10-18T00:00:00Z')
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
