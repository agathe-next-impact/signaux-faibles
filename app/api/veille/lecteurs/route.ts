import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { sourceAccès } from '@/lib/auth/source-acces'
import { changerActivation, créerLecteur, type RésultatÉcriture } from '@/lib/base/ecriture-lecteurs'
import { empreinte } from '@/lib/portail/debit'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Créer, révoquer ou réactiver un lecteur, dans Postgres.
 *
 *   POST /api/veille/lecteurs
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "action": "creer", "slug": "hermitage", "nom": "Claire", "email": "…" }
 *   { "action": "revoquer" | "reactiver", "slug": "hermitage", "email": "…" }
 *
 * Préalable à la bascule `SOURCE_ACCES=postgres` (palier 1a-bis) : c'est par
 * cette route, et non plus par la base Notion « Accès », que la tâche Cowork
 * tiendra les lecteurs. Elle **refuse** (409) tant que la source n'est pas
 * `postgres` : en `notion` ou en `double`, c'est Notion qui fait foi, et un
 * lecteur créé ici seulement ne pourrait pas entrer, tandis qu'une révocation
 * faite ici seulement ne fermerait rien.
 *
 * L'identifiant d'accès est tiré par le portail et ne sort jamais ; le lien
 * part ensuite par `POST /api/acces/ouvrir`, comme aujourd'hui. Les journaux ne
 * portent que l'empreinte de l'adresse.
 */
const demande = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('creer'),
    slug: z.string().trim().min(1),
    nom: z.string().trim().min(1),
    email: z.email(),
  }),
  z.object({
    action: z.enum(['revoquer', 'reactiver']),
    slug: z.string().trim().min(1),
    email: z.email(),
  }),
])

const STATUT: Record<RésultatÉcriture['sorte'], number> = {
  créé: 201,
  révoqué: 200,
  réactivé: 200,
  inchangé: 200,
  'organisation-inconnue': 404,
  'lecteur-inconnu': 404,
  'déjà-inscrit': 409,
  'plafond-atteint': 409,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'lecteurs')
  if (refus) return refus

  const source = sourceAccès()
  if (source !== 'postgres') {
    return NextResponse.json(
      {
        état: 'refusé',
        raison: `SOURCE_ACCES vaut ${source} : la base Notion « Accès » fait foi, écrire le lecteur là.`,
      },
      { status: 409 },
    )
  }

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })

  const corps = lue.data
  try {
    const résultat =
      corps.action === 'creer'
        ? await créerLecteur({ slug: corps.slug, nom: corps.nom, email: corps.email })
        : await changerActivation({ slug: corps.slug, email: corps.email, actif: corps.action === 'reactiver' })

    console.info(`[veille/lecteurs] ${corps.action} ${corps.slug} · ${empreinte(corps.email)} : ${résultat.sorte}.`)
    return NextResponse.json({ état: résultat.sorte }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    // L'erreur sort de lib/base sans donnée : seulement le code SQLSTATE.
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`[veille/lecteurs] ${message}`)
    return NextResponse.json({ état: 'échec', message }, { status: 500 })
  }
}
