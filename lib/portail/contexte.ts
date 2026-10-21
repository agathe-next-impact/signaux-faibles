import { lireDossiersOuverts } from '@/lib/domaine/dossiers'
import type { ÉditionDeTravail } from '@/lib/notion/travail'

/**
 * Le contexte Notion d'une organisation avant d'écrire ses lettres : par
 * **famille** (la clé interne, jamais le nom client de la veille), le dernier
 * numéro, la dernière date et les deux dernières éditions avec ce que
 * l'anti-doublon et la continuité des dossiers demandent.
 *
 * Partagé entre `GET /api/veille/contexte` (la tâche qui le demande) et la file
 * de travaux (qui le sert avec chaque travail pris) : une seule lecture des
 * éditions, et la même pour les deux.
 */
export const FAMILLES = ['Écosystème', 'Concurrentiel'] as const
export type Famille = (typeof FAMILLES)[number]

export function résuméDÉdition(édition: ÉditionDeTravail) {
  return {
    pageId: édition.pageId,
    titre: édition.titre,
    statut: édition.statut,
    veille: édition.veille,
    date: édition.dateÉdition,
    numéro: édition.numéro,
    périodeCouverte: édition.périodeCouverte,
    fenêtreÉlargie: édition.fenêtreÉlargie,
    dossiers: lireDossiersOuverts(édition.dossiersOuvertsBruts),
    dossiersBruts: édition.dossiersOuvertsBruts,
    actionDeLaSemaine: édition.actionDeLaSemaine,
    amendements: édition.amendements,
  }
}

export type ContexteDeFamille = ReturnType<typeof contexteDeFamille>

/** Ce que la tâche doit savoir d'une famille : numéros, dernière date, deux dernières éditions. */
export function contexteDeFamille(éditions: readonly ÉditionDeTravail[], famille: string) {
  const siennes = éditions.filter((é) => é.famille === famille)
  const numéros = siennes.map((é) => é.numéro).filter((n): n is number => n !== null)
  const dernierNuméro = numéros.length > 0 ? Math.max(...numéros) : 0
  return {
    éditions: siennes.length,
    dernierNuméro,
    prochainNuméro: dernierNuméro + 1,
    dernièreDate: siennes[0]?.dateÉdition ?? null,
    // Le nom client de la veille, tel que la dernière édition l'a porté.
    veille: siennes[0]?.veille ?? null,
    dernières: siennes.slice(0, 2).map(résuméDÉdition),
  }
}

/** Le contexte complet d'une organisation : chaque famille, et les éditions sans famille. */
export function contexteDesFamilles(éditions: readonly ÉditionDeTravail[]) {
  const familles = Object.fromEntries(FAMILLES.map((famille) => [famille, contexteDeFamille(éditions, famille)]))
  // Une édition sans famille n'est comptée nulle part : la dire, sinon la
  // numérotation de la famille qu'elle aurait dû porter repart en arrière.
  const sansFamille = éditions
    .filter((é) => !FAMILLES.includes(é.famille as Famille))
    .map((é) => ({ pageId: é.pageId, titre: é.titre, statut: é.statut }))
  return { familles, sansFamille }
}
