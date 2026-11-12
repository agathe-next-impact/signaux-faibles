import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { ÉcranDesMarchés } from '@/components/marches-ecran'
import { libelléDePériode } from '@/lib/domaine/strategie-vues'
import { marchésDeLEspace } from '@/lib/portail/marches'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Marchés et niches (12 novembre 2026, `docs/plan-marches-et-niches.md`) : où
 * porter l'effort. Un écran de décision, refait le jour même à la demande de
 * l'opératrice : en tête, la matrice qui range chaque offre et chaque niche
 * sous un verdict (à pousser, à disputer, à surveiller, à écarter), par règle
 * affichée et jamais par un modèle (`lectureDuSegment`) ; dessous, une fiche
 * courte par segment, son verdict, la phrase de chiffres qui le fonde et trois
 * chiffres au plus. Les hypothèses et les sources restent repliées. Aucune
 * lecture Notion, aucun appel aux registres depuis l'écran. Seulement pour un
 * espace réorganisé : ailleurs, 404 avant toute lecture.
 */
export default async function Marchés({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const vue = espace ? await marchésDeLEspace({ registre: accès.organisationId, aperçu: accès.aperçu }) : null

  return (
    <>
      <EntêteÉcran surtitre="le marché" titre="Marchés et niches" état={vue ? `trimestre ${libelléDePériode(vue.période)}` : undefined} />
      {vue ? <ÉcranDesMarchés vue={vue} /> : <p className="mt-6 text-ardoise">Les mesures de vos marchés ne sont pas encore publiées. Elles paraissent avec la revue de chaque trimestre.</p>}
      <div className="mt-12 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/concurrents`}>Voir {espace?.marché.écran.toLowerCase() ?? 'les concurrents'}</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/forces`}>Voir les forces du marché</LienFlèche>
        </p>
      </div>
    </>
  )
}
