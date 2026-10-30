import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { PasEncorePubliée, VEILLES_AFFICHÉES } from '@/components/votre-veille'
import { vueDesSources } from '@/lib/domaine/fiche-veille'
import { ficheDeLEspace } from '@/lib/portail/fiche-veille'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Sources (lot 6, 30 octobre 2026) : où regardez-vous. Les sources ouvertes par
 * la veille, rangées par thème, avec l'adresse de leur site : un nom et une
 * adresse, jamais une note d'accès (porte de la fiche). Seulement la fiche
 * publiée ; aucune lecture Notion. 404 hors de l'espace réorganisé.
 */
export default async function Sources({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const lue = espace ? await ficheDeLEspace({ registre: accès.organisationId }) : null
  const familles = lue?.fiche ? vueDesSources(lue.grille, lue.fiche) : []
  const total = familles.reduce((n, f) => n + f.sources.length, 0)

  return (
    <>
      <EntêteÉcran surtitre="votre veille" titre="Où nous regardons" état={lue?.fiche ? `${total} source${total > 1 ? 's' : ''}` : undefined} />
      {!lue ? (
        <p className="mt-6 text-ardoise">Les sources de votre veille ne peuvent pas être affichées pour l’instant. Réessayez dans quelques minutes.</p>
      ) : !lue.fiche ? (
        <PasEncorePubliée quoi="La liste des sources" />
      ) : (
        <>
          <p className="mt-6 max-w-[68ch] text-ardoise">Les sources que votre veille ouvre, thème par thème. Une lettre cite toujours la sienne ; celles-ci sont celles que nous regardons, qu’elles aient parlé ou non.</p>
          {VEILLES_AFFICHÉES.map(({ veille, titre }) => {
            const siennes = familles.filter((f) => f.veille === veille)
            return siennes.length === 0 ? null : (
              <section key={veille} className="mt-8 flex flex-col gap-4">
                <h2 className="font-titre text-h2 font-bold text-encre">{titre}</h2>
                <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
                  {siennes.map((f) => (
                    <section key={`${f.veille}-${f.numéro}`} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-6">
                      <h3 className="text-encre">
                        <span className="mr-2 font-mono text-label font-medium text-ardoise">{f.numéro}</span>
                        {f.nom}
                      </h3>
                      <ul className="flex flex-col gap-2">
                        {f.sources.map((s) => (
                          <li key={`${s.nom}-${s.site ?? ''}`} className="flex gap-3">
                            <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 bg-ardoise" />
                            {s.site ? (
                              <a href={s.site} target="_blank" rel="noopener noreferrer" className="text-encre underline decoration-gris-ligne underline-offset-2 hover:decoration-encre">
                                {s.nom}
                              </a>
                            ) : (
                              <span className="text-encre">{s.nom}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}
      <p className="mt-12">
        <LienFlèche href={`/${accès.slug}/veille/themes`}>Voir les thèmes de votre veille</LienFlèche>
      </p>
    </>
  )
}
