import type { Base } from '@/lib/base/client'
import { dernièreFiche, enregistrerLaFiche, fichePubliée, réglerLaPublicationDeLaFiche, type ÉtatDeLaFiche } from '@/lib/base/fiche-veille'
import { lireLaGrille, organisationPourLesOutils } from '@/lib/base/strategie'
import { contrôlerLaFiche, messageDeRepriseDeLaFiche, rendreLaFiche, type FicheDeVeille, type RefusDeFiche } from '@/lib/domaine/fiche-veille'
import type { Grille } from '@/lib/domaine/strategie'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { bornée } from '@/lib/portail/strategie'

/**
 * La fiche de veille pour le lecteur (lot 6, 30 octobre 2026) : la revue
 * mensuelle la poste (`POST /api/veille/fiche`), le portail la passe par la
 * porte avant toute écriture, l'opératrice la relit dans le courriel
 * « [Relecture] » et la publie (`PATCH /api/veille/fiche`). Les écrans
 * « Votre veille » ne lisent que la version publiée, par le registre de la
 * session (règle 2). Seul appelant de `lib/base/fiche-veille.ts`.
 */

export type RésultatDeLaFiche =
  | { readonly sorte: 'enregistrée'; readonly version: number; readonly texte: string }
  | { readonly sorte: 'refusée'; readonly refus: readonly RefusDeFiche[]; readonly message: string }
  | { readonly sorte: 'grille-périmée'; readonly attendue: number }
  | { readonly sorte: 'hors-pilote' | 'organisation-inconnue' | 'grille-absente' }

export async function recevoirLaFiche(
  entrée: { readonly slug: string; readonly grilleVersion: number; readonly fiche: FicheDeVeille },
  db?: Base,
): Promise<RésultatDeLaFiche> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const grille = await lireLaGrille(organisation.id, db)
  if (!grille) return { sorte: 'grille-absente' }
  if (grille.version !== entrée.grilleVersion) return { sorte: 'grille-périmée', attendue: grille.version }
  const refus = contrôlerLaFiche(entrée.fiche, grille.grille)
  if (refus.length > 0) return { sorte: 'refusée', refus, message: messageDeRepriseDeLaFiche(refus) }
  const { version } = await enregistrerLaFiche(
    { organisationId: organisation.id, grilleVersion: grille.version, contenu: entrée.fiche as unknown as Record<string, unknown> },
    db,
  )
  return { sorte: 'enregistrée', version, texte: rendreLaFiche(entrée.fiche, grille.grille, 'propose') }
}

export type LectureDeLaFiche =
  | { readonly sorte: 'lue'; readonly version: number; readonly état: ÉtatDeLaFiche; readonly texte: string; readonly fiche: FicheDeVeille }
  | { readonly sorte: 'aucune' | 'hors-pilote' | 'organisation-inconnue' }

/** La dernière version reçue, rendue en texte pour la relecture. */
export async function lireLaFicheDuPilote(entrée: { readonly slug: string }, db?: Base): Promise<LectureDeLaFiche> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const [fiche, grille] = await Promise.all([dernièreFiche(organisation.id, db), lireLaGrille(organisation.id, db)])
  if (!fiche || !grille) return { sorte: 'aucune' }
  const contenu = fiche.contenu as unknown as FicheDeVeille
  return { sorte: 'lue', version: fiche.version, état: fiche.état, texte: rendreLaFiche(contenu, grille.grille, fiche.état), fiche: contenu }
}

export type PublicationDeLaFiche =
  | { readonly sorte: 'réglée'; readonly version: number; readonly état: ÉtatDeLaFiche }
  | { readonly sorte: 'aucune' | 'hors-pilote' | 'organisation-inconnue' }

/** Le geste de l'opératrice après relecture : rien n'est montré au client avant lui. */
export async function publierLaFicheDuPilote(entrée: { readonly slug: string; readonly état: ÉtatDeLaFiche }, db?: Base): Promise<PublicationDeLaFiche> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const r = await réglerLaPublicationDeLaFiche({ organisationId: organisation.id, état: entrée.état }, db)
  return r ? { sorte: 'réglée', version: r.version, état: entrée.état } : { sorte: 'aucune' }
}

// ── Les écrans « Votre veille » ─────────────────────────────────────────────

export type FicheDeLEspace = {
  readonly grille: Grille
  /** La fiche publiée, ou `null` tant qu'aucune ne l'est : les écrans le disent. */
  readonly fiche: FicheDeVeille | null
  readonly publiéeLe: Date | null
}

/**
 * La grille et la fiche publiée de l'organisation de la session, pour les
 * écrans « Votre veille » et leur rubrique. `null` hors de l'espace réorganisé,
 * sans grille, ou dans le doute (base absente, `SOURCE_ACCES=notion`, lente).
 * Aucune lecture Notion.
 */
export async function ficheDeLEspace(entrée: { readonly registre: string }, db?: Base): Promise<FicheDeLEspace | null> {
  return bornée('lecture de la fiche de veille', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const [grille, fiche] = await Promise.all([lireLaGrille(organisation.id, db), fichePubliée(organisation.id, db)])
    if (!grille) return null
    return { grille: grille.grille, fiche: fiche ? (fiche.contenu as unknown as FicheDeVeille) : null, publiéeLe: fiche?.publiéeLe ?? null }
  })
}
