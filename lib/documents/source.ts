/**
 * L'aiguillage de la source des documents.
 *
 * `notion` (défaut) : les écrans lisent Notion comme avant. `payload` : ils
 * lisent les éditions de Payload. La valeur est lue à chaque appel, dans
 * `process.env` directement, pour qu'une faute de frappe dans l'hébergeur
 * retombe sur Notion en le journalisant plutôt que de faire tomber une page.
 */
export type SourceDocuments = 'notion' | 'payload'

let avertie: string | null = null

export function sourceDocuments(): SourceDocuments {
  const valeur = process.env['SOURCE_DOCUMENTS']
  if (valeur === 'payload') return 'payload'
  if (valeur && valeur !== 'notion' && avertie !== valeur) {
    avertie = valeur
    console.warn(`[documents] SOURCE_DOCUMENTS=« ${valeur} » inconnue : retombée sur notion`)
  }
  return 'notion'
}
