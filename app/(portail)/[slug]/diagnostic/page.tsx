import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { EnBref, MatriceSwot } from '@/components/strategie-ecrans'
import { enBrefDeLaSwot, libelléDePériode } from '@/lib/domaine/strategie-vues'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { lettresPubliées, semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, synthèseDeLEspace } from '@/lib/portail/strategie'

/**
 * Diagnostic (lot 3 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : où en est l'organisation. La SWOT de la dernière synthèse
 * mensuelle publiée, sortie de « Recommandations » ; chaque élément porte son
 * code en ancre, vers lequel mènent les options de l'écran « Options ».
 *
 * Seulement pour un espace réorganisé : ailleurs, 404 avant toute lecture. Aucune
 * lecture Notion de plus que la liste des éditions (numéros des lettres citées).
 */
export default async function Diagnostic({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const numéros = new Map(semaines.flatMap((s) => s.éditions).flatMap((é) => (é.numéro !== null ? [[é.pageId, é.numéro] as const] : [])))
  const synthèse = espace ? await synthèseDeLEspace({ registre: accès.organisationId, numéros }) : null
  // Un élément daté mène à la lettre qui porte son fait, parmi celles déjà listées pour l'organisation (règle 2).
  const lettres = new Map(lettresPubliées(semaines).map((l) => [normaliserIdentifiant(l.édition.pageId), `/${accès.slug}/lettres/${l.édition.pageId}`]))

  return (
    <>
      <EntêteÉcran surtitre="stratégie" titre="Où en êtes-vous" état={synthèse?.mois ? `synthèse ${libelléDePériode(synthèse.mois.période)}` : undefined} />
      {synthèse?.mois ? (
        <>
          <EnBref chiffres={enBrefDeLaSwot(synthèse.mois.swot)} />
          <div className="mt-8">
            <MatriceSwot swot={synthèse.mois.swot} lettre={(édition) => lettres.get(édition) ?? null} />
          </div>
        </>
      ) : (
        <p className="mt-5 text-ardoise">Aucune synthèse n’est publiée pour l’instant. Le diagnostic paraît avec la première revue mensuelle relue.</p>
      )}
      <div className="mt-10 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/recommandations`}>Voir les options qui en découlent</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/scenarios`}>Voir les scénarios du trimestre</LienFlèche>
        </p>
      </div>
    </>
  )
}
