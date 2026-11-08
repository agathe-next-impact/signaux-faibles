import type { BlocNotion } from '@/lib/domaine/document'
import * as payload from '@/lib/documents/payload'
import { sourceDocuments } from '@/lib/documents/source'
import { estLaDémonstration, estUnePageDeDémonstration } from '@/lib/domaine/demonstration'
import { blocsDeDémonstration, éditionsDeDémonstration } from '@/lib/vitrine/espace-demonstration'
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
 *
 * Une troisième source, sans aiguillage : **la démonstration** (7 novembre
 * 2026). Quand la clé de cloisonnement est celle de l'organisation fictive
 * (`estLaDémonstration`), les lettres viennent du code (`lib/vitrine/`), sans
 * cache ni base ; aucune clé de client ne peut la valoir, et aucune page de
 * client ne porte son préfixe.
 */
export async function listerÉditionsPubliées(organisationId: string): Promise<notion.Édition[]> {
  if (estLaDémonstration(organisationId)) return éditionsDeDémonstration(organisationId)
  return sourceDocuments() === 'payload'
    ? payload.listerÉditionsPubliées(organisationId)
    : notion.listerÉditionsPubliées(organisationId)
}

export async function lireBlocsDePage(pageId: string): Promise<BlocNotion[]> {
  if (estUnePageDeDémonstration(pageId)) return blocsDeDémonstration(pageId)
  return sourceDocuments() === 'payload' ? payload.lireBlocsDePage(pageId) : notion.lireBlocsDePage(pageId)
}

/**
 * Les éditions non publiées, pour l'aperçu de l'opératrice (1er novembre 2026) :
 * Brouillon et Relu dans Notion, « à publier » dans Payload. Seul appelant,
 * `lib/portail/semaine.ts`, derrière le privilège opérateur.
 */
export async function listerÉditionsÀPrévisualiser(organisationId: string): Promise<notion.Édition[]> {
  if (estLaDémonstration(organisationId)) return []
  return sourceDocuments() === 'payload'
    ? payload.listerÉditionsÀPrévisualiser(organisationId)
    : notion.listerÉditionsÀPrévisualiser(organisationId)
}

/**
 * Les blocs d'une édition, publiée ou en aperçu. Dans Notion, la lecture des
 * blocs ne filtre pas le statut ; dans Payload, une édition « à publier » a son
 * propre lecteur, qui refuse une publiée comme l'autre refuse un brouillon.
 */
export async function lireBlocsDeLÉdition(édition: Pick<notion.Édition, 'pageId' | 'aperçu'>): Promise<BlocNotion[]> {
  if (édition.aperçu && sourceDocuments() === 'payload') return payload.lireBlocsDeLAperçu(édition.pageId)
  return lireBlocsDePage(édition.pageId)
}

/**
 * Aucune image Notion en mode Payload : une lettre Payload n'en porte pas
 * (`docs/emails/README.md`, une image Notion n'entre jamais dans un courriel,
 * et le Markdown n'en produit pas). Le proxy des médias ne sert alors rien.
 */
export async function lireMédiaDeBloc(blocId: string, pageId: string): Promise<notion.MédiaDeBloc | null> {
  if (estUnePageDeDémonstration(pageId)) return null
  return sourceDocuments() === 'payload' ? null : notion.lireMédiaDeBloc(blocId, pageId)
}
