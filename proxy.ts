import { NextResponse, type NextRequest } from 'next/server'
import { vérifierJeton } from '@/lib/auth/jeton'
import { NOM_DU_COOKIE } from '@/lib/auth/session'

/**
 * Remplaçant de `middleware.ts` depuis Next.js 16. Runtime Node uniquement.
 *
 * Le proxy ne fait qu'une chose : écarter les requêtes qui n'ont pas de jeton
 * valide, avant qu'elles n'atteignent une page. Il ne lit pas Notion — le
 * contrôle d'appartenance, lui, a besoin d'une lecture cachée et vit dans le
 * layout (`lib/auth/appartenance.ts`), toujours avant le moindre appel de
 * contenu. Deux barrières successives, pas une seule répartie.
 */
const PUBLICS = [
  '/recevoir-mon-lien',
  '/acces/',
  '/api/webhooks/',
  '/_next/',
  '/favicon.ico',
]

export function proxy(requête: NextRequest): NextResponse {
  const { pathname } = requête.nextUrl

  if (pathname === '/' || PUBLICS.some((public_) => pathname.startsWith(public_))) {
    return NextResponse.next()
  }

  const secret = process.env['ACCES_SECRET_HMAC']
  const jeton = requête.cookies.get(NOM_DU_COOKIE)?.value

  if (!secret || !jeton || !vérifierJeton(jeton, secret)) {
    const destination = new URL('/recevoir-mon-lien', requête.url)
    return NextResponse.redirect(destination)
  }

  return NextResponse.next()
}

export const config = {
  // Tout sauf les fichiers statiques : la protection est le défaut, l'exception
  // est déclarée dans PUBLICS ci-dessus.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
