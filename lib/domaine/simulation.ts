import type { VerdictDeSegment } from '@/lib/domaine/marches-decision'
import type { ForcePorter, Grille, Pestel, Refus, Veille } from '@/lib/domaine/strategie'

/**
 * Le simulateur de scénarios (16 novembre 2026, lot 3b des simulations) : une
 * année jouée en quatre trimestres depuis l'état mesuré du marché du client.
 * Le dirigeant choisit ses actions, le jeu tire des cartes dont la fréquence
 * vient de sa veille, et chaque mouvement de pilier cite la ligne qui l'a causé.
 *
 * Tout est pur ici, et ce fichier n'importe que des types : le composant client
 * de l'écran le charge seul. Trois règles tiennent le reste :
 *   - le jeu n'invente aucun fait : une carte est une catégorie de faits de la
 *     veille, sa fréquence est comptée, son dernier fait est cité ;
 *   - les effets sont des hypothèses écrites, la **table d'effets**, bornée,
 *     contrôlée par `contrôlerLaTableDEffets`, relue et publiée par l'opératrice ;
 *   - rien n'est une prévision : même graine et mêmes actions donnent la même
 *     partie, et la comparaison rend des fourchettes, jamais une moyenne seule.
 */

export const PILIERS = ['marche', 'concurrence', 'environnement', 'alliances'] as const
export type Pilier = (typeof PILIERS)[number]
export const LIBELLÉS_DE_PILIER: Readonly<Record<Pilier, string>> = {
  marche: 'Marché',
  concurrence: 'Concurrence',
  environnement: 'Environnement',
  alliances: 'Alliances',
}

export const GESTES = ['investir', 'tester', 'retirer', 'allier', 'option'] as const
export type Geste = (typeof GESTES)[number]
export const LIBELLÉS_DE_GESTE: Readonly<Record<Geste, string>> = {
  investir: 'investir',
  tester: 'tester',
  retirer: 'se retirer',
  allier: 's’allier',
  option: 'option stratégique',
}

/** Le niveau d'engagement du client sur un segment, de 0 à 3. */
export const ENGAGEMENTS = ['absent', 'en test', 'offre établie', 'offre de référence'] as const

export const BORNES_DE_SIMULATION = {
  effetMax: 10,
  coûtMax: 3,
  actionsMax: 40,
  cartesMax: 20,
  engagementsMax: 30,
  libelléMax: 60,
  référenceMax: 120,
  concurrentsMax: 40,
  /** Une année en quatre trimestres. */
  tours: 4,
  budgetParTour: 6,
  actionsParTour: 4,
  cartesParTour: 3,
  /** Sous douze semaines d'historique, aucune carte n'entre dans le tirage (décision du 16 novembre 2026). */
  historiqueMin: 12,
} as const

export type Effets = Partial<Record<Pilier, number>>

/** Une condition au plus par ligne, sur un état que le jeu connaît. */
export type Condition = {
  readonly sur: 'engagement' | 'concurrents' | 'pilier'
  /** Pour `engagement` et `concurrents` : la clé du segment. */
  readonly segment?: string | null
  /** Pour `pilier`. */
  readonly pilier?: Pilier | null
  readonly comparaison: 'au-moins' | 'au-plus'
  readonly valeur: number
}

type Ligne = {
  readonly clé: string
  readonly libellé: string
  readonly effets: Effets
  readonly condition?: Condition | null
  /** Les effets qui remplacent `effets` quand la condition est vraie. */
  readonly effetsSousCondition?: Effets | null
  /** Le fait daté ou la ligne du référentiel dont l'hypothèse vient. */
  readonly référence: string
}

export type LigneDAction = Ligne & {
  readonly geste: Geste
  /** Pour investir, tester, se retirer : la clé du segment de l'arbre. */
  readonly segment?: string | null
  /** Pour s'allier : le nom d'une partie prenante de la grille. */
  readonly partiePrenante?: string | null
  /** En points de budget, de 1 à 3. */
  readonly coût: number
}

export type LigneDeCarte = Ligne & {
  /** La famille de la grille dont les faits font la fréquence de la carte ; absente pour la carte « rupture ». */
  readonly famille?: number | null
  readonly veille?: Veille | null
  /** Restreint la catégorie aux faits de la famille qui portent ce cadre. */
  readonly cadre?: Pestel | ForcePorter | null
  /** La carte rare : tous les faits marqués en rupture, quelle que soit leur famille. */
  readonly rupture?: boolean | null
}

export type EngagementDeDépart = {
  readonly segment: string
  readonly cran: number
  /** La ligne de la fiche de veille ou du référentiel d'où il est déduit : « fiche, niches ». */
  readonly référence: string
}

export type TableDEffets = {
  readonly engagements: readonly EngagementDeDépart[]
  readonly actions: readonly LigneDAction[]
  readonly cartes: readonly LigneDeCarte[]
}

// ── La porte de la table d'effets ────────────────────────────────────────────

const PESTEL_CONNUES = ['politique', 'economique', 'socioculturel', 'technologique', 'ecologique', 'legal']
const FORCES_CONNUES = ['rivalite', 'nouveaux_entrants', 'substituts', 'pouvoir_clients', 'pouvoir_fournisseurs']
const VEILLES_CONNUES = ['ecosysteme', 'concurrentiel']
const normaliser = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export type ContexteDeLaTable = {
  /** Les clés des segments de l'arbre des marchés en vigueur. */
  readonly segments: readonly string[]
  readonly grille: Pick<Grille, 'familles' | 'partiesPrenantes'>
}

/**
 * La porte de la table d'effets : elle vérifie que la table est bien formée et
 * ne nomme que ce que le portail connaît (segments de l'arbre, familles et
 * parties prenantes de la grille, piliers). Elle ne juge pas la justesse d'un
 * effet : c'est une hypothèse, que seule la relecture peut discuter.
 */
export function contrôlerLaTableDEffets(table: TableDEffets, contexte: ContexteDeLaTable): readonly Refus[] {
  const refus: Refus[] = []
  const B = BORNES_DE_SIMULATION
  const refuser = (code: string, message: string, cible: string) => refus.push({ code, message, cible })
  const segments = new Set(contexte.segments)
  const parties = new Set(contexte.grille.partiesPrenantes.map((p) => normaliser(p.nom)))

  if (table.actions.length < 1 || table.actions.length > B.actionsMax) refuser('table-hors-bornes', `${table.actions.length} action(s) : 1 à ${B.actionsMax}`, 'actions')
  if (table.cartes.length < 1 || table.cartes.length > B.cartesMax) refuser('table-hors-bornes', `${table.cartes.length} carte(s) : 1 à ${B.cartesMax}`, 'cartes')
  if (table.engagements.length > B.engagementsMax) refuser('table-hors-bornes', `${table.engagements.length} engagements : ${B.engagementsMax} au plus`, 'engagements')

  const effets = (e: Effets | null | undefined, cible: string, exigé: boolean) => {
    const entrées = Object.entries(e ?? {})
    for (const [pilier, valeur] of entrées) {
      if (!(PILIERS as readonly string[]).includes(pilier)) refuser('pilier-inconnu', `pilier « ${pilier} » : attendu ${PILIERS.join(', ')}`, cible)
      else if (!Number.isInteger(valeur) || Math.abs(valeur as number) > B.effetMax) refuser('effet-hors-bornes', `effet ${String(valeur)} sur ${pilier} : un entier de −${B.effetMax} à +${B.effetMax}`, cible)
    }
    if (exigé && !entrées.some(([, v]) => v !== 0)) refuser('effet-hors-bornes', 'la ligne ne bouge aucun pilier', cible)
  }
  const condition = (c: Condition | null | undefined, sous: Effets | null | undefined, cible: string) => {
    if (c == null) {
      if (sous != null) refuser('condition-inconnue', 'des effets sous condition sans condition', cible)
      return
    }
    if (c.comparaison !== 'au-moins' && c.comparaison !== 'au-plus') refuser('condition-inconnue', `comparaison « ${String(c.comparaison)} » : au-moins ou au-plus`, cible)
    const entier = (max: number) => Number.isInteger(c.valeur) && c.valeur >= 0 && c.valeur <= max
    if (c.sur === 'engagement' || c.sur === 'concurrents') {
      if (!c.segment || !segments.has(c.segment)) refuser('segment-inconnu', `la condition porte sur le segment « ${String(c.segment)} », absent de l’arbre`, cible)
      if (!entier(c.sur === 'engagement' ? 3 : B.concurrentsMax)) refuser('condition-inconnue', `valeur ${String(c.valeur)} hors bornes pour « ${c.sur} »`, cible)
    } else if (c.sur === 'pilier') {
      if (!c.pilier || !(PILIERS as readonly string[]).includes(c.pilier)) refuser('pilier-inconnu', `la condition porte sur le pilier « ${String(c.pilier)} »`, cible)
      if (!entier(100)) refuser('condition-inconnue', `valeur ${String(c.valeur)} hors de 0 à 100`, cible)
    } else {
      refuser('condition-inconnue', `la condition porte sur « ${String((c as { sur?: unknown }).sur)} » : engagement, concurrents ou pilier`, cible)
    }
    if (sous == null) refuser('condition-inconnue', 'une condition sans effets sous condition', cible)
    else effets(sous, cible, false)
  }
  const commune = (l: Ligne, cible: string, clés: Set<string>) => {
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(l.clé) || l.clé.length > 40) refuser('clé-invalide', `clé « ${l.clé} » : minuscules, chiffres, tirets, 40 caractères au plus`, cible)
    if (clés.has(l.clé)) refuser('doublon', `la clé « ${l.clé} » est portée par deux lignes`, cible)
    clés.add(l.clé)
    if (l.libellé.trim().length === 0 || l.libellé.length > B.libelléMax) refuser('longueur', `libellé vide ou de plus de ${B.libelléMax} caractères`, cible)
    if (l.référence.trim().length === 0 || l.référence.length > B.référenceMax) refuser('référence-manquante', `chaque ligne cite un fait daté ou une ligne du référentiel, ${B.référenceMax} caractères au plus`, cible)
    effets(l.effets, cible, true)
    condition(l.condition, l.effetsSousCondition, cible)
  }

  const clésDActions = new Set<string>()
  table.actions.forEach((a, i) => {
    const cible = `action ${i + 1}`
    commune(a, cible, clésDActions)
    if (!(GESTES as readonly string[]).includes(a.geste)) refuser('geste-inconnu', `geste « ${String(a.geste)} » : attendu ${GESTES.join(', ')}`, cible)
    if (!Number.isInteger(a.coût) || a.coût < 1 || a.coût > B.coûtMax) refuser('coût-hors-bornes', `coût ${String(a.coût)} : un entier de 1 à ${B.coûtMax}`, cible)
    if (a.geste === 'investir' || a.geste === 'tester' || a.geste === 'retirer') {
      if (!a.segment || !segments.has(a.segment)) refuser('segment-inconnu', `le segment « ${String(a.segment)} » n’est pas dans l’arbre des marchés`, cible)
    }
    if (a.geste === 'allier' && (!a.partiePrenante || !parties.has(normaliser(a.partiePrenante)))) {
      refuser('partie-prenante-inconnue', `« ${String(a.partiePrenante)} » ne figure pas parmi les parties prenantes de la grille`, cible)
    }
  })

  const clésDeCartes = new Set<string>()
  table.cartes.forEach((c, i) => {
    const cible = `carte ${i + 1}`
    commune(c, cible, clésDeCartes)
    if (c.cadre != null && !PESTEL_CONNUES.includes(c.cadre) && !FORCES_CONNUES.includes(c.cadre)) refuser('étiquette-inconnue', `cadre « ${String(c.cadre)} » : une dimension PESTEL ou une force de Porter`, cible)
    if (c.veille != null && !VEILLES_CONNUES.includes(c.veille)) refuser('étiquette-inconnue', `veille « ${String(c.veille)} » inconnue`, cible)
    if (c.rupture === true) {
      if (c.famille != null) refuser('carte-mal-formée', 'la carte « rupture » ne porte pas de famille : elle compte toutes les ruptures', cible)
      return
    }
    if (c.famille == null) return void refuser('carte-mal-formée', 'une carte porte une famille de la grille, ou `rupture: true`', cible)
    const candidates = contexte.grille.familles.filter((f) => f.numéro === c.famille && (c.veille == null || f.veille === c.veille))
    if (candidates.length === 0) refuser('famille-inconnue', `la carte renvoie à la famille ${c.famille}${c.veille ? ` de la veille ${c.veille}` : ''}, absente de la grille`, cible)
    else if (candidates.length > 1) refuser('famille-ambiguë', `la grille porte deux familles ${c.famille} : la carte précise sa veille`, cible)
  })

  const engagés = new Set<string>()
  table.engagements.forEach((e, i) => {
    const cible = `engagement ${i + 1}`
    if (!segments.has(e.segment)) refuser('segment-inconnu', `le segment « ${e.segment} » n’est pas dans l’arbre des marchés`, cible)
    if (engagés.has(e.segment)) refuser('doublon', `deux engagements pour le segment « ${e.segment} »`, cible)
    engagés.add(e.segment)
    if (!Number.isInteger(e.cran) || e.cran < 0 || e.cran > 3) refuser('cran-hors-bornes', `engagement ${String(e.cran)} : un entier de 0 à 3`, cible)
    if (e.référence.trim().length === 0 || e.référence.length > B.référenceMax) refuser('référence-manquante', 'chaque engagement cite la ligne dont il est déduit', cible)
  })
  return refus
}

// ── L'état de départ ─────────────────────────────────────────────────────────

/** Un segment de l'arbre tel que le jeu le lit : son verdict et sa concurrence, mesurés et publiés. */
export type SegmentDeJeu = {
  readonly clé: string
  readonly libellé: string
  /** Le verdict de la matrice « Où porter l'effort » ; `null` sans mesure publiée. */
  readonly verdict: VerdictDeSegment | null
  readonly concurrents: number | null
}

/** Ce que la veille a compté pour une carte : des comptes et le dernier fait, jamais un texte de lettre. */
export type ObservationDeCarte = {
  readonly clé: string
  /** Le nombre de semaines où la veille a relevé au moins un fait de la catégorie. */
  readonly semaines: number
  readonly faits: number
  readonly dernier: { readonly date: string; readonly source: string; readonly édition: string } | null
}

export type DonnéeDeSimulation = {
  readonly segments: readonly SegmentDeJeu[]
  readonly table: TableDEffets
  readonly observations: readonly ObservationDeCarte[]
  /** Le nombre de semaines d'historique de faits étiquetés. */
  readonly historique: number
  readonly départ: PiliersDeDépart
}

export type Piliers = Readonly<Record<Pilier, number>>
export type PiliersDeDépart = { readonly valeurs: Piliers; readonly bases: Readonly<Record<Pilier, string>> }

const borner = (x: number) => Math.max(0, Math.min(100, Math.round(x)))

/** La part de l'effort (les crans d'engagement) portée sur des segments « à pousser » ou « à disputer ». */
export function partDeLEffort(segments: readonly SegmentDeJeu[], engagements: Readonly<Record<string, number>>): number {
  let total = 0
  let porteurs = 0
  for (const s of segments) {
    const cran = engagements[s.clé] ?? 0
    total += cran
    if (s.verdict === 'pousser' || s.verdict === 'disputer') porteurs += cran
  }
  return total === 0 ? 0 : borner((100 * porteurs) / total)
}

/**
 * Les quatre piliers au premier tour, lus dans ce qui est mesuré et publié.
 * Aucun ne lit la santé financière du client : la veille ne la connaît pas.
 * Chaque valeur dit sa base, que l'écran affiche.
 */
export function piliersDeDépart(entrée: {
  readonly segments: readonly SegmentDeJeu[]
  readonly engagements: readonly EngagementDeDépart[]
  /** Les crans (1 à 3) des forces rivalité et nouveaux entrants du dernier trimestre publié. */
  readonly forces: readonly { readonly force: string; readonly cran: number }[]
  /** Les dimensions PESTEL où la veille a relevé au moins un fait FORT sur l'historique. */
  readonly dimensionsExposées: readonly string[]
}): PiliersDeDépart {
  const engagements = Object.fromEntries(entrée.engagements.map((e) => [e.segment, e.cran]))
  const engagés = entrée.engagements.filter((e) => e.cran > 0).length
  const forces = entrée.forces.filter((f) => (f.force === 'rivalite' || f.force === 'nouveaux_entrants') && f.cran >= 1 && f.cran <= 3)
  const exposées = new Set(entrée.dimensionsExposées).size
  return {
    valeurs: {
      marche: partDeLEffort(entrée.segments, engagements),
      concurrence: forces.length === 0 ? 50 : borner(100 - (forces.reduce((n, f) => n + (f.cran - 1) * 50, 0) / forces.length)),
      environnement: borner((100 * (6 - Math.min(6, exposées))) / 6),
      alliances: 50,
    },
    bases: {
      marche: engagés === 0 ? 'aucun engagement établi sur un segment' : `part de l’effort sur les segments à pousser ou à disputer, ${engagés} segment${engagés > 1 ? 's' : ''} engagé${engagés > 1 ? 's' : ''}`,
      concurrence: forces.length === 0 ? 'forces non mesurées : point de départ neutre' : `intensité de la rivalité et des nouveaux entrants, ${forces.length} force${forces.length > 1 ? 's' : ''} lue${forces.length > 1 ? 's' : ''}`,
      environnement: `${exposées} dimension${exposées > 1 ? 's' : ''} PESTEL sur 6 avec un fait fort`,
      alliances: 'point de départ neutre : la veille ne dit pas qui est de votre côté',
    },
  }
}

// ── Le tirage ────────────────────────────────────────────────────────────────

/** Le générateur à graine du jeu du domaine : la même graine rejoue la même partie. */
function mulberry(a: number): [number, number] {
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [a, ((t ^ (t >>> 14)) >>> 0) / 4294967296]
}

export type CarteDuTirage = {
  readonly carte: LigneDeCarte
  readonly observation: ObservationDeCarte | null
  /** Le poids de la carte : la part des semaines où la veille a vu sa catégorie. */
  readonly poids: number
  /** Sa part du tirage, de 0 à 1 ; 0 hors du tirage. */
  readonly part: number
  /** Pourquoi la carte reste hors du tirage, sinon `null`. */
  readonly écartée: 'historique-court' | 'jamais-observée' | null
}

/** Les cartes de la table, avec leur poids compté dans la veille ; l'écran affiche cette base. */
export function cartesDuTirage(donnée: Pick<DonnéeDeSimulation, 'table' | 'observations' | 'historique'>): readonly CarteDuTirage[] {
  const parClé = new Map(donnée.observations.map((o) => [o.clé, o]))
  const court = donnée.historique < BORNES_DE_SIMULATION.historiqueMin
  const brutes = donnée.table.cartes.map((carte) => {
    const observation = parClé.get(carte.clé) ?? null
    const semaines = observation?.semaines ?? 0
    const écartée = court ? ('historique-court' as const) : semaines === 0 ? ('jamais-observée' as const) : null
    return { carte, observation, poids: écartée || donnée.historique === 0 ? 0 : Math.min(1, semaines / donnée.historique), écartée }
  })
  const total = brutes.reduce((n, c) => n + c.poids, 0)
  return brutes.map((c) => ({ ...c, part: total === 0 ? 0 : c.poids / total }))
}

/**
 * Les cartes d'un trimestre : une à trois, tirées sans remise selon leur poids.
 * Le tirage ne dépend que de la graine et du tour, jamais de l'état : deux
 * stratégies jouées sur la même graine subissent les mêmes aléas.
 */
export function tirerLesCartes(cartes: readonly CarteDuTirage[], graine: number, tour: number): readonly CarteDuTirage[] {
  let rng = (Math.imul(graine | 0, 0x9e3779b1) + Math.imul(tour + 1, 0x85ebca6b)) | 0
  const suivant = () => {
    const [état, x] = mulberry(rng)
    rng = état
    return x
  }
  const reste = cartes.filter((c) => c.poids > 0)
  if (reste.length === 0) return []
  const combien = Math.min(reste.length, 1 + Math.floor(suivant() * BORNES_DE_SIMULATION.cartesParTour))
  const tirées: CarteDuTirage[] = []
  for (let i = 0; i < combien; i++) {
    const total = reste.reduce((n, c) => n + c.poids, 0)
    let t = suivant() * total
    let rang = reste.findIndex((c) => (t -= c.poids) < 0)
    if (rang < 0) rang = reste.length - 1
    tirées.push(...reste.splice(rang, 1))
  }
  return tirées
}

// ── Le tour ──────────────────────────────────────────────────────────────────

export type ÉtatDeJeu = {
  /** Le nombre de trimestres joués, de 0 à 4. */
  readonly tour: number
  readonly piliers: Piliers
  /** Le cran d'engagement de chaque segment en jeu. */
  readonly engagements: Readonly<Record<string, number>>
  /** Les parties prenantes avec qui une alliance est nouée. */
  readonly alliances: readonly string[]
}

export type Mouvement = {
  readonly pilier: Pilier
  /** Le mouvement appliqué, bornes de 0 à 100 comprises. */
  readonly delta: number
  readonly cause: 'action' | 'carte' | 'effort'
  /** La clé et le libellé de la ligne de la table qui a joué ; pour `effort`, la réallocation des engagements. */
  readonly clé: string
  readonly libellé: string
  /** `true` quand la condition de la ligne était vraie : ses effets sous condition ont joué. */
  readonly sousCondition: boolean
}

export type BilanDeTour = {
  readonly tour: number
  readonly jouées: readonly string[]
  /** Les actions demandées que le jeu n'a pas pu jouer, et pourquoi. */
  readonly écartées: readonly { readonly clé: string; readonly raison: string }[]
  readonly cartes: readonly CarteDuTirage[]
  readonly mouvements: readonly Mouvement[]
  readonly avant: Piliers
  readonly après: Piliers
  readonly budgetDépensé: number
}

export function étatDeDépart(donnée: DonnéeDeSimulation): ÉtatDeJeu {
  return { tour: 0, piliers: donnée.départ.valeurs, engagements: Object.fromEntries(donnée.table.engagements.map((e) => [e.segment, e.cran])), alliances: [] }
}

/** Pourquoi une action ne peut pas être jouée dans cet état ; `null` si elle peut l'être. */
export function refusDeLAction(action: LigneDAction, état: Pick<ÉtatDeJeu, 'engagements' | 'alliances'>): string | null {
  if (action.geste === 'investir' || action.geste === 'tester' || action.geste === 'retirer') {
    const cran = action.segment ? état.engagements[action.segment] : undefined
    if (cran === undefined) return 'segment hors du jeu : rien n’établit votre engagement de départ'
    if (action.geste === 'tester' && cran !== 0) return 'déjà engagé sur ce segment'
    if (action.geste === 'investir' && cran === 0) return 'tester d’abord ce segment'
    if (action.geste === 'investir' && cran >= 3) return 'déjà offre de référence'
    if (action.geste === 'retirer' && cran === 0) return 'aucun engagement à retirer'
  }
  if (action.geste === 'allier' && action.partiePrenante && état.alliances.includes(action.partiePrenante)) return 'alliance déjà nouée'
  return null
}

function conditionVraie(c: Condition, état: ÉtatDeJeu, segments: ReadonlyMap<string, SegmentDeJeu>): boolean {
  const valeur =
    c.sur === 'engagement' ? (état.engagements[c.segment ?? ''] ?? 0) : c.sur === 'concurrents' ? (segments.get(c.segment ?? '')?.concurrents ?? null) : état.piliers[c.pilier ?? 'marche']
  // Une concurrence non mesurée ne rend jamais une condition vraie : rien n'est deviné.
  if (valeur === null) return false
  return c.comparaison === 'au-moins' ? valeur >= c.valeur : valeur <= c.valeur
}

/**
 * Un trimestre : les actions choisies, dans leur ordre et dans la limite du
 * budget, puis les cartes tirées, puis la part de l'effort recalculée. Chaque
 * mouvement de pilier porte la ligne qui l'a causé. Une action impossible est
 * écartée et dite, jamais jouée à moitié.
 */
export function jouerUnTour(donnée: DonnéeDeSimulation, état: ÉtatDeJeu, actions: readonly string[], graine: number): { readonly état: ÉtatDeJeu; readonly bilan: BilanDeTour } {
  const B = BORNES_DE_SIMULATION
  const parClé = new Map(donnée.table.actions.map((a) => [a.clé, a]))
  const segments = new Map(donnée.segments.map((s) => [s.clé, s]))
  let courant: ÉtatDeJeu = état
  const mouvements: Mouvement[] = []
  const jouées: string[] = []
  const écartées: { clé: string; raison: string }[] = []
  let budget = 0

  const appliquer = (ligne: Ligne, cause: 'action' | 'carte') => {
    const sousCondition = ligne.condition != null && conditionVraie(ligne.condition, courant, segments)
    const effets = sousCondition ? (ligne.effetsSousCondition ?? {}) : ligne.effets
    const piliers = { ...courant.piliers }
    for (const pilier of PILIERS) {
      const voulu = effets[pilier] ?? 0
      if (voulu === 0) continue
      const après = borner(piliers[pilier] + voulu)
      mouvements.push({ pilier, delta: après - piliers[pilier], cause, clé: ligne.clé, libellé: ligne.libellé, sousCondition })
      piliers[pilier] = après
    }
    courant = { ...courant, piliers }
  }

  for (const clé of actions) {
    const action = parClé.get(clé)
    if (!action) {
      écartées.push({ clé, raison: 'action absente de la table' })
      continue
    }
    if (jouées.includes(clé)) {
      écartées.push({ clé, raison: 'déjà jouée ce trimestre' })
      continue
    }
    if (jouées.length >= B.actionsParTour) {
      écartées.push({ clé, raison: `${B.actionsParTour} actions au plus par trimestre` })
      continue
    }
    if (budget + action.coût > B.budgetParTour) {
      écartées.push({ clé, raison: 'budget du trimestre dépassé' })
      continue
    }
    const refus = refusDeLAction(action, courant)
    if (refus) {
      écartées.push({ clé, raison: refus })
      continue
    }
    const partAvant = partDeLEffort(donnée.segments, courant.engagements)
    appliquer(action, 'action')
    budget += action.coût
    jouées.push(clé)
    if (action.segment && (action.geste === 'investir' || action.geste === 'tester' || action.geste === 'retirer')) {
      const cran = courant.engagements[action.segment] ?? 0
      const suivant = action.geste === 'retirer' ? 0 : Math.min(3, cran + 1)
      courant = { ...courant, engagements: { ...courant.engagements, [action.segment]: suivant } }
      // La part de l'effort suit la réallocation : le pilier Marché bouge d'autant, et le bilan le dit.
      const écart = partDeLEffort(donnée.segments, courant.engagements) - partAvant
      if (écart !== 0) {
        const après = borner(courant.piliers.marche + écart)
        const libellé = `Effort déplacé : ${segments.get(action.segment)?.libellé ?? action.segment}, ${ENGAGEMENTS[suivant]}`
        mouvements.push({ pilier: 'marche', delta: après - courant.piliers.marche, cause: 'effort', clé: action.clé, libellé, sousCondition: false })
        courant = { ...courant, piliers: { ...courant.piliers, marche: après } }
      }
    }
    if (action.geste === 'allier' && action.partiePrenante) courant = { ...courant, alliances: [...courant.alliances, action.partiePrenante] }
  }

  const cartes = tirerLesCartes(cartesDuTirage(donnée), graine, état.tour)
  for (const c of cartes) appliquer(c.carte, 'carte')

  courant = { ...courant, tour: état.tour + 1 }
  return { état: courant, bilan: { tour: état.tour + 1, jouées, écartées, cartes, mouvements, avant: état.piliers, après: courant.piliers, budgetDépensé: budget } }
}

/** L'effet attendu des actions choisies, sans événement : ce que le dirigeant voit avant de jouer. */
export function prévisionDuTour(donnée: DonnéeDeSimulation, état: ÉtatDeJeu, actions: readonly string[]): Pick<BilanDeTour, 'jouées' | 'écartées' | 'mouvements' | 'après' | 'budgetDépensé'> {
  const sansCarte = { ...donnée, observations: [] }
  const { bilan } = jouerUnTour(sansCarte, état, actions, 0)
  return { jouées: bilan.jouées, écartées: bilan.écartées, mouvements: bilan.mouvements, après: bilan.après, budgetDépensé: bilan.budgetDépensé }
}

export type Partie = { readonly graine: number; readonly tours: readonly (readonly string[])[] }

/** Rejoue une partie depuis le départ : même graine et mêmes actions, même résultat. */
export function jouerLaPartie(donnée: DonnéeDeSimulation, partie: Partie): { readonly état: ÉtatDeJeu; readonly bilans: readonly BilanDeTour[] } {
  let état = étatDeDépart(donnée)
  const bilans: BilanDeTour[] = []
  for (const actions of partie.tours.slice(0, BORNES_DE_SIMULATION.tours)) {
    const r = jouerUnTour(donnée, état, actions, partie.graine)
    état = r.état
    bilans.push(r.bilan)
  }
  return { état, bilans }
}

// ── Comparer deux stratégies ─────────────────────────────────────────────────

export type Fourchette = { readonly min: number; readonly bas: number; readonly médiane: number; readonly haut: number; readonly max: number }
export type RésultatDeStratégie = Readonly<Record<Pilier, Fourchette>>

/**
 * Deux stratégies (deux suites d'actions sur l'année) jouées sur les mêmes
 * graines. Le résultat est une répartition par pilier : minimum, premier
 * décile, médiane, neuvième décile, maximum. Jamais une moyenne seule.
 */
export function comparerDeuxStratégies(
  donnée: DonnéeDeSimulation,
  a: readonly (readonly string[])[],
  b: readonly (readonly string[])[],
  parties: number = 1000,
  premièreGraine: number = 1,
): { readonly parties: number; readonly a: RésultatDeStratégie; readonly b: RésultatDeStratégie } {
  const compléter = (tours: readonly (readonly string[])[]) => Array.from({ length: BORNES_DE_SIMULATION.tours }, (_, i) => tours[i] ?? [])
  const jouer = (tours: readonly (readonly string[])[]): RésultatDeStratégie => {
    const finales: Record<Pilier, number[]> = { marche: [], concurrence: [], environnement: [], alliances: [] }
    for (let i = 0; i < parties; i++) {
      const { état } = jouerLaPartie(donnée, { graine: premièreGraine + i, tours: compléter(tours) })
      for (const p of PILIERS) finales[p].push(état.piliers[p])
    }
    const fourchette = (valeurs: number[]): Fourchette => {
      const t = [...valeurs].sort((x, y) => x - y)
      const à = (q: number) => t[Math.min(t.length - 1, Math.floor(q * (t.length - 1)))] ?? 0
      return { min: t[0] ?? 0, bas: à(0.1), médiane: à(0.5), haut: à(0.9), max: t[t.length - 1] ?? 0 }
    }
    return { marche: fourchette(finales.marche), concurrence: fourchette(finales.concurrence), environnement: fourchette(finales.environnement), alliances: fourchette(finales.alliances) }
  }
  return { parties, a: jouer(a), b: jouer(b) }
}

// ── La partie dans l'adresse ─────────────────────────────────────────────────

/**
 * Une partie tient dans l'adresse (`?p=4821;0.3;1;;2`) : la graine, puis pour
 * chaque trimestre le rang de ses actions dans la table. Rien n'est stocké.
 */
export function écrireLaPartie(partie: Partie, table: Pick<TableDEffets, 'actions'>): string {
  const rang = new Map(table.actions.map((a, i) => [a.clé, i]))
  const tours = partie.tours.map((t) => t.flatMap((clé) => (rang.has(clé) ? [String(rang.get(clé))] : [])).join('.'))
  return [String(partie.graine >>> 0), ...tours].join(';')
}

/** Lit une partie de l'adresse ; tout ce qui n'est pas reconnu est ignoré, jamais interprété. */
export function lireLaPartie(texte: string | null | undefined, table: Pick<TableDEffets, 'actions'>): Partie | null {
  if (!texte || texte.length > 400) return null
  const [graine, ...tours] = texte.split(';')
  if (!graine || !/^\d{1,10}$/.test(graine)) return null
  return {
    graine: Number(graine) >>> 0,
    tours: tours.slice(0, BORNES_DE_SIMULATION.tours).map((t) =>
      t
        .split('.')
        .filter((x) => /^\d{1,2}$/.test(x))
        .flatMap((x) => {
          const action = table.actions[Number(x)]
          return action ? [action.clé] : []
        })
        .slice(0, BORNES_DE_SIMULATION.actionsParTour),
    ),
  }
}
