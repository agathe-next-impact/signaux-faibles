import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { interpréterLivraison } from '@/lib/notion/webhook'

/**
 * Le webhook Notion.
 *
 * Il vérifie, invalide les tags concernés et répond. Il ne relit jamais Notion
 * et n'envoie jamais d'email : c'est la seule façon de tenir la fenêtre de
 * réponse et de ne pas transformer une rafale d'éditions en rafale de requêtes
 * vers une API limitée à trois par seconde.
 *
 * Cette route lit `process.env` directement au lieu de passer par `lib/env.ts`.
 * C'est délibéré : la poignée de main d'abonnement arrive **avant** que
 * `NOTION_WEBHOOK_SECRET` n'existe, puisqu'elle est ce qui le fournit. Une
 * validation stricte de tout l'environnement rendrait l'abonnement impossible.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  // Le corps doit être lu tel qu'il est arrivé : toute reprise en JSON change
  // les octets et invalide la signature.
  const brut = await requête.text()

  const décision = await interpréterLivraison({
    brut,
    signature: requête.headers.get('x-notion-signature'),
    secret: process.env['NOTION_WEBHOOK_SECRET'],
  })

  switch (décision.sorte) {
    case 'poignée-de-main':
      // Notion n'envoie ce jeton qu'ici, une fois, et ne l'affiche nulle part :
      // le journaliser est le seul moyen de le récupérer pour le coller dans
      // l'interface puis dans NOTION_WEBHOOK_SECRET. Traiter cette ligne de
      // journal comme un secret, et la purger une fois l'abonnement vérifié.
      console.warn(
        '[webhook notion] poignée de main reçue. Jeton de vérification à ' +
          'coller dans « Verify subscription » puis dans NOTION_WEBHOOK_SECRET : ' +
          décision.jetonDeVérification,
      )
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'refusée':
      console.warn(`[webhook notion] livraison refusée : ${décision.raison}`)
      return new NextResponse(null, { status: 401 })

    case 'invalider':
      // Le profil `max` marque la donnée comme périmée et laisse la
      // régénération se faire en arrière-plan : la requête suivante est servie
      // immédiatement, avec l'ancienne version, plutôt que de bloquer.
      for (const tag of décision.tags) revalidateTag(tag, 'max')
      return NextResponse.json({ reçu: true }, { status: 200 })

    case 'sans-effet':
      return NextResponse.json({ reçu: true }, { status: 200 })
  }
}
