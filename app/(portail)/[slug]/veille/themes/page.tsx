import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { Case, EntêteÉcran, Grille, LienFlèche } from '@/components/coquille'
import { vueDesThèmes } from '@/lib/domaine/fiche-veille'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'
import { ficheDeLEspace } from '@/lib/portail/fiche-veille'
import { PasEncorePubliée, VEILLES_AFFICHÉES } from '@/components/votre-veille'

/**
 * Thèmes suivis (lot 6 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : que surveillez-vous pour moi. Une case par famille de la
 * grille, avec sa cadence et son cadre (PESTEL ou Porter) ; ce qu'elle suit et
 * ce qui rend un de ses faits fort viennent de la fiche de veille publiée par
 * l'opératrice. Chaque case mène aux faits de l'axe. Aucune lecture Notion.
 * Seulement pour un espace réorganisé : ailleurs, 404 avant toute lecture.
 */
export default async function ThèmesSuivis({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const lue = espace ? await ficheDeLEspace({ registre: accès.organisationId }) : null
  const thèmes = lue ? vueDesThèmes(lue.grille, lue.fiche) : []

  return (
    <>
      <EntêteÉcran surtitre="votre veille" titre="Ce que nous surveillons pour vous" état={lue ? `${thèmes.length} thèmes` : undefined} />
      {!lue ? (
        <p className="mt-5 text-ardoise">Les thèmes de votre veille ne peuvent pas être affichés pour l’instant. Réessayez dans quelques minutes.</p>
      ) : (
        <>
          {lue.fiche ? (
            <p className="mt-5 max-w-[68ch] text-ardoise">Chaque thème de votre veille, ce qu’il suit et ce qui rend un de ses faits fort. Chaque case ouvre les faits que vos lettres ont relevés pour lui.</p>
          ) : (
            <PasEncorePubliée quoi="Ce que suit chaque thème" />
          )}
          {VEILLES_AFFICHÉES.map(({ veille, titre }) => {
            const siens = thèmes.filter((t) => t.veille === veille)
            return siens.length === 0 ? null : (
              <section key={veille} className="mt-8 flex flex-col gap-4">
                <h2 className="font-titre text-h2 font-bold text-encre">{titre}</h2>
                <Grille étiquette={`Thèmes : ${titre}`} colonnes={2}>
                  {siens.map((t) => (
                    <Case key={`${t.veille}-${t.numéro}`}>
                      <p className="label-mono text-ardoise">
                        {t.numéro} · {t.cadence}
                        {t.cadre ? ` · ${t.cadre}` : ''}
                      </p>
                      <h3 className="font-titre text-h3 font-semibold text-encre">{t.nom}</h3>
                      {t.suit ? (
                        <div className="flex flex-col gap-1">
                          <p className="label-mono text-ardoise">Ce qu’il suit</p>
                          <p className="text-encre">{t.suit}</p>
                        </div>
                      ) : null}
                      {t.fort ? (
                        <div className="flex flex-col gap-1">
                          <p className="label-mono text-ardoise">Un fait est fort quand</p>
                          <p className="text-encre">{t.fort}</p>
                        </div>
                      ) : null}
                      {lue.fiche ? <p className="label-mono text-ardoise">{t.sources} source{t.sources > 1 ? 's' : ''}</p> : null}
                      <div className="mt-auto pt-1">
                        <LienFlèche href={`/${accès.slug}/pestel/${t.segment}`} étendu>
                          Ses faits
                        </LienFlèche>
                      </div>
                    </Case>
                  ))}
                </Grille>
              </section>
            )
          })}
        </>
      )}
      <p className="mt-10">
        <LienFlèche href={`/${accès.slug}/veille/sources`}>Voir les sources de votre veille</LienFlèche>
      </p>
    </>
  )
}
