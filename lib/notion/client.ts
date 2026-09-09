import { Client } from '@notionhq/client'
import { env } from '@/lib/env'
import {
  CONTRAT_ACCES,
  CONTRAT_EDITIONS,
  vérifierSchéma,
  type SchémaRéel,
} from '@/lib/notion/schema'

let client: Client | undefined

/**
 * Le client Notion du portail. Un seul jeton, partagé sur les deux seules bases
 * que l'intégration voit : « Éditions de veille » et « Accès — portail ».
 */
export function notion(): Client {
  client ??= new Client({ auth: env().NOTION_TOKEN })
  return client
}

export type SourcesDeDonnées = {
  readonly éditions: string
  readonly accès: string
}

/**
 * Résout les identifiants de sources de données et vérifie les deux schémas.
 *
 * Depuis la version d'API 2025-09-03, une base est un conteneur : les requêtes
 * portent sur une *source de données*, pas sur la base. La résolution est une
 * lecture Notion, elle vit donc dans une fonction cachée (règle 1), avec le
 * profil long : ces identifiants ne changent pas.
 *
 * La garde de schéma est branchée ici parce que c'est le seul point que toute
 * lecture traverse. En serverless il n'y a pas de « démarrage » : le premier
 * appel après expiration du cache tient ce rôle.
 */
export async function sourcesDeDonnées(): Promise<SourcesDeDonnées> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('notion')
  cacheTag('schema:notion')

  const [éditions, accès] = await Promise.all([
    résoudreUneBase(env().NOTION_BASE_EDITIONS, 'Éditions de veille', CONTRAT_EDITIONS),
    résoudreUneBase(env().NOTION_BASE_ACCES, 'Accès — portail', CONTRAT_ACCES),
  ])

  return { éditions, accès }
}

async function résoudreUneBase(
  identifiantDeLaBase: string,
  nomLisible: string,
  contrat: Parameters<typeof vérifierSchéma>[1],
): Promise<string> {
  const base = await notion().databases.retrieve({ database_id: identifiantDeLaBase })

  const sources = (base as { data_sources?: Array<{ id: string }> }).data_sources ?? []
  const première = sources[0]

  if (!première) {
    throw new Error(
      `La base Notion « ${nomLisible} » (${identifiantDeLaBase}) n'expose aucune ` +
        'source de données. Vérifier que l\'intégration du portail y a bien accès.',
    )
  }

  if (sources.length > 1) {
    throw new Error(
      `La base Notion « ${nomLisible} » expose ${sources.length} sources de données. ` +
        'Le portail en attend une seule ; préciser laquelle avant de continuer.',
    )
  }

  const source = await notion().dataSources.retrieve({ data_source_id: première.id })
  const propriétés = (source as { properties?: SchémaRéel }).properties ?? {}
  vérifierSchéma(nomLisible, contrat, propriétés)

  return première.id
}
