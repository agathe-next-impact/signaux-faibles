import { NextResponse, type NextRequest } from 'next/server'
import { interpréterLivraisonLemlist } from '@/lib/lemlist/webhook'
import { traiterÉvénementLemlist } from '@/lib/portail/prospection'

/**
 * Le webhook lemlist (19 octobre 2026) : ce que lemlist dit au portail.
 *
 * Il vérifie le secret, écrit l'événement au journal de prospection, applique
 * son effet sur le statut et répond. Il n'appelle jamais lemlist en retour, ne
 * touche à aucun cache Notion et n'envoie aucun courrier.
 *
 * Les codes de réponse disent à lemlist s'il doit réessayer :
 *   · 401 pour une livraison refusée (secret absent ou faux) ;
 *   · 500 sur une panne de la base, pour que lemlist relivre ;
 *   · 200 pour tout le reste, y compris un événement inconnu, un lead que rien
 *     ne rattache à un lecteur, ou un doublon : relivrer n'y changerait rien.
 *
 * `LEMLIST_WEBHOOK_SECRET` est lu directement dans `process.env`, comme les
 * secrets des webhooks Notion et Stripe : une page du portail n'a pas à tomber
 * parce que le webhook n'est pas encore créé chez lemlist.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const corps: unknown = await requête.json().catch(() => null)
  const décision = interpréterLivraisonLemlist({ corps, secret: process.env['LEMLIST_WEBHOOK_SECRET'] })

  switch (décision.sorte) {
    case 'refusée':
      console.warn(`[webhook lemlist] livraison refusée : ${décision.raison}`)
      return NextResponse.json({ reçu: false }, { status: 401 })

    case 'sans-effet':
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'inexploitable':
      console.warn(`[webhook lemlist] ${décision.type} inexploitable : ${décision.raison}`)
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'événement':
      try {
        const issue = await traiterÉvénementLemlist(décision.événement)
        if (issue.sorte === 'enregistré' && !issue.rattaché) {
          console.warn(`[webhook lemlist] ${décision.événement.type} ${décision.événement.activité} : aucun lecteur ne porte cette adresse.`)
        } else {
          console.info(`[webhook lemlist] ${décision.événement.type} ${décision.événement.activité} : ${issue.sorte}`)
        }
        return NextResponse.json({ reçu: true, résultat: issue.sorte }, { status: 200 })
      } catch (erreur) {
        // Une contrainte violée est déterministe : relivrer n'y changerait rien.
        if ((erreur as { code?: unknown }).code === '23514') {
          console.warn(`[webhook lemlist] ${décision.événement.type} rejeté par une contrainte de la base (SQLSTATE 23514).`)
          return NextResponse.json({ reçu: true, résultat: 'rejeté' }, { status: 200 })
        }
        console.error(`[webhook lemlist] écriture en échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
        return NextResponse.json({ reçu: false }, { status: 500 })
      }
  }
}
