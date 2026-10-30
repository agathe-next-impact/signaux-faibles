import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran } from '@/components/coquille'
import { GrilleDesÉcrans } from '@/components/grille-des-ecrans'
import { casesDeLaRubrique, RUBRIQUES } from '@/lib/domaine/tableau-de-bord'
import { semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'
import { tableauDeLEspace } from '@/lib/portail/tableau'

const RUBRIQUE = RUBRIQUES.find((r) => r.clé === 'marche')!

/**
 * « Le marché » : concurrents, acteurs, forces du marché. Écran de rubrique (30 octobre 2026, décision de l'opératrice) : la grille
 * des écrans de la rubrique, chacun avec son chiffre clé, celui de la carte de
 * la vue d'ensemble. Seulement pour un espace réorganisé : ailleurs, 404 avant
 * toute lecture. Aucune lecture Notion au-delà de la liste
 * des éditions.
 */
export default async function RubriqueMarché({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const tableau = espace
    ? await tableauDeLEspace({ slug: accès.slug, registre: accès.organisationId, semaines, concurrents: espace.concurrents, axes: null })
    : null

  return (
    <>
      <EntêteÉcran surtitre="rubrique" titre={RUBRIQUE.titre} />
      <p className="mt-5 max-w-[68ch] text-ardoise">{RUBRIQUE.présentation}</p>
      <div className="mt-8">
        {tableau ? (
          <GrilleDesÉcrans étiquette={`Les écrans de la rubrique ${RUBRIQUE.titre}`} cases={casesDeLaRubrique(tableau.cases, RUBRIQUE.clé)} />
        ) : (
          <p className="text-ardoise">Les chiffres de cette rubrique ne sont pas disponibles pour le moment. Réessayez dans quelques minutes.</p>
        )}
      </div>
    </>
  )
}
