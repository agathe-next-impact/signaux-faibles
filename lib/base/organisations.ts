import { and, eq, isNull, ne } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, lecteurs, organisations } from '@/lib/base/schema'

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
 * passent en `essai`, plus un cas étroit : une organisation `abonnee` **créée
 * par l'import avant l'activation**. L'étape A de l'onboarding écrit la ligne
 * Accès, case Actif décochée, et un import rejoué entre-temps crée
 * l'organisation à l'état `abonnee`. On la reconnaît à trois signes réunis :
 * aucune date d'activation, aucun abonnement Stripe, aucun lecteur actif. Un
 * client historique a toujours au moins un lecteur actif.
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

export async function ouvrirEnEssai(
  entrée: { readonly slug: string; readonly nom: string; readonly registreNotion: string },
  db: Base = base(),
): Promise<RésultatDOuverture> {
  return protéger('ouverture d’une organisation en essai', () =>
    db.transaction(async (tx) => {
      const [autre] = await tx
        .select({ slug: organisations.slug })
        .from(organisations)
        .where(and(eq(organisations.registreNotion, entrée.registreNotion), ne(organisations.slug, entrée.slug)))
        .limit(1)
      if (autre) return { sorte: 'registre-pris', slug: autre.slug } as const

      const [existante] = await tx
        .select({ id: organisations.id, état: organisations.état })
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
            registreNotion: entrée.registreNotion,
            état: 'essai',
            relectureRequise: false,
          })
          .returning({ id: organisations.id })
        return { sorte: 'créée', organisationId: créée!.id } as const
      }

      if (existante.état === 'essai') return { sorte: 'déjà-en-essai', organisationId: existante.id } as const
      const néeDeLImport = existante.état === 'abonnee' && (await néeDeLImportAvantActivation(tx, existante.id))
      if (existante.état !== 'demande' && existante.état !== 'generation' && !néeDeLImport) {
        return { sorte: 'état-incompatible', état: existante.état } as const
      }
      await tx
        .update(organisations)
        .set({ état: 'essai', nom: entrée.nom, registreNotion: entrée.registreNotion, relectureRequise: false, modifiéeLe: new Date() })
        .where(eq(organisations.id, existante.id))
      return { sorte: 'passée-en-essai', organisationId: existante.id } as const
    }),
  )
}

async function néeDeLImportAvantActivation(tx: Pick<Base, 'select'>, organisationId: string): Promise<boolean> {
  const [organisation] = await tx
    .select({ activéeLe: organisations.activéeLe })
    .from(organisations)
    .where(eq(organisations.id, organisationId))
  if (!organisation || organisation.activéeLe) return false
  const [abonnement] = await tx
    .select({ id: abonnements.id })
    .from(abonnements)
    .where(eq(abonnements.organisationId, organisationId))
    .limit(1)
  if (abonnement) return false
  const [actif] = await tx
    .select({ id: lecteurs.id })
    .from(lecteurs)
    .where(and(eq(lecteurs.organisationId, organisationId), eq(lecteurs.actif, true), eq(lecteurs.tousLesEspaces, false)))
    .limit(1)
  return !actif
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
