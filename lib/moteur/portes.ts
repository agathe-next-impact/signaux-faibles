/**
 * Les portes de la production (programme du 22 octobre 2026, §3, étape 4).
 *
 * Mécaniques, et les seules qui décident : le contrat de forme (validateur de
 * production, forme unique), les citations (toute URL de la lettre est dans le
 * dossier de collecte), les dates (un fait de la période est daté dedans, ou
 * donné comme contexte), le vocabulaire interdit. Un manquement devient un
 * message de reprise que le modèle reçoit dans la même conversation.
 */
import { contrôlerLaLettre, type Rapport } from '@/lib/portail/lint'
import type { LettreAssemblée } from '@/lib/moteur/assemblage'
import type { SortieRédigée, Sélection } from '@/lib/moteur/redaction'
import { normaliserUrl } from '@/lib/moteur/recherche'

export type Manquement = { readonly code: string; readonly message: string }

export type ContrôleDeProduction = {
  readonly franchies: boolean
  readonly rapport: Rapport
  readonly manquements: readonly Manquement[]
  readonly messageDeReprise: string | null
  readonly faits: number
}

const VOCABULAIRE_INTERDIT: ReadonlyArray<{ motif: RegExp; libellé: string }> = [
  { motif: /\bréférentiel\b/i, libellé: '« référentiel »' },
  { motif: /§\s?\d/, libellé: 'une numérotation « § »' },
  { motif: /\bFAIBLE\b/, libellé: '« FAIBLE »' },
  { motif: /\bnon ouvert(e|es|s)?\b/i, libellé: '« non ouverte »' },
  { motif: /requ[êe]tes? non lanc/i, libellé: '« requête non lancée »' },
  { motif: /\bnote de m[ée]thode\b/i, libellé: '« note de méthode »' },
]

function citéeParUnFait(sortie: SortieRédigée, url: string): boolean {
  const cible = normaliserUrl(url)
  return sortie.axes.some((axe) => axe.faits.some((fait) => [fait.url, ...fait.autresUrls].some((u) => normaliserUrl(u) === cible)))
}

const MOIS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
const MOIS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function sansAccents(texte: string): string {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** La date AAAA-MM-JJ se lit-elle dans le texte, sous l'une de ses écritures courantes (« 18 octobre », « Oct 18 », « 18/10/2026 », « 2026-10-18 ») ? */
export function dateSeLit(texte: string, iso: string): boolean {
  const [a, m, j] = iso.split('-').map(Number)
  if (!a || !m || !j) return false
  const t = sansAccents(texte)
  const jour = `0?${j}(?:er)?`
  const mois = [MOIS_FR[m - 1]!, MOIS_FR[m - 1]!.slice(0, 4), MOIS_EN[m - 1]!, MOIS_EN[m - 1]!.slice(0, 3)].join('|')
  const motifs = [
    new RegExp(`\\b${jour}\\s+(?:de\\s+)?(?:${mois})\\b`),
    new RegExp(`\\b(?:${mois})\\.?\\s+${jour}(?!\\d)`),
    new RegExp(`\\b${jour}[/.-]0?${m}(?:[/.-](?:${a}|${String(a).slice(2)}))?(?!\\d)`),
    new RegExp(`\\b${a}-0?${m}-0?${j}(?!\\d)`),
    new RegExp(`\\b0?${m}/${jour}/${a}(?!\\d)`),
  ]
  return motifs.some((motif) => motif.test(t))
}

const MOTS_BANALS = new Set(['cette', 'semaine', 'bouge', 'reste', 'avant', 'apres', 'dans', 'pour', 'avec', 'sans', 'depuis', 'attend', 'suite', 'encore', 'toujours', 'plus', 'moins', 'dossier', 'changement'])

function motsDuDossier(d: { nom: string; suivi: string }): Set<string> {
  return new Set(
    sansAccents(`${d.nom} ${d.suivi}`)
      .split(/[^a-z0-9]+/)
      .filter((mot) => mot.length >= 4 && !MOTS_BANALS.has(mot)),
  )
}

/** Les paires de dossiers dont le texte se recouvre aux deux tiers : un même sujet écrit deux fois. */
export function dossiersEnDouble(dossiers: ReadonlyArray<{ nom: string; suivi: string }>): Array<[string, string]> {
  const paires: Array<[string, string]> = []
  for (let i = 0; i < dossiers.length; i += 1) {
    for (let k = i + 1; k < dossiers.length; k += 1) {
      const a = motsDuDossier(dossiers[i]!)
      const b = motsDuDossier(dossiers[k]!)
      const commun = [...a].filter((mot) => b.has(mot)).length
      const union = a.size + b.size - commun
      if (union > 0 && commun >= 4 && commun / union >= 0.5) paires.push([dossiers[i]!.nom, dossiers[k]!.nom])
    }
  }
  return paires
}

export function urlsDuMarkdown(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(/https?:\/\/[^\s)\]>"']+/g)].map((m) => m[0].replace(/[.,;:]+$/, '')))]
}

export function contrôlerLaProduction(entrée: {
  readonly lettre: LettreAssemblée
  readonly sortie: SortieRédigée
  readonly sélection: Sélection
  /** Les URL que le code a réellement ouvertes : sources à l'état ouvert et résultats de recherche. */
  readonly urlsAdmises: ReadonlySet<string>
  /** Ce que dit chaque URL ouverte, par URL normalisée : la porte des dates y cherche la date du fait. */
  readonly textes?: ReadonlyMap<string, string>
}): ContrôleDeProduction {
  const { lettre, sortie, sélection } = entrée
  const rapport = contrôlerLaLettre({
    titre: lettre.propriétés.titre,
    blocs: lettre.blocs,
    dossiersBruts: lettre.propriétés.dossiersOuvertsSuivis,
    numéro: sélection.numéro,
    forme: 'unique',
  })
  const manquements: Manquement[] = rapport.ruptures.map((r) => ({ code: r.code, message: r.message }))

  // ── Citations : rien qui n'ait été ouvert ─────────────────────────────────
  const admises = new Set([...entrée.urlsAdmises].map(normaliserUrl))
  // La rubrique des sources non consultées est écrite par le code et liste des URL non ouvertes : seuls les faits de la lettre citent.
  const ignorées = new Set(lettre.urlsIgnorées.map(normaliserUrl))
  const nonOuvertes = urlsDuMarkdown(lettre.markdown).filter((u) => !admises.has(normaliserUrl(u)) && !(ignorées.has(normaliserUrl(u)) && !citéeParUnFait(sortie, u)))
  if (nonOuvertes.length > 0) {
    manquements.push({
      code: 'citation-non-ouverte',
      message: `${nonOuvertes.length} URL citée(s) qui ne sont pas dans le dossier de collecte : ${nonOuvertes.slice(0, 10).join(', ')}. Chaque fait cite l'URL exacte de l'extrait dont il vient ; un fait sans extrait n'existe pas.`,
    })
  }

  // ── Dates : dans la période, ou contexte assumé ──────────────────────────
  for (const axe of sortie.axes) {
    for (const fait of axe.faits) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fait.date)) {
        manquements.push({ code: 'fait-date-illisible', message: `axe ${axe.numéro} : la date « ${fait.date} » n'est pas au format AAAA-MM-JJ.` })
        continue
      }
      if (fait.date < sélection.période.début && !fait.contexte) {
        manquements.push({
          code: 'fait-hors-période',
          message: `axe ${axe.numéro} : le fait du ${fait.date} est antérieur à la période (${sélection.période.début} au ${sélection.période.fin}) sans être donné comme élément de contexte : le marquer contexte s'il éclaire une échéance, sinon le retirer.`,
        })
      }
      if (fait.date > sélection.dateÉdition) {
        manquements.push({ code: 'fait-futur', message: `axe ${axe.numéro} : le fait est daté du ${fait.date}, après la date d'édition : une échéance à venir se date du jour de son annonce.` })
      }
    }
  }

  // ── Dates : celle d'un fait se lit dans sa source ─────────────────────────
  if (entrée.textes) {
    for (const axe of sortie.axes) {
      for (const fait of axe.faits) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fait.date)) continue
        const lus = [fait.url, ...fait.autresUrls].map((u) => entrée.textes?.get(normaliserUrl(u))).filter((t): t is string => typeof t === 'string')
        if (lus.length > 0 && !lus.some((texte) => dateSeLit(texte, fait.date))) {
          manquements.push({
            code: 'fait-date-non-sourcée',
            message: `axe ${axe.numéro} : le fait daté du ${fait.date} (« ${fait.texte.slice(0, 70)} ») n'a pas cette date dans ${fait.url} : la date d'un fait est celle que son extrait donne, jamais celle d'une autre page. La corriger d'après l'extrait, citer l'article qui porte la date, ou retirer le fait.`,
          })
        }
      }
    }
  }

  // ── Dossiers : un même sujet n'ouvre pas deux dossiers ──────────────────
  const doublons = dossiersEnDouble(sortie.dossiers)
  if (doublons.length > 0) {
    manquements.push({
      code: 'dossiers-doublons',
      message: `dossiers en double : ${doublons.map(([a, b]) => `« ${a} » et « ${b} »`).join(' ; ')}. Deux organisations dans une même affaire forment un seul dossier, nommé « A et B », avec un seul suivi.`,
    })
  }

  // ── Vocabulaire ───────────────────────────────────────────────────────────
  for (const { motif, libellé } of VOCABULAIRE_INTERDIT) {
    if (motif.test(lettre.markdown)) manquements.push({ code: 'vocabulaire-interdit', message: `la lettre contient ${libellé} : rien du référentiel ni de la méthode n'est écrit au client.` })
  }

  // ── Tous les axes du référentiel sont rendus ─────────────────────────────
  const rendus = new Set(sortie.axes.map((a) => a.numéro))
  const manquants = [...rapport.aperçu.axes].filter((a) => a.numéro !== null && !rendus.has(a.numéro))
  if (manquants.length > 0) {
    manquements.push({ code: 'axe-omis', message: `${manquants.length} axe(s) du référentiel sans objet dans la sortie : ${manquants.map((a) => a.titre).join(', ')}. Tous les axes sont rendus, en RAS s'il le faut.` })
  }

  const faits = sortie.axes.reduce((total, a) => total + (a.niveau === 'RAS' ? 0 : a.faits.length), 0)
  const franchies = manquements.length === 0
  return {
    franchies,
    rapport,
    manquements,
    faits,
    messageDeReprise: franchies ? null : messageDeReprise(manquements),
  }
}

export function messageDeReprise(manquements: readonly Manquement[]): string {
  const lignes = manquements.map((m) => `- [${m.code}] ${m.message}`)
  return (
    `LA LETTRE N'EST PAS ACCEPTÉE. Le programme a relevé les manquements suivants au contrat ; corrige chacun d'eux et rends de nouveau l'objet complet, tous les axes, dans le même format. ` +
    `Ne change rien d'autre que ce qui est demandé ; n'ajoute aucune URL qui ne soit dans le dossier ; un fait que tu ne peux pas sourcer ou dater est retiré, et l'axe passe en RAS s'il n'en reste aucun.\n${lignes.join('\n')}`
  )
}
