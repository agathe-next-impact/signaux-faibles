import type { BlocNotion } from '@/lib/domaine/document'
import * as payload from '@/lib/documents/payload'
import { sourceDocuments } from '@/lib/documents/source'
import * as notion from '@/lib/notion/editions'

export type { Édition, MédiaDeBloc } from '@/lib/notion/editions'

/**
 * La façade de lecture des documents.
 *
 * Les écrans et `lib/portail` importent d'ici, jamais de `lib/notion/editions`
 * ni de `lib/documents/payload` : `SOURCE_DOCUMENTS` est le seul aiguillage.
 * Les deux sources ont exactement les mêmes signatures et le même type
 * `Édition` ; les fonctions cachées restent dans chaque source, la façade n'y
 * ajoute aucune lecture. Les routes `/api/veille/*` et `lib/notion/travail.ts`,
 * elles, restent sur Notion : elles servent le dispositif, pas un écran.
 */
export async function listerÉditionsPubliées(organisationId: string): Promise<notion.Édition[]> {
  return sourceDocuments() === 'payload'
    ? payload.listerÉditionsPubliées(organisationId)
    : notion.listerÉditionsPubliées(organisationId)
}

export async function lireBlocsDePage(pageId: string): Promise<BlocNotion[]> {
  return sourceDocuments() === 'payload' ? payload.lireBlocsDePage(pageId) : notion.lireBlocsDePage(pageId)
}

/**
 * Aucune image Notion en mode Payload : une lettre Payload n'en porte pas
 * (`docs/emails/README.md`, une image Notion n'entre jamais dans un courriel,
 * et le Markdown n'en produit pas). Le proxy des médias ne sert alors rien.
 */
export async function lireMédiaDeBloc(blocId: string, pageId: string): Promise<notion.MédiaDeBloc | null> {
  return sourceDocuments() === 'payload' ? null : notion.lireMédiaDeBloc(blocId, pageId)
}
