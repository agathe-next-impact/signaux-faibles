import type { LigneDeMarché, NiveauDeSegment } from '@/lib/domaine/marches'

/**
 * La décision sur les marchés et les niches : un verdict par segment, par
 * règle, la matrice qui les range, et la distance au basculement de chaque
 * verdict (16 novembre 2026, lot 1 des simulations de scénarios). La section
 * « Et si » de l'écran, où le lecteur posait ses hypothèses, a été retirée le
 * même jour à la demande de l'opératrice : la règle rejouée sous hypothèse ne
 * sert plus qu'à calculer cette distance.
 *
 * Ce fichier n'importe que des types. Tout y est pur. Rien n'est lu, rien
 * n'est stocké.
 */

/** Un montant en euros, arrondi pour être lu : « 1,2 M€ », « 340 k€ ». */
export function montantCourt(euros: number): string {
  const f = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: n < 10 ? 1 : 0 })
  if (euros >= 1_000_000_000) return `${f(euros / 1_000_000_000)} Md€`
  if (euros >= 1_000_000) return `${f(euros / 1_000_000)} M€`
  if (euros >= 1_000) return `${f(euros / 1_000)} k€`
  return `${f(euros)} €`
}

// ── La règle ─────────────────────────────────────────────────────────────────

/** Au moins autant de faits dans le trimestre : l'activité de la veille est soutenue. */
export const SEUIL_D_ACTIVITÉ_SOUTENUE = 10
/** Au moins autant de concurrents suivis sur le segment : la concurrence est dense. */
export const SEUIL_DE_CONCURRENCE_DENSE = 4
/**
 * En deçà de cette part du potentiel de l'arbre, un segment chiffré est
 * marginal : il ne monte jamais au-dessus de « à surveiller » (décision de
 * l'opératrice du 16 novembre 2026). Une part, et non un montant : le même
 * potentiel pèse lourd dans un arbre et peu dans un autre.
 */
export const SEUIL_DE_POTENTIEL_MARGINAL = 0.05

export type VerdictDeSegment = 'pousser' | 'disputer' | 'surveiller' | 'ecarter'

/** Dans l'ordre de lecture de la matrice : soutenu puis calme, concurrence limitée puis dense. */
export const VERDICTS: readonly VerdictDeSegment[] = ['pousser', 'disputer', 'surveiller', 'ecarter']

export const LIBELLÉS_DE_VERDICT: Readonly<Record<VerdictDeSegment, string>> = {
  pousser: 'à pousser',
  disputer: 'à disputer',
  surveiller: 'à surveiller',
  ecarter: 'à écarter',
}

const POUR_CENT_MARGINAL = Math.round(SEUIL_DE_POTENTIEL_MARGINAL * 100)

/** La règle de chaque verdict, telle que l'écran l'affiche sous son titre. */
export const RÈGLES_DE_VERDICT: Readonly<Record<VerdictDeSegment, string>> = {
  pousser: `Activité soutenue (${SEUIL_D_ACTIVITÉ_SOUTENUE} faits ou plus), moins de ${SEUIL_DE_CONCURRENCE_DENSE} concurrents suivis`,
  disputer: `Activité soutenue, ${SEUIL_DE_CONCURRENCE_DENSE} concurrents suivis ou plus`,
  surveiller: `Activité calme, concurrence non mesurée, ou potentiel sous ${POUR_CENT_MARGINAL} % de l’arbre`,
  ecarter: `Activité calme et concurrence dense, ou segment en recul`,
}

/** Ce que la règle lit de l'arbre entier : le potentiel haut de ses offres chiffrées. */
export type ArbreDeDécision = { readonly potentielTotal: number | null }

/**
 * Le potentiel de l'arbre : la somme des potentiels hauts des offres chiffrées.
 * Les niches n'y entrent pas, elles sont déjà dans leur offre ; la racine non
 * plus, elle est cette même somme. `null` sans offre chiffrée : la règle du
 * potentiel ne s'applique alors à personne.
 */
export function arbreDeDécision(lignes: readonly LigneDeMarché[]): ArbreDeDécision {
  const total = lignes.filter((l) => l.niveau === 'offre' && l.potentiel).reduce((n, l) => n + (l.potentiel?.haut ?? 0), 0)
  return { potentielTotal: total > 0 ? total : null }
}

/** La part du potentiel haut d'un segment dans celui de l'arbre ; `null` sans chiffre d'un côté ou de l'autre. */
export function partDuPotentiel(l: LigneDeMarché, arbre: ArbreDeDécision): number | null {
  if (!l.potentiel || arbre.potentielTotal === null) return null
  return l.potentiel.haut / arbre.potentielTotal
}

export type LectureDeSegment = {
  readonly verdict: VerdictDeSegment
  /** La situation du segment, en une phrase : son activité, sa concurrence, puis son potentiel. */
  readonly raison: string
  /** Vrai quand le potentiel marginal a retenu le segment à « à surveiller ». */
  readonly retenu?: boolean
}

const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`

const fourchette = (p: { readonly bas: number; readonly haut: number }) => (p.bas === p.haut ? montantCourt(p.haut) : `${montantCourt(p.bas)} à ${montantCourt(p.haut)}`)

function pourCent(part: number): string {
  const n = Math.round(part * 100)
  return n < 1 ? 'moins de 1 %' : `${n.toLocaleString('fr-FR')} %`
}

/**
 * Le verdict d'un segment, par règle et jamais par un modèle : l'activité de la
 * veille (faits rattachés) et la concurrence (concurrents suivis présents),
 * croisées en quatre cases, puis le potentiel. Un segment éteint ou en
 * régression est écarté quelle que soit sa case ; une concurrence non mesurée
 * ne conclut jamais mieux que « à surveiller » ; un potentiel marginal non
 * plus. Un segment sans potentiel chiffré n'est pas pénalisé. La phrase décrit
 * la situation avec les mots de la règle, les chiffres entre parenthèses.
 *
 * Sans `arbre`, la règle du potentiel ne s'applique pas et la phrase n'en dit
 * rien : c'est la règle d'avant le 16 novembre 2026.
 */
export function lectureDuSegment(l: LigneDeMarché, arbre?: ArbreDeDécision): LectureDeSegment {
  if (l.état === 'eteint') return { verdict: 'ecarter', raison: 'Le segment s’est éteint : ni fait ni cible depuis deux trimestres.' }
  const soutenue = l.faits >= SEUIL_D_ACTIVITÉ_SOUTENUE
  const forts = l.faitsForts > 0 ? `, dont ${l.faitsForts} ${l.faitsForts > 1 ? 'signaux forts' : 'signal fort'}` : ''
  const activité =
    l.faits === 0 ? 'Aucun fait relevé par la veille ce trimestre' : `${soutenue ? 'Activité soutenue' : 'Peu d’activité'} ce trimestre (${pluriel(l.faits, 'fait')}${forts})`
  const début = l.état === 'en_regression' ? `En recul depuis deux trimestres. ${activité}` : activité

  let verdict: VerdictDeSegment
  let raison: string
  if (l.présents === null) {
    verdict = l.état === 'en_regression' ? 'ecarter' : 'surveiller'
    raison = `${début} ; la concurrence n’y est pas encore mesurée.`
  } else {
    const n = l.présents.length
    const dense = n >= SEUIL_DE_CONCURRENCE_DENSE
    const présence = n === 0 ? 'aucun concurrent suivi n’y est présent' : `${pluriel(n, 'concurrent')} suivi${n > 1 ? 's' : ''} y ${n > 1 ? 'sont présents' : 'est présent'}`
    const concurrence = dense ? `sur un segment disputé : ${présence}` : `et peu de concurrence : ${présence}`
    verdict = l.état === 'en_regression' ? 'ecarter' : soutenue ? (dense ? 'disputer' : 'pousser') : dense ? 'ecarter' : 'surveiller'
    raison = `${début} ${concurrence}.`
  }
  if (!arbre || !l.potentiel) return { verdict, raison }

  const part = partDuPotentiel(l, arbre)
  const marginal = part !== null && part < SEUIL_DE_POTENTIEL_MARGINAL
  const chiffre = `${fourchette(l.potentiel)} par an${part !== null ? `, ${pourCent(part)} de l’arbre` : ''}`
  if (marginal && (verdict === 'pousser' || verdict === 'disputer')) {
    return { verdict: 'surveiller', raison: `${raison} Potentiel marginal (${chiffre}) : le segment reste à surveiller.`, retenu: true }
  }
  return { verdict, raison: `${raison} Potentiel de ${chiffre}.` }
}

export type SegmentDeCase = {
  readonly clé: string
  readonly libellé: string
  readonly niveau: NiveauDeSegment
  readonly faits: number
  /** Le potentiel haut du segment, en euros par an ; `null` quand il n'est pas chiffré. */
  readonly potentiel: number | null
}

export type CaseDeDécision = {
  readonly verdict: VerdictDeSegment
  /** Les segments de la case : les chiffrés par potentiel décroissant, puis les autres, du plus actif au moins actif. */
  readonly segments: readonly SegmentDeCase[]
}

/** La matrice de décision : les offres et les niches rangées par verdict, le marché entier à part. */
export function matriceDeDécision(lignes: readonly LigneDeMarché[]): { readonly cases: readonly CaseDeDécision[]; readonly faitsMax: number } {
  const arbre = arbreDeDécision(lignes)
  const classées = lignes.filter((l) => l.niveau !== 'marche').map((l) => ({ l, verdict: lectureDuSegment(l, arbre).verdict }))
  return {
    cases: VERDICTS.map((verdict) => ({
      verdict,
      segments: classées
        .filter((c) => c.verdict === verdict)
        .map(({ l }): SegmentDeCase => ({ clé: l.clé, libellé: l.libellé, niveau: l.niveau, faits: l.faits, potentiel: l.potentiel?.haut ?? null }))
        .sort((a, b) => (b.potentiel ?? -1) - (a.potentiel ?? -1) || b.faits - a.faits),
    })),
    faitsMax: Math.max(0, ...classées.map((c) => c.l.faits)),
  }
}

// ── La sensibilité de la règle ───────────────────────────────────
//
// Une hypothèse déplace une mesure d'un segment ; la règle est rejouée telle
// quelle. Les seuils ne se règlent pas : les rendre réglables ferait dire à
// l'écran ce que l'on veut entendre. Ce n'est pas une prévision.

export type HypothèsesDeSegment = {
  /** Le nombre de faits du trimestre. */
  readonly faits?: number
  /** Le nombre de concurrents suivis présents ; mesure aussi une concurrence non renseignée. */
  readonly concurrents?: number
  /** Le segment supposé en recul depuis deux trimestres. */
  readonly recul?: boolean
  /** La dépense par cible, en pour cent de l'hypothèse de l'arbre (100 : inchangée). */
  readonly dépense?: number
}

export const BORNES_DES_HYPOTHÈSES = { faitsMax: 200, concurrentsMax: 40, dépenseMin: 25, dépenseMax: 400 } as const

const entier = (x: unknown, min: number, max: number): number | undefined => (typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : undefined)

/** Une hypothèse ramenée à ses bornes ; un levier hors bornes est écarté, pas arrondi. */
export function bornerLesHypothèses(h: HypothèsesDeSegment): HypothèsesDeSegment {
  const faits = entier(h.faits, 0, BORNES_DES_HYPOTHÈSES.faitsMax)
  const concurrents = entier(h.concurrents, 0, BORNES_DES_HYPOTHÈSES.concurrentsMax)
  const dépense = entier(h.dépense, BORNES_DES_HYPOTHÈSES.dépenseMin, BORNES_DES_HYPOTHÈSES.dépenseMax)
  return {
    ...(faits !== undefined ? { faits } : {}),
    ...(concurrents !== undefined ? { concurrents } : {}),
    ...(h.recul === true ? { recul: true } : {}),
    ...(dépense !== undefined && dépense !== 100 ? { dépense } : {}),
  }
}

const sansHypothèse = (h: HypothèsesDeSegment) => h.faits === undefined && h.concurrents === undefined && h.recul !== true && h.dépense === undefined

/**
 * Une ligne sous hypothèses. Les concurrents supposés en plus n'ont pas de
 * nom : l'hypothèse porte un nombre, pas une entité. Un segment éteint auquel
 * on suppose des faits redevient lisible par la règle.
 */
export function simulerLaLigne(l: LigneDeMarché, hypothèses: HypothèsesDeSegment): LigneDeMarché {
  const h = bornerLesHypothèses(hypothèses)
  if (sansHypothèse(h)) return l
  const faits = h.faits ?? l.faits
  const mesurés = l.présents ?? []
  const présents =
    h.concurrents === undefined
      ? l.présents
      : [...mesurés.slice(0, h.concurrents), ...Array.from({ length: Math.max(0, h.concurrents - mesurés.length) }, (_, i) => `concurrent supposé ${i + 1}`)]
  const potentiel =
    h.dépense !== undefined && l.potentiel ? { ...l.potentiel, bas: Math.round((l.potentiel.bas * h.dépense) / 100), haut: Math.round((l.potentiel.haut * h.dépense) / 100) } : l.potentiel
  const état = h.recul ? 'en_regression' : l.état === 'eteint' && faits > 0 ? 'stable' : l.état
  return { ...l, faits, faitsForts: Math.min(l.faitsForts, faits), présents, potentiel, état }
}

export type Bascule = {
  readonly levier: 'faits' | 'concurrents' | 'mesure' | 'potentiel'
  /** La plus petite variation du levier qui change le verdict ; `null` pour un levier sans nombre. */
  readonly écart: number | null
  readonly verdict: VerdictDeSegment
  readonly phrase: string
}

/**
 * La distance au basculement : pour chaque levier, la plus petite variation,
 * tout le reste égal, qui change le verdict du segment. Jamais une variation
 * impossible : ni moins de zéro fait, ni moins de zéro concurrent.
 */
export function distancesDeBascule(l: LigneDeMarché, lignes: readonly LigneDeMarché[]): Bascule[] {
  if (l.niveau === 'marche' || l.état === 'eteint') return []
  const arbre = arbreDeDécision(lignes)
  const actuelle = lectureDuSegment(l, arbre)
  const sous = (h: HypothèsesDeSegment) => lectureDuSegment(simulerLaLigne(l, h), arbre).verdict
  const bascules: Bascule[] = []

  const plusProche = (départ: number, max: number, essai: (n: number) => VerdictDeSegment): { écart: number; verdict: VerdictDeSegment } | null => {
    for (let d = 1; d <= max; d += 1) {
      for (const écart of [d, -d]) {
        const n = départ + écart
        if (n < 0 || n > max) continue
        const verdict = essai(n)
        if (verdict !== actuelle.verdict) return { écart, verdict }
      }
    }
    return null
  }
  const sens = (écart: number) => (écart > 0 ? 'de plus' : 'de moins')

  const parFaits = plusProche(l.faits, BORNES_DES_HYPOTHÈSES.faitsMax, (faits) => sous({ faits }))
  if (parFaits) {
    bascules.push({ levier: 'faits', ...parFaits, phrase: `${pluriel(Math.abs(parFaits.écart), 'fait')} ${sens(parFaits.écart)} : ${LIBELLÉS_DE_VERDICT[parFaits.verdict]}` })
  }

  if (l.présents === null) {
    const verdict = sous({ concurrents: 0 })
    if (verdict !== actuelle.verdict) bascules.push({ levier: 'mesure', écart: null, verdict, phrase: `Concurrence mesurée, sans concurrent présent : ${LIBELLÉS_DE_VERDICT[verdict]}` })
  } else {
    const parConcurrents = plusProche(l.présents.length, BORNES_DES_HYPOTHÈSES.concurrentsMax, (concurrents) => sous({ concurrents }))
    if (parConcurrents) {
      bascules.push({
        levier: 'concurrents',
        ...parConcurrents,
        phrase: `${pluriel(Math.abs(parConcurrents.écart), 'concurrent')} ${sens(parConcurrents.écart)} : ${LIBELLÉS_DE_VERDICT[parConcurrents.verdict]}`,
      })
    }
  }

  if (actuelle.retenu) {
    const verdict = lectureDuSegment(l).verdict
    bascules.push({ levier: 'potentiel', écart: null, verdict, phrase: `Potentiel à ${POUR_CENT_MARGINAL} % de l’arbre ou plus : ${LIBELLÉS_DE_VERDICT[verdict]}` })
  }
  return bascules
}
