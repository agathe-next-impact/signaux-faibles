import { NextResponse, type NextRequest } from 'next/server'
import { baseConfigurée } from '@/lib/base/client'
import { prospectionsRécentes } from '@/lib/base/prospection'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * L'état de la prospection, pour la tâche de prospection (19 octobre 2026).
 *
 *   GET /api/veille/prospection?jours=30
 *   Authorization: Bearer <ACTIVATION_SECRET ou CRON_SECRET>
 *
 * Une ligne par lead lemlist modifié depuis la fenêtre demandée : espace,
 * empreinte de l'adresse, identifiants lemlist, statut et sa date, séquence
 * arrêtée ou non, dernier statut écrit chez lemlist et code du dernier échec,
 * et le compte des événements reçus par type (`emailsOpened: 2`…). C'est de ces
 * comptes que la tâche tire le score d'un prospect ; le portail ne le calcule
 * pas, pour que la grille reste dans la tâche, où elle se règle sans déploiement.
 *
 * Un statut `desinscrit` est à lire **avant** de recontacter une adresse : il
 * est final.
 *
 * Aucune adresse : l'empreinte suffit à rapprocher une ligne d'un contact
 * lemlist, dont la tâche a l'adresse par le connecteur.
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'prospection')
  if (refus) return refus

  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const jours = Math.min(Math.max(Number(requête.nextUrl.searchParams.get('jours')) || 30, 1), 365)
  try {
    const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000)
    const lignes = await prospectionsRécentes(depuis)
    return NextResponse.json({ état: 'lu', jours, nombre: lignes.length, prospections: lignes })
  } catch (erreur) {
    console.error(`[veille/prospection] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
