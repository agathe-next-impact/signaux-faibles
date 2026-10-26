/**
 * Les outils stratégiques : listes fermées, et les trois portes qui contrôlent
 * ce qu'une tâche propose avant que le portail l'enregistre (plan du
 * 26 octobre 2026, `docs/plan-outils-strategiques.md`).
 *
 *   · `contrôlerLesÉtiquettes` : chaque semaine, les étiquettes des faits d'une
 *     lettre (PESTEL ou force de Porter, mouvement d'Ansoff, rupture) ;
 *   · `contrôlerLaGrille` : la grille de l'organisation (axes des groupes
 *     stratégiques, parties prenantes, familles) ;
 *   · `contrôlerLaSynthèse` : chaque mois et chaque trimestre, PESTEL, SWOT,
 *     TOWS, positions en crans, scénarios.
 *
 * Ce module est pur : il ne lit ni Notion ni Postgres. Il reçoit ce qu'il doit
 * contrôler et ce contre quoi le contrôler, et rend des refus nommés. Il ne
 * juge pas le sens : qu'un énoncé resterait vrai pour un concurrent ne se
 * mesure pas en code, c'est la relecture qui le dit. Il garantit ce que le code
 * peut garantir : rien sans fait daté, des crans bornés, aucun FAIBLE, et un
 * fait étiqueté qui existe vraiment dans la lettre, désigné sans en recopier
 * le texte.
 */
import { construireDocument, segmenterLesFaits, type Bloc, type Document } from '@/lib/domaine/document'
import { rangDImpact, type NiveauImpact } from '@/lib/domaine/impact'
import { sansAccent } from '@/lib/domaine/texte'

// ── Listes fermées ───────────────────────────────────────────────────────────

export const PESTEL = ['politique', 'economique', 'socioculturel', 'technologique', 'ecologique', 'legal'] as const
export type Pestel = (typeof PESTEL)[number]

export const FORCES_PORTER = ['rivalite', 'nouveaux_entrants', 'substituts', 'pouvoir_clients', 'pouvoir_fournisseurs'] as const
export type ForcePorter = (typeof FORCES_PORTER)[number]

export const ANSOFF = ['penetration', 'developpement_produit', 'developpement_marche', 'diversification'] as const
export type Ansoff = (typeof ANSOFF)[number]

/** Les forces où un fait nomme un concurrent, et donc son mouvement d'Ansoff. */
const FORCES_CONCURRENTES: readonly ForcePorter[] = ['rivalite', 'nouveaux_entrants']

export const SECTIONS = ['axe', 'acteurs'] as const
export type Section = (typeof SECTIONS)[number]

export const IMPACTS_DE_FAIT = ['FORT', 'MOYEN'] as const
export type ImpactDeFait = (typeof IMPACTS_DE_FAIT)[number]

export const NOUVEAUTÉS = ['nouveau', 'contexte'] as const
export type Nouveauté = (typeof NOUVEAUTÉS)[number]

export const CASES_SWOT = ['forces', 'faiblesses', 'opportunites', 'menaces'] as const
export type CaseSwot = (typeof CASES_SWOT)[number]
const CASES_INTERNES: readonly CaseSwot[] = ['forces', 'faiblesses']

export const ÉTATS_D_ÉLÉMENT = ['nouveau', 'renforce', 'inchange', 'affaibli'] as const
export type ÉtatDÉlément = (typeof ÉTATS_D_ÉLÉMENT)[number]

export const ORIGINES = ['faits', 'declaratif'] as const
export type Origine = (typeof ORIGINES)[number]

export const TYPES_TOWS = ['SO', 'ST', 'WO', 'WT'] as const
export type TypeTows = (typeof TYPES_TOWS)[number]

export const CADENCES = ['hebdomadaire', 'mensuelle'] as const
export type Cadence = (typeof CADENCES)[number]

export const VEILLES = ['ecosysteme', 'concurrentiel'] as const
export type Veille = (typeof VEILLES)[number]

export const OUTILS_DE_POSITION = ['groupes', 'mendelow', 'forces'] as const
export type OutilDePosition = (typeof OUTILS_DE_POSITION)[number]

/** Mendelow : pouvoir et intérêt en trois crans. Jamais « faible » ni « fort », réservés à l'impact. */
export const CRANS_MENDELOW = ['bas', 'intermediaire', 'eleve'] as const
/** Cinq forces : intensité en trois crans, et `non_suivi` quand aucune famille ne porte la force. */
export const CRANS_DES_FORCES = ['contenue', 'marquee', 'intense'] as const
export const TENDANCES = ['hausse', 'stable', 'baisse'] as const
export type Tendance = (typeof TENDANCES)[number]

export const BORNES = {
  axesDesGroupes: 2,
  cransMin: 3,
  cransMax: 5,
  libelléMax: 40,
  entitéMax: 120,
  entitésParVeilleMax: 40,
  partiesPrenantesMin: 8,
  partiesPrenantesMax: 15,
  partiePrenanteMax: 80,
  énoncéMax: 240,
  scénarioMax: 400,
  élémentsParCaseMin: 3,
  élémentsParCaseMax: 5,
  towsMin: 2,
  towsMax: 4,
  scénarios: 3,
  indicateursMin: 2,
  indicateursMax: 4,
} as const

// ── Refus ────────────────────────────────────────────────────────────────────

export type Refus = {
  readonly code: string
  readonly message: string
  /** Ce que le refus désigne : un fait (« axe 2, fait 1 »), un élément, une position. */
  readonly cible?: string
}

/** Ce que la route rend au modèle : la liste, dans le format des reprises du moteur. */
export function messageDeRefus(refus: readonly Refus[]): string {
  const lignes = refus.map((r) => `- [${r.code}]${r.cible ? ` ${r.cible} :` : ''} ${r.message}`)
  return (
    'LE LOT N’EST PAS ACCEPTÉ. Corrige chacun des points suivants et renvoie le lot complet, dans le même format. ' +
    'Ne change rien d’autre ; un élément que tu ne peux pas rattacher à un fait daté est retiré.\n' +
    lignes.join('\n')
  )
}

/** Les mots que la charte et le contrat de forme interdisent dans tout ce qui peut atteindre un client. */
const VOCABULAIRE_INTERDIT: ReadonlyArray<{ motif: RegExp; libellé: string }> = [
  { motif: /\bFAIBLE\b/, libellé: '« FAIBLE » (trois niveaux seulement : FORT, MOYEN, RAS)' },
  { motif: /\bréférentiel\b/i, libellé: '« référentiel »' },
  { motif: /§\s?\d/, libellé: 'une numérotation « § »' },
]

function vocabulaireInterdit(texte: string): string | null {
  return VOCABULAIRE_INTERDIT.find((v) => v.motif.test(texte))?.libellé ?? null
}

const estDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

// ── Empreintes ───────────────────────────────────────────────────────────────

/** Un titre ramené à ses mots : sans accent, sans ponctuation, espaces réduits. */
export function normaliserTitre(texte: string): string {
  return sansAccent(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Huit caractères hexadécimaux, FNV-1a sur 32 bits. Ce n'est pas un secret : il
 * sert à reconnaître une phrase-titre sans la conserver, et à comparer deux
 * grilles. Pur, sans dépendance au module cryptographique de Node, pour que le
 * domaine reste utilisable partout.
 */
export function empreinte(texte: string): string {
  let h = 0x811c9dc5
  for (const c of texte) {
    h ^= c.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export const empreinteDeTitre = (titre: string) => empreinte(normaliserTitre(titre))

// ── Les faits d'une lettre ───────────────────────────────────────────────────

/** Un fait tel que la porte le voit : où il est, son empreinte, ses URL. Jamais son texte au-delà de la porte. */
export type FaitDeLaLettre = {
  readonly section: Section
  readonly axe: number | null
  readonly niveauDeLAxe: NiveauImpact | null
  readonly rang: number
  readonly titre: string
  readonly empreinte: string
  readonly urls: readonly string[]
}

const cléDeFait = (section: Section, axe: number | null, rang: number) => `${section}:${axe ?? '-'}:${rang}`
const cibleDeFait = (section: Section, axe: number | null, rang: number) =>
  section === 'axe' ? `axe ${axe ?? '?'}, fait ${rang}` : `actualité des acteurs, fait ${rang}`

function urlsDesBlocs(blocs: readonly Bloc[]): string[] {
  const urls = new Set<string>()
  const ajouterDuTexte = (texte: string) => {
    for (const m of texte.matchAll(/https?:\/\/[^\s)\]>"']+/g)) urls.add(m[0].replace(/[.,;:]+$/, ''))
  }
  const parcourir = (segments: readonly { texte: string; lien: string | null }[]) => {
    for (const s of segments) {
      if (s.lien) urls.add(s.lien)
      ajouterDuTexte(s.texte)
    }
  }
  for (const bloc of blocs) {
    if (bloc.type === 'paragraphe' || bloc.type === 'citation' || bloc.type === 'titre' || bloc.type === 'encadré') parcourir(bloc.segments)
    else if (bloc.type === 'liste') for (const é of bloc.éléments) parcourir(é)
  }
  return [...urls]
}

/**
 * Une URL comparée sans son schéma, son « www. », sa barre finale ni ses
 * encodages. `decodeURIComponent` et non `decodeURI` : l'API Notion rend
 * `reference=2026%2F0138(COD)` là où la lettre et la tâche écrivent
 * `2026/0138%28COD%29` ou `2026/0138(COD)`, et `decodeURI` ne décode jamais
 * `%2F` (constaté le 26 octobre 2026 sur trois lettres d'Infralliance). La forme
 * décodée ne sert qu'à comparer, jamais à ouvrir.
 */
export function normaliserUrl(url: string): string {
  let u = url.trim()
  try {
    u = decodeURIComponent(u)
  } catch {
    try {
      u = decodeURI(u)
    } catch {
      // une URL mal encodée se compare telle quelle
    }
  }
  return u
    .replace(/^<|>$/g, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

/** La rubrique « L'actualité des acteurs » (« Actualité acteurs » chez L'Hermitage). */
function estRubriqueDActualitéDesActeurs(titre: string): boolean {
  const t = sansAccent(titre)
  return t.includes('actualite') && t.includes('acteurs')
}

/**
 * Les faits étiquetables d'une lettre : ceux des axes non RAS, et ceux de la
 * rubrique de l'actualité des acteurs. Jamais « L'essentiel », « Signaux de
 * rupture » ni l'analyse, qui reprennent des faits sans en apporter.
 */
export function faitsDeLaLettre(document: Document): FaitDeLaLettre[] {
  const faits: FaitDeLaLettre[] = []
  for (const rubrique of document.rubriques) {
    for (const axe of rubrique.axes) {
      if (axe.niveau === 'RAS') continue
      for (const f of segmenterLesFaits(axe.blocs)) {
        faits.push({ section: 'axe', axe: axe.numéro, niveauDeLAxe: axe.niveau, rang: f.rang, titre: f.titre, empreinte: empreinteDeTitre(f.titre), urls: urlsDesBlocs(f.blocs) })
      }
    }
    if (estRubriqueDActualitéDesActeurs(rubrique.titre)) {
      for (const f of segmenterLesFaits(rubrique.introduction)) {
        faits.push({ section: 'acteurs', axe: null, niveauDeLAxe: null, rang: f.rang, titre: f.titre, empreinte: empreinteDeTitre(f.titre), urls: urlsDesBlocs(f.blocs) })
      }
    }
  }
  return faits
}

// ── Porte des étiquettes ─────────────────────────────────────────────────────

/** Ce que la tâche propose pour un fait. Le titre est recopié tel qu'écrit dans la lettre, pour être vérifié puis jeté. */
export type ÉtiquetteProposée = {
  readonly section: Section
  readonly axe?: number | null
  readonly rang: number
  readonly titre: string
  readonly date: string
  readonly source: string
  readonly pestel?: Pestel | null
  readonly porter?: ForcePorter | null
  readonly ansoff?: Ansoff | null
  readonly entite?: string | null
  readonly rupture: boolean
  readonly impact: ImpactDeFait
  readonly nouveaute: Nouveauté
}

/** Ce que le portail enregistre : la place du fait et son empreinte, plus le texte. */
export type ÉtiquetteValidée = Omit<ÉtiquetteProposée, 'titre' | 'axe' | 'pestel' | 'porter' | 'ansoff' | 'entite'> & {
  readonly axe: number | null
  readonly empreinte: string
  readonly pestel: Pestel | null
  readonly porter: ForcePorter | null
  readonly ansoff: Ansoff | null
  readonly entite: string | null
}

export type ContrôleDesÉtiquettes = {
  readonly acceptées: readonly ÉtiquetteValidée[]
  readonly refus: readonly Refus[]
  readonly faits: number
}

const dans = <T extends string>(liste: readonly T[], valeur: unknown): valeur is T => typeof valeur === 'string' && (liste as readonly string[]).includes(valeur)

export function contrôlerLesÉtiquettes(entrée: {
  readonly blocs: Parameters<typeof construireDocument>[0]
  readonly dateÉdition: string
  readonly lot: readonly ÉtiquetteProposée[]
  /** Les entités de la grille, quand elle existe : une entité nommée hors grille est refusée. */
  readonly entités?: readonly string[] | null
}): ContrôleDesÉtiquettes {
  const faits = faitsDeLaLettre(construireDocument(entrée.blocs))
  const parClé = new Map(faits.map((f) => [cléDeFait(f.section, f.axe, f.rang), f]))
  const entités = entrée.entités ? new Set(entrée.entités.map(normaliserTitre)) : null
  const refus: Refus[] = []
  const acceptées: ÉtiquetteValidée[] = []
  const vues = new Set<string>()

  for (const é of entrée.lot) {
    const axe = é.section === 'axe' ? (é.axe ?? null) : null
    const cible = cibleDeFait(é.section, axe, é.rang)
    const avant = refus.length
    const refuser = (code: string, message: string) => refus.push({ code, message, cible })

    if (!dans(SECTIONS, é.section)) {
      refuser('section-inconnue', `section « ${String(é.section)} » : attendu ${SECTIONS.join(' ou ')}`)
      continue
    }
    const clé = cléDeFait(é.section, axe, é.rang)
    if (vues.has(clé)) {
      refuser('doublon', 'ce fait est étiqueté deux fois dans le lot')
      continue
    }
    vues.add(clé)

    const fait = parClé.get(clé)
    if (!fait) {
      const axeRas = é.section === 'axe' && construireDocument(entrée.blocs).rubriques.some((r) => r.axes.some((a) => a.numéro === axe && a.niveau === 'RAS'))
      refuser(axeRas ? 'axe-ras' : 'fait-introuvable', axeRas ? 'un axe RAS ne porte aucun fait à étiqueter' : 'la lettre ne porte pas de fait à cette place')
      continue
    }
    if (normaliserTitre(é.titre) !== normaliserTitre(fait.titre)) {
      refuser('titre-différent', `la phrase-titre envoyée ne correspond pas à celle de la lettre, qui commence par « ${fait.titre.slice(0, 60)} »`)
    }

    const pestel = é.pestel ?? null
    const porter = é.porter ?? null
    const ansoff = é.ansoff ?? null
    const entite = é.entite?.trim() ? é.entite.trim() : null
    if (pestel !== null && !dans(PESTEL, pestel)) refuser('étiquette-inconnue', `PESTEL « ${String(pestel)} » inconnu`)
    if (porter !== null && !dans(FORCES_PORTER, porter)) refuser('étiquette-inconnue', `force « ${String(porter)} » inconnue`)
    if (ansoff !== null && !dans(ANSOFF, ansoff)) refuser('étiquette-inconnue', `mouvement d'Ansoff « ${String(ansoff)} » inconnu`)
    if (!dans(IMPACTS_DE_FAIT, é.impact)) refuser('étiquette-inconnue', `impact « ${String(é.impact)} » : FORT ou MOYEN, un fait RAS n'est pas étiqueté`)
    if (!dans(NOUVEAUTÉS, é.nouveaute)) refuser('étiquette-inconnue', `nouveauté « ${String(é.nouveaute)} » : nouveau ou contexte`)
    if (typeof é.rupture !== 'boolean') refuser('étiquette-inconnue', 'rupture : vrai ou faux')
    if ((pestel === null) === (porter === null)) refuser('cadre-ambigu', 'un fait porte exactement une étiquette : une lettre PESTEL ou une force de Porter')

    const concurrent = porter !== null && FORCES_CONCURRENTES.includes(porter) && entite !== null
    if (concurrent && ansoff === null) refuser('ansoff-manquant', 'un fait qui nomme un concurrent (rivalité, nouvel entrant) porte son mouvement d’Ansoff')
    if (!concurrent && ansoff !== null) refuser('ansoff-hors-concurrent', 'le mouvement d’Ansoff ne vaut que pour un concurrent nommé, sous rivalité ou nouveaux entrants')
    if (entite !== null && entités && !entités.has(normaliserTitre(entite))) refuser('entité-hors-grille', `« ${entite} » ne figure pas parmi les entités de la grille`)
    if (entite !== null && entite.length > BORNES.entitéMax) refuser('longueur', `entité de plus de ${BORNES.entitéMax} caractères`)

    // `rangDImpact` trie par impact décroissant : un rang plus petit est un impact plus fort.
    if (dans(IMPACTS_DE_FAIT, é.impact) && fait.niveauDeLAxe && rangDImpact(é.impact) < rangDImpact(fait.niveauDeLAxe)) {
      refuser('impact-supérieur-à-l-axe', `un fait ${é.impact} dans un axe ${fait.niveauDeLAxe} : le niveau de l'axe est celui de son fait le plus fort`)
    }
    if (!estDate(é.date)) refuser('date-invalide', `date « ${é.date} » : AAAA-MM-JJ`)
    else if (é.date > entrée.dateÉdition) refuser('date-future', `fait daté du ${é.date}, après l'édition du ${entrée.dateÉdition}`)
    if (!fait.urls.map(normaliserUrl).includes(normaliserUrl(é.source))) refuser('source-absente', `l'URL ${é.source} n'est pas citée dans ce fait`)

    if (refus.length === avant) {
      acceptées.push({
        section: é.section,
        axe,
        rang: é.rang,
        empreinte: fait.empreinte,
        date: é.date,
        source: é.source,
        pestel,
        porter,
        ansoff,
        entite,
        rupture: é.rupture,
        impact: é.impact,
        nouveaute: é.nouveaute,
      })
    }
  }

  for (const f of faits) {
    if (!vues.has(cléDeFait(f.section, f.axe, f.rang))) {
      refus.push({ code: 'lot-incomplet', message: `fait non étiqueté : « ${f.titre.slice(0, 80)} »`, cible: cibleDeFait(f.section, f.axe, f.rang) })
    }
  }
  return { acceptées: refus.length === 0 ? acceptées : [], refus, faits: faits.length }
}

// ── Lecture des étiquettes, pour l'espace client ────────────────────────────

/** Les libellés affichés : sentence case, accents, jamais les clés techniques. */
export const LIBELLÉS_PESTEL: Readonly<Record<Pestel, string>> = {
  politique: 'Politique',
  economique: 'Économique',
  socioculturel: 'Socioculturel',
  technologique: 'Technologique',
  ecologique: 'Écologique',
  legal: 'Légal',
}

export const LIBELLÉS_PORTER: Readonly<Record<ForcePorter, string>> = {
  rivalite: 'Rivalité entre acteurs',
  nouveaux_entrants: 'Nouveaux entrants',
  substituts: 'Substituts',
  pouvoir_clients: 'Pouvoir des clients',
  pouvoir_fournisseurs: 'Pouvoir des fournisseurs',
}

export const LIBELLÉS_ANSOFF: Readonly<Record<Ansoff, string>> = {
  penetration: 'pénétration',
  developpement_produit: 'développement de produit',
  developpement_marche: 'développement de marché',
  diversification: 'diversification',
}

/** Un fait étiqueté tel que l'écran le reçoit : ses étiquettes, et sa phrase-titre quand elle a été relue. */
export type FaitÀLire = {
  readonly pestel: string | null
  readonly porter: string | null
  readonly ansoff: string | null
  readonly entite: string | null
  readonly rupture: boolean
  readonly date: string
  readonly titre: string | null
}

export type LectureDesÉtiquettes = {
  readonly total: number
  /** Les six dimensions, dans l'ordre du cadre, zéro compris : un trou se lit. */
  readonly pestel: readonly { readonly clé: Pestel; readonly libellé: string; readonly faits: number }[]
  /** Les cinq forces, dans l'ordre du cadre, avec les entités nommées les plus citées. */
  readonly forces: readonly { readonly clé: ForcePorter; readonly libellé: string; readonly faits: number; readonly entités: readonly string[] }[]
  readonly mouvements: readonly { readonly libellé: string; readonly faits: number }[]
  /** Les ruptures dont la phrase-titre a été relue, de la plus récente à la plus ancienne. */
  readonly ruptures: readonly { readonly titre: string; readonly date: string }[]
}

/** Trois entités par force : au-delà, la case devient une liste que l'écran des acteurs tient déjà. */
const ENTITÉS_PAR_FORCE = 3

/**
 * Ce que les étiquettes d'un ensemble de faits donnent à lire : la répartition
 * sur le cadre PESTEL et sur les cinq forces, les mouvements d'Ansoff, et les
 * ruptures. Un simple compte, sans interprétation : l'énoncé d'une synthèse
 * viendra de la revue mensuelle, relue, jamais d'ici.
 */
export function lectureDesÉtiquettes(faits: readonly FaitÀLire[]): LectureDesÉtiquettes {
  const compter = <T extends string>(liste: readonly T[], valeur: (f: FaitÀLire) => string | null) =>
    new Map(liste.map((clé) => [clé, faits.filter((f) => valeur(f) === clé).length]))
  const parPestel = compter(PESTEL, (f) => f.pestel)
  const parForce = compter(FORCES_PORTER, (f) => f.porter)

  const entitésDe = (force: ForcePorter) => {
    const comptes = new Map<string, number>()
    for (const f of faits) if (f.porter === force && f.entite) comptes.set(f.entite, (comptes.get(f.entite) ?? 0) + 1)
    return [...comptes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).slice(0, ENTITÉS_PAR_FORCE).map(([nom]) => nom)
  }

  return {
    total: faits.length,
    pestel: PESTEL.map((clé) => ({ clé, libellé: LIBELLÉS_PESTEL[clé], faits: parPestel.get(clé) ?? 0 })),
    forces: FORCES_PORTER.map((clé) => ({ clé, libellé: LIBELLÉS_PORTER[clé], faits: parForce.get(clé) ?? 0, entités: entitésDe(clé) })),
    mouvements: ANSOFF.map((clé) => ({ libellé: LIBELLÉS_ANSOFF[clé], faits: faits.filter((f) => f.ansoff === clé).length })).filter((m) => m.faits > 0),
    ruptures: faits
      .filter((f): f is FaitÀLire & { titre: string } => f.rupture && f.titre !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((f) => ({ titre: f.titre, date: f.date })),
  }
}

// ── Porte de la grille ───────────────────────────────────────────────────────

export type AxeDeGroupes = { readonly clé: string; readonly libellé: string; readonly crans: readonly string[] }
export type FamilleDeGrille = {
  readonly numéro: number
  readonly veille: Veille
  readonly pestel?: Pestel | null
  readonly porter?: ForcePorter | null
  readonly cadence: Cadence
}
export type EntitéDeGrille = { readonly nom: string; readonly veille: Veille; readonly siren?: string | null }

export type Grille = {
  readonly axesGroupes: readonly AxeDeGroupes[]
  readonly familles: readonly FamilleDeGrille[]
  readonly entités: readonly EntitéDeGrille[]
  readonly partiesPrenantes: readonly { readonly nom: string }[]
  readonly offres?: readonly string[] | null
}

export function contrôlerLaGrille(grille: Grille): readonly Refus[] {
  const refus: Refus[] = []
  const refuser = (code: string, message: string, cible?: string) => refus.push({ code, message, ...(cible ? { cible } : {}) })
  const libellé = (texte: string, cible: string) => {
    if (texte.trim().length === 0 || texte.length > BORNES.libelléMax) refuser('libellé-hors-bornes', `libellé vide ou de plus de ${BORNES.libelléMax} caractères`, cible)
    if (/\bfaible\b|\bfort\b/i.test(texte)) refuser('vocabulaire-interdit', '« faible » et « fort » sont réservés à l’impact', cible)
  }

  if (grille.axesGroupes.length !== BORNES.axesDesGroupes) refuser('axes-hors-bornes', `la carte des groupes stratégiques a exactement ${BORNES.axesDesGroupes} axes`)
  const clés = new Set<string>()
  for (const axe of grille.axesGroupes) {
    const cible = `axe « ${axe.clé} »`
    if (!/^[a-z][a-z0-9_]{0,29}$/.test(axe.clé) || clés.has(axe.clé)) refuser('clé-invalide', 'clé d’axe en minuscules, unique', cible)
    clés.add(axe.clé)
    libellé(axe.libellé, cible)
    if (axe.crans.length < BORNES.cransMin || axe.crans.length > BORNES.cransMax) refuser('crans-hors-bornes', `${BORNES.cransMin} à ${BORNES.cransMax} crans`, cible)
    axe.crans.forEach((c, i) => libellé(c, `${cible}, cran ${i + 1}`))
  }

  const numéros = new Set<string>()
  for (const f of grille.familles) {
    const cible = `famille ${f.numéro} (${f.veille})`
    if (!dans(VEILLES, f.veille)) refuser('veille-inconnue', `veille « ${String(f.veille)} »`, cible)
    if (numéros.has(`${f.veille}:${f.numéro}`)) refuser('doublon', 'famille déclarée deux fois', cible)
    numéros.add(`${f.veille}:${f.numéro}`)
    const pestel = f.pestel ?? null
    const porter = f.porter ?? null
    if ((pestel === null) === (porter === null)) refuser('famille-sans-cadre', 'chaque famille est rattachée à une lettre PESTEL ou à une force, une seule', cible)
    if (pestel !== null && !dans(PESTEL, pestel)) refuser('étiquette-inconnue', `PESTEL « ${String(pestel)} »`, cible)
    if (porter !== null && !dans(FORCES_PORTER, porter)) refuser('étiquette-inconnue', `force « ${String(porter)} »`, cible)
    if (!dans(CADENCES, f.cadence)) refuser('cadence-inconnue', `cadence « ${String(f.cadence)} »`, cible)
  }
  if (grille.familles.length === 0) refuser('familles-absentes', 'la grille porte la correspondance de chaque famille du référentiel')

  for (const veille of VEILLES) {
    const n = grille.entités.filter((e) => e.veille === veille).length
    if (n > BORNES.entitésParVeilleMax) refuser('entités-hors-plafond', `${n} entités pour la veille ${veille}, ${BORNES.entitésParVeilleMax} au plus`)
  }
  for (const e of grille.entités) {
    if (e.nom.trim().length === 0 || e.nom.length > BORNES.entitéMax) refuser('longueur', `nom vide ou de plus de ${BORNES.entitéMax} caractères`, `entité « ${e.nom.slice(0, 40)} »`)
    if (e.siren != null && !/^\d{9}$/.test(e.siren)) refuser('siren-invalide', 'neuf chiffres, ou null', `entité « ${e.nom} »`)
  }

  const pp = grille.partiesPrenantes
  if (pp.length < BORNES.partiesPrenantesMin || pp.length > BORNES.partiesPrenantesMax) {
    refuser('parties-prenantes-hors-bornes', `${pp.length} parties prenantes pour ${BORNES.partiesPrenantesMin} à ${BORNES.partiesPrenantesMax}`)
  }
  for (const p of pp) if (p.nom.trim().length === 0 || p.nom.length > BORNES.partiePrenanteMax) refuser('longueur', `nom vide ou de plus de ${BORNES.partiePrenanteMax} caractères`, `partie prenante « ${p.nom.slice(0, 40)} »`)
  return refus
}

/** L'empreinte d'une grille : la même grille re-postée ne crée pas de version. */
export function empreinteDeLaGrille(grille: Grille): string {
  const trié = <T>(liste: readonly T[], clé: (x: T) => string) => [...liste].sort((a, b) => clé(a).localeCompare(clé(b)))
  return empreinte(
    JSON.stringify({
      a: grille.axesGroupes.map((a) => [a.clé, a.libellé, a.crans]),
      f: trié(grille.familles, (f) => `${f.veille}:${String(f.numéro).padStart(3, '0')}`).map((f) => [f.veille, f.numéro, f.pestel ?? null, f.porter ?? null, f.cadence]),
      e: trié(grille.entités, (e) => `${e.veille}:${e.nom}`).map((e) => [e.veille, e.nom, e.siren ?? null]),
      p: trié(grille.partiesPrenantes, (p) => p.nom).map((p) => p.nom),
      o: grille.offres ?? null,
    }),
  )
}

/** Les lettres PESTEL qu'aucune famille ne couvre : les trous du référentiel. */
export function trousDuPestel(grille: Grille): Pestel[] {
  const couvertes = new Set(grille.familles.map((f) => f.pestel).filter((p): p is Pestel => p != null))
  return PESTEL.filter((p) => !couvertes.has(p))
}

/** Les forces qu'aucune famille ne porte : « non suivi » dans la lecture des cinq forces. */
export function forcesNonSuivies(grille: Grille): ForcePorter[] {
  const portées = new Set(grille.familles.map((f) => f.porter).filter((p): p is ForcePorter => p != null))
  return FORCES_PORTER.filter((p) => !portées.has(p))
}

// ── Porte de la synthèse ─────────────────────────────────────────────────────

export type ÉlémentSwotProposé = {
  /** Identifiant provisoire dans le lot (« S1 », « O2 »), repris par la TOWS. */
  readonly id: string
  readonly case: CaseSwot
  readonly énoncé: string
  readonly état: ÉtatDÉlément
  readonly origine: Origine
  readonly hypothèse: boolean
  /** L'élément de la période précédente qu'il prolonge, par son identifiant en base. */
  readonly filiation?: string | null
  readonly faits: readonly string[]
  /** Pour un élément déclaratif : la section de la fiche (« fiche v1.1, §7 »). */
  readonly référenceFiche?: string | null
}

export type OptionTowsProposée = {
  readonly type: TypeTows
  readonly énoncé: string
  readonly éléments: readonly string[]
  readonly candidate: boolean
}

export type PositionProposée = {
  readonly outil: OutilDePosition
  readonly sujet: string
  readonly axe: string
  readonly cran: number | null
  readonly nonSuivi?: boolean
  readonly tendance?: Tendance | null
  readonly faits: readonly string[]
}

export type LettrePestelProposée = {
  readonly lettre: Pestel
  readonly énoncé: string | null
  readonly faits: readonly string[]
}

export type ScénarioProposé = {
  readonly titre: string
  readonly énoncé: string
  readonly indicateurs: readonly { readonly famille: number; readonly signal: string }[]
  readonly faits: readonly string[]
}

export type SynthèseProposée = {
  readonly mode: 'initial' | 'mensuel' | 'trimestriel'
  readonly grilleVersion: number
  readonly pestel: readonly LettrePestelProposée[]
  readonly swot: readonly ÉlémentSwotProposé[]
  /** Cases que la fenêtre ne permet pas de remplir à trois éléments : dites, jamais remplies pour remplir. */
  readonly casesInsuffisantes?: readonly CaseSwot[]
  readonly tows: readonly OptionTowsProposée[]
  readonly positions: readonly PositionProposée[]
  readonly scénarios?: readonly ScénarioProposé[]
  readonly interprétations?: readonly { readonly outil: 'indice_cycle' | 'benchmark'; readonly énoncé: string }[]
}

/** Un fait étiqueté de l'organisation, tel que la base le connaît. */
export type FaitConnu = { readonly date: string; readonly entite: string | null }

export type ContexteDeSynthèse = {
  readonly faits: ReadonlyMap<string, FaitConnu>
  readonly fenêtre: { readonly début: string; readonly fin: string }
  readonly grille: Grille
  readonly grilleVersion: number
  /** Les éléments SWOT de la période précédente, par identifiant : leur case. */
  readonly élémentsPrécédents: ReadonlyMap<string, CaseSwot>
  /** Les crans de la période précédente, par `outil:sujet:axe`, le sujet passé par `normaliserTitre`. */
  readonly positionsPrécédentes: ReadonlyMap<string, number | null>
}

export type ContrôleDeSynthèse = {
  readonly refus: readonly Refus[]
  readonly avertissements: readonly Refus[]
}

export function contrôlerLaSynthèse(synthèse: SynthèseProposée, contexte: ContexteDeSynthèse): ContrôleDeSynthèse {
  const refus: Refus[] = []
  const avertissements: Refus[] = []
  const refuser = (code: string, message: string, cible?: string) => refus.push({ code, message, ...(cible ? { cible } : {}) })
  const dansLaFenêtre = (id: string) => {
    const f = contexte.faits.get(id)
    return !!f && f.date >= contexte.fenêtre.début && f.date <= contexte.fenêtre.fin
  }
  const nomsDeLaGrille = [...contexte.grille.entités.map((e) => e.nom), ...contexte.grille.partiesPrenantes.map((p) => p.nom)].map(normaliserTitre).filter((n) => n.length >= 3)

  const vérifierFaits = (faits: readonly string[], cible: string, exigerUn = true) => {
    if (exigerUn && faits.length === 0) refuser('sans-fait', 'aucun fait cité : rien sans fait daté', cible)
    for (const id of faits) if (!contexte.faits.has(id)) refuser('fait-inconnu', `le fait ${id} n'est pas un fait étiqueté de cette organisation`, cible)
  }
  const vérifierÉnoncé = (texte: string, cible: string, max: number = BORNES.énoncéMax) => {
    if (texte.trim().length === 0 || texte.length > max) refuser('longueur', `énoncé vide ou de plus de ${max} caractères`, cible)
    const interdit = vocabulaireInterdit(texte)
    if (interdit) refuser('vocabulaire-interdit', interdit, cible)
    const t = normaliserTitre(texte)
    if (!/\d/.test(texte) && !nomsDeLaGrille.some((n) => ` ${t} `.includes(` ${n} `))) {
      avertissements.push({ code: 'spécificité', message: 'ni nom de la grille, ni chiffre, ni date : à vérifier à la relecture qu’il ne resterait pas vrai pour un concurrent', cible })
    }
  }

  if (synthèse.grilleVersion !== contexte.grilleVersion) refuser('grille-périmée', `synthèse bâtie sur la grille v${synthèse.grilleVersion}, la dernière est la v${contexte.grilleVersion} : re-poste la grille ou relis-la`)

  // PESTEL : les six lettres, les trous dits comme trous.
  const trous = new Set(trousDuPestel(contexte.grille))
  const lettres = new Set(synthèse.pestel.map((l) => l.lettre))
  for (const lettre of PESTEL) if (!lettres.has(lettre)) refuser('pestel-incomplet', `la lettre « ${lettre} » manque`)
  for (const l of synthèse.pestel) {
    const cible = `PESTEL ${l.lettre}`
    if (!dans(PESTEL, l.lettre)) {
      refuser('étiquette-inconnue', `lettre « ${String(l.lettre)} »`)
      continue
    }
    if (trous.has(l.lettre)) {
      if (l.faits.length > 0) refuser('trou-avec-faits', 'aucune famille ne couvre cette lettre : elle est un trou, pas une lecture', cible)
      continue
    }
    vérifierFaits(l.faits, cible, l.énoncé !== null)
    if (l.énoncé !== null) vérifierÉnoncé(l.énoncé, cible)
  }

  // SWOT.
  const ids = new Map<string, CaseSwot>()
  for (const é of synthèse.swot) {
    const cible = `SWOT ${é.id}`
    if (ids.has(é.id)) refuser('doublon', 'identifiant déjà pris dans le lot', cible)
    if (!dans(CASES_SWOT, é.case)) {
      refuser('étiquette-inconnue', `case « ${String(é.case)} »`, cible)
      continue
    }
    ids.set(é.id, é.case)
    if (!dans(ÉTATS_D_ÉLÉMENT, é.état)) refuser('état-inconnu', `état « ${String(é.état)} »`, cible)
    if (!dans(ORIGINES, é.origine)) refuser('étiquette-inconnue', `origine « ${String(é.origine)} »`, cible)
    vérifierÉnoncé(é.énoncé, cible)

    if (é.origine === 'declaratif') {
      if (!CASES_INTERNES.includes(é.case)) refuser('déclaratif-hors-forces-faiblesses', 'seules les forces et faiblesses peuvent venir d’une déclaration', cible)
      if (!é.hypothèse) refuser('hypothèse-non-marquée', 'un élément déclaratif est une hypothèse à valider', cible)
      if (!é.référenceFiche?.trim()) refuser('sans-référence', 'un élément déclaratif cite la section de la fiche qui le porte', cible)
      vérifierFaits(é.faits, cible, false)
    } else {
      vérifierFaits(é.faits, cible)
      if (é.état !== 'inchange' && é.faits.length > 0 && !é.faits.some(dansLaFenêtre)) {
        refuser('fait-hors-fenêtre', `un élément ${é.état} cite au moins un fait de la fenêtre (${contexte.fenêtre.début} au ${contexte.fenêtre.fin})`, cible)
      }
    }

    if (synthèse.mode === 'initial' && é.état !== 'nouveau') refuser('état-incohérent', 'une synthèse initiale ne porte que des éléments nouveaux', cible)
    if (é.état === 'nouveau' && é.filiation) refuser('filiation-incohérente', 'un élément nouveau ne prolonge rien', cible)
    if (é.état !== 'nouveau' && dans(ÉTATS_D_ÉLÉMENT, é.état)) {
      const précédent = é.filiation ? contexte.élémentsPrécédents.get(é.filiation) : undefined
      if (!précédent) refuser('filiation-inconnue', 'un élément renforcé, inchangé ou affaibli désigne l’élément de la période précédente qu’il prolonge', cible)
      else if (précédent !== é.case) refuser('filiation-inconnue', `l’élément prolongé était dans la case ${précédent}`, cible)
    }
  }
  const insuffisantes = new Set(synthèse.casesInsuffisantes ?? [])
  for (const c of CASES_SWOT) {
    const n = synthèse.swot.filter((é) => é.case === c).length
    if (n > BORNES.élémentsParCaseMax || (n < BORNES.élémentsParCaseMin && !insuffisantes.has(c))) {
      refuser('case-hors-bornes', `${n} élément(s) : ${BORNES.élémentsParCaseMin} à ${BORNES.élémentsParCaseMax}, ou moins si la case est déclarée insuffisante`, `SWOT ${c}`)
    }
  }

  // TOWS.
  if (synthèse.tows.length < BORNES.towsMin || synthèse.tows.length > BORNES.towsMax) refuser('tows-hors-bornes', `${synthèse.tows.length} option(s) pour ${BORNES.towsMin} à ${BORNES.towsMax}`)
  if (synthèse.tows.filter((o) => o.candidate).length !== 1) refuser('candidate-unique', 'une seule option, la plus forte, est candidate à la recommandation')
  synthèse.tows.forEach((o, i) => {
    const cible = `TOWS ${i + 1}`
    if (!dans(TYPES_TOWS, o.type)) {
      refuser('étiquette-inconnue', `type « ${String(o.type)} »`, cible)
      return
    }
    vérifierÉnoncé(o.énoncé, cible)
    const cases = o.éléments.map((id) => ids.get(id))
    if (cases.some((c) => c === undefined)) refuser('élément-inconnu', 'une option cite un élément absent de la SWOT du lot', cible)
    const interne = o.type[0] === 'S' ? 'forces' : 'faiblesses'
    const externe = o.type[1] === 'O' ? 'opportunites' : 'menaces'
    if (!cases.includes(interne) || !cases.includes(externe)) refuser('tows-sans-croisement', `une option ${o.type} croise au moins un élément « ${interne} » et un élément « ${externe} »`, cible)
  })

  // Positions.
  const entités = new Set(contexte.grille.entités.map((e) => normaliserTitre(e.nom)))
  const partiesPrenantes = new Set(contexte.grille.partiesPrenantes.map((p) => normaliserTitre(p.nom)))
  const axes = new Map(contexte.grille.axesGroupes.map((a) => [a.clé, a.crans.length]))
  const nonSuivies = new Set(forcesNonSuivies(contexte.grille))
  const posées = new Set<string>()
  for (const p of synthèse.positions) {
    const cible = `${p.outil} ${p.sujet} / ${p.axe}`
    if (!dans(OUTILS_DE_POSITION, p.outil)) {
      refuser('étiquette-inconnue', `outil « ${String(p.outil)} »`, cible)
      continue
    }
    const clé = `${p.outil}:${normaliserTitre(p.sujet)}:${p.axe}`
    if (posées.has(clé)) refuser('doublon', 'position déclarée deux fois', cible)
    posées.add(clé)

    let max = 0
    if (p.outil === 'groupes') {
      if (!entités.has(normaliserTitre(p.sujet))) refuser('position-hors-grille', 'entité absente de la grille', cible)
      max = axes.get(p.axe) ?? 0
      if (!max) refuser('position-hors-grille', 'axe absent de la grille', cible)
    } else if (p.outil === 'mendelow') {
      if (!partiesPrenantes.has(normaliserTitre(p.sujet))) refuser('position-hors-grille', 'partie prenante absente de la grille', cible)
      if (p.axe !== 'pouvoir' && p.axe !== 'interet') refuser('position-hors-grille', 'axe « pouvoir » ou « interet »', cible)
      max = CRANS_MENDELOW.length
    } else {
      if (!dans(FORCES_PORTER, p.sujet)) refuser('position-hors-grille', `force « ${p.sujet} » inconnue`, cible)
      if (p.axe !== 'intensite') refuser('position-hors-grille', 'axe « intensite »', cible)
      if (synthèse.mode !== 'trimestriel') refuser('hors-période', 'les cinq forces se lisent au trimestre', cible)
      if (!p.nonSuivi && (!p.tendance || !dans(TENDANCES, p.tendance))) refuser('tendance-manquante', 'une force porte sa tendance : hausse, stable ou baisse', cible)
      max = CRANS_DES_FORCES.length
    }

    if (p.nonSuivi) {
      if (p.outil !== 'forces' || !nonSuivies.has(p.sujet as ForcePorter)) refuser('non-suivi-injustifié', 'seule une force qu’aucune famille ne porte est « non suivi »', cible)
      continue
    }
    if (p.outil === 'forces' && nonSuivies.has(p.sujet as ForcePorter)) refuser('non-suivi-manquant', 'aucune famille ne porte cette force : elle est « non suivi »', cible)
    if (p.cran === null || !Number.isInteger(p.cran) || p.cran < 1 || (max > 0 && p.cran > max)) refuser('cran-hors-bornes', `cran ${String(p.cran)} pour 1 à ${max}`, cible)
    vérifierFaits(p.faits, cible)
    const avant = contexte.positionsPrécédentes.get(clé)
    if (avant !== undefined && avant !== p.cran) {
      const sujet = normaliserTitre(p.sujet)
      const justifié = p.faits.some((id) => {
        const f = contexte.faits.get(id)
        if (!f || !dansLaFenêtre(id)) return false
        return p.outil === 'groupes' ? !!f.entite && normaliserTitre(f.entite) === sujet : true
      })
      if (!justifié) refuser('mouvement-sans-fait', `cran ${String(avant)} devenu ${String(p.cran)} sans fait de la fenêtre${p.outil === 'groupes' ? ' qui nomme cette entité' : ''}`, cible)
    }
  }
  if (synthèse.mode === 'trimestriel') {
    for (const force of FORCES_PORTER) if (!posées.has(`forces:${normaliserTitre(force)}:intensite`)) refuser('forces-incomplètes', `la force « ${force} » manque`)
  }

  // Scénarios, au trimestre.
  const scénarios = synthèse.scénarios ?? []
  if (synthèse.mode === 'trimestriel' && scénarios.length !== BORNES.scénarios) refuser('scénarios-hors-bornes', `${scénarios.length} scénario(s) pour ${BORNES.scénarios}`)
  if (synthèse.mode !== 'trimestriel' && scénarios.length > 0) refuser('hors-période', 'les scénarios se bâtissent au trimestre')
  const familles = new Set(contexte.grille.familles.map((f) => f.numéro))
  scénarios.forEach((s, i) => {
    const cible = `scénario ${i + 1}`
    vérifierÉnoncé(s.énoncé, cible, BORNES.scénarioMax)
    if (s.titre.trim().length === 0 || s.titre.length > BORNES.libelléMax * 2) refuser('longueur', 'titre vide ou trop long', cible)
    if (s.indicateurs.length < BORNES.indicateursMin || s.indicateurs.length > BORNES.indicateursMax) refuser('indicateurs-hors-bornes', `${s.indicateurs.length} indicateur(s) pour ${BORNES.indicateursMin} à ${BORNES.indicateursMax}`, cible)
    for (const ind of s.indicateurs) if (!familles.has(ind.famille)) refuser('famille-inconnue', `l’indicateur renvoie à la famille ${ind.famille}, absente de la grille`, cible)
    vérifierFaits(s.faits, cible)
  })

  for (const it of synthèse.interprétations ?? []) {
    if (synthèse.mode !== 'trimestriel') refuser('hors-période', 'l’indice et le benchmark se lisent au trimestre', it.outil)
    vérifierÉnoncé(it.énoncé, it.outil)
  }
  return { refus, avertissements }
}
