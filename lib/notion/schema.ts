/**
 * Le contrat des bases Notion.
 *
 * Les bases Notion *sont* le contrat : aucun fichier n'est partagé entre le
 * portail et les tâches Cowork. Ce module est donc le seul endroit du dépôt qui
 * énonce ce que le portail attend, et il le confronte au schéma réel avant la
 * première lecture. Si une propriété manque ou a changé de type, le portail
 * refuse de servir plutôt que d'afficher une page mutilée.
 */

/** Types de propriétés de l'API Notion utilisés par le portail. */
export type TypeNotion =
  | 'title'
  | 'rich_text'
  | 'select'
  | 'relation'
  | 'date'
  | 'number'
  | 'checkbox'
  | 'email'

export type PropriétéAttendue = {
  readonly type: TypeNotion
  /** Options qui doivent exister, pour une propriété `select`. */
  readonly options?: readonly string[]
}

export type ContratDeBase = Readonly<Record<string, PropriétéAttendue>>

/**
 * « Éditions de veille ».
 *
 * `Organisation` est une relation vers le registre depuis le 9 septembre 2026.
 * L'API ne renvoie que des identifiants de page : le portail n'a pas accès au
 * registre et ne voit donc jamais le nom d'une organisation par Notion.
 */
export const CONTRAT_EDITIONS: ContratDeBase = {
  Titre: { type: 'title' },
  Organisation: { type: 'relation' },
  Veille: { type: 'select' },
  Famille: { type: 'select' },
  "Date d'édition": { type: 'date' },
  Numéro: { type: 'number' },
  Statut: { type: 'select', options: ['Envoyé'] },
  'Période couverte': { type: 'rich_text' },
  'Fenêtre élargie': { type: 'checkbox' },
  'Dossiers ouverts suivis': { type: 'rich_text' },
  'Action de la semaine': { type: 'rich_text' },
  'Amendements au référentiel': { type: 'rich_text' },
  Livraison: { type: 'rich_text' },
}

/** « Accès — portail ». */
export const CONTRAT_ACCES: ContratDeBase = {
  Nom: { type: 'title' },
  Email: { type: 'email' },
  'Organisation (libellé)': { type: 'rich_text' },
  "Identifiant Notion de l'organisation": { type: 'rich_text' },
  Slug: { type: 'rich_text' },
  "Identifiant d'accès": { type: 'rich_text' },
  Actif: { type: 'checkbox' },
}

/** Propriétés internes, jamais exposées au navigateur d'un client. */
export const PROPRIETES_INTERNES = [
  'Famille',
  'Amendements au référentiel',
  'Livraison',
] as const

/** Forme minimale d'un schéma renvoyé par l'API, suffisante pour la garde. */
export type SchémaRéel = Record<
  string,
  { type: string; select?: { options?: Array<{ name: string }> } | null }
>

export type ÉcartDeSchéma = {
  readonly propriété: string
  readonly raison: string
}

/**
 * Compare un schéma réel au contrat attendu. Ne signale que ce qui manque ou
 * ne correspond pas : une propriété *supplémentaire* dans Notion n'est pas un
 * écart, les tâches Cowork étant libres d'en ajouter pour leur propre usage.
 */
export function écartsDeSchéma(
  contrat: ContratDeBase,
  réel: SchémaRéel,
): ÉcartDeSchéma[] {
  const écarts: ÉcartDeSchéma[] = []

  for (const [nom, attendue] of Object.entries(contrat)) {
    const propriété = réel[nom]

    if (!propriété) {
      écarts.push({ propriété: nom, raison: 'absente de la base' })
      continue
    }

    if (propriété.type !== attendue.type) {
      écarts.push({
        propriété: nom,
        raison: `type « ${propriété.type} », attendu « ${attendue.type} »`,
      })
      continue
    }

    if (attendue.options) {
      const présentes = new Set(
        (propriété.select?.options ?? []).map((option) => option.name),
      )
      const absentes = attendue.options.filter((option) => !présentes.has(option))
      if (absentes.length > 0) {
        écarts.push({
          propriété: nom,
          raison: `option(s) manquante(s) : ${absentes.join(', ')}`,
        })
      }
    }
  }

  return écarts
}

/** Lève une erreur nommant précisément ce qui a changé dans Notion. */
export function vérifierSchéma(
  nomDeLaBase: string,
  contrat: ContratDeBase,
  réel: SchémaRéel,
): void {
  const écarts = écartsDeSchéma(contrat, réel)
  if (écarts.length === 0) return

  const détail = écarts
    .map((écart) => `  « ${écart.propriété} » : ${écart.raison}`)
    .join('\n')

  throw new Error(
    `Le schéma de la base Notion « ${nomDeLaBase} » ne correspond plus à ce que ` +
      `le portail attend :\n${détail}\n` +
      'Le portail refuse de servir plutôt que d\'afficher des éditions mutilées. ' +
      'Corriger la base dans Notion, ou mettre à jour lib/notion/schema.ts si le ' +
      'changement est voulu.',
  )
}
