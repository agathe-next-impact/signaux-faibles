import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { RenduBlocs } from '@/components/document'
import { dernièresNotes, LETTRES_SUIVIES, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Cadrage de veille : ce que nous proposons de changer au périmètre.
 *
 * Ces ajustements ne sont pas des faits de la semaine, et c'est pourquoi ils ne
 * figurent plus dans les lettres : mêlés aux signaux, ils se lisaient comme une
 * information de veille alors qu'ils appellent une décision. Ils sont détachés
 * du corps à la construction du document (`construireDocument`), pas masqué à
 * l'affichage — aucun écran ne peut donc les faire réapparaître par mégarde.
 *
 * Coût Notion : les quatre dernières lettres, les mêmes entrées de cache que la
 * page d'un axe.
 */
export default async function Cadrage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const notes = await dernièresNotes(semaines)
  const avecCadrage = notes.filter(({ document }) => document.cadrage.length > 0)

  return (
    <>
      <EntêteÉcran
        surtitre="cadrage de veille"
        titre="Ce que nous proposons d’ajuster"
        état={`${LETTRES_SUIVIES} dernières lettres`}
      />

      <div className="mt-6">
        <Panneau ton="ardoise">
          <p className="text-encre">
            Ces ajustements ne sont appliqués qu’après votre accord. Pour demander vous-même
            une modification du périmètre — ajouter ou retirer un sujet suivi, une source, un
            acteur, un territoire, ou changer ce qui doit compter comme important —
            répondez à la lettre.
          </p>
        </Panneau>
      </div>

      {avecCadrage.length === 0 ? (
        <p className="mt-8 text-ardoise">
          Aucun ajustement n’est proposé dans les dernières lettres. Le périmètre de votre
          veille tient tel qu’il est.
        </p>
      ) : (
        <div className="mt-8 flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
          {avecCadrage.map(({ lettre, document }) => (
            <section key={lettre.édition.pageId} className="flex flex-col gap-4 py-6">
              <div className="flex flex-col gap-1">
                <p className="label-mono text-ardoise">
                  {lettre.édition.veille ?? 'veille'}
                  {lettre.édition.numéro !== null ? ` · n° ${lettre.édition.numéro}` : ''}
                </p>
                <h2 className="font-titre text-h3 font-semibold text-encre">
                  {lettre.semaine.libellé}
                </h2>
              </div>

              <RenduBlocs blocs={document.cadrage} />

              <p>
                <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                  Lire la lettre de cette semaine
                </LienFlèche>
              </p>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
