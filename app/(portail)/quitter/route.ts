import { NextResponse, type NextRequest } from 'next/server'
import { NOM_DU_COOKIE } from '@/lib/auth/session'

/**
 * Quitter le portail sur cet appareil.
 *
 * Cette route existe parce que le portail fonctionne hors ligne : les éditions
 * déjà ouvertes restent sur l'appareil. Sur un poste partagé, il faut donc un
 * geste pour les retirer. Le cookie est effacé ici, et la page appelante
 * demande au service worker de purger son cache avant de partir.
 *
 * En POST seulement : effacer une session est une action, pas une lecture. Une
 * route en GET se déclencherait sur une simple image distante pointée vers elle.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const réponse = NextResponse.redirect(new URL('/recevoir-mon-lien?quitte=1', requête.url), 303)
  réponse.cookies.set(NOM_DU_COOKIE, '', { path: '/', maxAge: 0 })
  return réponse
}
