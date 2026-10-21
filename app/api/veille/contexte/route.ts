import { NextResponse, type NextRequest } from 'next/server'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { listerÉditionsDeTravail } from '@/lib/notion/travail'
import { contexteDesFamilles } from '@/lib/portail/contexte'
import { identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Le contexte d'une organisation avant d'écrire ses lettres.
 *
 *   GET /api/veille/contexte?organisation=<page_id de la ligne de registre>
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 * Pour chaque **famille** (Écosystème, Concurrentiel — la clé interne, jamais
 * le nom client de la veille) : le dernier numéro, le prochain, la dernière
 * date, et les deux dernières éditions avec ce que l'anti-doublon et la
 * continuité des dossiers demandent. Tous statuts confondus : un brouillon en
 * relecture a déjà son numéro.
 *
 * C'est l'étape 0.3 de « Tâche — Lettres de veille », qui repartait à 1 quand
 * le modèle confondait `Famille` et `Veille`. Ici la confusion est impossible :
 * la propriété est nommée une fois, dans le code (`lib/portail/contexte.ts`,
 * que la file de travaux partage).
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'contexte')
  if (refus) return refus

  const organisation = requête.nextUrl.searchParams.get('organisation')
  if (!identifiantNotionValide(organisation)) {
    return NextResponse.json(
      { état: 'refusée', raison: '« organisation » absent ou invalide (page_id de la ligne de registre)' },
      { status: 400 },
    )
  }
  const organisationId = normaliserIdentifiant(organisation)

  try {
    const éditions = await listerÉditionsDeTravail(organisationId)
    return NextResponse.json({
      état: 'lu',
      organisation: organisationId,
      éditions: éditions.length,
      ...contexteDesFamilles(éditions),
    })
  } catch (erreur) {
    console.error(
      `[veille/contexte] échec pour ${organisationId} : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    )
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
