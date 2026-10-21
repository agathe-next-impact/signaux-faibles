import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { lireLeTravail } from '@/lib/base/travaux'
import { dossierDOnboarding, dossierDeParution, dossierDeProspect, sélectionDuJour } from '@/lib/payload/dispositif'
import { identifiantPayload } from '@/lib/payload/portail'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Ce qu'une tâche Trigger.dev lit avant de produire (programme du 22 octobre
 * 2026, §4). Lecture seule, jeton d'activation, Payload.
 *
 *   GET /api/veille/dossier?mode=selection&dateEdition=AAAA-MM-JJ
 *       → { organisations: [], filieres: [id] } : les filières qui paraissent
 *         ce jour. Les organisations ne sont plus sélectionnées ici : c'est la
 *         file de travaux qui décide quelle lettre produire et quand
 *         (`POST /api/veille/travaux`, action `prendre`).
 *   GET /api/veille/dossier?travail=<uuid>
 *       → le dossier de parution du travail pris : l'organisation est celle du
 *         travail (par sa clé de cloisonnement), le numéro et la date de
 *         parution ceux que la file a attribués, le mode découle du type
 *         (`premiere_lettre` → onboarding, `lettre` → parution). La tâche ne
 *         choisit rien.
 *   GET /api/veille/dossier?mode=parution|decouverte|onboarding&organisation=<id>[&dateEdition=…]
 *       → le même dossier, hors file (évaluation, rattrapage à la main)
 *   GET /api/veille/dossier?mode=filiere&filiere=<id>[&dateEdition=…]
 *       → le dossier de parution d'une filière : référentiel, sélection, gel des sources
 *   GET /api/veille/dossier?mode=onboarding-complet&organisation=<id>
 *       → le dossier d'onboarding : fiche, filière et son référentiel, référentiel unique s'il existe
 *   GET /api/veille/dossier?mode=prospect&prospect=<id>
 *       → le dossier du bloc personnalisé
 *
 * La tâche d'onboarding demande d'abord `onboarding-complet` (pour écrire le
 * référentiel s'il manque), puis `onboarding` (pour produire la lettre).
 */
const paramètres = z.object({
  mode: z.enum(['selection', 'parution', 'decouverte', 'onboarding', 'filiere', 'onboarding-complet', 'prospect']).optional(),
  travail: z.string().uuid().optional(),
  organisation: z.string().min(1).optional(),
  filiere: z.string().min(1).optional(),
  prospect: z.string().min(1).optional(),
  dateEdition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'dossier')
  if (refus) return refus

  const lu = paramètres.safeParse(Object.fromEntries(requête.nextUrl.searchParams.entries()))
  if (!lu.success) return NextResponse.json({ état: 'invalide', détails: lu.error.issues }, { status: 400 })
  const { mode, travail, organisation, filiere, prospect, dateEdition } = lu.data
  if (!mode && !travail) return NextResponse.json({ état: 'invalide', détails: 'mode ou travail requis' }, { status: 400 })

  try {
    if (travail) return dossierDuTravail(travail, mode)
    if (mode === 'selection') return NextResponse.json({ ...(await sélectionDuJour()), organisations: [] })
    if (mode === 'prospect') {
      if (!prospect) return NextResponse.json({ état: 'invalide', détails: 'prospect requis' }, { status: 400 })
      const dossier = await dossierDeProspect(prospect)
      return typeof dossier === 'string' ? NextResponse.json({ état: dossier }, { status: 404 }) : NextResponse.json(dossier)
    }
    if (mode === 'onboarding-complet') {
      if (!organisation) return NextResponse.json({ état: 'invalide', détails: 'organisation requise' }, { status: 400 })
      const dossier = await dossierDOnboarding(organisation)
      return typeof dossier === 'string' ? NextResponse.json({ état: dossier }, { status: 404 }) : NextResponse.json(dossier)
    }
    if (mode === 'filiere') {
      if (!filiere) return NextResponse.json({ état: 'invalide', détails: 'filiere requise' }, { status: 400 })
      const dossier = await dossierDeParution({ filiere }, 'filiere', dateEdition)
      return typeof dossier === 'string' ? NextResponse.json({ état: dossier }, { status: 404 }) : NextResponse.json(dossier)
    }
    if (!organisation) return NextResponse.json({ état: 'invalide', détails: 'organisation requise' }, { status: 400 })
    if (!mode) return NextResponse.json({ état: 'invalide', détails: 'mode requis' }, { status: 400 })
    const dossier = await dossierDeParution({ organisation }, mode, dateEdition)
    return typeof dossier === 'string' ? NextResponse.json({ état: dossier }, { status: 404 }) : NextResponse.json(dossier)
  } catch (erreur) {
    console.error(`[veille/dossier] ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 500 })
  }
}

/**
 * Le dossier d'un travail de la file : ce que la file a décidé prime sur ce
 * que le dossier recalculerait. Le mode peut être forcé (`decouverte`) ; sinon
 * il découle du type du travail.
 */
async function dossierDuTravail(travailId: string, mode: z.infer<typeof paramètres>['mode']): Promise<NextResponse> {
  const travail = await lireLeTravail(travailId)
  if (!travail) return NextResponse.json({ état: 'travail-inconnu' }, { status: 404 })
  if (travail.type !== 'lettre' && travail.type !== 'premiere_lettre') {
    return NextResponse.json({ état: 'type-non-pris-en-charge', type: travail.type }, { status: 409 })
  }
  const registre = travail.organisation.registreNotion
  if (!registre) return NextResponse.json({ état: 'organisation-sans-registre' }, { status: 409 })
  const modeDeProduction = mode === 'decouverte' ? 'decouverte' : travail.type === 'premiere_lettre' ? 'onboarding' : 'parution'
  const dossier = await dossierDeParution(
    { organisation: identifiantPayload(registre) },
    modeDeProduction,
    travail.contexte.parution?.date,
    { numéro: travail.contexte.numéro },
  )
  if (typeof dossier === 'string') return NextResponse.json({ état: dossier }, { status: 404 })
  return NextResponse.json({ ...dossier, travail: { id: travail.id, type: travail.type, état: travail.état, mode: modeDeProduction } })
}
