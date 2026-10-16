import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { vérifierJeton } from '@/lib/auth/jeton'
import { attributsDuCookie, NOM_DU_COOKIE } from '@/lib/auth/session'
import { lireAccèsParIdentifiant } from '@/lib/auth/source-acces'

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
  if (!accès || !accès.actif) return versLeFormulaire

  // L'opérateur global (palier 1) n'a pas d'espace à lui : il choisit. Tout
  // autre accès sans slug reste refusé, comme avant.
  const destination = accès.slug.length > 0 ? `/${accès.slug}` : accès.tousLesEspaces ? '/espaces' : null
  if (!destination) return versLeFormulaire

  const réponse = NextResponse.redirect(new URL(destination, requête.url))
  réponse.cookies.set(NOM_DU_COOKIE, decodeURIComponent(jeton), attributsDuCookie())

  return réponse
}
