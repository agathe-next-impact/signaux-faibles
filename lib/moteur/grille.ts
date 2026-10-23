/**
 * Ce que la commande de première lettre fait en code plutôt qu'au modèle
 * (23 octobre 2026) : relever les dates visibles d'une page lue, écrire la ligne
 * de grille d'une source, et condenser les grilles et les faits des agents de
 * collecte en une synthèse par référentiel, que lit le rédacteur.
 *
 * La première lettre Heritech a coûté 63 $ : le rédacteur relisait à chaque
 * appel les neuf grilles entières (plus de 100 000 caractères) pour en tirer
 * quatre listes de la note de méthode. Le code les compte ; le rédacteur ne lit
 * plus que la synthèse de sa propre lettre. Aucune décision éditoriale ici :
 * le code compte et range, il ne juge pas.
 */
import type { Lecture } from '@/lib/moteur/collecte'

// ── Dates visibles ───────────────────────────────────────────────────────────

const MOIS: Readonly<Record<string, number>> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
}
const NOMS_DE_MOIS = Object.keys(MOIS).join('|')

function dateIso(année: number, mois: number, jour: number): string | null {
  if (mois < 1 || mois > 12 || jour < 1) return null
  const jours = new Date(Date.UTC(année, mois, 0)).getUTCDate()
  if (jour > jours) return null
  return `${année}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

/**
 * Les dates écrites dans un texte, de la plus récente à la plus ancienne,
 * jamais postérieures à `aujourdhui` (AAAA-MM-JJ) : une date future est une
 * échéance, pas une publication. Formats lus : « 12 octobre 2026 », « 1er
 * mars 2026 », « 12/10/2026 », « 12.10.2026 » et « 2026-10-12 ».
 *
 * Sert à écrire la date de la dernière publication visible d'une source sans
 * fait dans la fenêtre : un RAS porte toujours cette date (étape 1bis, point 7).
 */
export function datesVues(texte: string, aujourdhui: string): string[] {
  const trouvées = new Set<string>()
  const ajouter = (d: string | null) => {
    if (d && d <= aujourdhui && d >= '1990-01-01') trouvées.add(d)
  }
  for (const m of texte.matchAll(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${NOMS_DE_MOIS})\\s+(\\d{4})\\b`, 'giu'))) {
    ajouter(dateIso(Number(m[3]), MOIS[m[2]!.toLowerCase()] ?? 0, Number(m[1])))
  }
  for (const m of texte.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    ajouter(dateIso(Number(m[3]), Number(m[2]), Number(m[1])))
  }
  for (const m of texte.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    ajouter(dateIso(Number(m[1]), Number(m[2]), Number(m[3])))
  }
  return [...trouvées].sort().reverse()
}

/** « 2026-10-12 » en « 12/10/2026 », la forme des lettres. */
export function dateFrançaise(iso: string): string {
  const [a, m, j] = iso.split('-')
  return `${j}/${m}/${a}`
}

// ── Le lot lu en code ────────────────────────────────────────────────────────

/** Le nom du fichier où le texte d'une source est écrit : rang et domaine. */
export function fichierDeLecture(rang: number, url: string): string {
  let domaine = 'source'
  try {
    domaine = new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '-')
  } catch {
    // une URL illisible garde le nom générique
  }
  return `${String(rang).padStart(2, '0')}-${domaine}.txt`
}

export type LigneDuLot = {
  readonly rang: number
  readonly url: string
  /**
   * `À RELANCER` : la source n'a pas été essayée, l'échéance du lot étant
   * atteinte. Ce n'est pas une source non ouverte : elle repart dans un lot.
   */
  readonly état: 'OUVERTE' | 'NON OUVERTE' | 'À RELANCER'
  readonly détail: string
  readonly fichier: string | null
  readonly dernièreDate: string | null
}

/**
 * La ligne de grille de chaque source lue en code. Une page que ni la requête
 * simple ni le navigateur n'ont ouverte est NON OUVERTE avec la raison des deux
 * essais (`http-403+navigateur-403`) : jamais un RAS.
 */
export function lignesDuLot(lectures: readonly Lecture[], aujourdhui: string): LigneDuLot[] {
  return lectures.map((l, i) => {
    if (l.état === 'delai-du-lot') {
      return { rang: i + 1, url: l.url, état: 'À RELANCER', détail: 'non essayée : échéance du lot atteinte, à relancer dans un second lot', fichier: null, dernièreDate: null }
    }
    const ouverte = l.état.startsWith('ouverte')
    const dernière = ouverte ? (datesVues(l.texte, aujourdhui)[0] ?? null) : null
    const voie = l.état === 'ouverte-navigateur' ? 'navigateur' : 'requête simple'
    return {
      rang: i + 1,
      url: l.url,
      état: ouverte ? 'OUVERTE' : 'NON OUVERTE',
      détail: ouverte
        ? `lue le ${dateFrançaise(l.luLe.slice(0, 10))} (${voie}), ${l.texte.length} caractères, dernière date visible : ${dernière ? dateFrançaise(dernière) : 'aucune'}`
        : `après requête simple et navigateur : ${l.état}`,
      fichier: ouverte ? fichierDeLecture(i + 1, l.url) : null,
      dernièreDate: dernière,
    }
  })
}

/** L'index du lot en Markdown, à recopier dans la grille de collecte. */
export function indexDuLot(lignes: readonly LigneDuLot[]): string {
  const ouvertes = lignes.filter((l) => l.état === 'OUVERTE').length
  const àRelancer = lignes.filter((l) => l.état === 'À RELANCER').length
  return [
    `${lignes.length} source(s), ${ouvertes} ouverte(s), ${lignes.length - ouvertes - àRelancer} non ouverte(s)${àRelancer ? `, ${àRelancer} à relancer` : ''}.`,
    '',
    '| Rang | URL | État | Détail | Fichier |',
    '|---|---|---|---|---|',
    ...lignes.map((l) => `| ${l.rang} | ${l.url} | ${l.état} | ${l.détail} | ${l.fichier ?? ''} |`),
    '',
  ].join('\n')
}

// ── Grilles et faits des agents ──────────────────────────────────────────────

export const ÉTATS = ['OUVERTE', 'REQUÊTÉE', 'FOURNIE', 'NON OUVERTE'] as const
export type ÉtatDeGrille = (typeof ÉTATS)[number]

export type LigneDeGrille = {
  readonly référentiel: string
  readonly section: string
  readonly élément: string
  /** L'état reconnu, ou `null` si la colonne est vide ou illisible. */
  readonly état: ÉtatDeGrille | null
  readonly détail: string
}

function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** L'état d'une cellule : « NON OUVERTE » avant « OUVERTE », accents ignorés. */
function étatDe(cellule: string): ÉtatDeGrille | null {
  const c = sansAccents(cellule).toUpperCase()
  if (c.includes('NON OUVERT')) return 'NON OUVERTE'
  if (c.includes('REQUETE')) return 'REQUÊTÉE'
  if (c.includes('FOURNI')) return 'FOURNIE'
  if (c.includes('OUVERT')) return 'OUVERTE'
  return null
}

/**
 * Les lignes d'une grille au format de la consigne de collecte :
 * `| Référentiel | Section et famille | Élément | État | Détail |`. Les lignes
 * d'en-tête et de séparation sont ignorées ; une table d'un autre format aussi.
 */
export function lireGrille(markdown: string): LigneDeGrille[] {
  const lignes: LigneDeGrille[] = []
  for (const brute of markdown.split('\n')) {
    const ligne = brute.trim()
    if (!ligne.startsWith('|')) continue
    const cellules = ligne.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
    if (cellules.length !== 5) continue
    if (cellules.every((c) => /^:?-{2,}:?$/.test(c))) continue
    if (sansAccents(cellules[3]!).toLowerCase() === 'etat') continue
    const [référentiel, section, élément, état, détail] = cellules as [string, string, string, string, string]
    lignes.push({ référentiel, section, élément, état: étatDe(état), détail })
  }
  return lignes
}

/** Le bloc « Élargissements » d'une grille, ligne à ligne. */
export function élargissementsDe(markdown: string): string[] {
  const début = markdown.search(/^#{1,6}\s*[ÉE]largissements/im)
  if (début === -1) return []
  const suite = markdown.slice(début).split('\n').slice(1)
  const fin = suite.findIndex((l) => /^#{1,6}\s/.test(l))
  return (fin === -1 ? suite : suite.slice(0, fin)).map((l) => l.trim()).filter((l) => l && !l.startsWith('|---'))
}

export type Fait = {
  readonly titre: string
  readonly champs: Readonly<Record<string, string>>
  /** Le bloc tel que l'agent l'a écrit, titre compris. */
  readonly brut: string
}

/** Les blocs « ### titre » suivis de lignes « - Clé : valeur ». */
export function lireFaits(markdown: string): Fait[] {
  const faits: Fait[] = []
  const morceaux = markdown.split(/^(?=###\s)/m).filter((m) => m.startsWith('###'))
  for (const morceau of morceaux) {
    const [entête, ...reste] = morceau.trimEnd().split('\n')
    const champs: Record<string, string> = {}
    for (const ligne of reste) {
      const m = /^\s*-\s*([^:]{2,40}?)\s*:\s*(.*)$/.exec(ligne)
      if (m) champs[m[1]!.trim()] = m[2]!.trim()
    }
    faits.push({ titre: entête!.replace(/^###\s*/, '').trim(), champs, brut: morceau.trimEnd() })
  }
  return faits
}

function porteSur(valeur: string | undefined, référentiel: string): boolean {
  return sansAccents(valeur ?? '').toLowerCase().includes(sansAccents(référentiel).toLowerCase())
}

/** « nouveau », « contexte », ou `null` pour un RAS motivé ou un constat d'absence. */
function natureDe(fait: Fait): 'nouveau' | 'contexte' | null {
  const v = sansAccents(fait.champs['Nouveau ou contexte'] ?? '').toLowerCase()
  return v.startsWith('nouveau') ? 'nouveau' : v.includes('contexte') ? 'contexte' : null
}

export type Synthèse = {
  readonly markdown: string
  readonly lignes: number
  readonly vides: number
  readonly faitsNouveaux: number
  readonly faitsDeContexte: number
  /** Les blocs sans fait : RAS motivés et constats d'absence. */
  readonly constats: number
}

/** Un fait et le lot qui l'a rendu (le nom de son fichier, sans extension). */
export type FaitDuLot = { readonly lot: string; readonly fait: Fait }

/**
 * Le référentiel d'un fait. Un bloc qui ne le dit pas (un RAS motivé, un constat
 * d'absence) prend celui de la grille de son lot, quand toutes ses lignes portent
 * sur le même ; sinon il est commun aux deux lettres (`null`).
 */
function référentielDuFait(f: FaitDuLot, grilles: readonly { nom: string; markdown: string }[]): string | null {
  const dit = f.fait.champs['Référentiel']
  if (dit) return dit
  const grille = grilles.find((g) => g.nom === f.lot)
  const référentiels = new Set((grille ? lireGrille(grille.markdown) : []).map((l) => sansAccents(l.référentiel).toLowerCase()))
  return référentiels.size === 1 ? [...référentiels][0]! : null
}

/**
 * La synthèse d'un référentiel pour son rédacteur : les comptes de la grille,
 * ses lignes non ouvertes avec leur raison, ses élargissements, puis les faits
 * de ce référentiel rangés par famille, les RAS et constats communs aux deux
 * lettres ; enfin les seuls titres des faits de l'autre lettre, pour tenir la
 * frontière sans relire leurs blocs.
 *
 * Une ligne de grille sans état reconnu est comptée « vide » : l'étape 1bis
 * interdit de rédiger tant qu'il en reste une.
 */
export function synthèseDuRéférentiel(
  grilles: readonly { nom: string; markdown: string }[],
  faitsDesLots: readonly FaitDuLot[],
  référentiel: string,
): Synthèse {
  const lignes = grilles.flatMap((g) => lireGrille(g.markdown)).filter((l) => porteSur(l.référentiel, référentiel))
  const parÉtat = new Map<string, number>()
  for (const l of lignes) parÉtat.set(l.état ?? 'vide', (parÉtat.get(l.état ?? 'vide') ?? 0) + 1)
  const vides = parÉtat.get('vide') ?? 0
  const nonOuvertes = lignes.filter((l) => l.état === 'NON OUVERTE')
  const élargissements = grilles.flatMap((g) => élargissementsDe(g.markdown).map((l) => `${g.nom} : ${l.replace(/^[-*]\s*/, '')}`))

  const rangés = faitsDesLots.map((f) => ({ fait: f.fait, référentiel: référentielDuFait(f, grilles) }))
  const siens = rangés.filter((f) => f.référentiel !== null && porteSur(f.référentiel, référentiel)).map((f) => f.fait)
  const communs = rangés.filter((f) => f.référentiel === null).map((f) => f.fait)
  const autres = rangés.filter((f) => f.référentiel !== null && !porteSur(f.référentiel, référentiel)).map((f) => f.fait)
  const familles = new Map<string, Fait[]>()
  for (const f of siens) {
    const famille = f.champs['Famille'] ?? 'famille non dite'
    familles.set(famille, [...(familles.get(famille) ?? []), f])
  }
  const nouveaux = siens.filter((f) => natureDe(f) === 'nouveau').length
  const deContexte = siens.filter((f) => natureDe(f) === 'contexte').length
  const constats = siens.length - nouveaux - deContexte

  const markdown = [
    `# Synthèse de collecte : ${référentiel}`,
    '',
    '## Grille',
    '',
    `${lignes.length} ligne(s) : ${[...ÉTATS, 'vide'].map((é) => `${parÉtat.get(é) ?? 0} ${é === 'vide' ? 'vide(s)' : é}`).join(', ')}.`,
    vides ? `**${vides} ligne(s) sans état : la collecte n'est pas terminée (étape 1bis, point 8).**` : 'Aucune ligne vide.',
    '',
    '### Non ouvertes, avec leur raison',
    '',
    ...(nonOuvertes.length ? nonOuvertes.map((l) => `- ${l.section} · ${l.élément} : ${l.détail}`) : ['- aucune']),
    '',
    '### Élargissements',
    '',
    ...(élargissements.length ? élargissements.map((l) => `- ${l}`) : ['- aucun']),
    '',
    `## Faits : ${nouveaux} nouveau(x), ${deContexte} de contexte, ${constats} RAS ou constat(s)`,
    '',
    ...[...familles.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .flatMap(([famille, liste]) => [`## ${famille}`, '', ...liste.map((f) => f.brut.replace(/^###/, '####')), '']),
    '## Communs aux deux lettres (canaux d’entrée, requêtes générales)',
    '',
    ...(communs.length ? communs.map((f) => f.brut.replace(/^###/, '####')) : ['- aucun']),
    '',
    '## Faits de l’autre lettre (titres seuls, pour la frontière)',
    '',
    ...(autres.length ? autres.map((f) => `- ${f.titre} (${f.champs['Famille'] ?? '?'})`) : ['- aucun']),
    '',
  ].join('\n')

  return { markdown, lignes: lignes.length, vides, faitsNouveaux: nouveaux, faitsDeContexte: deContexte, constats }
}
