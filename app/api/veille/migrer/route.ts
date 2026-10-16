import { NextResponse, type NextRequest } from 'next/server'
import { appliquerLesMigrations } from '@/lib/base/migrer'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Crée ou met à jour les tables de la base du portail.
 *
 *   POST /api/veille/migrer
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 * Le portail est le seul à tenir `DATABASE_URL` : c'est lui qui applique les
 * migrations, plutôt qu'un poste où il faudrait recopier l'adresse de la base.
 * Idempotente : relancée, elle n'applique que ce qui manque. Elle ne supprime
 * rien qu'une migration commitée et relue n'ait dit en clair.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'migrer')
  if (refus) return refus

  try {
    await appliquerLesMigrations()
    return NextResponse.json({ état: 'à jour' })
  } catch (erreur) {
    // L'erreur sort de lib/base sans donnée : seulement le code SQLSTATE.
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`[veille/migrer] ${message}`)
    return NextResponse.json({ état: 'échec', message }, { status: 500 })
  }
}
