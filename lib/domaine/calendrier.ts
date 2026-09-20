import { estUneDateISO } from '@/lib/domaine/semaines'

/**
 * La sélection du jour, en code.
 *
 * Jusqu'au 17 septembre 2026, c'était le modèle de langage qui, à chaque run,
 * établissait le jour de la semaine, le quantième et la semaine ISO en heure de
 * Paris, puis appliquait la règle de cadence de chaque organisation. Les
 * formules Notion « Parution aujourd'hui » et « Revue mensuelle demain » font
 * le même calcul, mais l'API ne les expose pas. Ce module est la troisième
 * copie de la règle, et la seule qui soit testée : les deux autres — la formule
 * et la prose de la page « Tâche — Lettres de veille » — doivent lui rester
 * conformes.
 *
 * Le portail ne lit pas le registre (règle 2 de `CLAUDE.md`) : la liste des
 * organisations lui est **donnée** par l'appelant, avec leur jour et leur
 * cadence, et il ne rend que des slugs. Ce module est pur.
 */

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const
export type Jour = (typeof JOURS)[number]

/** Les options exactes de la propriété « Cadence » du registre. */
export const CADENCES = [
  'Hebdomadaire',
  'Quinzaine (semaines paires)',
  'Mensuelle (1re occurrence du mois)',
] as const
export type Cadence = (typeof CADENCES)[number]

export type OrganisationÀDater = {
  readonly slug: string
  readonly jour: Jour
  readonly cadence: Cadence
  /** Ordonne les organisations d'un même jour, par exemple « 6 h 30 ». */
  readonly heure?: string
}

export type Datation = {
  readonly date: string
  readonly jour: Jour
  readonly quantième: number
  readonly semaineISO: number
  readonly annéeISO: number
  readonly semainePaire: boolean
}

const JOUR_MS = 24 * 60 * 60 * 1000

/** La date calendaire courante à Paris, au format ISO. */
export function aujourdHuiÀParis(maintenant: Date = new Date()): string {
  // `sv-SE` compose naturellement en AAAA-MM-JJ ; c'est le seul rôle de la locale.
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(maintenant)
}

function versDate(dateISO: string): Date {
  if (!estUneDateISO(dateISO)) throw new Error(`Date inexploitable : « ${dateISO} »`)
  return new Date(`${dateISO}T00:00:00.000Z`)
}

function versISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Semaine ISO 8601 : la semaine 1 est celle qui contient le 4 janvier. */
function semaineISODe(date: Date): { semaine: number; année: number } {
  const copie = new Date(date.getTime())
  const jour = copie.getUTCDay() === 0 ? 7 : copie.getUTCDay()
  // Ramène au jeudi de la même semaine : c'est lui qui fixe l'année ISO.
  copie.setUTCDate(copie.getUTCDate() + 4 - jour)
  const année = copie.getUTCFullYear()
  const premierJanvier = new Date(Date.UTC(année, 0, 1))
  const semaine = Math.ceil(((copie.getTime() - premierJanvier.getTime()) / JOUR_MS + 1) / 7)
  return { semaine, année }
}

/** Tout ce que la règle de cadence a besoin de savoir d'une date. */
export function dater(dateISO: string): Datation {
  const date = versDate(dateISO)
  const indexJour = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1
  const { semaine, année } = semaineISODe(date)
  return {
    date: dateISO,
    jour: JOURS[indexJour] as Jour,
    quantième: date.getUTCDate(),
    semaineISO: semaine,
    annéeISO: année,
    semainePaire: semaine % 2 === 0,
  }
}

/** La date du lendemain, ou de `n` jours plus tard. */
export function décaler(dateISO: string, jours: number): string {
  return versISO(new Date(versDate(dateISO).getTime() + jours * JOUR_MS))
}

/**
 * La règle de parution, telle que la page « Tâche — Lettres de veille » l'écrit :
 * le jour de parution est le jour de la date, ET la cadence tombe ce jour-là.
 * Hebdomadaire → toujours ; quinzaine → semaine ISO paire ; mensuelle →
 * quantième ≤ 7 (première occurrence du jour dans le mois).
 */
export function paraîtLe(organisation: OrganisationÀDater, datation: Datation): boolean {
  if (organisation.jour !== datation.jour) return false
  switch (organisation.cadence) {
    case 'Hebdomadaire':
      return true
    case 'Quinzaine (semaines paires)':
      return datation.semainePaire
    case 'Mensuelle (1re occurrence du mois)':
      return datation.quantième <= 7
  }
}

/**
 * La règle de la revue mensuelle : la parution à cette date est la **première
 * du mois** pour cette organisation.
 *
 * Elle est **dérivée** de `paraîtLe` et non réécrite : l'organisation paraît ce
 * jour-là, et aucun jour antérieur du même mois ne la faisait paraître. La page
 * « Tâche — Revue mensuelle » l'écrivait en arithmétique (hebdomadaire →
 * quantième ≤ 7 ; quinzaine → semaine paire et quantième ≤ 14), et
 * l'arithmétique est fausse dès janvier 2027 : 2026 compte 53 semaines ISO, la
 * semaine 53 et la semaine 1 sont toutes deux impaires, et une quinzaine « paire »
 * qui paraît le vendredi saute trois semaines — sa première parution de janvier
 * tombe le 15, quantième 15, que la formule refuse. Dériver couvre toutes les
 * cadences, y compris celles qu'on ajouterait.
 */
export function premièreParutionDuMois(
  organisation: OrganisationÀDater,
  datation: Datation,
): boolean {
  if (!paraîtLe(organisation, datation)) return false
  for (let n = 1; n < datation.quantième; n += 1) {
    if (paraîtLe(organisation, dater(décaler(datation.date, -n)))) return false
  }
  return true
}

/** Ordre de traitement d'un même jour : l'heure de parution, puis le slug. */
export function ordonner<T extends OrganisationÀDater>(organisations: readonly T[]): T[] {
  const minutes = (heure: string | undefined): number => {
    const m = /(\d{1,2})\s*h\s*(\d{2})?/.exec(heure ?? '')
    return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : Number.MAX_SAFE_INTEGER
  }
  return [...organisations].sort(
    (a, b) => minutes(a.heure) - minutes(b.heure) || a.slug.localeCompare(b.slug, 'fr'),
  )
}

export type ProchaineParution = {
  readonly slug: string
  readonly date: string
  readonly jour: Jour
}

/**
 * La prochaine parution de chaque organisation strictement après `dateISO`,
 * cherchée sur `horizon` jours. Une organisation mensuelle attend au plus
 * cinq semaines ; l'horizon par défaut couvre ce cas avec marge.
 */
export function prochainesParutions(
  organisations: readonly OrganisationÀDater[],
  dateISO: string,
  horizon = 62,
): ProchaineParution[] {
  const restantes = new Map(organisations.map((o) => [o.slug, o]))
  const trouvées: ProchaineParution[] = []

  for (let n = 1; n <= horizon && restantes.size > 0; n += 1) {
    const datation = dater(décaler(dateISO, n))
    for (const organisation of ordonner([...restantes.values()])) {
      if (paraîtLe(organisation, datation)) {
        trouvées.push({ slug: organisation.slug, date: datation.date, jour: datation.jour })
        restantes.delete(organisation.slug)
      }
    }
  }

  return trouvées
}

export type Sélection = {
  readonly aujourdHui: Datation
  readonly demain: Datation
  /** À produire aujourd'hui, dans l'ordre de traitement. */
  readonly parutions: readonly OrganisationÀDater[]
  /** Dont la première parution du mois tombe demain : revue mensuelle ce soir. */
  readonly revuesDues: readonly OrganisationÀDater[]
  readonly prochaines: readonly ProchaineParution[]
}

/** La sélection complète d'une date, pour la tâche des lettres et celle de la revue. */
export function sélectionner(
  organisations: readonly OrganisationÀDater[],
  dateISO: string,
): Sélection {
  const aujourdHui = dater(dateISO)
  const demain = dater(décaler(dateISO, 1))
  return {
    aujourdHui,
    demain,
    parutions: ordonner(organisations.filter((o) => paraîtLe(o, aujourdHui))),
    revuesDues: ordonner(organisations.filter((o) => premièreParutionDuMois(o, demain))),
    prochaines: prochainesParutions(organisations, dateISO),
  }
}
