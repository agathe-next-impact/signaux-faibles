import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { BarresDuBenchmark, EntréesEtSorties } from '@/components/graphiques-strategie'
import { EnBref } from '@/components/strategie-ecrans'
import { enBrefDesIndicateurs, libelléDePériode } from '@/lib/domaine/strategie-vues'
import { espaceDeLOrganisation, indicateursDeLEspace } from '@/lib/portail/strategie'

/**
 * Indicateurs (lot 5 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : le secteur grandit-il. L'indice de cycle de vie (entrées et
 * procédures collectives au BODACC sur deux périodes de douze mois) et le
 * benchmark (comptes publiés au registre des entités de la grille), tels que le
 * portail les a calculés pour le dernier trimestre publié ; l'interprétation
 * est celle de la synthèse, relue par l'opératrice. Aucune lecture Notion, aucun
 * appel aux registres depuis l'écran. Seulement pour un espace réorganisé :
 * ailleurs, 404 avant toute lecture.
 */
export default async function Indicateurs({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const vue = espace ? await indicateursDeLEspace({ registre: accès.organisationId }) : null

  return (
    <>
      <EntêteÉcran surtitre="stratégie" titre="Le secteur grandit-il" état={vue ? `trimestre ${libelléDePériode(vue.période)}` : undefined} />
      {vue ? (
        <>
          <EnBref chiffres={enBrefDesIndicateurs(vue)} />

          {vue.indice ? (
            <section className="mt-10 flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-titre text-h2 font-bold text-encre">Entrées et sorties du marché</h2>
                <p className="label-mono text-ardoise">BODACC · outil en test</p>
              </div>
              <p className="max-w-[68ch] text-ardoise">
                Les créations et immatriculations, face aux procédures collectives, publiées au Bulletin officiel sur douze mois, et sur les douze mois d’avant.
              </p>
              <EntréesEtSorties indice={vue.indice.valeurs} />
              {vue.indice.interprétation ? <p className="max-w-[68ch] text-encre">{vue.indice.interprétation}</p> : null}
              {vue.indice.valeurs.limites.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {vue.indice.valeurs.limites.map((l) => (
                    <li key={l} className="text-sm text-ardoise">{l}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : (
            <p className="mt-8 text-ardoise">L’indice de cycle de vie n’a pas été calculé pour ce trimestre : il demande les départements et l’activité suivis par votre veille.</p>
          )}

          {vue.benchmark ? (
            <section className="mt-10 flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-titre text-h2 font-bold text-encre">Chiffres d’affaires publiés</h2>
                <p className="label-mono text-ardoise">Registre des entreprises · outil en test</p>
              </div>
              <p className="max-w-[68ch] text-ardoise">
                Le dernier exercice publié de chaque entité suivie qui a un SIREN. Un chiffre absent n’est pas publié, il n’est pas nul ; les exercices diffèrent d’une entité à l’autre.
              </p>
              <BarresDuBenchmark benchmark={vue.benchmark.valeurs} />
              {vue.benchmark.interprétation ? <p className="max-w-[68ch] text-encre">{vue.benchmark.interprétation}</p> : null}
              {vue.benchmark.valeurs.limites.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {vue.benchmark.valeurs.limites.map((l) => (
                    <li key={l} className="text-sm text-ardoise">{l}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <p className="mt-5 text-ardoise">Les indicateurs ne sont pas encore publiés. Ils paraissent avec la revue de chaque trimestre.</p>
      )}
      <div className="mt-10 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/forces`}>Voir les forces du marché</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/scenarios`}>Voir les scénarios</LienFlèche>
        </p>
      </div>
    </>
  )
}
