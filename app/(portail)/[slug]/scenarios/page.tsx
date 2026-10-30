import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { TroisScénarios } from '@/components/strategie-ecrans'
import { libelléDePériode } from '@/lib/domaine/strategie-vues'
import { semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, synthèseDeLEspace } from '@/lib/portail/strategie'

/**
 * Scénarios (lot 3 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : ce qui peut arriver. Les trois scénarios de la dernière
 * synthèse trimestrielle publiée, sortis de « Recommandations », avec leurs
 * indicateurs datables. Seulement pour un espace réorganisé : ailleurs, 404
 * avant toute lecture.
 */
export default async function Scénarios({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const numéros = new Map(semaines.flatMap((s) => s.éditions).flatMap((é) => (é.numéro !== null ? [[é.pageId, é.numéro] as const] : [])))
  const synthèse = espace ? await synthèseDeLEspace({ registre: accès.organisationId, numéros }) : null
  const trimestre = synthèse?.trimestre && synthèse.trimestre.scénarios.length > 0 ? synthèse.trimestre : null

  return (
    <>
      <EntêteÉcran surtitre="stratégie" titre="Ce qui peut arriver" état={trimestre ? `trimestre ${libelléDePériode(trimestre.période)}` : undefined} />
      {trimestre ? (
        <div className="mt-8">
          <TroisScénarios scénarios={trimestre.scénarios} />
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
