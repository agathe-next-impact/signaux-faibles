import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { PasEncorePubliée } from '@/components/votre-veille'
import { vueDeLAxePrésenté } from '@/lib/domaine/fiche-veille'
import { ficheDeLEspace } from '@/lib/portail/fiche-veille'
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

const dateLongue = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/**
 * La fiche de présentation d'un axe (6 novembre 2026, demande de l'opératrice) :
 * la famille du référentiel qui le définit, son cadre (PESTEL ou Porter), sa
 * cadence, ce qu'il suit et ce qui rend un de ses faits fort, ses sources et ses
 * échéances à venir. La grille et la fiche de veille publiée seulement, par
 * `ficheDeLEspace` : aucune lecture Notion. Ses faits restent sur
 * `/[slug]/pestel/[axe]`, vers lequel elle renvoie. Le segment n'est comparé
 * qu'à la grille ; inconnu, 404. Seulement pour un espace réorganisé : ailleurs,
 * 404 avant toute lecture.
 */
export default async function PrésentationDUnAxe({ params }: { params: Promise<{ slug: string; axe: string }> }) {
  const { slug, axe: segment } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const lue = espace ? await ficheDeLEspace({ registre: accès.organisationId }) : null
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const axe = lue ? vueDeLAxePrésenté(lue.grille, lue.fiche, segment, aujourdhui) : null
  if (lue && !axe) notFound()

  const retour = (
    <p className="mt-6">
      <LienFlèche href={`/${accès.slug}/veille/themes`}>Retour aux thèmes</LienFlèche>
    </p>
  )
  if (!lue || !axe) {
    return (
      <>
        <EntêteÉcran surtitre="votre veille" titre="Fiche indisponible" />
        <p className="mt-6 text-ardoise">Cette fiche ne peut pas être affichée pour l’instant. Réessayez dans quelques minutes.</p>
        {retour}
      </>
    )
  }

  return (
    <>
      <EntêteÉcran surtitre={`axe ${axe.numéro} · ${axe.veilleNommée}`} titre={axe.nom} état={axe.cadence} />
      {retour}

      {!lue.fiche ? <PasEncorePubliée quoi="Ce que suit cet axe" /> : null}

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Ce que suit cet axe</h2>
        <div className="border border-gris-ligne">
          <div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2">
            <Rubrique titre="Ce qu’il suit">
              <p className={axe.suit ? 'text-encre' : 'text-ardoise'}>{axe.suit ?? 'Pas encore publié.'}</p>
            </Rubrique>
            <Rubrique titre="Un fait est fort quand">
              <p className={axe.fort ? 'text-encre' : 'text-ardoise'}>{axe.fort ?? 'Pas encore publié.'}</p>
            </Rubrique>
            <Rubrique titre="Son cadre">
              <p className="text-encre">{axe.cadre ?? 'Non rattaché'}</p>
            </Rubrique>
            <Rubrique titre="Sa cadence">
              <p className="text-encre">{axe.cadence === 'hebdomadaire' ? 'Chaque semaine, dans votre lettre' : 'Chaque mois, à la revue'}</p>
            </Rubrique>
          </div>
        </div>
      </section>

      {lue.fiche ? (
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="font-titre text-h2 font-bold text-encre">Où nous regardons</h2>
          {axe.sourcesNommées.length === 0 ? (
            <p className="text-ardoise">Aucune source nommée pour cet axe.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {axe.sourcesNommées.map((s) => (
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
          )}
        </section>
      ) : null}

      {lue.fiche ? (
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="font-titre text-h2 font-bold text-encre">Ce que nous attendons</h2>
          {axe.échéances.length === 0 ? (
            <p className="text-ardoise">Aucune échéance à venir pour cet axe.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {axe.échéances.map((é) => (
                <li key={`${é.date}-${é.libellé}`} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="label-mono text-ocre-texte">{dateLongue(é.date)}</span>
                  <span className="text-encre">{é.libellé}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className="mt-12">
        <LienFlèche href={`/${accès.slug}/pestel/${axe.segment}`}>Voir ses faits dans vos lettres</LienFlèche>
      </p>
    </>
  )
}
