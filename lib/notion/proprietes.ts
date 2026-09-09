/**
 * Lecture défensive des propriétés d'une page Notion.
 *
 * Le schéma est vérifié au démarrage (lib/notion/schema.ts), mais une propriété
 * peut être vide sur une page donnée. Chaque lecteur renvoie une valeur neutre
 * plutôt que de lever : une édition incomplète s'affiche amputée, elle ne fait
 * pas tomber la page.
 */
type Propriétés = Record<string, unknown>

function propriété(page: unknown, nom: string): Record<string, unknown> | null {
  const propriétés = (page as { properties?: Propriétés } | null)?.properties
  const valeur = propriétés?.[nom]
  return typeof valeur === 'object' && valeur !== null
    ? (valeur as Record<string, unknown>)
    : null
}

function concaténer(valeur: unknown): string {
  if (!Array.isArray(valeur)) return ''
  return (valeur as Array<{ plain_text?: string }>)
    .map((morceau) => morceau.plain_text ?? '')
    .join('')
    .trim()
}

export function lireTitre(page: unknown, nom: string): string {
  return concaténer(propriété(page, nom)?.['title'])
}

export function lireTexte(page: unknown, nom: string): string {
  return concaténer(propriété(page, nom)?.['rich_text'])
}

export function lireSélection(page: unknown, nom: string): string | null {
  const sélection = propriété(page, nom)?.['select']
  if (typeof sélection !== 'object' || sélection === null) return null
  const valeur = (sélection as { name?: unknown }).name
  return typeof valeur === 'string' ? valeur : null
}

export function lireDate(page: unknown, nom: string): string | null {
  const date = propriété(page, nom)?.['date']
  if (typeof date !== 'object' || date === null) return null
  const début = (date as { start?: unknown }).start
  return typeof début === 'string' ? début.slice(0, 10) : null
}

export function lireNombre(page: unknown, nom: string): number | null {
  const nombre = propriété(page, nom)?.['number']
  return typeof nombre === 'number' ? nombre : null
}

export function lireCase(page: unknown, nom: string): boolean {
  return propriété(page, nom)?.['checkbox'] === true
}

export function lireEmail(page: unknown, nom: string): string | null {
  const email = propriété(page, nom)?.['email']
  return typeof email === 'string' && email.length > 0 ? email : null
}

/**
 * Identifiants d'une relation.
 *
 * Renvoie **toute** la liste, jamais le premier élément : une relation est une
 * liste, et le 9 septembre 2026 deux éditions ont porté simultanément la ligne
 * de registre vivante et son doublon mis à la corbeille. Décider de
 * l'appartenance sur `[0]` aurait donné la mauvaise organisation.
 */
export function lireRelation(page: unknown, nom: string): string[] {
  const relation = propriété(page, nom)?.['relation']
  if (!Array.isArray(relation)) return []
  return (relation as Array<{ id?: unknown }>)
    .map((entrée) => entrée.id)
    .filter((id): id is string => typeof id === 'string')
    .map(normaliserIdentifiant)
}

/** Les identifiants Notion circulent avec ou sans tirets selon les surfaces. */
export function normaliserIdentifiant(identifiant: string): string {
  return identifiant.replaceAll('-', '').toLowerCase()
}
