import {
  CASES_SWOT,
  FORCES_PORTER,
  LIBELLÉS_PESTEL,
  LIBELLÉS_PORTER,
  normaliserTitre,
  normaliserUrl,
  PESTEL,
  trousDuPestel,
  type CaseSwot,
  type ForcePorter,
  type Grille,
  type LigneDeBenchmark,
  type Pestel,
} from '@/lib/domaine/strategie'
import { enSlug } from '@/lib/domaine/slug'
import { sansAccent } from '@/lib/domaine/texte'

/**
 * Ce que les écrans du client montrent d'une synthèse publiée (outils
 * stratégiques, lot 11), calculé ici sans rien lire : la carte des groupes
 * stratégiques et la matrice de Mendelow pour « Acteurs », la SWOT et la TOWS
 * codées pour « Recommandations », les cinq forces et les scénarios pour la
 * lecture du trimestre, et l'onglet PESTEL de « Les axes ». Hiérarchie : les
 * maquettes validées le 26 octobre 2026 (`docs/plan-outils-strategiques.md`,
 * lot 11).
 *
 * Aucune note, aucune couleur nouvelle : les crans ont leur libellé, les
 * mouvements leur fait daté. Ce qui n'est pas placé n'est pas inventé.
 */

/** Une ligne d'élément ou de position, telle que la base la rend, réduite à ce que les vues lisent. */
export type ÉlémentLu = {
  readonly id: string
  readonly outil: string
  readonly clé: string
  readonly rang: number
  readonly énoncé: string | null
  readonly origine: string
  readonly faits: readonly string[]
  readonly références: unknown
  readonly candidateRecommandation: boolean
}
export type PositionLue = {
  readonly outil: string
  readonly sujet: string
  readonly axe: string
  readonly cran: number | null
  readonly nonSuivi: boolean
  readonly tendance: string | null
  readonly faits: readonly string[]
  /** `declaratif` : lue dans le corpus de la veille, sans fait daté (30 octobre 2026). */
  readonly origine?: string
}
/** Un fait cité, pour dater une case : sa date, et la lettre qui le porte. */
export type FaitCité = { readonly date: string; readonly édition: string }

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] as const
export const dateCourte = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** « Synthèse d’octobre 2026 », « Trimestre de juillet à septembre 2026 ». */
export function libelléDePériode(période: string): string {
  const mois = /^(\d{4})-(\d{2})$/.exec(période)
  if (mois) {
    const nom = MOIS_LONGS[Number(mois[2]) - 1] ?? ''
    return `${/^[aeiouyé]/i.test(nom) ? 'd’' : 'de '}${nom} ${mois[1]}`
  }
  const t = /^(\d{4})-T([1-4])$/.exec(période)
  if (t) {
    const premier = (Number(t[2]) - 1) * 3
    return `de ${MOIS_LONGS[premier]} à ${MOIS_LONGS[premier + 2]} ${t[1]}`
  }
  return période
}

/** Le fait le plus récent d'une liste, pour dater une case. */
function plusRécent(ids: readonly string[], faits: ReadonlyMap<string, FaitCité>): FaitCité | null {
  let meilleur: FaitCité | null = null
  for (const id of ids) {
    const f = faits.get(id)
    if (f && (!meilleur || f.date > meilleur.date)) meilleur = f
  }
  return meilleur
}

// ── Carte des groupes stratégiques ───────────────────────────────────────────

export type OccupantDeCase = {
  readonly sujet: string
  readonly organisation: boolean
  /** Le cran a changé sur l'un des deux axes depuis la synthèse publiée précédente. */
  readonly aBougé: boolean
  /** « Venu de 2 · 1 » : les crans précédents, ligne puis colonne. */
  readonly venuDe: { readonly ligne: number; readonly colonne: number } | null
  readonly fait: FaitCité | null
}

export type VueDeLaCarte = {
  readonly colonnes: { readonly clé: string; readonly libellé: string; readonly crans: readonly string[] }
  readonly lignes: { readonly clé: string; readonly libellé: string; readonly crans: readonly string[] }
  /** Clé `ligne:colonne`, crans à partir de 1. */
  readonly cases: ReadonlyMap<string, readonly OccupantDeCase[]>
  /** La position précédente d'un sujet qui a bougé, en pointillé dans sa case d'origine. */
  readonly anciennes: ReadonlyMap<string, readonly string[]>
  readonly placés: number
  /** Les placés dont la position est déclarative : lue dans le corpus de la veille, sans fait daté. */
  readonly déclaratifs: number
}

/** La carte : la première clé d'axe de la grille en colonnes, la seconde en lignes. Un sujet sans ses deux crans n'est pas placé. */
export function vueDeLaCarte(
  grille: Grille,
  positionsDuMois: readonly PositionLue[],
  précédentes: readonly PositionLue[],
  organisation: string,
  faits: ReadonlyMap<string, FaitCité>,
): VueDeLaCarte | null {
  const [colonnes, lignes] = grille.axesGroupes
  if (!colonnes || !lignes) return null
  const crans = (liste: readonly PositionLue[]) => {
    const parSujet = new Map<string, { ligne?: number; colonne?: number; faits: string[]; déclaratif: boolean }>()
    for (const p of liste) {
      if (p.outil !== 'groupes' || p.cran === null) continue
      const s = parSujet.get(p.sujet) ?? { faits: [], déclaratif: true }
      if (p.axe === colonnes.clé) s.colonne = p.cran
      if (p.axe === lignes.clé) s.ligne = p.cran
      s.faits.push(...p.faits)
      s.déclaratif &&= p.origine === 'declaratif'
      parSujet.set(p.sujet, s)
    }
    return parSujet
  }
  const maintenant = crans(positionsDuMois)
  const avant = crans(précédentes)
  const elle = normaliserTitre(organisation)
  const cases = new Map<string, OccupantDeCase[]>()
  const anciennes = new Map<string, string[]>()
  let placés = 0
  let déclaratifs = 0
  for (const [sujet, c] of maintenant) {
    if (c.ligne === undefined || c.colonne === undefined) continue
    if (c.déclaratif) déclaratifs++
    const a = avant.get(sujet)
    const aBougé = !!a && a.ligne !== undefined && a.colonne !== undefined && (a.ligne !== c.ligne || a.colonne !== c.colonne)
    const clé = `${c.ligne}:${c.colonne}`
    cases.set(clé, [
      ...(cases.get(clé) ?? []),
      { sujet, organisation: normaliserTitre(sujet) === elle, aBougé, venuDe: aBougé ? { ligne: a!.ligne!, colonne: a!.colonne! } : null, fait: plusRécent(c.faits, faits) },
    ])
    if (aBougé) anciennes.set(`${a!.ligne}:${a!.colonne}`, [...(anciennes.get(`${a!.ligne}:${a!.colonne}`) ?? []), sujet])
    placés++
  }
  for (const occupants of cases.values()) occupants.sort((x, y) => Number(y.organisation) - Number(x.organisation) || x.sujet.localeCompare(y.sujet, 'fr'))
  return { colonnes: { clé: colonnes.clé, libellé: colonnes.libellé, crans: colonnes.crans }, lignes: { clé: lignes.clé, libellé: lignes.libellé, crans: lignes.crans }, cases, anciennes, placés, déclaratifs }
}

// ── Concurrents (lot 2 de la réorganisation, 30 octobre 2026) ────────────────

/** Une position lue avec sa période et sa référence, pour l'historique d'une fiche. */
export type PositionDatée = PositionLue & { readonly période: string; readonly référence?: string | null }

/** Un cran nommé : l'axe de la grille et le libellé du cran. */
export type CranNommé = { readonly axe: string; readonly cran: number; readonly libellé: string }

export type ConcurrentVu = {
  readonly nom: string
  /** Le segment d'URL de sa fiche, `enSlug` du nom. */
  readonly segment: string
  readonly siren: string | null
  /** Les crans du mois, dans l'ordre des axes de la grille ; vide si la synthèse ne le place pas. */
  readonly crans: readonly CranNommé[]
  /** Toutes ses positions du mois sont lues dans le corpus de la veille, sans fait daté. */
  readonly déclaratif: boolean
  /** Un cran a changé depuis la synthèse publiée précédente. */
  readonly aBougé: boolean
  /** Les faits étiquetés qui le nomment, sur toute l'archive, et la date du plus récent. */
  readonly faits: number
  readonly dernierFait: string | null
}

export type VueDesConcurrents = {
  readonly concurrents: readonly ConcurrentVu[]
  /** Ceux dont un cran a bougé ce mois-ci : les mouvements du mois. */
  readonly mouvements: readonly ConcurrentVu[]
  /** Ceux qu'aucune position du mois ne place. */
  readonly nonPlacés: number
}

function cransNommés(grille: Grille, positions: readonly PositionLue[]): CranNommé[] {
  return grille.axesGroupes.flatMap((axe) => {
    const p = positions.find((x) => x.axe === axe.clé && x.cran !== null)
    return p && p.cran !== null ? [{ axe: axe.libellé, cran: p.cran, libellé: axe.crans[p.cran - 1] ?? `cran ${p.cran}` }] : []
  })
}

/**
 * Les concurrents de la grille (veille `concurrentiel`), l'organisation exclue :
 * elle a sa place sur la carte, pas dans la liste de ses concurrents. Ordre : ce
 * qui a bougé, puis ce dont les lettres parlent le plus, puis le nom.
 */
export function vueDesConcurrents(
  grille: Grille,
  positionsDuMois: readonly PositionLue[],
  précédentes: readonly PositionLue[],
  faits: ReadonlyMap<string, { readonly nombre: number; readonly dernier: string }>,
  organisation: string,
): VueDesConcurrents {
  const elle = normaliserTitre(organisation)
  const parSujet = (liste: readonly PositionLue[]) => {
    const m = new Map<string, PositionLue[]>()
    for (const p of liste) if (p.outil === 'groupes') m.set(normaliserTitre(p.sujet), [...(m.get(normaliserTitre(p.sujet)) ?? []), p])
    return m
  }
  const maintenant = parSujet(positionsDuMois)
  const avant = parSujet(précédentes)
  const faitsNormalisés = new Map([...faits].map(([nom, f]) => [normaliserTitre(nom), f]))
  const concurrents = grille.entités
    .filter((e) => e.veille === 'concurrentiel' && normaliserTitre(e.nom) !== elle)
    .map((e): ConcurrentVu => {
      const clé = normaliserTitre(e.nom)
      const siennes = maintenant.get(clé) ?? []
      const crans = cransNommés(grille, siennes)
      const anciennes = avant.get(clé) ?? []
      const aBougé =
        crans.length > 0 &&
        anciennes.length > 0 &&
        siennes.some((p) => {
          const a = anciennes.find((x) => x.axe === p.axe)
          return !!a && a.cran !== null && a.cran !== p.cran
        })
      const f = faitsNormalisés.get(clé)
      return {
        nom: e.nom,
        segment: enSlug(e.nom),
        siren: e.siren ?? null,
        crans,
        déclaratif: siennes.length > 0 && siennes.every((p) => p.origine === 'declaratif'),
        aBougé,
        faits: f?.nombre ?? 0,
        dernierFait: f?.dernier ?? null,
      }
    })
    .sort((a, b) => Number(b.aBougé) - Number(a.aBougé) || b.faits - a.faits || a.nom.localeCompare(b.nom, 'fr'))
  return { concurrents, mouvements: concurrents.filter((c) => c.aBougé), nonPlacés: concurrents.filter((c) => c.crans.length === 0).length }
}

/** Un fait étiqueté tel qu'une fiche le montre, réduit à ce que la base en garde. */
export type FaitDeLaFiche = {
  readonly date: string
  readonly édition: string
  /** L'empreinte de sa phrase-titre : l'écran la relit dans les lettres qu'il a déjà lues. */
  readonly empreinte: string
  readonly pestel: string | null
  readonly porter: string | null
  readonly impact: string
  readonly rupture: boolean
}

export type FicheDuConcurrent = {
  readonly nom: string
  readonly siren: string | null
  /** La position de la dernière synthèse publiée qui le place, ou `null`. */
  readonly position: {
    readonly période: string
    readonly crans: readonly CranNommé[]
    readonly déclaratif: boolean
    readonly référence: string | null
  } | null
  /** Une ligne par période publiée qui le place, de la plus récente à la plus ancienne ; `aBougé` par rapport à la précédente. */
  readonly historique: readonly { readonly période: string; readonly crans: readonly CranNommé[]; readonly déclaratif: boolean; readonly aBougé: boolean }[]
  /** Ses faits étiquetés, du plus récent au plus ancien, avec le libellé de leur dimension. */
  readonly faits: readonly (FaitDeLaFiche & { readonly dimension: string | null })[]
  /** Ses chiffres publiés au registre, tels que le benchmark du dernier trimestre publié les a lus. */
  readonly chiffres: (LigneDeBenchmark & { readonly période: string }) | null
}

/**
 * La fiche d'un concurrent de la grille : sa position et son historique, ses
 * faits étiquetés, ses chiffres du registre. `null` si le nom n'est pas un
 * concurrent de la grille : un segment d'URL inventé ne mène à rien.
 */
export function vueDeLaFiche(
  grille: Grille,
  segment: string,
  positions: readonly PositionDatée[],
  faits: readonly FaitDeLaFiche[],
  benchmark: { readonly période: string; readonly lignes: readonly LigneDeBenchmark[] } | null,
): FicheDuConcurrent | null {
  const entité = grille.entités.find((e) => e.veille === 'concurrentiel' && enSlug(e.nom) === segment)
  if (!entité) return null
  const clé = normaliserTitre(entité.nom)
  const parPériode = new Map<string, PositionDatée[]>()
  for (const p of positions) {
    if (p.outil !== 'groupes' || normaliserTitre(p.sujet) !== clé) continue
    parPériode.set(p.période, [...(parPériode.get(p.période) ?? []), p])
  }
  const chronologie = [...parPériode.keys()].sort().flatMap((période) => {
    const siennes = parPériode.get(période)!
    const crans = cransNommés(grille, siennes)
    return crans.length > 0 ? [{ période, siennes, crans, déclaratif: siennes.every((p) => p.origine === 'declaratif') }] : []
  })
  const historique = chronologie
    .map((h, i) => {
      const avant = chronologie[i - 1]
      const aBougé = !!avant && h.crans.some((c) => avant.crans.some((a) => a.axe === c.axe && a.cran !== c.cran))
      return { période: h.période, crans: h.crans, déclaratif: h.déclaratif, aBougé }
    })
    .reverse()
  const dernière = chronologie.at(-1)
  const ligne = benchmark?.lignes.find((l) => normaliserTitre(l.nom) === clé) ?? null
  return {
    nom: entité.nom,
    siren: entité.siren ?? null,
    position: dernière
      ? { période: dernière.période, crans: dernière.crans, déclaratif: dernière.déclaratif, référence: dernière.siennes.find((p) => p.référence)?.référence ?? null }
      : null,
    historique,
    faits: faits.map((f) => ({
      ...f,
      dimension: f.pestel ? (LIBELLÉS_PESTEL[f.pestel as Pestel] ?? null) : f.porter ? (LIBELLÉS_PORTER[f.porter as ForcePorter] ?? null) : null,
    })),
    chiffres: ligne && benchmark ? { ...ligne, période: benchmark.période } : null,
  }
}

/** Les noms des concurrents de la grille, l'organisation exclue : ce qu'« Acteurs » laisse à « Concurrents ». */
export function nomsDesConcurrents(grille: Grille, organisation: string): readonly string[] {
  const elle = normaliserTitre(organisation)
  return grille.entités.filter((e) => e.veille === 'concurrentiel' && normaliserTitre(e.nom) !== elle).map((e) => e.nom)
}

// ── Matrice de Mendelow ──────────────────────────────────────────────────────

export const LIBELLÉS_MENDELOW = ['bas', 'intermédiaire', 'élevé'] as const
/** Les quatre coins de la matrice, tels que la lecture usuelle les nomme. */
export const STRATÉGIES_MENDELOW: Readonly<Record<string, string>> = {
  '3:1': 'Tenir satisfait',
  '3:3': 'Associer de près',
  '1:1': 'Surveiller',
  '1:3': 'Tenir informé',
}

export type VueDeMendelow = {
  /** Clé `pouvoir:intérêt`, crans de 1 à 3. */
  readonly cases: ReadonlyMap<string, readonly { readonly sujet: string; readonly aBougé: boolean; readonly fait: FaitCité | null }[]>
  readonly placés: number
  /** Les placés dont la position est déclarative : lue dans le corpus de la veille, sans fait daté. */
  readonly déclaratifs: number
}

export function vueDeMendelow(positionsDuMois: readonly PositionLue[], précédentes: readonly PositionLue[], faits: ReadonlyMap<string, FaitCité>): VueDeMendelow {
  const lire = (liste: readonly PositionLue[]) => {
    const m = new Map<string, { pouvoir?: number; interet?: number; faits: string[]; déclaratif: boolean }>()
    for (const p of liste) {
      if (p.outil !== 'mendelow' || p.cran === null) continue
      const s = m.get(p.sujet) ?? { faits: [], déclaratif: true }
      if (p.axe === 'pouvoir') s.pouvoir = p.cran
      if (p.axe === 'interet') s.interet = p.cran
      s.faits.push(...p.faits)
      s.déclaratif &&= p.origine === 'declaratif'
      m.set(p.sujet, s)
    }
    return m
  }
  const maintenant = lire(positionsDuMois)
  const avant = lire(précédentes)
  const cases = new Map<string, { sujet: string; aBougé: boolean; fait: FaitCité | null }[]>()
  let placés = 0
  let déclaratifs = 0
  for (const [sujet, s] of maintenant) {
    if (s.pouvoir === undefined || s.interet === undefined) continue
    if (s.déclaratif) déclaratifs++
    const a = avant.get(sujet)
    const aBougé = !a || a.pouvoir !== s.pouvoir || a.interet !== s.interet
    const clé = `${s.pouvoir}:${s.interet}`
    cases.set(clé, [...(cases.get(clé) ?? []), { sujet, aBougé: aBougé && avant.size > 0, fait: plusRécent(s.faits, faits) }])
    placés++
  }
  for (const liste of cases.values()) liste.sort((x, y) => x.sujet.localeCompare(y.sujet, 'fr'))
  return { cases, placés, déclaratifs }
}

// ── SWOT et TOWS codées ──────────────────────────────────────────────────────

const PRÉFIXES: Readonly<Record<CaseSwot, string>> = { forces: 'F', faiblesses: 'Fa', opportunites: 'O', menaces: 'M' }
export const LIBELLÉS_SWOT: Readonly<Record<CaseSwot, string>> = { forces: 'Forces', faiblesses: 'Faiblesses', opportunites: 'Opportunités', menaces: 'Menaces' }

export type ÉlémentDeLaSwot = {
  readonly code: string
  readonly énoncé: string
  /** « Déclaratif · votre fiche » ou « Fait du 15/10 · lettre n° 9 ». */
  readonly source: string
  /** La lettre du fait le plus récent (32 hexadécimaux), pour y mener ; nulle pour un élément déclaratif. */
  readonly édition: string | null
}
export type VueDeLaSwot = Readonly<Record<CaseSwot, readonly ÉlémentDeLaSwot[]>>

export function vueDeLaSwot(
  éléments: readonly ÉlémentLu[],
  faits: ReadonlyMap<string, FaitCité>,
  numéros: ReadonlyMap<string, number>,
): { readonly swot: VueDeLaSwot; readonly codes: ReadonlyMap<string, string> } {
  const codes = new Map<string, string>()
  const swot = Object.fromEntries(CASES_SWOT.map((c) => [c, [] as ÉlémentDeLaSwot[]])) as Record<CaseSwot, ÉlémentDeLaSwot[]>
  const swotLus = éléments.filter((é) => é.outil === 'swot' && (CASES_SWOT as readonly string[]).includes(é.clé)).sort((a, b) => a.rang - b.rang)
  for (const é of swotLus) {
    const c = é.clé as CaseSwot
    const code = `${PRÉFIXES[c]}${swot[c].length + 1}`
    codes.set(é.id, code)
    // L'identifiant de l'élément au moment du post (`S1`) est gardé dans les références : la TOWS le cite.
    const provisoire = (é.références as { idProvisoire?: string } | null)?.idProvisoire
    if (provisoire) codes.set(provisoire, code)
    const fait = plusRécent(é.faits, faits)
    const numéro = fait ? numéros.get(fait.édition) : undefined
    const source =
      é.origine === 'declaratif'
        ? 'Déclaratif · votre fiche'
        : fait
          ? `Fait du ${dateCourte(fait.date)}${numéro ? ` · lettre n° ${numéro}` : ''}`
          : 'Faits de vos lettres'
    swot[c].push({ code, énoncé: é.énoncé ?? '', source, édition: é.origine === 'declaratif' ? null : (fait?.édition || null) })
  }
  return { swot, codes }
}

export const TYPES_DE_TOWS = [
  { type: 'SO', libellé: 'Forces × opportunités', verbe: 'Saisir' },
  { type: 'WO', libellé: 'Faiblesses × opportunités', verbe: 'Corriger' },
  { type: 'ST', libellé: 'Forces × menaces', verbe: 'Défendre' },
  { type: 'WT', libellé: 'Faiblesses × menaces', verbe: 'Se protéger' },
] as const

export type OptionDeTows = { readonly énoncé: string; readonly croise: readonly string[]; readonly candidate: boolean }
export type VueDeLaTows = {
  readonly parType: Readonly<Record<(typeof TYPES_DE_TOWS)[number]['type'], readonly OptionDeTows[]>>
  readonly candidate: (OptionDeTows & { readonly libellé: string }) | null
}

export function vueDeLaTows(éléments: readonly ÉlémentLu[], codes: ReadonlyMap<string, string>): VueDeLaTows {
  const parType = { SO: [] as OptionDeTows[], WO: [] as OptionDeTows[], ST: [] as OptionDeTows[], WT: [] as OptionDeTows[] }
  let candidate: VueDeLaTows['candidate'] = null
  for (const é of éléments.filter((x) => x.outil === 'tows').sort((a, b) => a.rang - b.rang)) {
    const type = é.clé as keyof typeof parType
    if (!(type in parType)) continue
    const croisés = ((é.références as { éléments?: string[] } | null)?.éléments ?? []).map((id) => codes.get(id)).filter((c): c is string => !!c)
    const option = { énoncé: é.énoncé ?? '', croise: croisés, candidate: é.candidateRecommandation }
    parType[type].push(option)
    if (é.candidateRecommandation) candidate = { ...option, libellé: TYPES_DE_TOWS.find((t) => t.type === type)!.libellé }
  }
  return { parType, candidate }
}

// ── Lecture du trimestre ─────────────────────────────────────────────────────

const LIBELLÉS_INTENSITÉ = ['Contenue', 'Marquée', 'Intense'] as const
const LIBELLÉS_TENDANCE: Readonly<Record<string, string>> = { hausse: 'en hausse', stable: 'stable', baisse: 'en baisse' }

export type ForceLue = {
  readonly force: ForcePorter
  readonly libellé: string
  readonly lecture: string
  readonly nonSuivi: boolean
  /** 1 contenue, 2 marquée, 3 intense ; nul pour une force non suivie. */
  readonly cran: number | null
  readonly tendance: string | null
}

/** Les cinq forces, dans l'ordre du cadre ; une force absente de la synthèse n'est pas inventée. */
export function vueDesForces(positions: readonly PositionLue[]): readonly ForceLue[] {
  return FORCES_PORTER.flatMap((force) => {
    const p = positions.find((x) => x.outil === 'forces' && x.sujet === force)
    if (!p) return []
    return [
      {
        force,
        libellé: LIBELLÉS_PORTER[force],
        nonSuivi: p.nonSuivi,
        cran: p.nonSuivi ? null : p.cran,
        tendance: p.nonSuivi ? null : p.tendance,
        lecture: p.nonSuivi
          ? 'Non suivi'
          : `${LIBELLÉS_INTENSITÉ[(p.cran ?? 1) - 1] ?? `Cran ${p.cran}`}${p.tendance ? ` · ${LIBELLÉS_TENDANCE[p.tendance] ?? p.tendance}` : ''}`,
      },
    ]
  })
}

export type ScénarioLu = { readonly titre: string; readonly énoncé: string; readonly indicateurs: readonly { readonly famille: number; readonly signal: string }[] }

export function vueDesScénarios(éléments: readonly ÉlémentLu[]): readonly ScénarioLu[] {
  return éléments
    .filter((é) => é.outil === 'scenario')
    .sort((a, b) => a.clé.localeCompare(b.clé))
    .map((é) => {
      const r = (é.références ?? {}) as { titre?: string; indicateurs?: { famille: number; signal: string }[] }
      return { titre: r.titre ?? é.clé, énoncé: é.énoncé ?? '', indicateurs: r.indicateurs ?? [] }
    })
}

// ── Onglet PESTEL de « Les axes » ────────────────────────────────────────────

export const LIBELLÉS_PESTEL_COURTS: Readonly<Record<Pestel, { readonly initiale: string; readonly libellé: string }>> = {
  politique: { initiale: 'P', libellé: 'Politique' },
  economique: { initiale: 'E', libellé: 'Économique' },
  socioculturel: { initiale: 'S', libellé: 'Socioculturel' },
  technologique: { initiale: 'T', libellé: 'Technologique' },
  ecologique: { initiale: 'E', libellé: 'Écologique' },
  legal: { initiale: 'L', libellé: 'Légal' },
}

/** Un fait étiqueté, tel que la base le rend, réduit à ce que l'onglet lit. */
export type FaitPourLePestel = {
  readonly pestel: Pestel | null
  readonly rupture: boolean
  readonly dateÉdition: string
  readonly dateFait: string
  readonly édition: string
  readonly famille: string | null
  readonly axe: number | null
  /** La phrase-titre relue dans une lettre que l'écran a déjà lue, sinon `null`. */
  readonly titre: string | null
  /** L'URL de la source : avec la date et la dimension, elle dit si deux faits sont le même événement. */
  readonly source?: string | null
}

export type DimensionDuPestel = {
  readonly lettre: Pestel
  readonly initiale: string
  readonly libellé: string
  readonly faits: number
  readonly ruptures: number
  readonly parMois: readonly { readonly mois: string; readonly faits: number }[]
  /** Les axes qui suivent cette dimension, par le rattachement des familles de la grille. */
  readonly suiviePar: readonly { readonly numéro: number; readonly nom: string }[]
  readonly trou: boolean
}

export type VueDuPestel = {
  readonly fenêtre: { readonly début: string; readonly fin: string }
  readonly total: number
  readonly dimensions: readonly DimensionDuPestel[]
  /** Dimensions qu'aucune famille ne couvre, ou qu'une seule couvre. */
  readonly trous: readonly { readonly libellé: string; readonly familles: number; readonly nom: string | null }[]
  /** Les faits dont la phrase-titre est relue, une ligne par événement (même source, même date, même dimension), du plus récent au plus ancien. */
  readonly faits: readonly { readonly date: string; readonly dimension: string; readonly titre: string; readonly rupture: boolean; readonly axe: string | null }[]
}

const familleDe = (f: string | null) => {
  const n = sansAccent(f ?? '').toLowerCase()
  return n.startsWith('eco') ? 'ecosysteme' : n.startsWith('conc') ? 'concurrentiel' : null
}

/**
 * L'onglet PESTEL : les comptes de la fenêtre par dimension et par mois,
 * zéro compris, les axes qui suivent chaque dimension, les trous de couverture,
 * et les faits que les lettres déjà lues par l'écran permettent de citer.
 * `nomsDesAxes` : `veille:numéro` vers le nom de l'axe, lu dans ces lettres.
 */
export function vueDuPestel(
  faits: readonly FaitPourLePestel[],
  grille: Grille,
  nomsDesAxes: ReadonlyMap<string, string>,
  fenêtre: { readonly début: string; readonly fin: string },
): VueDuPestel {
  const mois = (() => {
    const liste: string[] = []
    const d = new Date(`${fenêtre.début.slice(0, 7)}-01T00:00:00Z`)
    while (d.toISOString().slice(0, 7) <= fenêtre.fin.slice(0, 7) && liste.length < 13) {
      liste.push(d.toISOString().slice(0, 7))
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
    return liste
  })()
  const trous = new Set(trousDuPestel(grille))
  // Le titre de l'axe dans les lettres lues, sinon le libellé de la grille : une
  // famille mensuelle n'est souvent dans aucune des lettres de la semaine.
  const nomsDeLaGrille = new Map(grille.familles.filter((f) => f.libellé).map((f) => [`${f.veille}:${f.numéro}`, f.libellé!]))
  const nom = (veille: string, numéro: number) => nomsDesAxes.get(`${veille}:${numéro}`) ?? nomsDeLaGrille.get(`${veille}:${numéro}`) ?? `Famille ${numéro}`
  const dimensions = PESTEL.map((lettre) => {
    const siens = faits.filter((f) => f.pestel === lettre)
    const familles = grille.familles.filter((f) => f.pestel === lettre)
    return {
      lettre,
      ...LIBELLÉS_PESTEL_COURTS[lettre],
      faits: siens.length,
      ruptures: siens.filter((f) => f.rupture).length,
      parMois: mois.map((m) => ({ mois: MOIS_COURTS[Number(m.slice(5, 7)) - 1]!, faits: siens.filter((f) => f.dateÉdition.startsWith(m)).length })),
      suiviePar: familles.map((f) => ({ numéro: f.numéro, nom: nom(f.veille, f.numéro) })),
      trou: trous.has(lettre),
    }
  })
  const libellés = new Map(dimensions.map((d) => [d.lettre, d.libellé]))
  return {
    fenêtre,
    total: faits.filter((f) => f.pestel).length,
    dimensions,
    trous: dimensions
      .filter((d) => d.suiviePar.length <= 1)
      .map((d) => ({ libellé: d.libellé, familles: d.suiviePar.length, nom: d.suiviePar[0] ? `${d.suiviePar[0].numéro} ${d.suiviePar[0].nom}` : null })),
    faits: (() => {
      // Une ligne par événement : même source, même date, même dimension. Les
      // deux lettres d'une semaine relèvent souvent le même fait, chacune sous
      // son angle ; la ligne garde la première phrase-titre et nomme les axes
      // des deux (même règle que les ruptures de la lecture stratégique).
      const lignes = new Map<string, { date: string; dimension: string; titre: string; rupture: boolean; axes: string[] }>()
      for (const f of faits
        .filter((f): f is FaitPourLePestel & { pestel: Pestel; titre: string } => !!f.pestel && !!f.titre)
        .sort((a, b) => b.dateFait.localeCompare(a.dateFait))) {
        const veille = familleDe(f.famille)
        const axe = veille && f.axe !== null ? `${f.axe} ${nom(veille, f.axe)}` : null
        const clé = `${f.dateFait}:${f.pestel}:${f.source ? normaliserUrl(f.source) : normaliserTitre(f.titre)}`
        const déjà = lignes.get(clé)
        if (déjà) {
          déjà.rupture ||= f.rupture
          if (axe && !déjà.axes.includes(axe)) déjà.axes.push(axe)
          continue
        }
        lignes.set(clé, { date: f.dateFait, dimension: libellés.get(f.pestel) ?? f.pestel, titre: f.titre, rupture: f.rupture, axes: axe ? [axe] : [] })
      }
      return [...lignes.values()].map(({ axes, ...ligne }) => ({ ...ligne, axe: axes.length > 0 ? axes.join(' · ') : null }))
    })(),
  }
}

// ── Tableau de l'opératrice : les périodes à publier ─────────────────────────

/** `mêlée` : une partie seulement des lignes est publiée, ce que les écrans ne lisent pas. */
export type ÉtatDeLaPériode = 'proposée' | 'publiée' | 'retirée' | 'mêlée'

export type PériodeAPublier = {
  readonly période: string
  readonly libellé: string
  readonly granularité: 'mois' | 'trimestre'
  readonly lignes: number
  readonly état: ÉtatDeLaPériode
}

export type SynthèsesDUneOrganisation = {
  readonly slug: string
  readonly nom: string
  readonly périodes: readonly PériodeAPublier[]
}

type ComptesDePériode = {
  readonly slug: string
  readonly nom: string
  readonly période: string
  readonly lignes: number
  readonly publiées: number
  readonly retirées: number
}

function étatDeLaPériode(c: ComptesDePériode): ÉtatDeLaPériode {
  if (c.publiées === c.lignes) return 'publiée'
  if (c.retirées === c.lignes) return 'retirée'
  if (c.publiées === 0 && c.retirées === 0) return 'proposée'
  return 'mêlée'
}

/** Une entrée par organisation, par nom ; ses périodes de la plus récente à la plus ancienne, le trimestre après les mois qu'il couvre. */
export function périodesAPublier(comptes: readonly ComptesDePériode[]): SynthèsesDUneOrganisation[] {
  const parOrganisation = new Map<string, { nom: string; périodes: PériodeAPublier[] }>()
  for (const c of comptes) {
    const entrée = parOrganisation.get(c.slug) ?? { nom: c.nom, périodes: [] }
    entrée.périodes.push({
      période: c.période,
      libellé: libelléDePériode(c.période),
      granularité: /-T[1-4]$/.test(c.période) ? 'trimestre' : 'mois',
      lignes: c.lignes,
      état: étatDeLaPériode(c),
    })
    parOrganisation.set(c.slug, entrée)
  }
  // « 2026-T3 » se range comme « 2026-09-99 » : après septembre, avant octobre.
  const rang = (p: string) => p.replace(/^(\d{4})-T([1-4])$/, (_, a: string, t: string) => `${a}-${String(Number(t) * 3).padStart(2, '0')}-99`)
  return [...parOrganisation.entries()]
    .map(([slug, e]) => ({ slug, nom: e.nom, périodes: [...e.périodes].sort((a, b) => rang(b.période).localeCompare(rang(a.période))) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// ── En bref (lot 4 de la réorganisation, 30 octobre 2026) ────────────────────

/**
 * Trois chiffres en tête d'écran, comptés sur ce que l'écran montre déjà :
 * jamais rédigés pour l'écran, jamais une note. Un chiffre que la synthèse ne
 * porte pas n'est pas inventé ; la case dit alors « n.d. ».
 */
export type ChiffreEnBref = { readonly intitulé: string; readonly valeur: number | string; readonly mention?: string | null }

const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`

/** Combien de sujets ont changé de case depuis la synthèse publiée précédente, l'organisation exclue. */
export function mouvementsDeLaCarte(carte: VueDeLaCarte | null): number {
  if (!carte) return 0
  return [...carte.cases.values()].flat().filter((o) => o.aBougé && !o.organisation).length
}

export function enBrefDesConcurrents(vue: VueDesConcurrents): readonly ChiffreEnBref[] {
  const placés = vue.concurrents.length - vue.nonPlacés
  const déclaratifs = vue.concurrents.filter((c) => c.déclaratif).length
  const cités = vue.concurrents.filter((c) => c.faits > 0).length
  return [
    { intitulé: 'Concurrents suivis', valeur: vue.concurrents.length, mention: `${placés} placés sur la carte` },
    { intitulé: 'Ont changé de case', valeur: vue.mouvements.length, mention: 'depuis la synthèse précédente' },
    { intitulé: 'Cités par vos lettres', valeur: cités, mention: déclaratifs > 0 ? `${pluriel(déclaratifs, 'position')} lue${déclaratifs > 1 ? 's' : ''} dans le corpus` : null },
  ]
}

export function enBrefDeLaSwot(swot: VueDeLaSwot): readonly ChiffreEnBref[] {
  const tous = CASES_SWOT.flatMap((c) => swot[c])
  const déclaratifs = tous.filter((é) => é.édition === null && é.source.startsWith('Déclaratif')).length
  return [
    { intitulé: 'Éléments de la SWOT', valeur: tous.length, mention: `${pluriel(déclaratifs, 'déclaratif')}, ${tous.length - déclaratifs} datés` },
    { intitulé: 'Opportunités', valeur: swot.opportunites.length, mention: 'tirées des faits de vos lettres' },
    { intitulé: 'Menaces', valeur: swot.menaces.length, mention: 'tirées des faits de vos lettres' },
  ]
}

export function enBrefDesForces(forces: readonly ForceLue[]): readonly ChiffreEnBref[] {
  const suivies = forces.filter((f) => !f.nonSuivi)
  return [
    { intitulé: 'Forces suivies', valeur: `${suivies.length} sur ${forces.length}`, mention: forces.length - suivies.length > 0 ? `${pluriel(forces.length - suivies.length, 'non suivie')}` : null },
    { intitulé: 'Intenses', valeur: suivies.filter((f) => f.cran === 3).length, mention: 'au troisième cran' },
    { intitulé: 'En hausse', valeur: suivies.filter((f) => f.tendance === 'hausse').length, mention: 'sur le trimestre' },
  ]
}

export function enBrefDuPestel(vue: VueDuPestel): readonly ChiffreEnBref[] {
  const tête = [...vue.dimensions].sort((a, b) => b.faits - a.faits)[0]
  const ruptures = vue.dimensions.reduce((n, d) => n + d.ruptures, 0)
  return [
    { intitulé: 'Faits datés', valeur: vue.total, mention: 'sur treize semaines' },
    { intitulé: 'Dimension la plus citée', valeur: tête && tête.faits > 0 ? tête.libellé : 'n.d.', mention: tête && tête.faits > 0 ? pluriel(tête.faits, 'fait') : null },
    { intitulé: 'Ruptures', valeur: ruptures, mention: vue.trous.length > 0 ? `${pluriel(vue.trous.length, 'dimension')} peu couverte${vue.trous.length > 1 ? 's' : ''}` : null },
  ]
}

export function enBrefDesScénarios(scénarios: readonly ScénarioLu[]): readonly ChiffreEnBref[] {
  const indicateurs = scénarios.reduce((n, s) => n + s.indicateurs.length, 0)
  const familles = new Set(scénarios.flatMap((s) => s.indicateurs.map((i) => i.famille))).size
  return [
    { intitulé: 'Scénarios', valeur: scénarios.length, mention: 'aucune probabilité' },
    { intitulé: 'Indicateurs à guetter', valeur: indicateurs, mention: 'datables et cherchables' },
    { intitulé: 'Thèmes qui les suivent', valeur: familles, mention: 'dans vos lettres' },
  ]
}

/** La synthèse publiée telle que les écrans la lisent : le mois et le trimestre, chacun absent s'il n'est pas publié. */
export type SynthèseVue = {
  readonly mois: {
    readonly période: string
    readonly carte: VueDeLaCarte | null
    readonly mendelow: VueDeMendelow
    readonly swot: VueDeLaSwot
    readonly tows: VueDeLaTows
  } | null
  readonly trimestre: { readonly période: string; readonly forces: readonly ForceLue[]; readonly scénarios: readonly ScénarioLu[] } | null
}
