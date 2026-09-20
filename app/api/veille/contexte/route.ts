import { NextResponse, type NextRequest } from 'next/server'
import { lireDossiersOuverts } from '@/lib/domaine/dossiers'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { listerÉditionsDeTravail, type ÉditionDeTravail } from '@/lib/notion/travail'
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
 * la propriété est nommée une fois, dans le code.
 */
const FAMILLES = ['Écosystème', 'Concurrentiel'] as const

function résumer(édition: ÉditionDeTravail) {
  return {
    pageId: édition.pageId,
    titre: édition.titre,
    statut: édition.statut,
    veille: édition.veille,
    date: édition.dateÉdition,
    numéro: édition.numéro,
    périodeCouverte: édition.périodeCouverte,
    fenêtreÉlargie: édition.fenêtreÉlargie,
    dossiers: lireDossiersOuverts(édition.dossiersOuvertsBruts),
    dossiersBruts: édition.dossiersOuvertsBruts,
    actionDeLaSemaine: édition.actionDeLaSemaine,
    amendements: édition.amendements,
  }
}

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

    const familles = Object.fromEntries(
      FAMILLES.map((famille) => {
        const siennes = éditions.filter((é) => é.famille === famille)
        const numéros = siennes.map((é) => é.numéro).filter((n): n is number => n !== null)
        const dernierNuméro = numéros.length > 0 ? Math.max(...numéros) : 0
        return [
          famille,
          {
            éditions: siennes.length,
            dernierNuméro,
            prochainNuméro: dernierNuméro + 1,
            dernièreDate: siennes[0]?.dateÉdition ?? null,
            // Le nom client de la veille, tel que la dernière édition l'a porté.
            veille: siennes[0]?.veille ?? null,
            dernières: siennes.slice(0, 2).map(résumer),
          },
        ]
      }),
    )

    const sansFamille = éditions.filter((é) => !FAMILLES.includes(é.famille as (typeof FAMILLES)[number]))

    return NextResponse.json({
      état: 'lu',
      organisation: organisationId,
      éditions: éditions.length,
      familles,
      // Une édition sans famille n'est comptée nulle part : la dire, sinon la
      // numérotation de la famille qu'elle aurait dû porter repart en arrière.
      sansFamille: sansFamille.map((é) => ({ pageId: é.pageId, titre: é.titre, statut: é.statut })),
    })
  } catch (erreur) {
    console.error(
      `[veille/contexte] échec pour ${organisationId} : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
    )
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
