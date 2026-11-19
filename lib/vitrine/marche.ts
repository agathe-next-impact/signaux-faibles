import { LECTEURS_ACTIFS_MAX, PRIX_MENSUEL_HT, équivalentMensuelDeLAnnuel } from '@/lib/domaine/offre'

/**
 * Ce que la vitrine dit du marché et de la valeur de la veille (27 octobre
 * 2026, `Synthèse client signauxfaibles : de quoi fixer le prix`). Le seul
 * endroit où ces chiffres sont écrits : les graphiques des pages vitrines les
 * lisent ici, et nos propres prix viennent toujours de `lib/domaine/offre.ts`.
 *
 * Trois règles tenues ici, parce qu'une page publique les rend opposables :
 * - le marché est décrit par **familles d'offres**, jamais par le nom d'un
 *   concurrent ; chaque fourchette garde ses sources et la date du relevé ;
 * - le temps de veille interne est une **hypothèse affichée comme telle**
 *   (heures par semaine, coût de l'heure), jamais un chiffre mesuré ;
 * - rien de nos coûts ni de nos marges : ils ne regardent pas le client.
 */

/** La date du relevé des prix publics, affichée sous les graphiques. */
export const RELEVÉ_DU_MARCHÉ = '2026-10-27'

export type FamilleDOffres = {
  readonly clé: 'alertes' | 'outils' | 'lettres' | 'plateformes'
  readonly libellé: string
  /** Ce que la famille livre, en une ligne. */
  readonly livre: string
  /** Fourchette de prix publics, en euros HT par mois. 0 = gratuit. */
  readonly min: number
  readonly max: number
  readonly sources: readonly { readonly libellé: string; readonly url: string }[]
}

/**
 * Les familles d'offres comparables, du moins cher au plus cher. Les bornes
 * viennent des pages tarifaires lues le 27 octobre 2026 ; une estimation
 * publiée par un tiers n'est retenue que comme borne basse « à partir de ».
 */
export const FAMILLES_D_OFFRES: readonly FamilleDOffres[] = [
  {
    clé: 'alertes',
    libellé: 'Alertes gratuites',
    livre: 'Des alertes par mot-clé, à trier soi-même',
    min: 0,
    max: 0,
    sources: [{ libellé: 'Scopya, outils de veille en 2026', url: 'https://scopya.fr/blog/outils-veille-concurrentielle-2026' }],
  },
  {
    clé: 'outils',
    libellé: 'Outils d’alerte et de veille',
    livre: 'Un flux d’articles et d’annonces filtré, sans analyse',
    min: 39,
    max: 349,
    sources: [
      { libellé: 'PublikConnect, tarifs', url: 'https://publikconnect.fr/tarifs/' },
      { libellé: 'Scopya, outils de veille en 2026', url: 'https://scopya.fr/blog/outils-veille-concurrentielle-2026' },
    ],
  },
  {
    clé: 'lettres',
    libellé: 'Lettres professionnelles',
    livre: 'La même lettre pour tous les abonnés, par utilisateur',
    min: 82,
    max: 82 * LECTEURS_ACTIFS_MAX,
    sources: [
      {
        libellé: 'Lamy Liaisons, Liaisons Sociales Quotidien',
        url: 'https://boutique.lamy-liaisons.fr/produit/liaisons-sociales/social/quotidien-en-ligne.html',
      },
    ],
  },
  {
    clé: 'plateformes',
    libellé: 'Plateformes de veille',
    livre: 'Un logiciel à paramétrer et à exploiter en interne',
    min: 3000,
    max: 6000,
    sources: [
      { libellé: 'Appvizer, Talkwalker', url: 'https://www.appvizer.fr/marketing/marketing-rs/talkwalker' },
      { libellé: 'Scopya, outils de veille en 2026', url: 'https://scopya.fr/blog/outils-veille-concurrentielle-2026' },
    ],
  },
]

/** Notre fourchette : l'annuel ramené au mois, puis le mensuel. */
export function notreFourchette(): { readonly min: number; readonly max: number } {
  return { min: équivalentMensuelDeLAnnuel(), max: PRIX_MENSUEL_HT }
}

/** Le prix du mois ramené à un lecteur, quand l'organisation en a le plafond. */
export function prixParLecteur(): number {
  return Math.round(PRIX_MENSUEL_HT / LECTEURS_ACTIFS_MAX)
}

/**
 * Le coût de l'heure retenu pour valoriser une veille faite en interne. C'est
 * une hypothèse, affichée comme telle à côté de chaque chiffre qu'elle produit.
 */
export const COÛT_HORAIRE_ILLUSTRATIF = 50
export const HEURES_DE_VEILLE_PAR_SEMAINE = [1, 2, 3] as const
const SEMAINES_PAR_MOIS = 52 / 12

/** Ce que coûte chaque mois une veille faite en interne, pour chaque durée hebdomadaire. */
export function coûtDeLaVeilleInterne(): readonly { readonly heures: number; readonly parMois: number }[] {
  return HEURES_DE_VEILLE_PAR_SEMAINE.map((heures) => ({
    heures,
    parMois: Math.round(heures * SEMAINES_PAR_MOIS * COÛT_HORAIRE_ILLUSTRATIF),
  }))
}

/** Le coût mensuel d'une seule heure de veille interne par semaine : le plancher du raisonnement. */
export function coûtDUneHeureParSemaine(): number {
  return Math.round(SEMAINES_PAR_MOIS * COÛT_HORAIRE_ILLUSTRATIF)
}

/**
 * La carte des groupes stratégiques du marché de la veille : l'outil de l'écran
 * « Acteurs », appliqué à nous-mêmes. Deux axes, trois crans chacun, chaque cran
 * avec son critère écrit, comme dans la grille d'un référentiel.
 */
export const AXES_DE_LA_CARTE = {
  personnalisation: {
    libellé: 'À qui elle est destinée',
    court: 'Pour qui',
    crans: [
      { libellé: 'Tous les abonnés', critère: 'La même publication pour tous' },
      { libellé: 'Vos mots-clés', critère: 'Des filtres que vous réglez vous-même' },
      { libellé: 'Votre organisation', critère: 'Un périmètre établi pour vous : axes, sources, acteurs' },
    ],
  },
  analyse: {
    libellé: 'Ce qu’elle vous livre',
    court: 'Ce qu’elle livre',
    crans: [
      { libellé: 'Des résultats à trier', critère: 'Des liens, des mentions, des tableaux à exploiter' },
      { libellé: 'Une information rédigée', critère: 'Des articles écrits pour tous, sans hiérarchie pour vous' },
      { libellé: 'Une analyse', critère: 'Des faits datés, sourcés, classés par impact pour vous' },
    ],
  },
} as const

export type PositionSurLaCarte = {
  readonly clé: FamilleDOffres['clé'] | 'cabinets' | 'nous'
  readonly libellé: string
  /** Cran de personnalisation, de 1 à 3. */
  readonly personnalisation: 1 | 2 | 3
  /** Cran d'analyse, de 1 à 3. */
  readonly analyse: 1 | 2 | 3
}

export const POSITIONS_SUR_LA_CARTE: readonly PositionSurLaCarte[] = [
  { clé: 'alertes', libellé: 'Alertes gratuites', personnalisation: 2, analyse: 1 },
  { clé: 'outils', libellé: 'Outils d’alerte et de veille', personnalisation: 2, analyse: 1 },
  { clé: 'plateformes', libellé: 'Plateformes de veille', personnalisation: 2, analyse: 1 },
  { clé: 'lettres', libellé: 'Lettres professionnelles', personnalisation: 1, analyse: 2 },
  { clé: 'cabinets', libellé: 'Cabinets de veille, sur devis', personnalisation: 3, analyse: 3 },
  { clé: 'nous', libellé: 'signauxfaibles', personnalisation: 3, analyse: 3 },
]
