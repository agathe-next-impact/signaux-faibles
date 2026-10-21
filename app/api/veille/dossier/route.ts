import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { dossierDOnboarding, dossierDeParution, dossierDeProspect, sélectionDuJour } from '@/lib/payload/dispositif'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Ce qu'une tâche Trigger.dev lit avant de produire (programme du 22 octobre
 * 2026, §4). Lecture seule, jeton d'activation, Payload.
 *
 *   GET /api/veille/dossier?mode=selection&dateEdition=AAAA-MM-JJ
 *       → { organisations: [id], filieres: [id] }, ce qui paraît ce jour
 *   GET /api/veille/dossier?mode=parution|decouverte|onboarding&organisation=<id>[&dateEdition=…]
 *   GET /api/veille/dossier?mode=filiere&filiere=<id>[&dateEdition=…]
 *       → le dossier de parution : référentiel, sélection, gel des sources
 *   GET /api/veille/dossier?mode=onboarding-complet&organisation=<id>
 *       → le dossier d'onboarding : fiche, filière et son référentiel, référentiel unique s'il existe
 *   GET /api/veille/dossier?mode=prospect&prospect=<id>
 *       → le dossier du bloc personnalisé
 *
 * La tâche d'onboarding demande d'abord `onboarding-complet` (pour écrire le
 * référentiel s'il manque), puis `onboarding` (pour produire la lettre).
 */
const paramètres = z.object({
  mode: z.enum(['selection', 'parution', 'decouverte', 'onboarding', 'filiere', 'onboarding-complet', 'prospect']),
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
  const { mode, organisation, filiere, prospect, dateEdition } = lu.data

  try {
    if (mode === 'selection') return NextResponse.json(await sélectionDuJour())
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
    const dossier = await dossierDeParution({ organisation }, mode, dateEdition)
    return typeof dossier === 'string' ? NextResponse.json({ état: dossier }, { status: 404 }) : NextResponse.json(dossier)
  } catch (erreur) {
    console.error(`[veille/dossier] ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 500 })
  }
}
