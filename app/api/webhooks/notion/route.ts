import { verifyWebhookSignature } from '@notionhq/client'
import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { tagsÀInvalider, type ChargeWebhook } from '@/lib/notion/webhook'

/**
 * Le webhook Notion.
 *
 * Il vérifie la signature, invalide les tags concernés et répond. Il ne relit
 * jamais Notion et n'envoie jamais d'email : c'est la seule façon de tenir la
 * fenêtre de réponse et de ne pas transformer une rafale d'éditions en rafale
 * de requêtes vers une API limitée à trois par seconde.
 *
 * `revalidateTag` avec le profil `max` marque la donnée comme périmée et laisse
 * la régénération se faire en arrière-plan : la requête suivante est servie
 * immédiatement, avec l'ancienne version, plutôt que de bloquer.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  // Le corps doit être lu tel qu'il est arrivé : toute reprise en JSON change
  // les octets et invalide la signature.
  const brut = await requête.text()

  const authentique = await verifyWebhookSignature({
    body: brut,
    signature: requête.headers.get('x-notion-signature'),
    verificationToken: env().NOTION_WEBHOOK_SECRET,
  })

  if (!authentique) return new NextResponse(null, { status: 401 })

  let charge: ChargeWebhook
  try {
    charge = JSON.parse(brut) as ChargeWebhook
  } catch {
    // Signature valide mais corps illisible : Notion n'a pas à réessayer.
    return NextResponse.json({ reçu: true }, { status: 200 })
  }

  // Poignée de main d'abonnement. Le jeton n'est pas journalisé : il se copie
  // depuis la page de l'intégration dans Notion, vers NOTION_WEBHOOK_SECRET.
  if (charge.verification_token) {
    console.info(
      "Notion a envoyé la poignée de main du webhook. Copier le jeton de " +
        "vérification depuis la page de l'intégration vers NOTION_WEBHOOK_SECRET.",
    )
    return NextResponse.json({ reçu: true }, { status: 200 })
  }

  for (const tag of tagsÀInvalider(charge)) revalidateTag(tag, 'max')

  return NextResponse.json({ reçu: true }, { status: 200 })
}
