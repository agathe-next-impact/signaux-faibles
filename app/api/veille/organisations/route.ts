import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import {
  ouvrirEnEssai,
  réglerLeParcours,
  type Réglage,
  type RésultatDOuverture,
  type RésultatDuRéglage,
} from '@/lib/base/organisations'
import { codeDePrescripteurValide } from '@/lib/domaine/prescripteurs'
import { identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { réglerLePilote } from '@/lib/portail/strategie'

/**
 * Ouvre une nouvelle organisation en essai (18 octobre 2026).
 *
 *   POST /api/veille/organisations
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "acme", "nom": "Acme", "registreNotion": "<page_id de la ligne du registre>", "origine": "demande" | "prospection", "prescripteur": "<code>" }
 *
 * `origine: "prospection"` (19 octobre 2026) : la lettre 1 part de lemlist
 * sans sollicitation, et l'essai n'ouvre qu'à la **première visite** du
 * lecteur ; `essai_ouvert_le` reste nul jusque-là, J0 n'est pas fixé, et les
 * lettres publiées avant la visite ne comptent pas dans l'essai.
 *
 * `prescripteur` (24 octobre 2026, `docs/prescripteurs.md`) : le code du
 * prescripteur qui a recommandé l'organisation, lu dans la demande de démo. Le
 * premier garde l'organisation, l'essai compte quatre parutions tant que J0
 * n'est pas posé, et l'organisation sort de la prospection. Exclusif de
 * `origine: "prospection"` (400) ; un code inconnu ou inactif rend
 * `prescripteur-inconnu` (404) ; une organisation déjà prospectée,
 * `déjà-prospectée` (409). Un prescripteur ou une organisation recommandée ne
 * passe jamais en prospection : `hors-prospection` (409).
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
 *
 *   PATCH /api/veille/organisations
 *   { "slug": "acme", "action": "prolonger", "semaines": 1 | 2 | 3 }
 *   { "slug": "acme", "action": "relecture", "requise": true | false }
 *   { "slug": "acme", "action": "offre", "offre": "standard" | "early_adopter" | "gratuite" }
 *   { "slug": "acme", "action": "parutions", "parutions": 3 }
 *   { "slug": "acme", "action": "parcours", "prochaineLettre": "2026-10-22", "restantes": 1 }
 *   { "slug": "acme", "action": "outils", "actif": true | false }
 *
 * `outils` (26 octobre 2026, `docs/plan-outils-strategiques.md`, lot 4) fait
 * entrer l'organisation dans le pilote des outils stratégiques, ou l'en fait
 * sortir : `pilote-réglé` (200) ou `inconnue` (404). Ce n'est pas un réglage
 * du parcours, et il passe par l'orchestration des outils, seule à toucher
 * leurs tables.
 *
 * Les deux réglages de l'opératrice sur un parcours d'essai (`réglerLeParcours`) :
 * décaler J0, jamais au-delà d'aujourd'hui, ou faire partir les courriers de fin
 * d'essai à l'adresse de relecture plutôt qu'au client.
 */
const demande = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nom: z.string().trim().min(1).max(200),
  registreNotion: z.string().trim().refine(identifiantNotionValide),
  /** `prospection` : la lettre 1 part sans sollicitation, l'essai n'ouvre qu'à la première visite. */
  origine: z.enum(['demande', 'prospection']).optional(),
  /** Le code du prescripteur qui recommande l'organisation ; exclusif de la prospection. */
  prescripteur: z.string().trim().refine(codeDePrescripteurValide).optional(),
})

const pilote = z.object({ slug: z.string().trim().min(1), action: z.literal('outils'), actif: z.boolean() })

const réglage = z.discriminatedUnion('action', [
  z.object({
    slug: z.string().trim().min(1),
    action: z.literal('prolonger'),
    semaines: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({ slug: z.string().trim().min(1), action: z.literal('relecture'), requise: z.boolean() }),
  z.object({
    slug: z.string().trim().min(1),
    action: z.literal('offre'),
    offre: z.enum(['standard', 'early_adopter', 'gratuite']),
  }),
  z.object({ slug: z.string().trim().min(1), action: z.literal('parutions'), parutions: z.number().int().min(1).max(8) }),
  z.object({
    slug: z.string().trim().min(1),
    action: z.literal('parcours'),
    prochaineLettre: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    restantes: z.number().int().min(1).max(8),
  }),
])

const STATUT_DU_RÉGLAGE: Record<RésultatDuRéglage['sorte'], number> = {
  prolongé: 200,
  'relecture-réglée': 200,
  'offre-posée': 200,
  'parutions-réglées': 200,
  'mis-en-parcours': 200,
  inconnue: 404,
  'pas-en-essai': 409,
  'sans-j0': 409,
  'au-delà-d-aujourdhui': 409,
  'abonnée-stripe': 409,
  'parutions-invalides': 409,
  'date-invalide': 400,
}

const STATUT: Record<RésultatDOuverture['sorte'], number> = {
  créée: 201,
  'passée-en-essai': 200,
  'déjà-en-essai': 200,
  'état-incompatible': 409,
  'registre-pris': 409,
  'registre-différent': 409,
  'prescripteur-inconnu': 404,
  'hors-prospection': 409,
  'déjà-prospectée': 409,
  'recommandée-par-elle-même': 409,
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'organisations')
  if (refus) return refus
  const indisponible = baseIndisponible()
  if (indisponible) return indisponible

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })

  const { slug, nom, registreNotion, origine, prescripteur } = lue.data
  if (origine === 'prospection' && prescripteur !== undefined) {
    return NextResponse.json({ état: 'invalide', raison: 'prospection et prescripteur s’excluent' }, { status: 400 })
  }
  try {
    const résultat = await ouvrirEnEssai({
      slug,
      nom,
      registreNotion,
      prospection: origine === 'prospection',
      ...(prescripteur !== undefined ? { prescripteur } : {}),
    })
    console.info(`[veille/organisations] ${slug} : ${résultat.sorte}.`)
    return NextResponse.json({ état: résultat.sorte, ...détail(résultat) }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    console.error(`[veille/organisations] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}

export async function PATCH(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'organisations')
  if (refus) return refus
  const indisponible = baseIndisponible()
  if (indisponible) return indisponible

  const corps: unknown = await requête.json().catch(() => null)
  const outils = pilote.safeParse(corps)
  if (outils.success) {
    const { slug, actif } = outils.data
    try {
      const résultat = await réglerLePilote({ slug, actif })
      console.info(`[veille/organisations] ${slug} : outils stratégiques ${actif ? 'ouverts' : 'fermés'}, ${résultat}.`)
      return résultat === 'réglé'
        ? NextResponse.json({ état: 'pilote-réglé', actif })
        : NextResponse.json({ état: 'inconnue' }, { status: 404 })
    } catch (erreur) {
      console.error(`[veille/organisations] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
      return NextResponse.json({ état: 'échec' }, { status: 502 })
    }
  }

  const lue = réglage.safeParse(corps)
  if (!lue.success) return NextResponse.json({ état: 'invalide' }, { status: 400 })

  const demande = lue.data
  try {
    const résultat = await réglerLeParcours(demande.slug, enRéglage(demande))
    console.info(`[veille/organisations] ${demande.slug} : ${demande.action}, ${journalDuRéglage(résultat)}.`)
    const { sorte, ...reste } = résultat
    return NextResponse.json({ état: sorte, ...reste }, { status: STATUT_DU_RÉGLAGE[sorte] })
  } catch (erreur) {
    console.error(`[veille/organisations] ${demande.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'échec' }, { status: 502 })
  }
}

function baseIndisponible(): NextResponse | null {
  if (!baseConfigurée()) {
    return NextResponse.json({ état: 'non-configurée', raison: 'DATABASE_URL absente' }, { status: 503 })
  }
  // `notion` est l'interrupteur de retour en arrière : il n'ouvre jamais Postgres.
  if (sourceAccès() === 'notion') {
    return NextResponse.json({ état: 'refusé', raison: 'SOURCE_ACCES vaut notion' }, { status: 409 })
  }
  return null
}

function enRéglage(demande: z.infer<typeof réglage>): Réglage {
  switch (demande.action) {
    case 'prolonger':
      return { sorte: 'prolonger', semaines: demande.semaines }
    case 'relecture':
      return { sorte: 'relecture', requise: demande.requise }
    case 'offre':
      return { sorte: 'offre', offre: demande.offre }
    case 'parutions':
      return { sorte: 'parutions', parutions: demande.parutions }
    case 'parcours':
      return { sorte: 'parcours', prochaineLettre: demande.prochaineLettre, restantes: demande.restantes }
  }
}

function journalDuRéglage(résultat: RésultatDuRéglage): string {
  switch (résultat.sorte) {
    case 'prolongé':
      return `J0 ${résultat.ancienJ0} → ${résultat.nouveauJ0}`
    case 'relecture-réglée':
      return résultat.requise ? 'courriers à la relecture' : 'courriers au client'
    case 'offre-posée':
      return `offre ${résultat.offre}, état ${résultat.état}`
    case 'mis-en-parcours':
      return `J0 ${résultat.j0}, ${résultat.restantes} parution(s) complète(s) restante(s) sur ${résultat.parutions}`
    case 'pas-en-essai':
      return `refusé, état ${résultat.état}`
    case 'au-delà-d-aujourdhui':
      return `refusé, J0 au plus tard le ${résultat.j0Maximal}`
    default:
      return résultat.sorte
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
