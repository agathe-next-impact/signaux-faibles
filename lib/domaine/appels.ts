import { axesDuDocument, faitsDe, type Bloc, type Document, type Segment } from '@/lib/domaine/document'
import { sansAccent } from '@/lib/domaine/texte'

/**
 * Les appels à projets d'une lettre d'appels, et leur suivi d'une lettre à
 * l'autre (18 novembre 2026, décision de l'opératrice : l'écran « Appels à
 * projets » lit une table Postgres, option A). Module pur : il ne lit rien.
 *
 * La forme d'un appel est le contrat de la lettre d'appels, que le lint tient
 * (`lib/portail/lint.ts`) : une phrase-titre (financeur, intitulé, montant,
 * clôture), puis « Pourquoi vous », « Arguments » et « Pièces et calendrier ».
 * Les mêmes fonctions découpent la lettre pour le lint et pour le relevé : un
 * appel que le lint compte est un appel que l'écran montre.
 */

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'] as const

/** Une date dans un texte, avec ou sans année, en toutes lettres ou chiffrée. */
const DATE_DANS_UN_APPEL =
  /\b(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?\b|\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g

/**
 * Les dates lisibles d'un texte, en AAAA-MM-JJ. Une date sans année prend celle
 * de l'édition, ou la suivante si elle tomberait plus de six mois avant elle :
 * « clôture le 15 janvier » écrit en novembre vise janvier qui vient.
 */
export function datesDUnTexte(texte: string, dateDeRéférence: string): string[] {
  const annéeDeRéférence = Number(dateDeRéférence.slice(0, 4))
  const dates: string[] = []
  for (const m of sansAccent(texte).matchAll(DATE_DANS_UN_APPEL)) {
    const jour = Number(m[1] ?? m[4])
    const mois = m[2] ? MOIS.indexOf(m[2] as (typeof MOIS)[number]) + 1 : Number(m[5])
    const annéeÉcrite = m[3] ?? m[6]
    if (!(jour >= 1 && jour <= 31 && mois >= 1 && mois <= 12)) continue
    const composer = (année: number) => `${année}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
    if (annéeÉcrite) {
      const année = Number(annéeÉcrite.length === 2 ? `20${annéeÉcrite}` : annéeÉcrite)
      dates.push(composer(année))
      continue
    }
    let date = composer(annéeDeRéférence)
    const écart = (Date.parse(dateDeRéférence) - Date.parse(date)) / (24 * 3600 * 1000)
    if (écart > 183) date = composer(annéeDeRéférence + 1)
    dates.push(date)
  }
  return dates
}

/** Le texte brut d'un bloc. */
export function texteDUnBloc(bloc: Bloc): string {
  switch (bloc.type) {
    case 'paragraphe':
    case 'titre':
    case 'citation':
    case 'encadré':
      return bloc.segments.map((s) => s.texte).join('')
    case 'liste':
      return bloc.éléments.map((é) => é.map((s) => s.texte).join('')).join('\n')
    case 'tableau':
      return bloc.lignes.map((ligne) => ligne.map((cellule) => cellule.map((s) => s.texte).join('')).join(' ')).join('\n')
    case 'code':
      return bloc.texte
    case 'séparateur':
    case 'image':
      return ''
  }
}

export function segmentsDUnBloc(bloc: Bloc): readonly Segment[] {
  switch (bloc.type) {
    case 'paragraphe':
    case 'titre':
    case 'citation':
    case 'encadré':
      return bloc.segments
    case 'liste':
      return bloc.éléments.flat()
    case 'tableau':
      return bloc.lignes.flat(2)
    default:
      return []
  }
}

/** Un appel d'un axe : sa phrase-titre et les blocs qui la suivent jusqu'au suivant. */
export type AppelDUnAxe = { readonly titre: Bloc; readonly blocs: readonly Bloc[] }

/** La phrase-titre d'un appel : un titre de niveau 3, ou un paragraphe qui s'ouvre en gras. */
function estTitreDAppel(bloc: Bloc): boolean {
  if (bloc.type === 'titre') return texteDUnBloc(bloc).trim().length > 0
  if (bloc.type !== 'paragraphe') return false
  const premier = bloc.segments.find((s) => s.texte.trim().length > 0)
  return premier !== undefined && premier.gras
}

/** Les appels d'un axe, dans l'ordre ; ce qui précède la première phrase-titre n'en est pas un. */
export function appelsDUnAxe(blocs: readonly Bloc[]): AppelDUnAxe[] {
  const appels: { titre: Bloc; blocs: Bloc[] }[] = []
  for (const bloc of faitsDe(blocs)) {
    if (estTitreDAppel(bloc)) appels.push({ titre: bloc, blocs: [bloc] })
    else appels[appels.length - 1]?.blocs.push(bloc)
  }
  return appels
}

/** Une adresse web d'un segment : son lien, ou une URL écrite en clair. */
function adressesDUnBloc(bloc: Bloc): string[] {
  const adresses: string[] = []
  for (const s of segmentsDUnBloc(bloc)) {
    if (s.lien && /^https?:\/\//.test(s.lien)) adresses.push(s.lien)
    for (const m of s.texte.matchAll(/https?:\/\/[^\s)>\]»]+/g)) adresses.push(m[0].replace(/[.,;:]+$/, ''))
  }
  return adresses
}

export const INTITULÉ_MAX = 120
export const FINANCEUR_MAX = 80
const ADRESSE_MAX = 500

/** Un appel tel que l'écran le montre, relevé d'une lettre. */
export type AppelRelevé = {
  readonly clé: string
  readonly rang: number
  readonly intitulé: string
  readonly financeur: string | null
  readonly clôture: string
  readonly adresse: string | null
  readonly impact: 'fort' | 'moyen'
  readonly àVérifier: boolean
}

function borner(texte: string, max: number): string {
  const t = texte.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

/**
 * La clé qui suit un appel d'une lettre à l'autre : son adresse sans protocole,
 * sans « www. », sans fragment ni barre finale, ou à défaut son intitulé sans
 * accent ni ponctuation. Deux lettres qui citent la même fiche parlent du même
 * appel, même si la phrase-titre a été reformulée.
 */
export function cléDAppel(adresse: string | null, intitulé: string): string {
  if (adresse) {
    const nette = adresse
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/#.*$/, '')
      .replace(/\/+$/, '')
    if (nette.length > 0) return nette.slice(0, 300)
  }
  return sansAccent(intitulé).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 300) || 'appel'
}

/** Le financeur et l'intitulé d'une phrase-titre « Financeur : intitulé, montant, clôture ». */
function financeurEtIntitulé(titre: string): { financeur: string | null; intitulé: string } {
  const propre = titre.replace(/\s+/g, ' ').trim().replace(/[.]$/, '')
  const i = propre.indexOf(' : ')
  if (i > 0 && i <= FINANCEUR_MAX) {
    return { financeur: borner(propre.slice(0, i), FINANCEUR_MAX), intitulé: borner(propre.slice(i + 3), INTITULÉ_MAX) }
  }
  return { financeur: null, intitulé: borner(propre, INTITULÉ_MAX) }
}

/**
 * Les appels d'une lettre d'appels, dans l'ordre de la lettre. Un appel sans
 * date de clôture lisible dans sa phrase-titre n'est pas relevé : le lint l'a
 * refusé (`clôture-absente`), et l'écran ne range rien sans date. L'impact est
 * le dernier « Impact fort » ou « Impact moyen » du texte de l'appel, à défaut
 * celui de son axe ; un appel d'un axe RAS sans impact écrit n'est pas relevé.
 */
export function appelsDeLaLettre(document: Document, dateÉdition: string): AppelRelevé[] {
  const appels: AppelRelevé[] = []
  const vues = new Set<string>()
  for (const axe of axesDuDocument(document)) {
    for (const appel of appelsDUnAxe(axe.blocs)) {
      const titre = texteDUnBloc(appel.titre)
      const dates = datesDUnTexte(titre, dateÉdition)
      const clôture = dates[dates.length - 1]
      if (!clôture) continue
      const texte = sansAccent(appel.blocs.map(texteDUnBloc).join('\n')).toLowerCase()
      const écrits = [...texte.matchAll(/impact\s+(fort|moyen)/g)].map((m) => m[1] as 'fort' | 'moyen')
      const impact = écrits[écrits.length - 1] ?? (axe.niveau === 'FORT' ? 'fort' : axe.niveau === 'MOYEN' ? 'moyen' : null)
      if (!impact) continue
      const adresses = appel.blocs.flatMap(adressesDUnBloc).filter((a) => a.length <= ADRESSE_MAX)
      // L'adresse de l'appel est celle de « Pièces et calendrier » (« Adresse de l'appel ») ; à défaut, la première citée.
      const pièces = appel.blocs.filter((b) => /adresse de l.appel|pieces et calendrier/.test(sansAccent(texteDUnBloc(b)).toLowerCase()))
      const adresse = pièces.flatMap(adressesDUnBloc).filter((a) => a.length <= ADRESSE_MAX).at(-1) ?? adresses[0] ?? null
      const { financeur, intitulé } = financeurEtIntitulé(titre)
      const clé = cléDAppel(adresse, intitulé)
      if (vues.has(clé)) continue
      vues.add(clé)
      const pourquoi = appel.blocs.filter((b) => /^pourquoi vous/.test(sansAccent(texteDUnBloc(b)).trim().toLowerCase()))
      const àVérifier = (pourquoi.length > 0 ? pourquoi : appel.blocs).some((b) => /a verifier/.test(sansAccent(texteDUnBloc(b)).toLowerCase()))
      appels.push({ clé, rang: appels.length + 1, intitulé, financeur, clôture, adresse, impact, àVérifier })
    }
  }
  return appels
}

// ── Le suivi, à la lecture ──────────────────────────────────────────────────

/** Une ligne relevée, telle que Postgres la rend. */
export type AppelDUneÉdition = AppelRelevé & { readonly édition: string; readonly dateÉdition: string }

/** Une lettre d'appels que le lecteur peut lire, avec son action. */
export type LettreDAppels = {
  readonly édition: string
  readonly dateÉdition: string
  readonly titre: string
  readonly actionDeLaSemaine: string
  readonly aperçu: boolean
}

export type AppelSuivi = AppelRelevé & {
  readonly premièreVue: string
  readonly dernièreVue: string
  /** L'édition la plus récente qui le cite. */
  readonly édition: string
  /** Apparu dans la dernière lettre d'appels lisible. */
  readonly nouveau: boolean
  /** Cité par la dernière lettre d'appels lisible. */
  readonly dansLaDernière: boolean
  readonly joursAvantClôture: number
}

export type MoisDeClôture = { readonly mois: string; readonly libellé: string; readonly appels: readonly AppelSuivi[] }

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const

export type VueDesAppels = {
  readonly dernière: LettreDAppels | null
  readonly ouverts: readonly AppelSuivi[]
  readonly clos: readonly AppelSuivi[]
  readonly mois: readonly MoisDeClôture[]
  readonly lettres: number
}

const JOUR_MS = 24 * 3600 * 1000

/** Les six mois civils à partir de celui d'aujourd'hui, en AAAA-MM. */
export function sixMois(aujourdhui: string): string[] {
  const année = Number(aujourdhui.slice(0, 4))
  const mois = Number(aujourdhui.slice(5, 7))
  return Array.from({ length: 6 }, (_, i) => {
    const m = mois - 1 + i
    return `${année + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`
  })
}

/**
 * Le suivi des appels, calculé à la lecture et jamais stocké. Seules comptent
 * les lignes des lettres que le lecteur peut lire (publiées, ou en aperçu pour
 * l'opératrice) : une ligne d'une lettre restée en Brouillon n'atteint jamais
 * un client (règle 3). Un appel prend les données de sa citation la plus
 * récente ; il est ouvert tant que sa clôture n'est pas passée, trié par
 * clôture la plus proche ; « nouveau » s'il n'a été vu que dans la dernière
 * lettre d'appels lisible, et pas dans une précédente.
 */
export function vueDesAppels(
  lignes: readonly AppelDUneÉdition[],
  lettres: readonly LettreDAppels[],
  aujourdhui: string,
): VueDesAppels {
  const lisibles = new Map(lettres.map((l) => [l.édition, l]))
  const triées = [...lettres].sort((a, b) => b.dateÉdition.localeCompare(a.dateÉdition))
  const retenues = lignes.filter((l) => lisibles.has(l.édition))
  const éditionsAvecAppels = new Set(retenues.map((l) => l.édition))
  const dernière = triées.find((l) => éditionsAvecAppels.has(l.édition)) ?? triées[0] ?? null

  const parClé = new Map<string, AppelDUneÉdition[]>()
  for (const l of retenues) parClé.set(l.clé, [...(parClé.get(l.clé) ?? []), l])

  const suivis: AppelSuivi[] = [...parClé.values()].map((citations) => {
    const ordre = [...citations].sort((a, b) => b.dateÉdition.localeCompare(a.dateÉdition) || a.rang - b.rang)
    const récente = ordre[0] as AppelDUneÉdition
    const premièreVue = ordre[ordre.length - 1]?.dateÉdition ?? récente.dateÉdition
    const dansLaDernière = dernière !== null && citations.some((c) => c.édition === dernière.édition)
    return {
      clé: récente.clé,
      rang: récente.rang,
      intitulé: récente.intitulé,
      financeur: récente.financeur,
      clôture: récente.clôture,
      adresse: récente.adresse,
      impact: récente.impact,
      àVérifier: récente.àVérifier,
      premièreVue,
      dernièreVue: récente.dateÉdition,
      édition: récente.édition,
      dansLaDernière,
      nouveau: dansLaDernière && citations.every((c) => c.édition === dernière?.édition),
      joursAvantClôture: Math.round((Date.parse(récente.clôture) - Date.parse(aujourdhui)) / JOUR_MS),
    }
  })

  const ouverts = suivis
    .filter((a) => a.clôture >= aujourdhui)
    .sort((a, b) => a.clôture.localeCompare(b.clôture) || (a.impact === b.impact ? 0 : a.impact === 'fort' ? -1 : 1) || a.intitulé.localeCompare(b.intitulé))
  const clos = suivis.filter((a) => a.clôture < aujourdhui).sort((a, b) => b.clôture.localeCompare(a.clôture))
  const mois = sixMois(aujourdhui).map((m) => ({
    mois: m,
    libellé: `${MOIS_COURTS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`,
    appels: ouverts.filter((a) => a.clôture.startsWith(m)),
  }))

  return { dernière, ouverts, clos, mois, lettres: éditionsAvecAppels.size }
}
