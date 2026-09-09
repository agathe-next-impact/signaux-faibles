/**
 * Regroupement des éditions par semaine.
 *
 * Le dispositif produit deux notes par parution et par organisation, une par
 * veille, numérotées séparément par famille. Le portail n'en fait pas deux
 * entrées concurrentes : une entrée par semaine, qui rassemble les notes de la
 * semaine. Le regroupement se fait ici, côté portail, après la requête filtrée
 * — jamais par une requête Notion par semaine.
 *
 * Tous les calculs sont en UTC. Les dates d'édition sont des dates sans heure ;
 * passer par le fuseau local ferait basculer certaines d'un jour, donc parfois
 * d'une semaine.
 */

/** Clé d'une semaine : la date ISO de son lundi, par exemple `2026-09-07`. */
export type CléDeSemaine = string

const JOUR_MS = 24 * 60 * 60 * 1000

/** `true` pour une date ISO calendaire valide, `2026-09-07` par exemple. */
export function estUneDateISO(valeur: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false
  const date = new Date(`${valeur}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valeur
}

/**
 * Lundi de la semaine ISO d'une date. La semaine ISO commence le lundi, et
 * `getUTCDay()` place le dimanche à 0 : il faut donc le ramener à 7.
 */
export function lundiDeLaSemaine(dateISO: string): CléDeSemaine {
  if (!estUneDateISO(dateISO)) {
    throw new Error(`Date d'édition inexploitable : « ${dateISO} »`)
  }

  const date = new Date(`${dateISO}T00:00:00.000Z`)
  const jour = date.getUTCDay() === 0 ? 7 : date.getUTCDay()
  const lundi = new Date(date.getTime() - (jour - 1) * JOUR_MS)
  return lundi.toISOString().slice(0, 10)
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const

/** « semaine du 1er septembre 2026 ». Sentence case, comme partout dans l'UI. */
export function libelléDeSemaine(clé: CléDeSemaine): string {
  const date = new Date(`${clé}T00:00:00.000Z`)
  const jour = date.getUTCDate()
  const mois = MOIS[date.getUTCMonth()]
  return `semaine du ${jour === 1 ? '1er' : jour} ${mois} ${date.getUTCFullYear()}`
}

export type AvecDate = { readonly dateÉdition: string }

export type Semaine<T extends AvecDate> = {
  readonly clé: CléDeSemaine
  readonly libellé: string
  /** Les notes de la semaine, dans l'ordre où la source les a données. */
  readonly éditions: readonly T[]
}

/**
 * Regroupe des éditions par semaine, de la plus récente à la plus ancienne.
 *
 * Une édition dont la date est inexploitable est écartée plutôt que rattachée
 * à une semaine arbitraire : mieux vaut une entrée manquante qu'une entrée
 * fausse. Les semaines de juillet 2026 portent plusieurs notes écosystème,
 * le dispositif n'étant pas encore hebdomadaire ; c'est fidèle à ce qui a été
 * envoyé et ne doit pas être lissé.
 */
export function regrouperParSemaine<T extends AvecDate>(
  éditions: readonly T[],
): Semaine<T>[] {
  const paquets = new Map<CléDeSemaine, T[]>()

  for (const édition of éditions) {
    if (!estUneDateISO(édition.dateÉdition)) continue
    const clé = lundiDeLaSemaine(édition.dateÉdition)
    const paquet = paquets.get(clé)
    if (paquet) paquet.push(édition)
    else paquets.set(clé, [édition])
  }

  return [...paquets.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([clé, liste]) => ({ clé, libellé: libelléDeSemaine(clé), éditions: liste }))
}
