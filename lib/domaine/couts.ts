/**
 * Le coût des tâches, mois par mois (16 novembre 2026, demande de l'opératrice).
 *
 * Chaque run rapporte ce que le SDK dit qu'il a coûté ; ce module range les
 * runs dans un mois de Paris et en tire les totaux de l'écran `/espaces/couts` :
 * par tâche, puis par organisation. Fonctions pures : ni base, ni horloge.
 *
 * **Le coût par organisation est exact ou estimé, et l'écran distingue les
 * deux.** Un run ciblé sur une organisation (onboarding, étiquetage) lui est
 * imputé en entier. Un run qui en traite plusieurs (les lettres du jour) n'est
 * pas mesuré organisation par organisation : sa dépense est répartie à parts
 * égales, ce qui est une convention et non une mesure. Un run qui n'en nomme
 * aucune (réconciliation, revue sans parution) reste « non attribué » : le
 * répartir sur tout le portefeuille inventerait un chiffre.
 */

export type RunMesuré = {
  readonly tâche: string
  /** L'organisation visée par `--organisation`, ou `null`. */
  readonly organisation: string | null
  /** Les slugs que le run a traités. */
  readonly organisations: readonly string[]
  /** L'issue du SDK ; seule `success` est une réussite. */
  readonly issue: string
  readonly coûtUsd: number
  readonly plafondUsd: number | null
  readonly duréeMs: number | null
  readonly tours: number | null
  readonly runGithub: number | null
  readonly lien: string | null
  readonly origine: string
  readonly mesuréLe: Date
}

import { enSlug } from '@/lib/domaine/slug'

const MOIS = /^(\d{4})-(0[1-9]|1[0-2])$/

export function estUnMois(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && MOIS.test(valeur)
}

const HORLOGE_DE_PARIS = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Le mois de Paris d'un instant, `AAAA-MM`. */
export function moisDeParis(instant: Date): string {
  return HORLOGE_DE_PARIS.format(instant).slice(0, 7)
}

/** Minuit à Paris le premier du mois : une ou deux heures avant minuit UTC, selon la saison. */
function minuitDeParis(année: number, mois: number): Date {
  const attendu = `${String(année).padStart(4, '0')}-${String(mois).padStart(2, '0')}-01 00:00`
  for (const heures of [1, 2]) {
    const candidat = new Date(Date.UTC(année, mois - 1, 1) - heures * 60 * 60 * 1000)
    if (HORLOGE_DE_PARIS.format(candidat) === attendu) return candidat
  }
  throw new Error(`Minuit de Paris introuvable pour ${attendu}`)
}

/** Les bornes d'un mois de Paris : son premier instant, et le premier du mois suivant (exclu). */
export function bornesDuMois(mois: string): { readonly début: Date; readonly fin: Date } {
  const lu = MOIS.exec(mois)
  if (!lu) throw new Error(`Mois inexploitable : « ${mois} »`)
  const année = Number(lu[1])
  const rang = Number(lu[2])
  return { début: minuitDeParis(année, rang), fin: rang === 12 ? minuitDeParis(année + 1, 1) : minuitDeParis(année, rang + 1) }
}

export function moisVoisins(mois: string): { readonly précédent: string; readonly suivant: string } {
  const lu = MOIS.exec(mois)
  if (!lu) throw new Error(`Mois inexploitable : « ${mois} »`)
  const année = Number(lu[1])
  const rang = Number(lu[2])
  const écrire = (a: number, m: number) => `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}`
  return {
    précédent: rang === 1 ? écrire(année - 1, 12) : écrire(année, rang - 1),
    suivant: rang === 12 ? écrire(année + 1, 1) : écrire(année, rang + 1),
  }
}

/** « novembre 2026 ». */
export function libelléDuMois(mois: string): string {
  const { début } = bornesDuMois(mois)
  // Midi du 2 : loin de toute frontière de fuseau.
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', month: 'long', year: 'numeric' }).format(new Date(début.getTime() + 36 * 60 * 60 * 1000))
}

const LIBELLÉS_DE_TÂCHE: Readonly<Record<string, string>> = {
  lettres: 'lettres de veille',
  reconciliation: 'réconciliation des envois',
  revue: 'revue mensuelle',
  balayage: 'balayage (référentiels, activation)',
  'premiere-lettre': 'première lettre',
  etiquetage: 'étiquetage',
  retrospective: 'rétrospective',
  onboarding: 'onboarding (moteur)',
  controle: 'contrôle avant essai',
}

/** Le nom d'une tâche pour l'écran ; une tâche inconnue s'affiche telle quelle. */
export function libelléDeTâche(tâche: string): string {
  return LIBELLÉS_DE_TÂCHE[tâche] ?? tâche
}

/** « 15,17 $ ». Le dollar : c'est la monnaie de la facture de l'API. */
export function dollars(montant: number): string {
  return `${montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
}

const arrondir = (n: number) => Math.round(n * 10_000) / 10_000

/** Seule l'issue `success` du SDK est une réussite : plafond atteint, erreur et refus n'en sont pas. */
export function aRéussi(run: Pick<RunMesuré, 'issue'>): boolean {
  return run.issue === 'success'
}

/** Les organisations auxquelles un run s'impute : celles qu'il a traitées, à défaut celle qu'il visait. */
export function organisationsDuRun(run: Pick<RunMesuré, 'organisation' | 'organisations'>): string[] {
  const traitées = [...new Set(run.organisations.filter((slug) => slug.length > 0))].sort()
  return traitées.length > 0 ? traitées : run.organisation ? [run.organisation] : []
}

/**
 * Les slugs d'un run, depuis ce que le harnais a relevé : `--organisation`
 * accepte un slug ou un nom, et un nom (« Aquitaine Robotics ») est ramené à
 * son slug. Dédoublonnés, triés, 120 caractères au plus ; ce qui ne donne rien
 * est écarté.
 */
export function slugsDUnRun(valeurs: readonly string[]): string[] {
  return [...new Set(valeurs.map((v) => enSlug(v)).filter((slug) => slug.length > 0 && slug.length <= 120))].sort()
}

export type TotalParTâche = {
  readonly tâche: string
  readonly runs: number
  /** Runs dont l'issue n'est pas `success` : leur coût est dépensé quand même. */
  readonly échecs: number
  readonly coûtUsd: number
  /** La somme des plafonds : ce que ces runs pouvaient coûter au plus. */
  readonly plafondUsd: number
  readonly duréeMs: number
}

export type TotalParOrganisation = {
  readonly slug: string
  /** Runs qui ont traité cette organisation, seule ou avec d'autres. */
  readonly runs: number
  /** Imputé en entier : runs qui n'ont traité qu'elle. */
  readonly exactUsd: number
  /** Sa part égale des runs qui en ont traité plusieurs : une convention, pas une mesure. */
  readonly estiméUsd: number
  readonly coûtUsd: number
}

export type TotauxDuMois = {
  readonly runs: number
  readonly échecs: number
  readonly coûtUsd: number
  readonly parTâche: readonly TotalParTâche[]
  readonly parOrganisation: readonly TotalParOrganisation[]
  /** Le coût des runs qui ne nomment aucune organisation. */
  readonly nonAttribuéUsd: number
  /** Le coût réparti à parts égales entre plusieurs organisations. */
  readonly répartiUsd: number
}

/** Les totaux d'un ensemble de runs (ceux d'un mois), par tâche puis par organisation, du plus coûteux au moins coûteux. */
export function totauxDuMois(runs: readonly RunMesuré[]): TotauxDuMois {
  const tâches = new Map<string, { runs: number; échecs: number; coût: number; plafond: number; durée: number }>()
  const organisations = new Map<string, { runs: number; exact: number; estimé: number }>()
  let coût = 0
  let échecs = 0
  let nonAttribué = 0
  let réparti = 0

  for (const run of runs) {
    coût += run.coûtUsd
    if (!aRéussi(run)) échecs++

    const t = tâches.get(run.tâche) ?? { runs: 0, échecs: 0, coût: 0, plafond: 0, durée: 0 }
    t.runs++
    if (!aRéussi(run)) t.échecs++
    t.coût += run.coûtUsd
    t.plafond += run.plafondUsd ?? 0
    t.durée += run.duréeMs ?? 0
    tâches.set(run.tâche, t)

    const slugs = organisationsDuRun(run)
    if (slugs.length === 0) {
      nonAttribué += run.coûtUsd
      continue
    }
    if (slugs.length > 1) réparti += run.coûtUsd
    const part = run.coûtUsd / slugs.length
    for (const slug of slugs) {
      const o = organisations.get(slug) ?? { runs: 0, exact: 0, estimé: 0 }
      o.runs++
      if (slugs.length === 1) o.exact += part
      else o.estimé += part
      organisations.set(slug, o)
    }
  }

  return {
    runs: runs.length,
    échecs,
    coûtUsd: arrondir(coût),
    parTâche: [...tâches.entries()]
      .map(([tâche, t]) => ({ tâche, runs: t.runs, échecs: t.échecs, coûtUsd: arrondir(t.coût), plafondUsd: arrondir(t.plafond), duréeMs: t.durée }))
      .sort((a, b) => b.coûtUsd - a.coûtUsd || a.tâche.localeCompare(b.tâche, 'fr')),
    parOrganisation: [...organisations.entries()]
      .map(([slug, o]) => ({ slug, runs: o.runs, exactUsd: arrondir(o.exact), estiméUsd: arrondir(o.estimé), coûtUsd: arrondir(o.exact + o.estimé) }))
      .sort((a, b) => b.coûtUsd - a.coûtUsd || a.slug.localeCompare(b.slug, 'fr')),
    nonAttribuéUsd: arrondir(nonAttribué),
    répartiUsd: arrondir(réparti),
  }
}

/** « 33 min », « 1 h 05 », « 45 s ». */
export function duréeLisible(ms: number | null): string {
  if (ms === null || ms <= 0) return '·'
  const secondes = Math.round(ms / 1000)
  if (secondes < 60) return `${secondes} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}
