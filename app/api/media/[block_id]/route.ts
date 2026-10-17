import { NextResponse, type NextRequest } from 'next/server'
import { identifiantDeLaSession } from '@/lib/auth/session'
import { lireAccèsParIdentifiant } from '@/lib/auth/source-acces'
import { lireMédiaDeBloc, listerÉditionsPubliées } from '@/lib/notion/editions'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { lectureDeLEspace } from '@/lib/portail/lecture'

/**
 * Le proxy des médias.
 *
 * Il existe parce que les URL de fichiers Notion expirent en une heure : aucune
 * ne doit être écrite dans le HTML. Mais un proxy naïf serait pire que le mal —
 * il donnerait à quiconque connaît un identifiant de bloc l'image d'un autre
 * client. Chaque requête est donc cloisonnée comme une page.
 *
 * **L'autorisation précède toute lecture Notion** (14 octobre 2026). L'adresse
 * porte la page qui est censée contenir le bloc (`?page=<page_id>`), écrite par
 * le rendu du document ; la route vérifie d'abord que cette page figure dans
 * les éditions publiées de l'organisation du demandeur — une liste déjà en
 * cache — et seulement ensuite résout le bloc, dont la page parente doit être
 * celle annoncée. Avant, le bloc était lu dans Notion avant le contrôle, ce qui
 * laissait un lecteur authentifié faire interroger n'importe quel identifiant
 * de bloc, et en garder la résolution cinquante minutes en cache.
 *
 * Toutes les causes de refus rendent le même 404 : l'existence d'un bloc n'est
 * pas une information à donner.
 */
const INTROUVABLE = new NextResponse(null, { status: 404 })

const IDENTIFIANT_NOTION = /^[0-9a-f]{32}$/

export async function GET(
  requête: NextRequest,
  contexte: { params: Promise<{ block_id: string }> },
): Promise<NextResponse> {
  const { block_id: blocId } = await contexte.params
  const pageAnnoncée = normaliserIdentifiant(requête.nextUrl.searchParams.get('page') ?? '')
  if (!IDENTIFIANT_NOTION.test(pageAnnoncée)) return INTROUVABLE

  const identifiant = await identifiantDeLaSession()
  if (!identifiant) return INTROUVABLE

  const accès = await lireAccèsParIdentifiant(identifiant)
  if (!accès || !accès.actif) return INTROUVABLE
  // Sans clé de cloisonnement (l'opérateur global), aucune édition n'est à lui.
  if (accès.organisationId.length === 0) return INTROUVABLE

  // Fin d'essai (palier 1c) : la lettre tronquée ne porte aucune image ; le
  // proxy n'en sert donc qu'en lecture complète. Postgres seulement, avant
  // toute lecture Notion.
  if ((await lectureDeLEspace({ organisationId: accès.organisationId, enOpérateur: false })).lecture !== 'complète') {
    return INTROUVABLE
  }

  const éditions = await listerÉditionsPubliées(accès.organisationId)
  const autorisé = éditions.some(
    (édition) => normaliserIdentifiant(édition.pageId) === pageAnnoncée,
  )
  if (!autorisé) return INTROUVABLE

  const média = await lireMédiaDeBloc(blocId, pageAnnoncée)
  if (!média) return INTROUVABLE
  if (normaliserIdentifiant(média.pageParenteId) !== pageAnnoncée) return INTROUVABLE

  const amont = await fetch(média.url)
  if (!amont.ok || !amont.body) return INTROUVABLE

  return new NextResponse(amont.body, {
    status: 200,
    headers: {
      'content-type': amont.headers.get('content-type') ?? 'application/octet-stream',
      // Le cache est privé : une image d'un client ne doit jamais être servie
      // depuis un cache partagé à un autre.
      'cache-control': 'private, max-age=600',
      'content-disposition': 'inline',
    },
  })
}
