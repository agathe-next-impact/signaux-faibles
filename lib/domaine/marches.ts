import { BORNES, empreinte, normaliserTitre, VEILLES, type Grille, type Refus, type Veille } from '@/lib/domaine/strategie'

/**
 * Marchés et niches (12 novembre 2026, `docs/plan-marches-et-niches.md`).
 *
 * Un marché, une offre et une niche sont la même chose à trois échelles : un
 * groupe d'acheteurs, délimité par un périmètre. L'organisation déclare donc un
 * **arbre de segments** : le marché à la racine, ses offres en dessous, les
 * niches en feuilles. Sur chaque segment, le portail calcule chaque trimestre
 * les mêmes mesures (cibles, potentiel, offre en place, activité de la veille),
 * et l'état du segment se déduit de la suite de ses mesures : il n'est jamais
 * déclaré ni stocké.
 *
 * Ce fichier est pur : la porte des segments, l'assemblage d'une mesure à
 * partir de comptes déjà lus, l'état calculé et la vue de l'écran. Les comptes
 * viennent de `lib/registres/`, l'écriture de `lib/base/marches.ts`, par la
 * seule orchestration `lib/portail/marches.ts`.
 *
 * Postgres ne porte ici que des clés, des libellés courts (40 caractères, la
 * borne de la grille), des périmètres en codes et des chiffres : ni corps de
 * lettre, ni texte de référentiel.
 */

export const BORNES_DES_SEGMENTS = {
  segmentsMax: 40,
  /** Racine, offres, niches : trois niveaux, jamais plus. */
  profondeurMax: 3,
  codesMax: 20,
  départementsMax: 13,
  entitésMax: 40,
  famillesMax: 12,
  texteMax: 80,
  sourceMax: 300,
  cpvMax: 10,
  libelléDesCiblesMax: 60,
} as const

/** Au-delà, l'API Recherche d'entreprises ne compte plus : elle rend ce plafond. */
export const PLAFOND_DU_REGISTRE = 10_000

/** Les tranches d'effectif salarié de l'INSEE, telles que le registre les code. */
export const TRANCHES_D_EFFECTIF = ['NN', '00', '01', '02', '03', '11', '12', '21', '22', '31', '32', '41', '42', '51', '52', '53'] as const

const NAF = /^\d{2}\.\d{2}[A-Z]$/
const DÉPARTEMENT = /^(\d{2}|2A|2B|97\d)$/
const CLÉ = /^[a-z][a-z0-9_]{0,39}$/
const SOURCE = /^https:\/\/[^\s]+$/
/** Un code CPV ou son début : « 3012 » couvre tous les codes qui commencent ainsi. */
const CPV = /^\d{4,8}$/

/**
 * Qui achète. `registre` : un périmètre que le portail compte dans le registre
 * des entreprises (codes NAF, tranches d'effectif, départements, ou les seules
 * collectivités territoriales). `declare` : un nombre posé avec sa source,
 * quand le registre ne sait pas compter la cible. `libellé` : ce que l'on
 * compte, au pluriel et en minuscules (« établissements hospitaliers »), pour
 * que l'écran dise de quoi le nombre est fait.
 */
export type CiblesDeSegment =
  | {
      readonly sorte: 'registre'
      readonly naf?: readonly string[]
      readonly tranches?: readonly string[]
      readonly départements?: readonly string[]
      readonly collectivités?: boolean
      readonly libellé?: string
    }
  | { readonly sorte: 'declare'; readonly nombre: number; readonly source: string; readonly libellé?: string }

/** Qui vend : les codes NAF des offreurs, et de quoi compter leurs entrées et sorties au BODACC. */
export type OffreDeSegment = {
  readonly naf?: readonly string[]
  readonly départements?: readonly string[]
  readonly texte?: string
}

/** La dépense annuelle d'une cible, en euros hors taxes : une hypothèse, toujours une fourchette et une source. */
export type DépenseDeSegment = { readonly basse: number; readonly haute: number; readonly source: string }

/**
 * Ce que les acheteurs publics achètent sur le segment : des codes CPV du
 * vocabulaire commun des marchés publics, ou leur début (quatre à huit
 * chiffres). Le portail y lit les marchés attribués, publiés par l'État (DECP).
 */
export type MarchésPublicsDeSegment = { readonly cpv: readonly string[] }

export type SegmentDeMarché = {
  readonly clé: string
  readonly libellé: string
  /** `null` pour la racine, le marché ; une seule racine. */
  readonly parent: string | null
  readonly cibles?: CiblesDeSegment | null
  readonly offre?: OffreDeSegment | null
  readonly dépense?: DépenseDeSegment | null
  readonly marchésPublics?: MarchésPublicsDeSegment | null
  /** Les entités de la grille dont les faits comptent pour l'activité du segment, par leur nom de grille. */
  readonly entités?: readonly string[]
  /**
   * Les concurrents de la grille présents sur le segment. Absent ou `null` : la
   * présence n'est pas renseignée. Liste vide : aucun concurrent n'y est
   * présent, et le segment est dit ouvert.
   */
  readonly présents?: readonly string[] | null
  /** Les familles de la grille dont les faits comptent pour l'activité du segment. */
  readonly familles?: readonly { readonly veille: Veille; readonly numéro: number }[]
}

export type NiveauDeSegment = 'marche' | 'offre' | 'niche'
export const LIBELLÉS_DE_NIVEAU: Readonly<Record<NiveauDeSegment, string>> = { marche: 'marché', offre: 'offre', niche: 'niche' }

/** La profondeur d'un segment dans l'arbre : 1 pour la racine. `null` si la chaîne des parents est rompue ou boucle. */
function profondeur(segment: SegmentDeMarché, parClé: ReadonlyMap<string, SegmentDeMarché>): number | null {
  let p = 1
  let courant = segment
  const vus = new Set([segment.clé])
  while (courant.parent !== null) {
    const parent = parClé.get(courant.parent)
    if (!parent || vus.has(parent.clé)) return null
    vus.add(parent.clé)
    courant = parent
    p += 1
  }
  return p
}

export function niveauDe(segment: SegmentDeMarché, segments: readonly SegmentDeMarché[]): NiveauDeSegment {
  const p = profondeur(segment, new Map(segments.map((s) => [s.clé, s])))
  return p === 1 ? 'marche' : p === 2 ? 'offre' : 'niche'
}

/**
 * La porte des segments : rien n'est écrit sans elle. Les entités et les
 * familles citées doivent figurer dans la grille de l'organisation.
 */
export function contrôlerLesSegments(segments: readonly SegmentDeMarché[], grille: Grille): readonly Refus[] {
  const refus: Refus[] = []
  const refuser = (code: string, message: string, cible?: string) => refus.push({ code, message, ...(cible ? { cible } : {}) })

  if (segments.length === 0) refuser('segments-absents', 'au moins un segment, la racine')
  if (segments.length > BORNES_DES_SEGMENTS.segmentsMax) refuser('segments-hors-bornes', `${segments.length} segments, ${BORNES_DES_SEGMENTS.segmentsMax} au plus`)

  const parClé = new Map<string, SegmentDeMarché>()
  for (const s of segments) {
    if (!CLÉ.test(s.clé)) refuser('clé-invalide', 'clé en minuscules, chiffres et tirets bas, 40 caractères au plus', `segment « ${s.clé.slice(0, 40)} »`)
    else if (parClé.has(s.clé)) refuser('doublon', 'clé déclarée deux fois', `segment « ${s.clé} »`)
    parClé.set(s.clé, s)
  }
  const racines = segments.filter((s) => s.parent === null)
  if (segments.length > 0 && racines.length !== 1) refuser('racine', `une seule racine, le marché ; ${racines.length} déclarée(s)`)

  const entités = new Set(grille.entités.map((e) => normaliserTitre(e.nom)))
  const concurrentsDeLaGrille = new Set(grille.entités.filter((e) => e.veille === 'concurrentiel' && e.organisation !== true).map((e) => normaliserTitre(e.nom)))
  const familles = new Set(grille.familles.map((f) => `${f.veille}:${f.numéro}`))
  const source = (valeur: string, cible: string) => {
    if (!SOURCE.test(valeur) || valeur.length > BORNES_DES_SEGMENTS.sourceMax) refuser('source-invalide', 'une adresse en https://, 300 caractères au plus', cible)
  }
  const codes = (liste: readonly string[] | undefined, forme: RegExp, max: number, nom: string, cible: string) => {
    if (!liste) return
    if (liste.length > max) refuser('périmètre-hors-bornes', `${liste.length} ${nom}, ${max} au plus`, cible)
    for (const c of liste) if (!forme.test(c)) refuser('code-invalide', `${nom} « ${String(c).slice(0, 12)} »`, cible)
  }

  for (const s of segments) {
    const cible = `segment « ${s.clé} »`
    if (s.libellé.trim().length === 0 || s.libellé.length > BORNES.libelléMax) refuser('libellé-hors-bornes', `libellé vide ou de plus de ${BORNES.libelléMax} caractères`, cible)
    if (/\bfaible\b|\bfort\b/i.test(s.libellé)) refuser('vocabulaire-interdit', '« faible » et « fort » sont réservés à l’impact', cible)

    if (s.parent !== null) {
      if (!parClé.has(s.parent)) refuser('parent-inconnu', `parent « ${s.parent.slice(0, 40)} » absent des segments`, cible)
      else {
        const p = profondeur(s, parClé)
        if (p === null) refuser('arbre-invalide', 'la chaîne des parents boucle', cible)
        else if (p > BORNES_DES_SEGMENTS.profondeurMax) refuser('arbre-invalide', 'trois niveaux au plus : le marché, ses offres, leurs niches', cible)
      }
    }

    const c = s.cibles ?? null
    if (c?.sorte === 'registre') {
      codes(c.naf, NAF, BORNES_DES_SEGMENTS.codesMax, 'code(s) NAF', `${cible}, cibles`)
      codes(c.tranches, new RegExp(`^(${TRANCHES_D_EFFECTIF.join('|')})$`), TRANCHES_D_EFFECTIF.length, 'tranche(s) d’effectif', `${cible}, cibles`)
      codes(c.départements, DÉPARTEMENT, BORNES_DES_SEGMENTS.départementsMax, 'département(s)', `${cible}, cibles`)
      if (!c.naf?.length && !c.tranches?.length && !c.départements?.length && c.collectivités !== true) {
        refuser('périmètre-vide', 'un périmètre compté demande un code NAF, une tranche, un département ou les collectivités', `${cible}, cibles`)
      }
    } else if (c?.sorte === 'declare') {
      if (!Number.isInteger(c.nombre) || c.nombre < 0 || c.nombre > 100_000_000) refuser('nombre-invalide', 'un nombre entier de cibles', `${cible}, cibles`)
      source(c.source, `${cible}, cibles`)
    } else if (c !== null) {
      refuser('cibles-invalides', 'cibles « registre » ou « declare »', cible)
    }
    if (c?.libellé !== undefined) {
      if (c.libellé.trim().length === 0 || c.libellé.length > BORNES_DES_SEGMENTS.libelléDesCiblesMax) {
        refuser('libellé-invalide', `le nom des cibles tient en ${BORNES_DES_SEGMENTS.libelléDesCiblesMax} caractères`, `${cible}, cibles`)
      }
      if (/\bfaible\b|\bfort\b/i.test(c.libellé)) refuser('vocabulaire-interdit', '« faible » et « fort » sont réservés à l’impact', `${cible}, cibles`)
    }

    const o = s.offre ?? null
    if (o) {
      codes(o.naf, NAF, BORNES_DES_SEGMENTS.codesMax, 'code(s) NAF', `${cible}, offre`)
      codes(o.départements, DÉPARTEMENT, BORNES_DES_SEGMENTS.départementsMax, 'département(s)', `${cible}, offre`)
      if (o.texte !== undefined && (o.texte.trim().length < 3 || o.texte.length > BORNES_DES_SEGMENTS.texteMax)) {
        refuser('texte-hors-bornes', `texte d’activité de 3 à ${BORNES_DES_SEGMENTS.texteMax} caractères`, `${cible}, offre`)
      }
      if (o.texte !== undefined && !o.départements?.length) refuser('périmètre-vide', 'le texte d’activité se compte au BODACC par département : il en faut au moins un', `${cible}, offre`)
      if (!o.naf?.length && o.texte === undefined) refuser('périmètre-vide', 'une offre demande des codes NAF ou un texte d’activité', `${cible}, offre`)
    }

    const d = s.dépense ?? null
    if (d) {
      const valide = (n: number) => Number.isFinite(n) && n > 0 && n <= 1_000_000_000
      if (!valide(d.basse) || !valide(d.haute) || d.basse > d.haute) refuser('dépense-invalide', 'une fourchette en euros, basse puis haute', `${cible}, dépense`)
      source(d.source, `${cible}, dépense`)
    }

    const mp = s.marchésPublics ?? null
    if (mp) {
      if (mp.cpv.length === 0) refuser('périmètre-vide', 'des marchés publics demandent au moins un code CPV', `${cible}, marchés publics`)
      codes(mp.cpv, CPV, BORNES_DES_SEGMENTS.cpvMax, 'code(s) CPV', `${cible}, marchés publics`)
    }

    const présentes = s.entités ?? []
    if (présentes.length > BORNES_DES_SEGMENTS.entitésMax) refuser('entités-hors-bornes', `${présentes.length} entités, ${BORNES_DES_SEGMENTS.entitésMax} au plus`, cible)
    for (const nom of présentes) if (!entités.has(normaliserTitre(nom))) refuser('entité-hors-grille', `« ${nom.slice(0, 60)} » ne figure pas dans la grille`, cible)

    const concurrents = s.présents ?? []
    if (concurrents.length > BORNES_DES_SEGMENTS.entitésMax) refuser('entités-hors-bornes', `${concurrents.length} concurrents présents, ${BORNES_DES_SEGMENTS.entitésMax} au plus`, cible)
    for (const nom of concurrents) if (!concurrentsDeLaGrille.has(normaliserTitre(nom))) refuser('présent-hors-grille', `« ${nom.slice(0, 60)} » n’est pas un concurrent de la grille`, cible)

    const suivies = s.familles ?? []
    if (suivies.length > BORNES_DES_SEGMENTS.famillesMax) refuser('familles-hors-bornes', `${suivies.length} familles, ${BORNES_DES_SEGMENTS.famillesMax} au plus`, cible)
    for (const f of suivies) {
      if (!VEILLES.includes(f.veille) || !familles.has(`${f.veille}:${f.numéro}`)) refuser('famille-inconnue', `famille ${f.numéro} (${String(f.veille)}) absente de la grille`, cible)
    }
  }
  return refus
}

export function messageDeRepriseDesSegments(refus: readonly Refus[]): string {
  return (
    'LES SEGMENTS NE SONT PAS ACCEPTÉS. Corrige chacun des points suivants et renvoie la liste complète, dans le même format.\n' +
    refus.map((r) => `- [${r.code}]${r.cible ? ` ${r.cible} :` : ''} ${r.message}`).join('\n')
  )
}

const trié = (liste: readonly string[] | undefined) => [...(liste ?? [])].sort()

/** Ce qui délimite un segment et chiffre son potentiel : si cela change, sa série repart. */
export function empreinteDuPérimètre(s: SegmentDeMarché): string {
  const c = s.cibles ?? null
  const o = s.offre ?? null
  const d = s.dépense ?? null
  const mp = s.marchésPublics ?? null
  return empreinte(
    JSON.stringify({
      // Posée seulement quand elle existe : un segment sans code CPV garde l'empreinte d'avant.
      ...(mp ? { m: trié(mp.cpv) } : {}),
      c: c === null ? null : c.sorte === 'registre' ? ['r', trié(c.naf), trié(c.tranches), trié(c.départements), c.collectivités === true] : ['d', c.nombre, c.source],
      o: o === null ? null : [trié(o.naf), trié(o.départements), o.texte ?? null],
      d: d === null ? null : [d.basse, d.haute, d.source],
    }),
  )
}

/** Insensible à l'ordre des segments, des entités et des familles : la même liste re-postée ne crée pas de version. */
export function empreinteDesSegments(segments: readonly SegmentDeMarché[]): string {
  return empreinte(
    JSON.stringify(
      [...segments]
        .sort((a, b) => a.clé.localeCompare(b.clé))
        .map((s) => [
          s.clé,
          s.libellé,
          s.parent,
          empreinteDuPérimètre(s),
          trié((s.entités ?? []).map(normaliserTitre)),
          s.présents == null ? null : trié(s.présents.map(normaliserTitre)),
          trié((s.familles ?? []).map((f) => `${f.veille}:${f.numéro}`)),
          // Posé seulement quand il existe : un arbre sans nom de cibles garde l'empreinte d'avant.
          ...(s.cibles?.libellé ? [s.cibles.libellé] : []),
        ]),
    ),
  )
}

// ── La mesure d'un segment ──────────────────────────────────────────────────

/** Un compte lu dans un registre : `null` s'il n'a pas répondu, `plafonné` s'il a rendu son plafond. */
/** `découpé` : le périmètre dépassait le plafond du registre, le nombre est la somme de ses tranches d'effectif. */
export type Compte = { readonly nombre: number | null; readonly plafonné: boolean; readonly source: string | null; readonly découpé?: boolean }

/** Au-delà, un montant publié est tenu pour une erreur de saisie ou un accord-cadre sans rapport avec la dépense d'une année. */
export const MONTANT_MAX_D_UN_MARCHÉ = 100_000_000

/** Les marchés publics attribués d'un segment, tels que lus dans les données essentielles de la commande publique. */
export type AchatsPublics = {
  readonly marchés: number
  /** En euros hors taxes, somme des montants notifiés. */
  readonly montant: number
  readonly titulaires: number
  /** Les marchés écartés parce que leur montant dépasse `MONTANT_MAX_D_UN_MARCHÉ` ; `null` si non compté. */
  readonly écartés: number | null
  /** Par SIREN demandé (les concurrents de la grille), ceux qui sont titulaires. */
  readonly parSiren: readonly { readonly siren: string; readonly marchés: number; readonly montant: number }[]
  readonly du: string
  /** Borne exclue. */
  readonly au: string
  readonly source: string
}

/** Ce que l'orchestration a lu pour un segment, avant l'assemblage. */
export type ComptesDuSegment = {
  readonly cibles: Compte | null
  readonly offreurs: Compte | null
  readonly entrées: number | null
  readonly sorties: number | null
  /** `undefined` : le segment n'a pas de code CPV. `null` : la source n'a pas répondu. */
  readonly achats?: AchatsPublics | null
}

/** Un fait étiqueté, réduit à ce que l'activité d'un segment regarde. */
export type FaitPourLesSegments = {
  readonly famille: string | null
  readonly axe: number | null
  readonly entité: string | null
  readonly impact: string
}

/** Un concurrent dont le benchmark du trimestre a lu les comptes. */
export type ChiffreDUnPrésent = { readonly nom: string; readonly chiffreDAffaires: number | null }

export type MesureDeSegment = {
  readonly clé: string
  readonly libellé: string
  readonly parent: string | null
  readonly niveau: NiveauDeSegment
  /** `empreinteDuPérimètre` : une mesure ne se compare qu'à une mesure du même périmètre. */
  readonly périmètre: string
  readonly cibles: number | null
  readonly ciblesPlafonnées: boolean
  readonly ciblesOrigine: 'registre' | 'declare' | null
  /** Ce que l'on compte (« établissements hospitaliers »), tel que l'arbre le nomme. Absent des mesures d'avant. */
  readonly ciblesLibellé?: string | null
  /** Cibles × dépense, en euros par an. `somme` : la racine additionne ses offres chiffrées. */
  readonly potentiel: { readonly bas: number; readonly haut: number; readonly origine: 'calcul' | 'somme' } | null
  readonly offreurs: number | null
  readonly offreursPlafonnés: boolean
  readonly entrées: number | null
  readonly sorties: number | null
  /** `null` : la présence des concurrents n'est pas renseignée sur ce segment. */
  readonly présents: readonly string[] | null
  /**
   * `arbre` : posés avec le segment. `marches` : titulaires d'un marché public
   * du segment, reconnus par leur SIREN. `faits` : déduits des faits du
   * trimestre qui nomment un concurrent de la grille.
   */
  readonly présentsOrigine?: 'arbre' | 'marches' | 'faits' | null
  /**
   * L'achat public du segment sur douze mois : une dépense constatée, distincte
   * du potentiel, qui reste une hypothèse. Absent ou `null` : le segment n'a pas
   * de code CPV, ou la source n'a pas répondu (la limite le dit).
   */
  readonly achatPublic?: {
    readonly montant: number
    readonly marchés: number
    readonly titulaires: number
    readonly du: string
    readonly au: string
    /** Les concurrents de la grille titulaires, du plus gros montant au plus petit. */
    readonly concurrents: readonly { readonly nom: string; readonly marchés: number; readonly montant: number }[]
    /** Ce que l'organisation elle-même a remporté, quand sa grille porte son SIREN ; `null` sinon. */
    readonly organisation?: { readonly marchés: number; readonly montant: number } | null
  } | null
  readonly chiffreDAffairesDesPrésents: number | null
  readonly présentsAvecComptes: number
  readonly faits: number
  readonly faitsForts: number
  readonly sources: readonly string[]
  readonly limites: readonly string[]
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const veilleDe = (famille: string | null): Veille | null => {
  const n = sansAccent(famille ?? '')
  return n.startsWith('eco') ? 'ecosysteme' : n.startsWith('conc') ? 'concurrentiel' : null
}

/**
 * Les faits qui comptent pour un segment : ceux d'une de ses familles (l'axe de
 * la lettre est le numéro de la famille ; une lettre unique, sans famille
 * d'édition, se rattache par le numéro seul), ou ceux qui nomment une de ses
 * entités. Un rattachement par règle, sans modèle : il vaut pour les faits déjà
 * étiquetés comme pour les suivants.
 */
export function faitsDuSegment<F extends FaitPourLesSegments>(segment: SegmentDeMarché, faits: readonly F[]): F[] {
  const entités = new Set((segment.entités ?? []).map(normaliserTitre))
  const familles = segment.familles ?? []
  return faits.filter((f) => {
    if (f.entité !== null && entités.has(normaliserTitre(f.entité))) return true
    if (f.axe === null) return false
    const veille = veilleDe(f.famille)
    return familles.some((x) => x.numéro === f.axe && (veille === null || x.veille === veille))
  })
}

/**
 * Assemble les mesures d'une période à partir de comptes déjà lus. Aucun
 * chiffre n'est inventé : un compte qui manque vaut `null`, un compte au
 * plafond du registre ne donne pas de potentiel, et chaque limite est écrite.
 */
export function mesurerLesSegments(
  segments: readonly SegmentDeMarché[],
  entrée: {
    readonly comptes: ReadonlyMap<string, ComptesDuSegment>
    readonly faits: readonly FaitPourLesSegments[]
    readonly chiffres: readonly ChiffreDUnPrésent[]
    /** Les concurrents de la grille : un fait du segment qui en nomme un le dit présent. */
    readonly concurrents?: readonly string[]
    /** Le SIREN des concurrents de la grille qui en portent un : il reconnaît le titulaire d'un marché public. */
    readonly sirens?: readonly { readonly nom: string; readonly siren: string }[]
    /** Le SIREN de l'organisation, quand sa grille le porte : sa propre part de l'achat public. */
    readonly sirenDeLOrganisation?: string | null
  },
): MesureDeSegment[] {
  const chiffres = new Map(entrée.chiffres.map((c) => [normaliserTitre(c.nom), c.chiffreDAffaires]))
  const concurrents = new Map((entrée.concurrents ?? []).map((nom) => [normaliserTitre(nom), nom]))
  const nomDuSiren = new Map((entrée.sirens ?? []).map((x) => [x.siren, x.nom]))
  const DÉCOUPE = 'compté tranche d’effectif par tranche, le périmètre dépassant le plafond du registre ; une entreprise sans tranche déclarée n’y entre pas.'
  const mesures = segments.map((s): MesureDeSegment => {
    const comptes = entrée.comptes.get(s.clé) ?? { cibles: null, offreurs: null, entrées: null, sorties: null }
    const limites: string[] = []
    const sources: string[] = []
    const c = s.cibles ?? null

    let cibles: number | null = null
    let ciblesPlafonnées = false
    if (c?.sorte === 'declare') {
      cibles = c.nombre
      sources.push(c.source)
      limites.push('Nombre de cibles déclaré, non compté par le portail : il vaut ce que vaut sa source.')
    } else if (c?.sorte === 'registre') {
      cibles = comptes.cibles?.nombre ?? null
      ciblesPlafonnées = comptes.cibles?.plafonné ?? false
      if (comptes.cibles?.source) sources.push(comptes.cibles.source)
      if (cibles === null) limites.push('Cibles n.d. : le registre des entreprises n’a pas répondu dans le temps imparti.')
      if (comptes.cibles?.découpé) limites.push(`Cibles : ${DÉCOUPE}`)
      if (ciblesPlafonnées) {
        limites.push(
          comptes.cibles?.découpé
            ? 'Cibles : une tranche dépasse encore le plafond du registre, le nombre affiché est un minimum.'
            : `Plus de ${PLAFOND_DU_REGISTRE.toLocaleString('fr-FR')} cibles : le registre ne compte pas au-delà. Périmètre à resserrer, ou nombre à déclarer avec sa source.`,
        )
      }
    }

    const d = s.dépense ?? null
    let potentiel: MesureDeSegment['potentiel'] = null
    if (d && cibles !== null && !ciblesPlafonnées) {
      potentiel = { bas: Math.round(cibles * d.basse), haut: Math.round(cibles * d.haute), origine: 'calcul' }
      sources.push(d.source)
      limites.push('Potentiel : cibles multipliées par une dépense annuelle posée en hypothèse. Un ordre de grandeur, pas une mesure du marché.')
    } else if (c !== null && !d) {
      limites.push('Potentiel en euros n.d. : aucune hypothèse de dépense par cible n’est posée sur ce segment.')
    }

    if (comptes.offreurs?.source) sources.push(comptes.offreurs.source)
    if (comptes.offreurs?.découpé) limites.push(`Offreurs : ${DÉCOUPE}`)
    if (comptes.offreurs?.plafonné) {
      limites.push(
        comptes.offreurs.découpé
          ? 'Offreurs : une tranche dépasse encore le plafond du registre, le nombre affiché est un minimum.'
          : `Plus de ${PLAFOND_DU_REGISTRE.toLocaleString('fr-FR')} offreurs : le registre ne compte pas au-delà.`,
      )
    }
    if (s.offre?.texte !== undefined) limites.push(`Entrées et procédures collectives : annonces du BODACC sur douze mois, filtrées par le texte « ${s.offre.texte} ».`)

    // Le marché entier, sans rattachement propre, porte toute l'activité de la veille.
    const entier = s.parent === null && !(s.familles ?? []).length && !(s.entités ?? []).length
    const siens = entier ? [...entrée.faits] : faitsDuSegment(s, entrée.faits)

    // Présence posée avec le segment, ou à défaut déduite : un concurrent de la grille que nomme un fait du segment.
    // Aucun fait ne prouve une niche ouverte : sans concurrent nommé, la présence reste non renseignée.
    let présents: string[] | null = s.présents == null ? null : [...s.présents]
    let présentsOrigine: 'arbre' | 'marches' | 'faits' | null = présents === null ? null : 'arbre'

    // L'achat public : ce que les acheteurs publics ont notifié sur les codes CPV du segment, en douze mois.
    let achatPublic: MesureDeSegment['achatPublic'] = null
    if (s.marchésPublics) {
      const a = comptes.achats ?? null
      if (a === null) {
        limites.push('Achat public n.d. : les données essentielles de la commande publique n’ont pas répondu dans le temps imparti.')
      } else {
        const parNom = new Map<string, { marchés: number; montant: number }>()
        for (const t of a.parSiren) {
          const nom = nomDuSiren.get(t.siren)
          if (nom === undefined) continue
          const déjà = parNom.get(nom) ?? { marchés: 0, montant: 0 }
          parNom.set(nom, { marchés: déjà.marchés + t.marchés, montant: déjà.montant + t.montant })
        }
        const titulaires = [...parNom.entries()].map(([nom, x]) => ({ nom, ...x })).sort((x, y) => y.montant - x.montant || x.nom.localeCompare(y.nom, 'fr'))
        const elle = entrée.sirenDeLOrganisation ?? null
        const sienne = elle === null ? null : (a.parSiren.find((t) => t.siren === elle) ?? { marchés: 0, montant: 0 })
        achatPublic = {
          montant: Math.round(a.montant),
          marchés: a.marchés,
          titulaires: a.titulaires,
          du: a.du,
          au: a.au,
          concurrents: titulaires,
          organisation: sienne === null ? null : { marchés: sienne.marchés, montant: sienne.montant },
        }
        sources.push(a.source)
        limites.push(
          `Achat public : marchés notifiés du ${a.du} au ${a.au} exclu sur les codes CPV ${trié(s.marchésPublics.cpv).join(', ')} (données essentielles de la commande publique). Une dépense constatée, pas tout le marché : les achats privés n’y sont pas, ni les marchés que leur acheteur n’a pas publiés, et un accord-cadre y compte pour son montant notifié entier.`,
        )
        if (a.écartés !== null && a.écartés > 0) limites.push(`Achat public : ${a.écartés} marché(s) de ${montantCourt(MONTANT_MAX_D_UN_MARCHÉ)} ou plus écarté(s), montant tenu pour une erreur de saisie.`)
        if (présents === null && !entier && titulaires.length > 0) {
          présents = titulaires.map((t) => t.nom)
          présentsOrigine = 'marches'
          limites.push(
            `Concurrents présents reconnus par leur SIREN parmi les titulaires : ${titulaires.map((t) => `${t.nom} (${t.marchés} marché${t.marchés > 1 ? 's' : ''}, ${montantCourt(t.montant)})`).join(', ')}. Seul le premier titulaire d’un marché est lu, et un concurrent sans SIREN dans la grille n’est pas reconnu.`,
          )
        }
      }
    }

    if (présents === null && !entier) {
      const nommés = new Map<string, number>()
      for (const f of siens) {
        const nom = f.entité === null ? undefined : concurrents.get(normaliserTitre(f.entité))
        if (nom !== undefined) nommés.set(nom, (nommés.get(nom) ?? 0) + 1)
      }
      if (nommés.size > 0) {
        présents = [...nommés.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'fr')).map(([nom]) => nom)
        présentsOrigine = 'faits'
        limites.push(`Concurrents présents déduits des faits du trimestre : ${[...nommés.entries()].map(([nom, n]) => `${nom} (${n})`).join(', ')}. Un concurrent que la veille n’a pas nommé sur ce segment n’y figure pas.`)
      }
    }
    const lus = (présents ?? []).map((nom) => chiffres.get(normaliserTitre(nom)) ?? null).filter((x): x is number => x !== null)
    if (présents && présents.length > 0) limites.push(`Chiffre d’affaires des concurrents présents : comptes publiés au registre (${lus.length} sur ${présents.length}), toutes activités confondues, pas leur seul chiffre sur ce segment.`)

    return {
      clé: s.clé,
      libellé: s.libellé,
      parent: s.parent,
      niveau: niveauDe(s, segments),
      périmètre: empreinteDuPérimètre(s),
      cibles,
      ciblesPlafonnées,
      ciblesOrigine: c?.sorte ?? null,
      ciblesLibellé: c?.libellé?.trim() || null,
      potentiel,
      offreurs: comptes.offreurs?.nombre ?? null,
      offreursPlafonnés: comptes.offreurs?.plafonné ?? false,
      entrées: comptes.entrées,
      sorties: comptes.sorties,
      présents,
      présentsOrigine,
      ...(s.marchésPublics ? { achatPublic } : {}),
      chiffreDAffairesDesPrésents: lus.length > 0 ? lus.reduce((a, b) => a + b, 0) : null,
      présentsAvecComptes: lus.length,
      faits: siens.length,
      faitsForts: siens.filter((f) => f.impact === 'FORT').length,
      sources: [...new Set(sources)],
      limites,
    }
  })

  // La racine sans potentiel propre additionne ses offres chiffrées, et dit combien ne le sont pas.
  return mesures.map((m) => {
    if (m.niveau !== 'marche' || m.potentiel) return m
    const offres = mesures.filter((x) => x.parent === m.clé)
    const chiffrées = offres.filter((x) => x.potentiel)
    if (chiffrées.length === 0) return m
    const manque = offres.length - chiffrées.length
    return {
      ...m,
      potentiel: {
        bas: chiffrées.reduce((a, x) => a + x.potentiel!.bas, 0),
        haut: chiffrées.reduce((a, x) => a + x.potentiel!.haut, 0),
        origine: 'somme' as const,
      },
      limites: [
        ...m.limites.filter((l) => !l.startsWith('Potentiel en euros n.d.')),
        `Potentiel global : somme des offres chiffrées (${chiffrées.length} sur ${offres.length})${manque > 0 ? ` ; ${manque} offre(s) sans chiffre n’y figurent pas` : ''}. Une cible servie par deux offres y compte deux fois.`,
      ],
    }
  })
}

// ── L'état d'un segment, calculé sur la suite de ses mesures ────────────────

export type TendanceDeSegment = 'hausse' | 'stable' | 'baisse'
export type ÉtatDeSegment = 'apparu' | 'en_croissance' | 'stable' | 'en_regression' | 'eteint'

export const LIBELLÉS_D_ÉTAT: Readonly<Record<ÉtatDeSegment, string>> = {
  apparu: 'première mesure',
  en_croissance: 'en croissance',
  stable: 'stable',
  en_regression: 'en régression',
  eteint: 'éteint',
}

/** En deçà, un écart de taille est du bruit de registre. */
export const SEUIL_DE_TAILLE = 0.05
/** L'activité de la veille bouge plus : un quart, et deux faits d'écart au moins. */
export const SEUIL_D_ACTIVITÉ = 0.25

const taille = (m: MesureDeSegment): number | null => (m.potentiel ? m.potentiel.haut : m.ciblesPlafonnées ? null : m.cibles)

/**
 * Le mouvement entre deux mesures du même périmètre : la taille (potentiel, ou
 * cibles à défaut) quand les deux la portent, l'activité de la veille sinon.
 * `null` si le périmètre a changé : les deux mesures ne se comparent pas.
 */
export function tendanceEntre(avant: MesureDeSegment, après: MesureDeSegment): TendanceDeSegment | null {
  if (avant.périmètre !== après.périmètre) return null
  const a = taille(avant)
  const b = taille(après)
  if (a !== null && b !== null && a > 0) {
    const écart = (b - a) / a
    if (écart >= SEUIL_DE_TAILLE) return 'hausse'
    if (écart <= -SEUIL_DE_TAILLE) return 'baisse'
    // Taille inchangée : l'activité départage.
  }
  const écart = après.faits - avant.faits
  if (Math.abs(écart) < 2) return 'stable'
  const relatif = avant.faits === 0 ? 1 : Math.abs(écart) / avant.faits
  if (relatif < SEUIL_D_ACTIVITÉ) return 'stable'
  return écart > 0 ? 'hausse' : 'baisse'
}

const muet = (m: MesureDeSegment) => m.faits === 0 && (m.cibles === null || m.cibles === 0)

/**
 * L'état d'un segment, de sa mesure la plus ancienne à la plus récente : il
 * n'est jamais stocké. `modifié` : le périmètre a changé depuis la mesure
 * précédente, la série repart et rien n'est comparé.
 */
export function étatDuSegment(série: readonly MesureDeSegment[]): { readonly état: ÉtatDeSegment; readonly tendance: TendanceDeSegment | null; readonly modifié: boolean } {
  const dernière = série.at(-1)
  const précédente = série.at(-2)
  if (!dernière || !précédente) return { état: 'apparu', tendance: null, modifié: false }
  const tendance = tendanceEntre(précédente, dernière)
  if (tendance === null) return { état: 'stable', tendance: null, modifié: true }
  if (muet(dernière) && muet(précédente)) return { état: 'eteint', tendance, modifié: false }
  if (tendance === 'hausse') return { état: 'en_croissance', tendance, modifié: false }
  const avant = série.at(-3)
  if (tendance === 'baisse' && avant && tendanceEntre(avant, précédente) === 'baisse') return { état: 'en_regression', tendance, modifié: false }
  return { état: 'stable', tendance, modifié: false }
}

// ── La vue de l'écran ───────────────────────────────────────────────────────

export type LigneDeMarché = MesureDeSegment & {
  readonly état: ÉtatDeSegment
  readonly tendance: TendanceDeSegment | null
  readonly modifié: boolean
  /** Aucun concurrent présent, renseigné comme tel, et aucun offreur compté au registre. */
  readonly ouverte: boolean
}

export type VueDesMarchés = {
  readonly période: string
  /** Dans l'ordre de l'arbre : le marché, puis chaque offre suivie de ses niches. */
  readonly lignes: readonly LigneDeMarché[]
  /** Mesurés à la période précédente, absents de celle-ci : retirés de l'arbre. */
  readonly disparus: readonly { readonly clé: string; readonly libellé: string; readonly niveau: NiveauDeSegment }[]
  readonly comptes: { readonly segments: number; readonly chiffrés: number; readonly ouverts: number }
}

/**
 * La vue des marchés à partir des mesures de chaque période, de la plus
 * ancienne à la plus récente. `null` sans mesure.
 */
export function vueDesMarchés(périodes: readonly { readonly période: string; readonly mesures: readonly MesureDeSegment[] }[]): VueDesMarchés | null {
  const dernière = périodes.at(-1)
  if (!dernière || dernière.mesures.length === 0) return null
  const lignes = dernière.mesures.map((m): LigneDeMarché => {
    const série = périodes.map((p) => p.mesures.find((x) => x.clé === m.clé)).filter((x): x is MesureDeSegment => x !== undefined)
    return { ...m, ...étatDuSegment(série), ouverte: m.niveau !== 'marche' && m.présents !== null && m.présents.length === 0 && !m.offreurs }
  })
  const enfants = (parent: string | null) => lignes.filter((l) => l.parent === parent)
  const ordonnées: LigneDeMarché[] = []
  const poser = (l: LigneDeMarché) => {
    ordonnées.push(l)
    for (const e of enfants(l.clé)) poser(e)
  }
  for (const racine of enfants(null)) poser(racine)
  // Un segment dont le parent n'a pas de mesure reste lisible, en fin de liste.
  for (const l of lignes) if (!ordonnées.includes(l)) ordonnées.push(l)

  const avant = périodes.at(-2)?.mesures ?? []
  const présentes = new Set(lignes.map((l) => l.clé))
  return {
    période: dernière.période,
    lignes: ordonnées,
    disparus: avant.filter((m) => !présentes.has(m.clé)).map((m) => ({ clé: m.clé, libellé: m.libellé, niveau: m.niveau })),
    comptes: {
      segments: lignes.length,
      chiffrés: lignes.filter((l) => l.potentiel !== null).length,
      ouverts: lignes.filter((l) => l.ouverte).length,
    },
  }
}

// ── La décision : un verdict par segment, par règle ─────────────────────────

/** Au moins autant de faits dans le trimestre : l'activité de la veille est soutenue. */
export const SEUIL_D_ACTIVITÉ_SOUTENUE = 10
/** Au moins autant de concurrents suivis sur le segment : la concurrence est dense. */
export const SEUIL_DE_CONCURRENCE_DENSE = 4

export type VerdictDeSegment = 'pousser' | 'disputer' | 'surveiller' | 'ecarter'

/** Dans l'ordre de lecture de la matrice : soutenu puis calme, concurrence limitée puis dense. */
export const VERDICTS: readonly VerdictDeSegment[] = ['pousser', 'disputer', 'surveiller', 'ecarter']

export const LIBELLÉS_DE_VERDICT: Readonly<Record<VerdictDeSegment, string>> = {
  pousser: 'à pousser',
  disputer: 'à disputer',
  surveiller: 'à surveiller',
  ecarter: 'à écarter',
}

/** La règle de chaque verdict, telle que l'écran l'affiche sous son titre. */
export const RÈGLES_DE_VERDICT: Readonly<Record<VerdictDeSegment, string>> = {
  pousser: `Activité soutenue (${SEUIL_D_ACTIVITÉ_SOUTENUE} faits ou plus), moins de ${SEUIL_DE_CONCURRENCE_DENSE} concurrents suivis`,
  disputer: `Activité soutenue, ${SEUIL_DE_CONCURRENCE_DENSE} concurrents suivis ou plus`,
  surveiller: `Activité calme, ou concurrence non mesurée`,
  ecarter: `Activité calme et concurrence dense, ou segment en recul`,
}

export type LectureDeSegment = {
  readonly verdict: VerdictDeSegment
  /** La situation du segment, en une phrase : son activité, puis sa concurrence. */
  readonly raison: string
}

const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`

/**
 * Le verdict d'un segment, par règle et jamais par un modèle : deux mesures du
 * trimestre, l'activité de la veille (faits rattachés) et la concurrence
 * (concurrents suivis présents), croisées en quatre cases. Un segment éteint ou
 * en régression est écarté quelle que soit sa case ; une concurrence non
 * mesurée ne conclut jamais mieux que « à surveiller ». La phrase décrit la
 * situation avec les mots de la règle, les chiffres entre parenthèses.
 */
export function lectureDuSegment(l: LigneDeMarché): LectureDeSegment {
  if (l.état === 'eteint') return { verdict: 'ecarter', raison: 'Le segment s’est éteint : ni fait ni cible depuis deux trimestres.' }
  const soutenue = l.faits >= SEUIL_D_ACTIVITÉ_SOUTENUE
  const forts = l.faitsForts > 0 ? `, dont ${l.faitsForts} ${l.faitsForts > 1 ? 'signaux forts' : 'signal fort'}` : ''
  const activité =
    l.faits === 0 ? 'Aucun fait relevé par la veille ce trimestre' : `${soutenue ? 'Activité soutenue' : 'Peu d’activité'} ce trimestre (${pluriel(l.faits, 'fait')}${forts})`
  const début = l.état === 'en_regression' ? `En recul depuis deux trimestres. ${activité}` : activité
  if (l.présents === null) return { verdict: l.état === 'en_regression' ? 'ecarter' : 'surveiller', raison: `${début} ; la concurrence n’y est pas encore mesurée.` }
  const n = l.présents.length
  const dense = n >= SEUIL_DE_CONCURRENCE_DENSE
  const présence = n === 0 ? 'aucun concurrent suivi n’y est présent' : `${pluriel(n, 'concurrent')} suivi${n > 1 ? 's' : ''} y ${n > 1 ? 'sont présents' : 'est présent'}`
  const concurrence = dense ? `sur un segment disputé : ${présence}` : `et peu de concurrence : ${présence}`
  const verdict: VerdictDeSegment = l.état === 'en_regression' ? 'ecarter' : soutenue ? (dense ? 'disputer' : 'pousser') : dense ? 'ecarter' : 'surveiller'
  return { verdict, raison: `${début} ${concurrence}.` }
}

export type CaseDeDécision = {
  readonly verdict: VerdictDeSegment
  /** Les segments de la case, du plus actif au moins actif. */
  readonly segments: readonly { readonly clé: string; readonly libellé: string; readonly niveau: NiveauDeSegment; readonly faits: number }[]
}

/** La matrice de décision : les offres et les niches rangées par verdict, le marché entier à part. */
export function matriceDeDécision(lignes: readonly LigneDeMarché[]): { readonly cases: readonly CaseDeDécision[]; readonly faitsMax: number } {
  const classées = lignes.filter((l) => l.niveau !== 'marche').map((l) => ({ l, verdict: lectureDuSegment(l).verdict }))
  return {
    cases: VERDICTS.map((verdict) => ({
      verdict,
      segments: classées
        .filter((c) => c.verdict === verdict)
        .map(({ l }) => ({ clé: l.clé, libellé: l.libellé, niveau: l.niveau, faits: l.faits }))
        .sort((a, b) => b.faits - a.faits),
    })),
    faitsMax: Math.max(0, ...classées.map((c) => c.l.faits)),
  }
}

/** Les bornes d'un trimestre `AAAA-Tn`, en dates du calendrier. */
export function fenêtreDuTrimestre(période: string): { readonly début: string; readonly fin: string } | null {
  const t = /^(\d{4})-T([1-4])$/.exec(période)
  if (!t) return null
  const année = Number(t[1])
  const premier = (Number(t[2]) - 1) * 3
  const fin = new Date(Date.UTC(année, premier + 3, 0))
  return { début: `${année}-${String(premier + 1).padStart(2, '0')}-01`, fin: fin.toISOString().slice(0, 10) }
}

/** Un montant en euros, arrondi pour être lu : « 1,2 M€ », « 340 k€ ». */
export function montantCourt(euros: number): string {
  const f = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: n < 10 ? 1 : 0 })
  if (euros >= 1_000_000_000) return `${f(euros / 1_000_000_000)} Md€`
  if (euros >= 1_000_000) return `${f(euros / 1_000_000)} M€`
  if (euros >= 1_000) return `${f(euros / 1_000)} k€`
  return `${f(euros)} €`
}
