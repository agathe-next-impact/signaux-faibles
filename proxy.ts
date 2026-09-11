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
/**
 * Chemins que le proxy ne garde pas.
 *
 * `/api/` en fait partie, et ce n'est pas un trou : chaque route d'API porte
 * son propre contrôle, plus strict que celui du proxy — le proxy vérifie une
 * signature, le proxy des médias vérifie en plus que le bloc demandé appartient
 * bien aux éditions du client. Rediriger une requête d'API vers une page HTML
 * lui répondrait 200 avec un formulaire, là où un 404 est la bonne réponse.
 */
const PUBLICS = [
  '/recevoir-mon-lien',
  '/acces/',
  '/api/',
  '/_next/',
  '/favicon.ico',
  // Ressources de l'application installable. La page hors ligne en fait
  // partie : le service worker doit pouvoir la mettre en cache à
  // l'installation, avant même qu'une session existe.
  '/hors-ligne',
  '/manifest.webmanifest',
  '/sw.js',
  '/icone-',
  '/icon.svg',
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
    // 303 pour tout ce qui n'est pas une lecture. Le défaut de
    // `NextResponse.redirect` est 307, qui **conserve la méthode** : un POST
    // écarté ici était rejoué en POST sur le formulaire, qui répondait 405.
    // C'est arrivé en production le 11 septembre 2026 sur « quitter », et cela
    // se produirait à chaque action serveur postée depuis un onglet dont la
    // session a expiré — cas fréquent, l'application installée restant ouverte
    // des semaines. Le 303 retombe en GET : la personne voit le formulaire.
    return NextResponse.redirect(destination, requête.method === 'GET' ? 307 : 303)
  }

  return NextResponse.next()
}

export const config = {
  // Tout sauf les fichiers statiques : la protection est le défaut, l'exception
  // est déclarée dans PUBLICS ci-dessus.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
