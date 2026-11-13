import { NextResponse, type NextRequest } from 'next/server'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { importerLesAccès } from '@/lib/portail/import-acces'

/**
 * Aligne la table Postgres `lecteurs` sur la base Notion « Accès ».
 *
 *   POST /api/veille/importer-acces?a-blanc=1   → le plan et les comptes, rien n'est écrit
 *   POST /api/veille/importer-acces             → écrit, en une transaction
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 * Rejouable pendant toute la double lecture (`SOURCE_ACCES=double`), refusé en
 * 409 une fois Postgres source de vérité. La logique est celle du bouton du
 * tableau des abonnements, dans `lib/portail/import-acces.ts`. La réponse ne
 * porte que des comptes, des slugs, des libellés et des empreintes : ni
 * adresse ni identifiant d'accès, qui ne quittent jamais le serveur.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'importer-acces')
  if (refus) return refus

  const àBlanc = requête.nextUrl.searchParams.get('a-blanc') === '1'
  const issue = await importerLesAccès({ àBlanc })

  switch (issue.état) {
    case 'à blanc':
    case 'écrit':
      return NextResponse.json({
        état: issue.état,
        ...issue.résumé,
        organisationsCréées: issue.comptes.organisationsCréées,
        lecteursÉcrits: issue.comptes.lecteursCréés + issue.comptes.lecteursMisÀJour,
        lecteursCréés: issue.comptes.lecteursCréés,
        lecteursMisÀJour: issue.comptes.lecteursMisÀJour,
        lecteursDésactivés: issue.comptes.lecteursDésactivés,
        écartés: issue.comptes.écartés,
      })
    case 'refusé':
      if (issue.raison === 'base-notion-vide') {
        return NextResponse.json(
          { état: 'refusé', raison: 'la base Notion « Accès » ne rend aucune ligne' },
          { status: 409 },
        )
      }
      if (issue.raison === 'postgres-fait-foi') {
        return NextResponse.json(
          { état: 'refusé', raison: 'SOURCE_ACCES vaut postgres : la base Notion « Accès » est gelée, Postgres fait foi' },
          { status: 409 },
        )
      }
      if (issue.raison === 'sans-base') {
        return NextResponse.json({ état: 'refusé', raison: 'DATABASE_URL absente' }, { status: 503 })
      }
      return NextResponse.json({ état: 'refusé', raison: issue.raison }, { status: 409 })
    case 'échec':
      return NextResponse.json({ état: 'échec', message: issue.message }, { status: 500 })
  }
}
