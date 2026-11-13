import type { ÉtatOrganisation, Étape } from './parcours'

/**
 * Les statuts d'abonnement du tableau de l'opératrice (12 novembre 2026, à sa
 * demande : « les organisations doivent être groupées par statut »).
 *
 * Un statut n'est pas stocké : il se lit dans l'étape calculée par
 * `étapeDuParcours`, la même que l'espace du client, pour que le groupe d'une
 * organisation ne contredise jamais la colonne « étape » de sa ligne. Il ne
 * fait que réunir des étapes voisines ; le détail (parution en cours, paiement
 * en retard, raison d'un hors parcours) reste dans la colonne.
 */
export type StatutDAbonnement =
  | 'abonnee'
  | 'offerte'
  | 'essai'
  | 'tronquee'
  | 'suspendue'
  | 'avant-parcours'
  | 'sans-lecteur'
  | 'ecartee'
  | 'test'

/** L'ordre des groupes : ce qui rapporte, ce qui se joue, puis ce qui est sorti. */
export const ORDRE_DES_STATUTS: readonly StatutDAbonnement[] = [
  'abonnee',
  'offerte',
  'essai',
  'tronquee',
  'suspendue',
  'avant-parcours',
  'sans-lecteur',
  'ecartee',
  'test',
]

/** Le libellé d'un groupe, en sentence case (charte §03). */
export const LIBELLÉS_DE_STATUT: Record<StatutDAbonnement, string> = {
  abonnee: 'Abonnées',
  offerte: 'Accès offert',
  essai: 'En essai',
  tronquee: 'Fin d’essai, l’essentiel seul',
  suspendue: 'Suspendues',
  'avant-parcours': 'Avant le parcours',
  'sans-lecteur': 'Sans lecteur actif',
  ecartee: 'Écartées',
  test: 'Organisations de test',
}

/**
 * Le statut d'une étape. Un abonnement Stripe en retard de paiement reste
 * abonné, comme dans le parcours ; un hors parcours se partage par l'état de
 * l'organisation, et non par le libellé de sa raison : écartée, de test, ou pas
 * encore entrée (demande, génération, essai sans J0, activation datée dans le
 * futur). Le compte des lecteurs actifs, quand il est donné, range à part
 * une organisation qui n'en a plus (`sans-lecteur`).
 */
export function statutDAbonnement(étape: Étape, état: ÉtatOrganisation, lecteursActifs?: number): StatutDAbonnement {
  const statut = statutDeLÉtape(étape, état)
  return lecteursActifs === 0 && SANS_LECTEUR_POSSIBLE.has(statut) && !(étape.étape === 'abonnee' && étape.source === 'stripe')
    ? 'sans-lecteur'
    : statut
}

/**
 * Les statuts qu'un compte de lecteurs actifs à zéro fait passer « Sans lecteur
 * actif » (13 novembre 2026, à la demande de l'opératrice : des organisations
 * dont les accès ont été supprimés restaient parmi les abonnées). Une
 * organisation avant le parcours n'a souvent pas encore de lecteur, une
 * écartée ou de test est déjà à part, et un abonnement Stripe ouvert reste
 * parmi les abonnées : il se paie, l'absence de lecteur y est une anomalie à
 * voir là.
 */
const SANS_LECTEUR_POSSIBLE = new Set<StatutDAbonnement>(['abonnee', 'offerte', 'essai', 'tronquee', 'suspendue'])

function statutDeLÉtape(étape: Étape, état: ÉtatOrganisation): StatutDAbonnement {
  switch (étape.étape) {
    case 'abonnee':
      return étape.source === 'offerte' ? 'offerte' : 'abonnee'
    case 'essai':
      return 'essai'
    case 'tronquee':
      return 'tronquee'
    case 'suspendue':
      return 'suspendue'
    case 'hors-parcours':
      if (état === 'ecartee') return 'ecartee'
      if (état === 'test') return 'test'
      return 'avant-parcours'
  }
}

export type GroupeDAbonnement<T> = {
  readonly statut: StatutDAbonnement
  readonly libellé: string
  readonly éléments: readonly T[]
}

/**
 * Range des éléments par statut, dans `ORDRE_DES_STATUTS`, sans groupe vide.
 * L'ordre d'origine est gardé à l'intérieur de chaque groupe (le nom, pour le
 * tableau).
 */
export function grouperParStatut<T>(éléments: readonly T[], statutDe: (élément: T) => StatutDAbonnement): GroupeDAbonnement<T>[] {
  const parStatut = new Map<StatutDAbonnement, T[]>()
  for (const élément of éléments) {
    const statut = statutDe(élément)
    const groupe = parStatut.get(statut)
    if (groupe) groupe.push(élément)
    else parStatut.set(statut, [élément])
  }
  return ORDRE_DES_STATUTS.flatMap((statut) => {
    const groupe = parStatut.get(statut)
    return groupe ? [{ statut, libellé: LIBELLÉS_DE_STATUT[statut], éléments: groupe }] : []
  })
}
