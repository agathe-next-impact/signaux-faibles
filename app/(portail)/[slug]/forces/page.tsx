import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { CinqForces } from '@/components/strategie-ecrans'
import { libelléDePériode } from '@/lib/domaine/strategie-vues'
import { semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, synthèseDeLEspace } from '@/lib/portail/strategie'

/**
 * Forces du marché (lot 3 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : le marché se durcit-il. Les cinq forces de la dernière
 * synthèse trimestrielle publiée, sorties de « Recommandations ». Les barres à
 * trois crans viendront avec les graphiques (lot 5). Seulement pour un espace
 * réorganisé : ailleurs, 404 avant toute lecture.
 */
export default async function ForcesDuMarché({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const numéros = new Map(semaines.flatMap((s) => s.éditions).flatMap((é) => (é.numéro !== null ? [[é.pageId, é.numéro] as const] : [])))
  const synthèse = espace ? await synthèseDeLEspace({ registre: accès.organisationId, numéros }) : null
  const trimestre = synthèse?.trimestre && synthèse.trimestre.forces.length > 0 ? synthèse.trimestre : null

  return (
    <>
      <EntêteÉcran surtitre="le marché" titre="Le marché se durcit-il" état={trimestre ? `trimestre ${libelléDePériode(trimestre.période)}` : undefined} />
      {trimestre ? (
        <div className="mt-8">
          <CinqForces période={trimestre.période} forces={trimestre.forces} />
        </div>
      ) : (
        <p className="mt-5 text-ardoise">Les cinq forces ne sont pas encore publiées. Elles paraissent avec la revue de chaque trimestre.</p>
      )}
      <div className="mt-10 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/concurrents`}>Voir les concurrents et leur carte</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/acteurs`}>Voir les autres acteurs</LienFlèche>
        </p>
      </div>
    </>
  )
}
