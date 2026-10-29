import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { baseConfigurée } from '@/lib/base/client'
import type { Grille } from '@/lib/domaine/strategie'
import { identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { lireLaGrilleDuPilote, recevoirLaGrille, validerLaVersion, type RésultatDeLaGrille } from '@/lib/portail/strategie'

/**
 * La grille stratégique d'une organisation du pilote (outils stratégiques,
 * lot 5 de `docs/plan-outils-strategiques.md`).
 *
 *   POST /api/veille/grille
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *   { "slug": "infralliance", "referentiel": "<page_id du référentiel>", "grille": {
 *       "axes": [{ "cle", "libelle", "crans": [] }, …],
 *       "familles": [{ "numero", "veille", "pestel" | "porter", "cadence", "libelle"? }],
 *       "entites": [{ "nom", "veille", "siren" }],
 *       "partiesPrenantes": [{ "nom" }], "offres": [] } }
 *
 * Deux axes de groupes stratégiques de 3 à 5 crans, libellés de 40 caractères
 * au plus (les critères complets restent dans le référentiel) ; chaque famille
 * rattachée à une lettre PESTEL ou à une force ; 40 entités au plus par veille ;
 * 8 à 15 parties prenantes. La même grille re-postée (même empreinte) ne crée
 * pas de version : `inchangée`. Refusée : 422 avec la liste des refus et le
 * message de reprise, deux reprises au plus.
 *
 *   GET /api/veille/grille?slug=infralliance
 *
 * La dernière version, avec les trous du PESTEL et les forces non suivies.
 *
 *   PATCH /api/veille/grille
 *   { "slug": "infralliance", "version": 2 }
 *
 * Pose la validation de la dernière version, une fois répondus les points de
 * validation de ses axes.
 *
 * `hors-pilote` (200) : l'organisation n'a pas les outils stratégiques ; la
 * tâche passe l'étape. Le portail ne lit pas le référentiel : il n'en garde que
 * l'identifiant.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Des bornes de forme seulement, larges : les bornes du contrat sont celles de
// la porte (`contrôlerLaGrille`), qui les nomme dans son message de reprise.
const texte = (max: number) => z.string().trim().max(max)
const demande = z.object({
  slug: z.string().trim().regex(SLUG),
  referentiel: z.string().refine(identifiantNotionValide),
  grille: z.object({
    axes: z.array(z.object({ cle: texte(60), libelle: texte(200), crans: z.array(texte(200)).max(10) })).max(6),
    familles: z
      .array(
        z.object({
          numero: z.number().int().min(1).max(99),
          veille: texte(40),
          pestel: texte(40).nullish(),
          porter: texte(40).nullish(),
          cadence: texte(40),
          libelle: texte(200).nullish(),
        }),
      )
      .max(60),
    entites: z.array(z.object({ nom: texte(300), veille: texte(40), siren: texte(20).nullish() })).max(200),
    partiesPrenantes: z.array(z.object({ nom: texte(300) })).max(40),
    offres: z.array(texte(120)).max(12).nullish(),
  }),
})
const validation = z.object({ slug: z.string().trim().regex(SLUG), version: z.number().int().min(1) })

const STATUT: Record<RésultatDeLaGrille['sorte'], number> = {
  créée: 201,
  inchangée: 200,
  refusée: 422,
  'hors-pilote': 200,
  'organisation-inconnue': 404,
}

/** Le JSON de la route vers le type du domaine : les valeurs inconnues passent, la porte les nomme. */
function versLeDomaine(grille: z.infer<typeof demande>['grille']): Grille {
  return {
    axesGroupes: grille.axes.map((a) => ({ clé: a.cle, libellé: a.libelle, crans: a.crans })),
    familles: grille.familles.map((f) => ({
      numéro: f.numero,
      veille: f.veille as Grille['familles'][number]['veille'],
      pestel: (f.pestel ?? null) as Grille['familles'][number]['pestel'],
      porter: (f.porter ?? null) as Grille['familles'][number]['porter'],
      cadence: f.cadence as Grille['familles'][number]['cadence'],
      ...(f.libelle ? { libellé: f.libelle } : {}),
    })),
    entités: grille.entites.map((e) => ({ nom: e.nom, veille: e.veille as Grille['entités'][number]['veille'], siren: e.siren ?? null })),
    partiesPrenantes: grille.partiesPrenantes.map((p) => ({ nom: p.nom })),
    offres: grille.offres ?? null,
  }
}

function invalide(erreur: z.ZodError): NextResponse {
  const chemin = erreur.issues[0]?.path.join('.') ?? ''
  return NextResponse.json({ état: 'invalide', raison: chemin ? `champ « ${chemin} »` : 'corps illisible' }, { status: 400 })
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'grille')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = demande.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return invalide(lue.error)

  try {
    const résultat = await recevoirLaGrille({ slug: lue.data.slug, référentiel: lue.data.referentiel, grille: versLeDomaine(lue.data.grille) })
    console.info(
      `[veille/grille] ${lue.data.slug} : ${résultat.sorte}` +
        (résultat.sorte === 'créée' || résultat.sorte === 'inchangée' ? ` (v${résultat.version})` : '') +
        (résultat.sorte === 'refusée' ? ` (${résultat.refus.length} refus)` : '') +
        '.',
    )
    return NextResponse.json({ état: résultat.sorte, ...résultat }, { status: STATUT[résultat.sorte] })
  } catch (erreur) {
    console.error(`[veille/grille] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'grille')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const slug = requête.nextUrl.searchParams.get('slug') ?? ''
  if (!SLUG.test(slug)) return NextResponse.json({ état: 'invalide', raison: 'slug attendu' }, { status: 400 })

  try {
    const lecture = await lireLaGrilleDuPilote({ slug })
    if (lecture.sorte !== 'lue') {
      return NextResponse.json({ état: lecture.sorte }, { status: lecture.sorte === 'organisation-inconnue' ? 404 : 200 })
    }
    return NextResponse.json({
      état: 'lue',
      organisation: slug,
      version: lecture.version,
      empreinte: lecture.empreinte,
      referentiel: lecture.référentielNotion,
      validéeLe: lecture.validéeLe?.toISOString() ?? null,
      grille: {
        axes: lecture.grille.axesGroupes.map((a) => ({ cle: a.clé, libelle: a.libellé, crans: a.crans })),
        familles: lecture.grille.familles.map((f) => ({ numero: f.numéro, veille: f.veille, pestel: f.pestel ?? null, porter: f.porter ?? null, cadence: f.cadence, libelle: f.libellé ?? null })),
        entites: lecture.grille.entités.map((e) => ({ nom: e.nom, veille: e.veille, siren: e.siren ?? null })),
        partiesPrenantes: lecture.grille.partiesPrenantes,
        offres: lecture.grille.offres ?? null,
      },
      trousDuPestel: lecture.trousDuPestel,
      forcesNonSuivies: lecture.forcesNonSuivies,
    })
  } catch (erreur) {
    console.error(`[veille/grille] ${slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}

export async function PATCH(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'grille')
  if (refus) return refus
  if (!baseConfigurée()) return NextResponse.json({ état: 'base-non-configurée' }, { status: 503 })

  const lue = validation.safeParse(await requête.json().catch(() => null))
  if (!lue.success) return invalide(lue.error)

  try {
    const résultat = await validerLaVersion(lue.data)
    console.info(`[veille/grille] ${lue.data.slug} : validation de la v${lue.data.version}, ${résultat}.`)
    const statut = résultat === 'organisation-inconnue' || résultat === 'aucune' ? 404 : résultat === 'version-dépassée' ? 409 : 200
    return NextResponse.json({ état: résultat, version: lue.data.version }, { status: statut })
  } catch (erreur) {
    console.error(`[veille/grille] ${lue.data.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
