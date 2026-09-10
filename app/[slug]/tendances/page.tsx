import { exigerAccès } from '@/lib/auth/appartenance'
import { BadgeImpact } from '@/components/badge-impact'
import { Case, EntêteÉcran, Grille, LienFlèche } from '@/components/coquille'
import { TitreAxe } from '@/components/titre-axe'
import { slugDAxe } from '@/lib/domaine/document'
import { libelléDeMouvement, suivreLesAxes, suivreLesDossiers } from '@/lib/domaine/tendances'
import { documentsDeLaSemaine, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Tendances : où en est chaque axe, et ce qui bouge dans les dossiers.
 *
 * Chaque case de la grille ouvre le suivi de son axe sur les dernières
 * lettres.
 *
 * Deux lectures, deux coûts très différents. La grille des axes demande les
 * corps de la semaine courante et de la précédente — les mêmes que la vue
 * d'ensemble, donc les mêmes entrées de cache, et rien de plus. Le suivi des
 * dossiers, lui, ne lit **aucun corps** : il vient de la propriété texte des
 * éditions, et couvre toute l'archive pour une seule requête.
 */
export default async function Tendances({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const suivis = suivreLesDossiers(semaines)

  const [documents, documentsPrécédents] = await Promise.all([
    documentsDeLaSemaine(semaines[0]),
    documentsDeLaSemaine(semaines[1]),
  ])
  const axes = suivreLesAxes(documents, documentsPrécédents)
  const comparable = semaines.length > 1

  return (
    <>
      <EntêteÉcran
        surtitre="tendances"
        titre="Ce qui bouge, ce qui dort"
        état={`${semaines.length} semaine${semaines.length > 1 ? 's' : ''} observée${semaines.length > 1 ? 's' : ''}`}
      />

      <section className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">Les axes</h2>
          <p className="label-mono text-ardoise">
            {comparable ? 'comparés à la semaine précédente' : 'première semaine observée'}
          </p>
        </div>

        {axes.length === 0 ? (
          <p className="text-ardoise">
            Les notes de cette semaine ne portent pas d’axe. La grille se remplira à la
            prochaine parution.
          </p>
        ) : (
          <Grille étiquette="Axes de la semaine">
            {axes.map((axe) => (
              <Case key={axe.titre} accent={axe.mouvement === 'monté'}>
                <h3 className="font-titre text-h3 font-semibold text-encre">
                  <TitreAxe axe={axe} />
                </h3>
                {/* Sans semaine précédente, tout serait « nouveau » : on se
                    tait plutôt que d'annoncer un mouvement qui n'existe pas. */}
                {comparable ? (
                  <p className="label-mono text-ardoise">{libelléDeMouvement(axe.mouvement)}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                  <BadgeImpact niveau={axe.niveau} />
                  <LienFlèche href={`/${accès.slug}/tendances/${slugDAxe(axe.titre)}`} étendu>
                    Suivre
                  </LienFlèche>
                </div>
              </Case>
            ))}
          </Grille>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Les dossiers suivis</h2>

        {suivis.length === 0 ? (
          <p className="text-ardoise">
            Aucun dossier n’est suivi pour l’instant. Ils apparaîtront dès que les notes en
            ouvriront.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {suivis.map((dossier) => (
              <li key={dossier.nom} className="flex flex-col gap-3 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-titre text-h3 font-semibold text-encre">{dossier.nom}</h3>
                  <p className="label-mono text-ardoise">
                    {dossier.aBougé
                      ? 'a bougé cette semaine'
                      : dossier.semainesSansMouvement === 0
                        ? 'ouvert cette semaine'
                        : `${dossier.semainesSansMouvement} semaine${dossier.semainesSansMouvement > 1 ? 's' : ''} sans mouvement`}
                  </p>
                </div>

                {dossier.précisionActuelle ? (
                  <p className="text-ardoise">{dossier.précisionActuelle}</p>
                ) : null}

                {/* Le suivi reprend le motif de la charte : une ligne, des
                    impulsions. Rose quand le dossier a bougé, ardoise sinon.
                    « Axe » y garde son sens graphique, sans rapport avec les
                    axes thématiques de la grille ci-dessus. */}
                <ol
                  className="flex flex-wrap items-end gap-1"
                  aria-label="Suivi semaine par semaine"
                >
                  {dossier.points.map((point) => {
                    const compteur = point.compteur ?? 0
                    const hauteur = Math.min(4 + compteur * 6, 34)
                    return (
                      <li key={point.semaine} className="flex flex-col items-center gap-1">
                        <span
                          title={`${point.libellé} — ${compteur} semaine(s) sans mouvement`}
                          className={`w-[3px] rounded-full ${compteur === 0 ? 'bg-rose' : 'bg-ardoise'}`}
                          style={{ height: `${hauteur}px` }}
                        />
                      </li>
                    )
                  })}
                  <li className="ml-2 label-mono text-ardoise">
                    {dossier.points.length} relevé{dossier.points.length > 1 ? 's' : ''}
                  </li>
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
