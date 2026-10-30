import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { baseConfigurée } from '@/lib/base/client'
import type { FicheDeVeille } from '@/lib/domaine/fiche-veille'
import type { Veille } from '@/lib/domaine/strategie'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireLaFicheDuPilote, publierLaFicheDuPilote, recevoirLaFiche, type RésultatDeLaFiche } from '@/lib/portail/fiche-veille'

/**
 * La fiche de veille pour le lecteur (lot 6 de
 * `docs/proposition-reorganisation-espace.md`, 30 octobre 2026), postée par la
 * revue mensuelle, section « Fiche de veille », pour les organisations du
 * pilote des outils stratégiques.
 *
 *   POST /api/veille/fiche
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug", "grilleVersion": 1, "fiche": {
 *       "themes": [{ "veille": "ecosysteme", "numero": 1, "suit": "…", "fort": "…" }],
 *       "sources": [{ "veille", "numero", "nom": "…", "site": "https://…" | null }],
 *       "niches": [{ "enonce": "…", "signal": "…" }],
 *       "echeances": [{ "date": "2026-11-19", "libelle": "…", "veille": null, "numero": null }] } }
 *
 * Bornes : 120 caractères par thème, par critère, par niche et par signal,
 * 80 par nom de source et par échéance ; une source n'a qu'un nom et l'adresse
 * de son site, jamais une note d'accès. Refusée : 422 avec les refus et le
 * message de reprise. Acceptée : 201, une nouvelle version **proposée**, et
 * `texte`, à recopier dans le courriel « [Relecture] ».
 *
 *   GET /api/veille/fiche?slug=hermitage
 *
 * La dernière version reçue, son état (`publication`) et son texte de relecture.
 *
 *   PATCH /api/veille/fiche
 *   { "slug": "hermitage", "etat": "publie" | "retire" | "propose" }
 *
 * Le geste de l'opératrice après relecture : seule une fiche publiée est lue
 * par les écrans « Votre veille ».
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const texte = (max: number) => z.string().trim().max(max)
const veille = z.enum(['ecosysteme', 'concurrentiel'])
const numéro = z.number().int().min(1).max(99)
const demande = z.object({
  slug: z.string().trim().regex(SLUG),
  grilleVersion: z.number().int().min(1),
  fiche: z.object({
    themes: z.array(z.object({ veille, numero: numéro, suit: texte(400), fort: texte(400) })).max(40),
    sources: z.array(z.object({ veille, numero: numéro, nom: texte(200), site: texte(400).nullish() })).max(200),
    niches: z.array(z.object({ enonce: texte(400), signal: texte(400) })).max(40),
    echeances: z.array(z.object({ date: texte(10), libelle: texte(300), veille: veille.nullish(), numero: numéro.nullish() })).max(60),
  }),
})

const STATUT: Record<RésultatDeLaFiche['sorte'], number> = {
  enregistrée: 201,
  refusée: 422,
  'hors-pilote': 200,
  'organisation-inconnue': 404,
  'grille-absente': 409,
  'grille-périmée': 409,
}

/** Le JSON de la route vers le type du domaine ; la porte nomme ce qui ne va pas. */
function versLeDomaine(f: z.infer<typeof demande>['fiche']): FicheDeVeille {
  return {
    thèmes: f.themes.map((t) => ({ veille: t.veille as Veille, numéro: t.numero, suit: t.suit, fort: t.fort })),
    sources: f.sources.map((s) => ({ veille: s.veille as Veille, numéro: s.numero, nom: s.nom, site: s.site || null })),
    niches: f.niches.map((n) => ({ énoncé: n.enonce, signal: n.signal })),
    échéances: f.echeances.map((é) => ({ date: é.date, libellé: é.libelle, veille: (é.veille ?? null) as Veille | null, numéro: é.numero ?? null })),
  }
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'fiche')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) {
    const chemin = lue.error.issues[0]?.path.join('.') ?? ''
    return NextResponse.json({ état: 'invalide', raison: chemin ? `champ « ${chemin} »` : 'corps illisible' }, { status: 400 })
  }
  const { slug, grilleVersion, fiche } = lue.data
  try {
    const résultat = await recevoirLaFiche({ slug, grilleVersion, fiche: versLeDomaine(fiche) })
    console.info(
      `[veille/fiche] ${slug} : ${résultat.sorte}` +
        (résultat.sorte === 'enregistrée' ? ` (version ${résultat.version})` : '') +
        (résultat.sorte === 'refusée' ? ` (${résultat.refus.length} refus)` : '') +
        '.',
    )
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    console.error(`[veille/fiche] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'fiche')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const slug = requête.nextUrl.searchParams.get('slug') ?? ''
  if (!SLUG.test(slug)) return NextResponse.json({ état: 'invalide', raison: 'slug attendu' }, { status: 400 })
  try {
    const lecture = await lireLaFicheDuPilote({ slug })
    if (lecture.sorte !== 'lue') return NextResponse.json({ état: lecture.sorte }, { status: lecture.sorte === 'organisation-inconnue' ? 404 : 200 })
    return NextResponse.json({ état: 'lue', organisation: slug, version: lecture.version, publication: lecture.état, texte: lecture.texte, fiche: lecture.fiche })
  } catch (erreur) {
    console.error(`[veille/fiche] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

const publication = z.object({ slug: z.string().trim().regex(SLUG), etat: z.enum(['publie', 'retire', 'propose']) })

export async function PATCH(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'fiche')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = publication.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return NextResponse.json({ état: 'invalide', raison: 'slug et etat (publie, retire ou propose) attendus' }, { status: 400 })
  try {
    const r = await publierLaFicheDuPilote({ slug: lue.data.slug, état: lue.data.etat })
    console.info(`[veille/fiche] ${lue.data.slug} : ${lue.data.etat}, ${r.sorte}${r.sorte === 'réglée' ? ` (version ${r.version})` : ''}.`)
    const corps = r.sorte === 'réglée' ? { état: r.sorte, version: r.version, publication: r.état } : { état: r.sorte }
    return NextResponse.json(corps, { status: r.sorte === 'organisation-inconnue' ? 404 : 200 })
  } catch (erreur) {
    console.error(`[veille/fiche] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
