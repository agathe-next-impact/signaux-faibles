import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { vérifierJeton } from '@/lib/auth/jeton'
import { NOM_DU_COOKIE } from '@/lib/auth/session'
import { lireAccèsParIdentifiant } from '@/lib/notion/acces'

/**
 * La seule URL où le jeton apparaît.
 *
 * Elle vérifie, pose le cookie et **redirige immédiatement** : le jeton ne
 * reste ni dans l'historique de navigation, ni dans un en-tête `Referer` — la
 * politique `same-origin` est posée dans next.config.ts.
 *
 * Aucune page n'est rendue ici. Un jeton invalide et un accès révoqué mènent au
 * même endroit, sans dire lequel des deux : la route ne doit pas devenir un
 * oracle sur les identifiants valides.
 */
export async function GET(
  requête: NextRequest,
  contexte: { params: Promise<{ jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await contexte.params
  const versLeFormulaire = NextResponse.redirect(
    new URL('/recevoir-mon-lien?invalide=1', requête.url),
  )

  const identifiant = vérifierJeton(decodeURIComponent(jeton), env().ACCES_SECRET_HMAC)
  if (!identifiant) return versLeFormulaire

  const accès = await lireAccèsParIdentifiant(identifiant)
  if (!accès || !accès.actif || accès.slug.length === 0) return versLeFormulaire

  const réponse = NextResponse.redirect(new URL(`/${accès.slug}`, requête.url))
  réponse.cookies.set(NOM_DU_COOKIE, decodeURIComponent(jeton), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return réponse
}
