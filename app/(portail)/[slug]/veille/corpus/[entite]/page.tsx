import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { LIBELLÉS_DES_SORTES } from '@/lib/domaine/fiche-veille'
import { présentationDeLEntité } from '@/lib/portail/fiche-veille'
import { vocabulaireDuMarché } from '@/lib/domaine/sujets-du-marche'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/** Une rubrique de la fiche : un surtitre mono, puis son contenu. */
function Rubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-r border-b border-gris-ligne bg-blanc p-6">
      <p className="label-mono text-ardoise">{titre}</p>
      {children}
    </div>
  )
}

/**
 * La fiche de présentation d'une entité du corpus (6 novembre 2026, demande de
 * l'opératrice) : qui est ce concurrent, cet acteur ou cette partie prenante, et
 * ce que le référentiel en retient. Sa présentation vient de la fiche de veille
 * publiée ; sa place sur la carte et dans Mendelow, des dernières positions
 * publiées. Elle ne lit **aucune lettre** : l'activité d'un concurrent reste sur
 * sa fiche de « Concurrents », vers laquelle elle renvoie. Le segment n'est
 * comparé qu'à la grille de l'organisation de la session ; inconnu, 404. Seulement
 * pour un espace réorganisé : ailleurs, 404 avant toute lecture.
 */
export default async function PrésentationDUneEntité({ params }: { params: Promise<{ slug: string; entite: string }> }) {
  const { slug, entite: segment } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const lue = espace ? await présentationDeLEntité({ registre: accès.organisationId, segment }) : null
  if (lue?.sorte === 'inconnu') notFound()

  const retour = (
    <p className="mt-6">
      <LienFlèche href={`/${accès.slug}/veille/corpus`}>Retour au corpus</LienFlèche>
    </p>
  )
  if (!lue) {
    return (
      <>
        <EntêteÉcran surtitre="votre veille" titre="Fiche indisponible" />
        <p className="mt-6 text-ardoise">Cette fiche ne peut pas être affichée pour l’instant. Réessayez dans quelques minutes.</p>
        {retour}
      </>
    )
  }
  const { fiche } = lue
  const marché = espace?.marché ?? vocabulaireDuMarché(null)

  return (
    <>
      <EntêteÉcran
        surtitre={fiche.sorte === 'concurrent' ? marché.fiche : LIBELLÉS_DES_SORTES[fiche.sorte]}
        titre={fiche.nom}
        état={fiche.partiePrenante && fiche.sorte !== 'partie-prenante' ? 'aussi partie prenante' : undefined}
      />
      {retour}

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Qui c’est</h2>
        {fiche.présentation ? (
          <p className="max-w-[68ch] text-encre">{fiche.présentation}</p>
        ) : (
          <p className="max-w-[68ch] border border-gris-ligne bg-fond-neutre p-4 text-ardoise">
            Sa présentation n’est pas encore publiée. Elle est rédigée à la revue du mois avec la fiche de votre veille, relue, puis publiée ici.
          </p>
        )}
      </section>

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Ce que votre veille en retient</h2>
        <div className="border border-gris-ligne">
          <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2">
            <Rubrique titre="Sa place dans votre veille">
              <p className="text-encre">
                {fiche.sorte === 'concurrent'
                  ? marché.définition
                  : fiche.sorte === 'acteur'
                    ? 'Un acteur de votre environnement : votre veille écosystème le suit nommément.'
                    : 'Une partie prenante : votre veille lit son pouvoir et son intérêt.'}
              </p>
            </Rubrique>
            {fiche.siren ? (
              <Rubrique titre="Au registre">
                <p className="text-encre">SIREN {fiche.siren}</p>
              </Rubrique>
            ) : null}
            {fiche.sorte === 'concurrent' ? (
              <Rubrique titre="Sur la carte des groupes">
                {fiche.variables ? (
                  <>
                    <dl className="flex flex-col gap-1">
                      {fiche.variables.crans.map((c) => (
                        <div key={c.axe} className="flex flex-wrap gap-x-2">
                          <dt className="text-ardoise">{c.axe} :</dt>
                          <dd className="text-encre">{c.libellé}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="label-mono text-ardoise">
                      {fiche.variables.déclaratif ? 'déclaratif · votre veille' : `synthèse ${fiche.variables.libellé}`}
                    </p>
                  </>
                ) : (
                  <p className="text-ardoise">Pas encore placé sur la carte.</p>
                )}
              </Rubrique>
            ) : null}
            {fiche.partiePrenante ? (
              <Rubrique titre="Pouvoir et intérêt">
                {fiche.mendelow ? (
                  <>
                    <dl className="flex flex-col gap-1">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ardoise">Pouvoir :</dt>
                        <dd className="text-encre">{fiche.mendelow.pouvoir}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ardoise">Intérêt :</dt>
                        <dd className="text-encre">{fiche.mendelow.intérêt}</dd>
                      </div>
                    </dl>
                    <p className="label-mono text-ardoise">
                      {fiche.mendelow.déclaratif ? 'déclaratif · votre veille' : `synthèse ${fiche.mendelow.libellé}`}
                    </p>
                  </>
                ) : (
                  <p className="text-ardoise">Pas encore placée dans la matrice.</p>
                )}
              </Rubrique>
            ) : null}
          </div>
        </div>
      </section>

      <p className="mt-12">
        {fiche.sorte === 'concurrent' ? (
          <LienFlèche href={`/${accès.slug}/concurrents/${fiche.segment}`}>Voir son activité dans vos lettres</LienFlèche>
        ) : (
          <LienFlèche href={`/${accès.slug}/acteurs`}>Voir les acteurs</LienFlèche>
        )}
      </p>
    </>
  )
}
