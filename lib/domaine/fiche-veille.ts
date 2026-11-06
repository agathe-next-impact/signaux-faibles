import { enSlug } from '@/lib/domaine/slug'
import { LIBELLÉS_PESTEL, LIBELLÉS_PORTER, normaliserTitre, VEILLES, type Grille, type Veille } from '@/lib/domaine/strategie'
import { LIBELLÉS_MENDELOW, libelléDePériode, segmentDeFamille, type CranNommé, type PositionDatée } from '@/lib/domaine/strategie-vues'

/**
 * La fiche de veille pour le lecteur (lot 6 de
 * `docs/proposition-reorganisation-espace.md`, option A décidée le
 * 30 octobre 2026) : ce que la veille suit pour le client, écrit pour lui par la
 * revue mensuelle à partir du référentiel, et non le référentiel lui-même. Le
 * portail ne lit jamais les référentiels ; il reçoit cette fiche, la passe par
 * la porte ci-dessous, la garde en Postgres sous l'exception bornée de
 * `CLAUDE.md`, et ne la montre qu'une fois publiée par l'opératrice.
 *
 * Bornes du §6 de la proposition : 120 caractères par thème et par critère,
 * nom et adresse de site seulement pour une source (jamais une note d'accès),
 * 80 caractères par échéance ; les entités et leurs variables restent celles de
 * la grille, déjà en base.
 */

export const BORNES_DE_LA_FICHE = {
  thème: 120,
  critère: 120,
  nomDeSource: 80,
  site: 200,
  niche: 120,
  signal: 120,
  échéance: 80,
  présentation: 240,
  sources: 80,
  niches: 12,
  échéances: 24,
} as const

type Famille = { readonly veille: Veille; readonly numéro: number }

export type FicheDeVeille = {
  /** Une ligne par famille de la grille : ce qu'elle suit, et ce qui rend un de ses faits FORT. */
  readonly thèmes: readonly (Famille & { readonly suit: string; readonly fort: string })[]
  /** Les sources ouvertes par famille : un nom, et l'adresse de leur site quand elles en ont un. */
  readonly sources: readonly (Famille & { readonly nom: string; readonly site: string | null })[]
  /** Les niches surveillées et le signal qui déclencherait un fait. */
  readonly niches: readonly { readonly énoncé: string; readonly signal: string }[]
  /** Les échéances connues, datées, rattachées à une famille quand elles en relèvent. */
  readonly échéances: readonly { readonly date: string; readonly libellé: string; readonly veille: Veille | null; readonly numéro: number | null }[]
  /**
   * La présentation d'une entité ou d'une partie prenante de la grille, écrite
   * pour le lecteur : qui elle est et pourquoi la veille la suit (6 novembre
   * 2026, fiches de présentation du référentiel). Facultative : une fiche
   * d'avant n'en porte pas, et la fiche de l'entité montre alors la grille seule.
   */
  readonly présentations?: readonly { readonly nom: string; readonly texte: string }[]
}

/**
 * Une borne d'ensemble sous celle de la table (40 000 caractères de
 * `contenu::text`, qui compte des blancs que `JSON.stringify` n'écrit pas) :
 * la porte refuse avant que la base ne lève une erreur.
 */
export const TAILLE_MAX_DE_LA_FICHE = 36_000

export type RefusDeFiche = { readonly code: string; readonly message: string; readonly cible?: string }

/** Ce qui se lit comme une note interne du référentiel, jamais comme un texte pour le client. */
const NOTE_INTERNE = /\b(mot de passe|identifiant|login|code d['’]accès|à valider|point de validation|note interne|réserve interne|todo)\b/i

/** Une date du calendrier : `Date.parse` accepte le 30 février, l'aller-retour non. */
function dateValide(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const t = Date.parse(`${date}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === date
}

/** Une adresse de site publique : http ou https, sans identifiants. */
function siteValide(site: string): boolean {
  if (site.length > BORNES_DE_LA_FICHE.site) return false
  try {
    const u = new URL(site)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password && u.hostname.includes('.')
  } catch {
    return false
  }
}

/**
 * La porte de la fiche : chaque famille nommée existe dans la grille, chaque
 * texte tient dans sa borne et ne porte ni « faible » (le niveau n'existe pas)
 * ni ce qui ressemble à une note interne ; une source n'a qu'un nom et une
 * adresse de site valide ; une échéance a une vraie date.
 */
export function contrôlerLaFiche(fiche: FicheDeVeille, grille: Grille): readonly RefusDeFiche[] {
  const refus: RefusDeFiche[] = []
  const refuser = (code: string, message: string, cible?: string) => refus.push({ code, message, ...(cible ? { cible } : {}) })
  const familles = new Set(grille.familles.map((f) => `${f.veille}:${f.numéro}`))
  const famille = (f: { veille: Veille | null; numéro: number | null }, cible: string) => {
    if (f.veille === null && f.numéro === null) return
    if (f.veille === null || f.numéro === null || !(VEILLES as readonly string[]).includes(f.veille) || !familles.has(`${f.veille}:${f.numéro}`)) {
      refuser('famille-inconnue', `famille ${String(f.veille)} ${String(f.numéro)} absente de la grille`, cible)
    }
  }
  const texte = (valeur: string, borne: number, cible: string) => {
    const t = valeur.trim()
    if (t.length === 0 || t.length > borne) refuser('texte-hors-bornes', `texte vide ou de plus de ${borne} caractères`, cible)
    if (/\bfaible\b/i.test(t)) refuser('vocabulaire-interdit', '« faible » n’existe pas : trois niveaux, fort, moyen, RAS', cible)
    if (NOTE_INTERNE.test(t)) refuser('note-interne', 'un texte de la fiche ne reprend jamais une note interne du référentiel', cible)
  }

  if (fiche.thèmes.length === 0) refuser('fiche-vide', 'la fiche porte au moins un thème')
  const vus = new Set<string>()
  fiche.thèmes.forEach((t, i) => {
    const cible = `thèmes.${i}`
    famille(t, cible)
    const clé = `${t.veille}:${t.numéro}`
    if (vus.has(clé)) refuser('thème-en-double', `la famille ${t.veille} ${t.numéro} a déjà son thème`, cible)
    vus.add(clé)
    texte(t.suit, BORNES_DE_LA_FICHE.thème, `${cible}.suit`)
    texte(t.fort, BORNES_DE_LA_FICHE.critère, `${cible}.fort`)
  })

  if (fiche.sources.length > BORNES_DE_LA_FICHE.sources) refuser('trop-de-lignes', `${BORNES_DE_LA_FICHE.sources} sources au plus`, 'sources')
  fiche.sources.forEach((s, i) => {
    const cible = `sources.${i}`
    famille(s, cible)
    texte(s.nom, BORNES_DE_LA_FICHE.nomDeSource, `${cible}.nom`)
    if (s.site !== null && !siteValide(s.site)) refuser('site-invalide', 'adresse http ou https d’un site public, sans identifiants', `${cible}.site`)
  })

  if (fiche.niches.length > BORNES_DE_LA_FICHE.niches) refuser('trop-de-lignes', `${BORNES_DE_LA_FICHE.niches} niches au plus`, 'niches')
  fiche.niches.forEach((n, i) => {
    texte(n.énoncé, BORNES_DE_LA_FICHE.niche, `niches.${i}.enonce`)
    texte(n.signal, BORNES_DE_LA_FICHE.signal, `niches.${i}.signal`)
  })

  if (fiche.échéances.length > BORNES_DE_LA_FICHE.échéances) refuser('trop-de-lignes', `${BORNES_DE_LA_FICHE.échéances} échéances au plus`, 'echeances')
  fiche.échéances.forEach((é, i) => {
    const cible = `echeances.${i}`
    if (!dateValide(é.date)) refuser('date-invalide', `date « ${é.date} » : AAAA-MM-JJ`, cible)
    famille(é, cible)
    texte(é.libellé, BORNES_DE_LA_FICHE.échéance, `${cible}.libelle`)
  })

  // Une présentation par nom de la grille, entité ou partie prenante, jamais un nom inventé.
  const nommés = new Set([...grille.entités.map((e) => normaliserTitre(e.nom)), ...grille.partiesPrenantes.map((p) => normaliserTitre(p.nom))])
  const présentés = new Set<string>()
  ;(fiche.présentations ?? []).forEach((p, i) => {
    const cible = `presentations.${i}`
    const clé = normaliserTitre(p.nom)
    if (!nommés.has(clé)) refuser('nom-inconnu', `« ${p.nom.slice(0, 40)} » n’est ni une entité ni une partie prenante de la grille`, cible)
    if (présentés.has(clé)) refuser('présentation-en-double', `« ${p.nom.slice(0, 40)} » a déjà sa présentation`, cible)
    présentés.add(clé)
    texte(p.texte, BORNES_DE_LA_FICHE.présentation, `${cible}.texte`)
  })
  if (JSON.stringify(fiche).length > TAILLE_MAX_DE_LA_FICHE) refuser('fiche-trop-longue', `la fiche dépasse ${TAILLE_MAX_DE_LA_FICHE} caractères`)
  return refus
}

/** Le message de reprise, pour la revue : chaque refus sur une ligne. */
export function messageDeRepriseDeLaFiche(refus: readonly RefusDeFiche[]): string {
  return refus.map((r) => `[${r.code}]${r.cible ? ` ${r.cible}` : ''} : ${r.message}`).join('\n')
}

const nomDeFamille = (grille: Grille, veille: Veille, numéro: number) =>
  grille.familles.find((f) => f.veille === veille && f.numéro === numéro)?.libellé ?? `Famille ${numéro}`

/** La fiche en texte, pour le courriel « [Relecture] » de la revue. */
export function rendreLaFiche(fiche: FicheDeVeille, grille: Grille, état: string): string {
  const l: string[] = [`Fiche de veille, ${état === 'publie' ? 'publiée' : état === 'retire' ? 'retirée' : 'proposée : rien n’est montré au client'}.`, '', 'THÈMES SUIVIS']
  for (const t of fiche.thèmes) l.push(`- ${t.numéro} ${nomDeFamille(grille, t.veille, t.numéro)} (${t.veille}) : ${t.suit} FORT quand : ${t.fort}`)
  l.push('', 'SOURCES')
  for (const s of fiche.sources) l.push(`- ${s.numéro} ${nomDeFamille(grille, s.veille, s.numéro)} : ${s.nom}${s.site ? ` (${s.site})` : ''}`)
  l.push('', 'NICHES ET SIGNAUX')
  for (const n of fiche.niches) l.push(`- ${n.énoncé} Signal : ${n.signal}`)
  l.push('', 'ÉCHÉANCES')
  for (const é of fiche.échéances) l.push(`- ${é.date} : ${é.libellé}${é.veille && é.numéro !== null ? ` (${é.numéro} ${nomDeFamille(grille, é.veille, é.numéro)})` : ''}`)
  if ((fiche.présentations ?? []).length > 0) {
    l.push('', 'PRÉSENTATIONS')
    for (const p of fiche.présentations ?? []) l.push(`- ${p.nom} : ${p.texte}`)
  }
  return l.join('\n')
}

// ── Les vues des écrans « Votre veille » ────────────────────────────────────

export type ThèmeVu = {
  readonly veille: Veille
  readonly numéro: number
  readonly nom: string
  readonly segment: string
  readonly cadence: string
  /** Ce que la famille suit dans les cadres : sa dimension PESTEL ou sa force de Porter. */
  readonly cadre: string | null
  readonly suit: string | null
  readonly fort: string | null
  readonly sources: number
}

/** Une case par famille de la grille, dans son ordre ; le texte de la fiche s'y ajoute quand elle est publiée. */
export function vueDesThèmes(grille: Grille, fiche: FicheDeVeille | null): readonly ThèmeVu[] {
  return grille.familles.map((f) => {
    const t = fiche?.thèmes.find((x) => x.veille === f.veille && x.numéro === f.numéro)
    return {
      veille: f.veille,
      numéro: f.numéro,
      nom: f.libellé ?? `Famille ${f.numéro}`,
      segment: segmentDeFamille(f),
      cadence: f.cadence,
      cadre: f.pestel ? (LIBELLÉS_PESTEL[f.pestel] ?? null) : f.porter ? (LIBELLÉS_PORTER[f.porter] ?? null) : null,
      suit: t?.suit ?? null,
      fort: t?.fort ?? null,
      sources: fiche?.sources.filter((s) => s.veille === f.veille && s.numéro === f.numéro).length ?? 0,
    }
  })
}

export type SourcesDUneFamille = { readonly veille: Veille; readonly numéro: number; readonly nom: string; readonly sources: readonly { readonly nom: string; readonly site: string | null }[] }

/** Les sources rangées par famille, dans l'ordre de la grille ; une famille sans source n'apparaît pas. */
export function vueDesSources(grille: Grille, fiche: FicheDeVeille): readonly SourcesDUneFamille[] {
  return grille.familles.flatMap((f) => {
    const siennes = fiche.sources.filter((s) => s.veille === f.veille && s.numéro === f.numéro).map((s) => ({ nom: s.nom, site: s.site }))
    return siennes.length > 0 ? [{ veille: f.veille, numéro: f.numéro, nom: f.libellé ?? `Famille ${f.numéro}`, sources: siennes }] : []
  })
}

export type ÉchéanceVue = { readonly date: string; readonly libellé: string; readonly famille: string | null }
export type MoisDuCalendrier = { readonly mois: string; readonly libellé: string; readonly échéances: readonly ÉchéanceVue[] }

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const

/**
 * La frise des douze prochains mois, à partir du mois d'`aujourdhui` : chaque
 * mois avec ses échéances, mois vides compris ; une échéance passée ou au-delà
 * des douze mois n'y figure pas.
 */
export function vueDuCalendrier(grille: Grille, fiche: FicheDeVeille, aujourdhui: string): readonly MoisDuCalendrier[] {
  const d = new Date(`${aujourdhui.slice(0, 7)}-01T00:00:00Z`)
  const mois = Array.from({ length: 12 }, () => {
    const m = d.toISOString().slice(0, 7)
    d.setUTCMonth(d.getUTCMonth() + 1)
    return m
  })
  return mois.map((m) => ({
    mois: m,
    libellé: `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`,
    échéances: fiche.échéances
      .filter((é) => é.date.startsWith(m) && é.date >= aujourdhui)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((é) => ({ date: é.date, libellé: é.libellé, famille: é.veille && é.numéro !== null ? `${é.numéro} ${nomDeFamille(grille, é.veille, é.numéro)}` : null })),
  }))
}

/** La prochaine échéance à partir d'`aujourdhui`, pour la case du tableau de bord. */
export function prochaineÉchéance(fiche: FicheDeVeille, aujourdhui: string): { readonly date: string; readonly libellé: string } | null {
  const à = [...fiche.échéances].filter((é) => é.date >= aujourdhui).sort((a, b) => a.date.localeCompare(b.date))[0]
  return à ? { date: à.date, libellé: à.libellé } : null
}

// ── Les fiches de présentation du référentiel (6 novembre 2026) ─────────────

/** Ce qu'est une entité du corpus pour le lecteur : la grille le dit, jamais le portail. */
export type SorteDEntité = 'concurrent' | 'acteur' | 'partie-prenante'

export const LIBELLÉS_DES_SORTES: Readonly<Record<SorteDEntité, string>> = {
  concurrent: 'concurrent suivi',
  acteur: 'acteur de votre environnement',
  'partie-prenante': 'partie prenante',
}

export type PrésentationDEntité = {
  readonly nom: string
  readonly segment: string
  readonly sorte: SorteDEntité
  /** Aussi partie prenante quand une entité l'est : Mendelow la lit alors en plus. */
  readonly partiePrenante: boolean
  readonly siren: string | null
  /** Le texte de la fiche de veille publiée, ou `null` s'il n'y en a pas encore. */
  readonly présentation: string | null
  /** Ses crans sur la carte des groupes, à la dernière période publiée qui la place ; concurrents seulement. */
  readonly variables: {
    readonly période: string
    readonly libellé: string
    readonly crans: readonly CranNommé[]
    readonly déclaratif: boolean
    readonly référence: string | null
  } | null
  /** Son pouvoir et son intérêt, à la dernière période publiée qui la place ; parties prenantes seulement. */
  readonly mendelow: {
    readonly période: string
    readonly libellé: string
    readonly pouvoir: string
    readonly intérêt: string
    readonly déclaratif: boolean
  } | null
}

/** Le segment d'URL de la fiche d'une entité ou d'une partie prenante : `enSlug` de son nom. */
export const segmentDEntité = (nom: string) => enSlug(nom)

/**
 * Les entités du corpus dans l'ordre où « Corpus » les range : concurrents,
 * acteurs de l'environnement, puis parties prenantes qui ne sont pas déjà une
 * entité. L'organisation elle-même n'est pas un concurrent qu'on lui présente.
 */
export function entitésDuCorpus(grille: Grille, organisation: string): readonly { readonly nom: string; readonly sorte: SorteDEntité }[] {
  const elle = normaliserTitre(organisation)
  const entités = grille.entités
    .filter((e) => normaliserTitre(e.nom) !== elle)
    .map((e) => ({ nom: e.nom, sorte: (e.veille === 'concurrentiel' ? 'concurrent' : 'acteur') as SorteDEntité }))
  const vus = new Set(entités.map((e) => normaliserTitre(e.nom)))
  const ordre: Record<SorteDEntité, number> = { concurrent: 0, acteur: 1, 'partie-prenante': 2 }
  return [
    ...entités.sort((a, b) => ordre[a.sorte] - ordre[b.sorte]),
    ...grille.partiesPrenantes.filter((p) => !vus.has(normaliserTitre(p.nom))).map((p) => ({ nom: p.nom, sorte: 'partie-prenante' as const })),
  ]
}

/** Les positions de la dernière période publiée qui place `nom` pour cet outil. */
function dernièresPositions(positions: readonly PositionDatée[], outil: string, nom: string): readonly PositionDatée[] {
  const clé = normaliserTitre(nom)
  const siennes = positions.filter((p) => p.outil === outil && p.cran !== null && normaliserTitre(p.sujet) === clé)
  const période = siennes.map((p) => p.période).sort().at(-1)
  return période ? siennes.filter((p) => p.période === période) : []
}

/**
 * La fiche de présentation d'une entité ou d'une partie prenante : ce que le
 * référentiel en dit, sans rien lire des lettres. Le nom est retrouvé par le
 * segment d'URL **dans la grille seule** ; un segment inconnu rend `null`, et
 * l'organisation elle-même n'a pas de fiche dans son propre corpus.
 */
export function vueDeLaPrésentation(
  grille: Grille,
  fiche: FicheDeVeille | null,
  segment: string,
  positions: readonly PositionDatée[],
  organisation: string,
): PrésentationDEntité | null {
  const trouvée = entitésDuCorpus(grille, organisation).find((e) => segmentDEntité(e.nom) === segment)
  if (!trouvée) return null
  const clé = normaliserTitre(trouvée.nom)
  const entité = grille.entités.find((e) => normaliserTitre(e.nom) === clé)
  const partiePrenante = grille.partiesPrenantes.some((p) => normaliserTitre(p.nom) === clé)

  const groupes = trouvée.sorte === 'concurrent' ? dernièresPositions(positions, 'groupes', trouvée.nom) : []
  const crans = grille.axesGroupes.flatMap((axe) => {
    const p = groupes.find((x) => x.axe === axe.clé)
    return p && p.cran !== null ? [{ axe: axe.libellé, cran: p.cran, libellé: axe.crans[p.cran - 1] ?? `cran ${p.cran}` }] : []
  })
  const mendelow = partiePrenante ? dernièresPositions(positions, 'mendelow', trouvée.nom) : []
  const pouvoir = mendelow.find((p) => p.axe === 'pouvoir')?.cran ?? null
  const intérêt = mendelow.find((p) => p.axe === 'interet')?.cran ?? null

  return {
    nom: trouvée.nom,
    segment,
    sorte: trouvée.sorte,
    partiePrenante,
    siren: entité?.siren ?? null,
    présentation: fiche?.présentations?.find((p) => normaliserTitre(p.nom) === clé)?.texte ?? null,
    variables:
      crans.length > 0
        ? {
            période: groupes[0]!.période,
            libellé: libelléDePériode(groupes[0]!.période),
            crans,
            déclaratif: groupes.every((p) => p.origine === 'declaratif'),
            référence: groupes.find((p) => p.référence)?.référence ?? null,
          }
        : null,
    mendelow:
      pouvoir !== null && intérêt !== null
        ? {
            période: mendelow[0]!.période,
            libellé: libelléDePériode(mendelow[0]!.période),
            pouvoir: LIBELLÉS_MENDELOW[pouvoir - 1] ?? `cran ${pouvoir}`,
            intérêt: LIBELLÉS_MENDELOW[intérêt - 1] ?? `cran ${intérêt}`,
            déclaratif: mendelow.every((p) => p.origine === 'declaratif'),
          }
        : null,
  }
}

export type PrésentationDAxe = ThèmeVu & {
  /** Le libellé de la veille qui porte la famille, pour le lecteur. */
  readonly veilleNommée: string
  readonly sourcesNommées: readonly { readonly nom: string; readonly site: string | null }[]
  /** Ses échéances à venir, de la plus proche à la plus lointaine. */
  readonly échéances: readonly { readonly date: string; readonly libellé: string }[]
}

const VEILLE_NOMMÉE: Readonly<Record<Veille, string>> = { ecosysteme: 'votre environnement', concurrentiel: 'votre concurrence' }

/**
 * La fiche de présentation d'un axe : la famille du référentiel qui le définit,
 * son cadre, sa cadence, ce qu'il suit, ce qui rend un de ses faits fort, ses
 * sources et ses échéances à venir. Le segment n'est comparé qu'à la grille ;
 * inconnu, `null`. La fiche de veille non publiée laisse la grille seule.
 */
export function vueDeLAxePrésenté(grille: Grille, fiche: FicheDeVeille | null, segment: string, aujourdhui: string): PrésentationDAxe | null {
  const thème = vueDesThèmes(grille, fiche).find((t) => t.segment === segment)
  if (!thème) return null
  const sienne = (x: { readonly veille: Veille | null; readonly numéro: number | null }) => x.veille === thème.veille && x.numéro === thème.numéro
  return {
    ...thème,
    veilleNommée: VEILLE_NOMMÉE[thème.veille],
    sourcesNommées: (fiche?.sources ?? []).filter(sienne).map((s) => ({ nom: s.nom, site: s.site })),
    échéances: (fiche?.échéances ?? [])
      .filter((é) => sienne(é) && é.date >= aujourdhui)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((é) => ({ date: é.date, libellé: é.libellé })),
  }
}
