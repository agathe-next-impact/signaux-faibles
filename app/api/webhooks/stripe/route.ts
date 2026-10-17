import { NextResponse, type NextRequest } from 'next/server'
import { enregistrerÉvénementDAbonnement } from '@/lib/base/abonnements'
import { interpréterLivraisonStripe } from '@/lib/stripe/webhook'

/**
 * Le webhook Stripe (palier 1c) : le seul écrivain de la table `abonnements`.
 *
 * Il vérifie la signature, recopie l'état de l'abonnement et répond. Il
 * n'envoie aucun courrier et ne touche à aucun cache Notion : ce qu'il change,
 * c'est l'étape du parcours, qui est recalculée à la lecture suivante.
 *
 * Les codes de réponse disent à Stripe s'il doit relivrer, et c'est leur seul
 * rôle :
 *   · 400 pour une livraison refusée (signature) : Stripe la relivre, ce qui
 *     laisse le temps de corriger un secret mal posé ;
 *   · 500 sur une panne de la base : Stripe relivre pendant trois jours, et
 *     l'écriture idempotente absorbe le doublon ;
 *   · 200 pour tout le reste, y compris une organisation inconnue ou une
 *     métadonnée absente : relivrer n'y changerait rien, et le journal le dit.
 *
 * `STRIPE_WEBHOOK_SECRET` est lu directement dans `process.env`, comme le secret
 * du webhook Notion : une page du portail n'a pas à tomber parce que le compte
 * Stripe n'est pas encore créé.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  // Le corps doit être lu tel qu'il est arrivé : la signature porte sur ces octets.
  const brut = await requête.text()

  const décision = interpréterLivraisonStripe({
    brut,
    signature: requête.headers.get('stripe-signature'),
    secret: process.env['STRIPE_WEBHOOK_SECRET'],
  })

  switch (décision.sorte) {
    case 'refusée':
      console.warn(`[webhook stripe] livraison refusée : ${décision.raison}`)
      return NextResponse.json({ reçu: false }, { status: 400 })

    case 'sans-effet':
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'inexploitable':
      console.warn(`[webhook stripe] ${décision.type} inexploitable : ${décision.raison}`)
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'abonnement':
      try {
        const résultat = await enregistrerÉvénementDAbonnement(décision.événement)
        const journal = `[webhook stripe] ${décision.type} ${décision.événement.abonnementStripe} → ${décision.événement.état} : ${résultat.sorte}`
        if (résultat.sorte === 'organisation-inconnue') console.warn(journal)
        else console.info(journal)
        return NextResponse.json({ reçu: true, résultat: résultat.sorte }, { status: 200 })
      } catch (erreur) {
        console.error(`[webhook stripe] écriture en échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
        return NextResponse.json({ reçu: false }, { status: 500 })
      }
  }
}
