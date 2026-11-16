import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { TrajectoireDesScénarios, TroisScénarios } from '@/components/strategie-ecrans'
import { libelléDePériode } from '@/lib/domaine/strategie-vues'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { lettresPubliées, semainesDeLEspace } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, synthèseDeLEspace, trajectoireDeLEspace } from '@/lib/portail/strategie'

/**
 * Scénarios (lot 3 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : ce qui peut arriver. Les trois scénarios de la dernière
 * synthèse trimestrielle publiée, sortis de « Recommandations », avec leurs
 * indicateurs datables. Seulement pour un espace réorganisé : ailleurs, 404
 * avant toute lecture.
 *
 * Depuis le 16 novembre 2026 (lot 2 des simulations de scénarios), l'écran dit
 * aussi où en sont les signaux : les faits étiquetés parus depuis le dépôt des
 * scénarios, comptés contre la règle de chaque indicateur
 * (`trajectoireDeLEspace`, Postgres seul, aucun corps relu). Des comptes,
 * jamais une probabilité.
 */
export default async function Scénarios({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesDeLEspace(accès), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const numéros = new Map(semaines.flatMap((s) => s.éditions).flatMap((é) => (é.numéro !== null ? [[é.pageId, é.numéro] as const] : [])))
  const fin = semaines[0]?.éditions.map((é) => é.dateÉdition).sort().at(-1)
  const [synthèse, trajectoire] = await Promise.all([
    espace ? synthèseDeLEspace({ registre: accès.organisationId, numéros }) : null,
    espace && fin ? trajectoireDeLEspace({ registre: accès.organisationId, fin }) : null,
  ])
  const trimestre = synthèse?.trimestre && synthèse.trimestre.scénarios.length > 0 ? synthèse.trimestre : null
  const lettres = new Map(lettresPubliées(semaines).map((l) => [normaliserIdentifiant(l.édition.pageId), l]))
  const lien = (édition: string) => {
    const lettre = lettres.get(édition)
    return lettre
      ? { href: `/${accès.slug}/lettres/${lettre.édition.pageId}`, libellé: `${lettre.édition.numéro !== null ? `Lettre n° ${lettre.édition.numéro}` : 'La lettre'}, ${lettre.semaine.libellé}` }
      : null
  }

  return (
    <>
      <EntêteÉcran surtitre="stratégie" titre="Ce qui peut arriver" état={trimestre ? `trimestre ${libelléDePériode(trimestre.période)}` : undefined} />
      {trimestre ? (
        <div className="mt-8">
          <TroisScénarios scénarios={trimestre.scénarios} />
          {trajectoire ? (
            <div className="mt-12">
              <TrajectoireDesScénarios trajectoire={trajectoire} lien={lien} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-ardoise">Aucun scénario n’est publié pour l’instant. Ils paraissent avec la revue de chaque trimestre.</p>
      )}
      <div className="mt-12 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/forces`}>Voir les forces du marché sur le trimestre</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/recommandations`}>Voir les options du mois</LienFlèche>
        </p>
      </div>
    </>
  )
}
