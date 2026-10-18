import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import { ouvrirEnEssai, type RésultatDOuverture } from '@/lib/base/organisations'
import { identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Ouvre une nouvelle organisation en essai (18 octobre 2026).
 *
 *   POST /api/veille/organisations
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "acme", "nom": "Acme", "registreNotion": "<page_id de la ligne du registre>" }
 *
 * Appelée par l'onboarding Cowork (étape B), **avant** `POST
 * /api/veille/importer-acces` puis `POST /api/acces/ouvrir`. Sans elle,
 * l'import crée l'organisation à l'état `abonnee`, en accès complet et sans
 * fin d'essai.
 *
 * Elle n'écrit que la ligne `organisations` : les lecteurs restent tenus par
 * l'import (en `double`) ou par `/api/veille/lecteurs` (après la bascule).
 * J0 n'est pas posé ici : le passage quotidien du parcours le fixe à la date
 * de la première lettre publiée.
 *
 * Un client historique n'est jamais rétrogradé (`état-incompatible`, 409).
 * Rejouable : un second appel rend `déjà-en-essai`.
 */
const demande = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nom: z.string().trim().min(1).max(200),
  registreNotion: z.string().trim().refine(identifiantNotionValide),
})

const STATUT: Record<RésultatDOuverture['sorte'], number> = {
  créée: 201,
  'passée-en-essai': 200,
  'déjà-en-essai': 200,
  'état-incompatible': 409,
  'registre-pris': 409,
  'registre-différent': 409,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'organisations')
  if (refus) return refus

  if (!baseConfigurée()) {
    return NextResponse.json({ état: 'non-configurée', raison: 'DATABASE_URL absente' }, { status: 503 })
  }
  // `notion` est l'interrupteur de retour en arrière : il n'ouvre jamais Postgres.
  if (sourceAccès() === 'notion') {
    return NextResponse.json({ état: 'refusé', raison: 'SOURCE_ACCES vaut notion' }, { status: 409 })
  }

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })

  const { slug, nom, registreNotion } = lue.data
  try {
    const résultat = await ouvrirEnEssai({ slug, nom, registreNotion })
    console.info(`[veille/organisations] ${slug} : ${résultat.sorte}.`)
    return NextResponse.json({ état: résultat.sorte, ...détail(résultat) }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    console.error(`[veille/organisations] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}

function détail(résultat: RésultatDOuverture): Record<string, string> {
  switch (résultat.sorte) {
    case 'état-incompatible':
      return { étatActuel: résultat.état }
    case 'registre-pris':
      return { slugExistant: résultat.slug }
    case 'registre-différent':
      return { registreActuel: résultat.registreActuel }
    default:
      return {}
  }
}
