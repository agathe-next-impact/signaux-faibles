import { NextResponse, type NextRequest } from 'next/server'
import { identifiantDeLaSession } from '@/lib/auth/session'
import { lireAccèsParIdentifiant } from '@/lib/notion/acces'
import { lireMédiaDeBloc, listerÉditionsPubliées } from '@/lib/notion/editions'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'

/**
 * Le proxy des médias.
 *
 * Il existe parce que les URL de fichiers Notion expirent en une heure : aucune
 * ne doit être écrite dans le HTML. Mais un proxy naïf serait pire que le mal —
 * il donnerait à quiconque connaît un identifiant de bloc l'image d'un autre
 * client. Chaque requête est donc cloisonnée comme une page : la page qui porte
 * le bloc doit figurer dans les éditions publiées de l'organisation du
 * demandeur.
 *
 * Toutes les causes de refus rendent le même 404 : l'existence d'un bloc n'est
 * pas une information à donner.
 */
const INTROUVABLE = new NextResponse(null, { status: 404 })

export async function GET(
  _requête: NextRequest,
  contexte: { params: Promise<{ block_id: string }> },
): Promise<NextResponse> {
  const { block_id: blocId } = await contexte.params

  const identifiant = await identifiantDeLaSession()
  if (!identifiant) return INTROUVABLE

  const accès = await lireAccèsParIdentifiant(identifiant)
  if (!accès || !accès.actif) return INTROUVABLE

  const média = await lireMédiaDeBloc(blocId)
  if (!média) return INTROUVABLE

  const éditions = await listerÉditionsPubliées(accès.organisationId)
  const parente = normaliserIdentifiant(média.pageParenteId)
  const autorisé = éditions.some(
    (édition) => normaliserIdentifiant(édition.pageId) === parente,
  )
  if (!autorisé) return INTROUVABLE

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
