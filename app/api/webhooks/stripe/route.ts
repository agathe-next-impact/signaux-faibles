import { after, NextResponse, type NextRequest } from 'next/server'
import { enregistrerÉvénementDAbonnement } from '@/lib/base/abonnements'
import { préparerLeCourrierDuChangement } from '@/lib/portail/courriers-abonnement'
import { interpréterLivraisonStripe } from '@/lib/stripe/webhook'

/**
 * Le webhook Stripe (palier 1c) : le seul écrivain de la table `abonnements`.
 *
 * Il vérifie la signature, recopie l'état de l'abonnement et répond. Il ne
 * touche à aucun cache Notion : ce qu'il change, c'est l'étape du parcours, qui
 * est recalculée à la lecture suivante. Il n'envoie aucun courrier : depuis le
 * 23 octobre 2026, un changement d'état appliqué (abonnement actif, paiement
 * refusé, résiliation) prépare un **brouillon** Gmail par lecteur, dans
 * `after()`, une fois la réponse partie ; l'opératrice le relit et l'envoie.
 *
 * Les codes de réponse disent à Stripe s'il doit relivrer, et c'est leur seul
 * rôle :
 *   · 400 pour une livraison refusée (signature) : Stripe la relivre, ce qui
 *     laisse le temps de corriger un secret mal posé ;
 *   · 500 sur une panne de la base, ou sur un événement de l'autre mode (un
 *     `STRIPE_MODE` oublié en production) : Stripe relivre pendant trois jours
 *     et signale l'échec, et l'écriture idempotente absorbe le doublon ;
 *   · 200 pour tout le reste, y compris une organisation inconnue, une
 *     métadonnée absente ou une contrainte violée : relivrer n'y changerait rien, et le journal le dit.
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
    modeRéel: process.env['STRIPE_MODE'] === 'reel',
  })

  switch (décision.sorte) {
    case 'refusée':
      console.warn(`[webhook stripe] livraison refusée : ${décision.raison}`)
      return NextResponse.json({ reçu: false }, { status: 400 })

    case 'sans-effet':
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'autre-mode':
      console.error(`[webhook stripe] ${décision.type} non appliqué : ${décision.raison}. Vérifier STRIPE_MODE.`)
      return NextResponse.json({ reçu: false }, { status: 500 })

    case 'inexploitable':
      console.warn(`[webhook stripe] ${décision.type} inexploitable : ${décision.raison}`)
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'abonnement':
      try {
        const résultat = await enregistrerÉvénementDAbonnement(décision.événement)
        const journal = `[webhook stripe] ${décision.type} ${décision.événement.abonnementStripe} → ${décision.événement.état} : ${résultat.sorte}`
        if (résultat.sorte === 'organisation-inconnue' || résultat.sorte === 'autre-organisation') console.warn(journal)
        else console.info(journal)
        if (résultat.sorte === 'appliqué' && process.env['PORTAIL_URL']) {
          const { événement } = décision
          const portailUrl = process.env['PORTAIL_URL']
          after(() =>
            préparerLeCourrierDuChangement({ ...événement, étatPrécédent: résultat.étatPrécédent, portailUrl }).then(
              () => undefined,
              (erreur: unknown) => {
                console.error(`[webhook stripe] brouillon non préparé : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
              },
            ),
          )
        }
        return NextResponse.json({ reçu: true, résultat: résultat.sorte }, { status: 200 })
      } catch (erreur) {
        // Une contrainte violée (23514 : identifiant Stripe mal formé) est une
        // erreur déterministe : relivrer pendant trois jours n'y changerait rien.
        if ((erreur as { code?: unknown }).code === '23514') {
          console.warn(`[webhook stripe] ${décision.type} rejeté par une contrainte de la base (SQLSTATE 23514).`)
          return NextResponse.json({ reçu: true, résultat: 'rejeté' }, { status: 200 })
        }
        console.error(`[webhook stripe] écriture en échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
        return NextResponse.json({ reçu: false }, { status: 500 })
      }
  }
}
