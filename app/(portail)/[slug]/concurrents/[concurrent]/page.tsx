import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { Texte } from '@/components/document'
import { FaitsParMois } from '@/components/graphiques-strategie'
import { mentionsDe } from '@/lib/domaine/mentions'
import { dernièresNotes, LETTRES_SUIVIES, semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, ficheDuConcurrent } from '@/lib/portail/strategie'

/**
 * La fiche d'un concurrent (lot 2 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : ses faits datés mois par mois, en graphique, puis ce que les
 * dernières lettres en disent. Sa position, l'historique de ses crans, la liste
 * des faits, ses chiffres au registre et le lien vers son dossier ont été retirés
 * le 31 octobre 2026, à la demande de l'opératrice.
 *
 * Le concurrent est retrouvé par le segment d'URL **dans la grille de
 * l'organisation de la session** ; un segment inconnu est introuvable. Les
 * passages ne viennent que des lettres déjà listées pour cette organisation (règle 2).
 * Coût Notion : les corps des {@link LETTRES_SUIVIES} dernières lettres, les
 * mêmes entrées de cache que la page d'un axe ou d'un acteur.
 */
export default async function UnConcurrent({ params }: { params: Promise<{ slug: string; concurrent: string }> }) {
  const { slug, concurrent: segment } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const lue = espace ? await ficheDuConcurrent({ registre: accès.organisationId, segment }) : null
  if (lue?.sorte === 'inconnu') notFound()

  const retour = (
    <p className="mt-6">
      <LienFlèche href={`/${accès.slug}/concurrents`}>Retour aux concurrents</LienFlèche>
    </p>
  )
  if (!lue) {
    return (
      <>
        <EntêteÉcran surtitre="concurrent suivi" titre="Fiche indisponible" />
        <p className="mt-6 text-ardoise">Cette fiche ne peut pas être affichée pour l’instant. Réessayez dans quelques minutes.</p>
        {retour}
      </>
    )
  }
  const { fiche } = lue

  const notes = await dernièresNotes(semaines)
  const passages = notes.flatMap(({ lettre, document }) => {
    const mentions = mentionsDe(fiche.nom, document)
    return mentions.length > 0 ? [{ lettre, mentions }] : []
  })

  return (
    <>
      <EntêteÉcran
        surtitre="concurrent suivi"
        titre={fiche.nom}
        état={`${fiche.faits.length} fait${fiche.faits.length > 1 ? 's' : ''} daté${fiche.faits.length > 1 ? 's' : ''}`}
      />
      {retour}

      <div className="mt-8">
        <FaitsParMois faits={fiche.faits} />
      </div>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Ce que les lettres en disent</h2>
        <p className="text-ardoise">Les passages des {LETTRES_SUIVIES} dernières lettres qui le nomment.</p>
        {passages.length === 0 ? (
          <p className="text-ardoise">Aucune des dernières lettres ne le nomme en toutes lettres.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {passages.map(({ lettre, mentions }) => (
              <section key={lettre.édition.pageId} className="flex flex-col gap-3 py-6">
                <p className="label-mono text-ardoise">
                  {lettre.semaine.libellé}
                  {lettre.édition.numéro !== null ? ` · n° ${lettre.édition.numéro}` : ''}
                </p>
                <ul className="flex flex-col gap-2">
                  {mentions.flatMap((m) => m.passages).map((passage) => (
                    <li key={passage.texte} className="flex gap-3">
                      <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 bg-ardoise" />
                      <span className="text-encre">
                        <Texte segments={passage.segments} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p>
                  <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>Lire la lettre</LienFlèche>
                </p>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
