import { NextResponse, type NextRequest } from 'next/server'
import { base } from '@/lib/base/client'
import { appliquerImport, planifierImport } from '@/lib/base/import-acces'
import { lignesDAccèsPourImport } from '@/lib/notion/acces'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'

/**
 * Aligne la table Postgres `lecteurs` sur la base Notion « Accès ».
 *
 *   POST /api/veille/importer-acces?a-blanc=1   → le plan, rien n'est écrit
 *   POST /api/veille/importer-acces             → écrit, en une transaction
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 * Rejouable pendant toute la double lecture (`SOURCE_ACCES=double`). La
 * réponse ne porte que des comptes, des slugs, des libellés et des empreintes :
 * ni adresse ni identifiant d'accès, qui ne quittent jamais le serveur.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'importer-acces')
  if (refus) return refus

  const àBlanc = requête.nextUrl.searchParams.get('a-blanc') === '1'

  try {
    const lignes = await lignesDAccèsPourImport()

    // Une base vide désactiverait tous les lecteurs : plus probablement une
    // intégration qui a perdu son accès qu'une base vidée.
    if (lignes.length === 0) {
      return NextResponse.json(
        { état: 'refusé', raison: 'la base Notion « Accès » ne rend aucune ligne' },
        { status: 409 },
      )
    }

    const plan = planifierImport(lignes)
    const résumé = {
      lignesLues: lignes.length,
      organisations: plan.organisations.map((organisation) => ({
        slug: organisation.slug,
        nom: organisation.nom,
        lecteurs: plan.lecteurs.filter((lecteur) => lecteur.slug === organisation.slug).length,
        lecteursActifs: plan.lecteurs.filter((l) => l.slug === organisation.slug && l.actif).length,
      })),
      opérateurs: plan.opérateurs.length,
      opérateursActifs: plan.opérateurs.filter((opérateur) => opérateur.actif).length,
      écartés: plan.écartés,
      préservés: plan.préservés.length,
    }

    if (àBlanc) return NextResponse.json({ état: 'à blanc', ...résumé })

    const rapport = await appliquerImport(base(), plan)
    return NextResponse.json({
      état: 'écrit',
      ...résumé,
      lecteursÉcrits: rapport.lecteurs,
      lecteursDésactivés: rapport.lecteursDésactivés,
    })
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`[veille/importer-acces] ${message}`)
    return NextResponse.json({ état: 'échec', message }, { status: 500 })
  }
}
