import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { RenduBlocs } from '@/components/document'
import { dernièresNotes, LETTRES_SUIVIES, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Le périmètre de la veille : ce que nous suivons, et ce que nous proposons d'y
 * changer.
 *
 * Deux sections des lettres y sont réunies, et elles le sont parce qu'elles
 * répondent à la même question. « Les acteurs que nous suivons pour vous »
 * décrit le corpus lui-même — combien d'entités, lesquelles ont produit un fait
 * daté, où en est chaque dossier, quels trous de couverture subsistent. « Les
 * ajustements du cadrage » proposent d'en modifier le contour. Ni l'une ni
 * l'autre ne raconte la semaine ; séparées, la première se lisait comme de
 * l'information de veille et la seconde vivait seule sur un écran nommé
 * « Cadrage », qui ne disait pas ce qu'il portait.
 *
 * Elles sont détachées du corps à la construction du document
 * (`construireDocument`), pas masquées à l'affichage : aucun écran ne peut donc
 * les faire réapparaître dans une lettre par mégarde.
 *
 * **À ne pas confondre avec l'écran « Acteurs »**, qui suit les dossiers un par
 * un, semaine après semaine, et ne lit aucun corps de note. Ici, on lit les
 * quatre dernières lettres — les mêmes entrées de cache que la page d'un axe.
 * Les deux écrans renvoient l'un vers l'autre en pied.
 */
export default async function Périmètre({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const notes = await dernièresNotes(semaines)
  const avecActeurs = notes.filter(({ document }) => document.acteursSuivis.length > 0)
  const avecCadrage = notes.filter(({ document }) => document.cadrage.length > 0)

  return (
    <>
      <EntêteÉcran
        surtitre="périmètre de la veille"
        titre="Ce que nous suivons pour vous"
        état={`${LETTRES_SUIVIES} dernières lettres`}
      />

      <p className="mt-5 text-ardoise">
        Ce que votre veille surveille, et ce que nous proposons d’y changer. Deux questions
        de périmètre, tenues à l’écart des faits de la semaine.
      </p>

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">Les acteurs que nous suivons</h2>
          <LienFlèche href={`/${accès.slug}/acteurs`}>Voir le suivi dossier par dossier</LienFlèche>
        </div>

        {avecActeurs.length === 0 ? (
          <p className="text-ardoise">
            Les dernières lettres ne décrivent pas le corpus suivi. Le suivi des dossiers
            ouverts, lui, reste tenu à jour semaine après semaine.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {avecActeurs.map(({ lettre, document }) => (
              <section key={lettre.édition.pageId} className="flex flex-col gap-4 py-6">
                <EnTêteDeLettre
                  veille={lettre.édition.veille}
                  numéro={lettre.édition.numéro}
                  semaine={lettre.semaine.libellé}
                />

                <RenduBlocs blocs={document.acteursSuivis} />

                <p>
                  <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                    Lire la lettre de cette semaine
                  </LienFlèche>
                </p>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">
          Ce que nous proposons d’ajuster
        </h2>

        <Panneau ton="ardoise">
          <p className="text-encre">
            Ces ajustements ne sont appliqués qu’après votre accord. Pour demander vous-même
            une modification du périmètre — ajouter ou retirer un sujet suivi, une source, un
            acteur, un territoire, ou changer ce qui doit compter comme important —
            répondez à la lettre.
          </p>
        </Panneau>

        {avecCadrage.length === 0 ? (
          <p className="text-ardoise">
            Aucun ajustement n’est proposé dans les dernières lettres. Le périmètre de votre
            veille tient tel qu’il est.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {avecCadrage.map(({ lettre, document }) => (
              <section key={lettre.édition.pageId} className="flex flex-col gap-4 py-6">
                <EnTêteDeLettre
                  veille={lettre.édition.veille}
                  numéro={lettre.édition.numéro}
                  semaine={lettre.semaine.libellé}
                />

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
      </section>

      <p className="mt-8">
        <LienFlèche href={`/${accès.slug}/acteurs`}>Voir le suivi des acteurs</LienFlèche>
      </p>
    </>
  )
}

/** La provenance d'un extrait : la veille, son numéro, la semaine. */
function EnTêteDeLettre({
  veille,
  numéro,
  semaine,
}: {
  veille: string | null
  numéro: number | null
  semaine: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="label-mono text-ardoise">
        {veille ?? 'veille'}
        {numéro !== null ? ` · n° ${numéro}` : ''}
      </p>
      <h3 className="font-titre text-h3 font-semibold text-encre">{semaine}</h3>
    </div>
  )
}
