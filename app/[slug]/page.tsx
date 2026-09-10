import { exigerAccès } from '@/lib/auth/appartenance'
import { Case, EntêteÉcran, Grille, LienFlèche, Panneau, Tuile } from '@/components/coquille'
import { CaseAxe } from '@/components/case-axe'
import { fusionnerLesAxes, slugDAxe } from '@/lib/domaine/document'
import { ordonnerLesDossiers } from '@/lib/domaine/dossiers'
import { trierParImpact } from '@/lib/domaine/impact'
import { écart, synthétiser } from '@/lib/domaine/synthese'
import { documentsDeLaSemaine, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Vue d'ensemble : ce que la semaine dit, en un écran.
 *
 * Deux angles, et les deux lettres de la semaine réunies dans chacun. La
 * séparation ne se fait pas par lettre — le lecteur n'a pas à savoir laquelle
 * a relevé quoi — mais par nature de ce qui est suivi : des **acteurs**
 * nommés d'un côté, les **axes** de l'écosystème de l'autre.
 *
 * Les chiffres se déduisent des mêmes lectures, jamais d'une donnée inventée.
 * La comparaison porte sur la semaine précédente, deux lectures de blocs de
 * plus — c'est ce qui fait la valeur d'un tableau de bord, et le cache
 * l'absorbe.
 */

/** Au-delà, la page s'allonge sans rien apprendre : le suivi complet est dans les tendances. */
const ACTEURS_EN_ACCUEIL = 6

export default async function VueDEnsemble({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const courante = semaines[0]

  if (!courante) {
    return (
      <>
        <EntêteÉcran surtitre="veille personnalisée" titre="Vue d’ensemble" />
        <p className="mt-8 text-ardoise">
          Dès que la première lettre sera envoyée, elle apparaîtra ici.
        </p>
      </>
    )
  }

  const [documents, documentsPrécédents] = await Promise.all([
    documentsDeLaSemaine(courante),
    documentsDeLaSemaine(semaines[1]),
  ])

  const synthèse = synthétiser(
    documents,
    courante.éditions.map((édition) => édition.dossiersOuvertsBruts),
  )
  const précédente = semaines[1]
    ? synthétiser(
        documentsPrécédents,
        semaines[1].éditions.map((édition) => édition.dossiersOuvertsBruts),
      )
    : null

  // Les deux lettres réunies : un axe ouvert par les deux ne fait qu'une case.
  const axes = trierParImpact(fusionnerLesAxes(documents))
  const acteurs = ordonnerLesDossiers(synthèse.dossiers)

  const actions = courante.éditions
    .map((édition) => édition.actionDeLaSemaine)
    .filter((action) => action.length > 0)

  return (
    <>
      <EntêteÉcran
        surtitre="veille personnalisée"
        titre="Vue d’ensemble"
        état={`à jour · ${courante.libellé}`}
      />

      <div className="mt-6">
        <Grille étiquette="Chiffres de la semaine" colonnes={4}>
          <Tuile
            intitulé="axes suivis"
            valeur={synthèse.axesTotal}
            mention={écart(synthèse.axesTotal, précédente?.axesTotal ?? null)}
          />
          <Tuile
            intitulé="signal fort"
            valeur={synthèse.parNiveau.FORT}
            mention={écart(synthèse.parNiveau.FORT, précédente?.parNiveau.FORT ?? null)}
            accent={synthèse.parNiveau.FORT > 0}
          />
          <Tuile
            intitulé="acteurs suivis"
            valeur={synthèse.dossiers.length}
            mention={écart(synthèse.dossiers.length, précédente?.dossiers.length ?? null)}
          />
          <Tuile
            intitulé="sans mouvement"
            valeur={synthèse.dossiersEnAttente}
            mention={`sur ${synthèse.dossiers.length} acteurs`}
          />
        </Grille>
      </div>

      {actions.length > 0 ? (
        <div className="mt-6">
          <Panneau ton="ardoise">
            <h2 className="label-mono text-ardoise">Action de la semaine</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {actions.map((action) => (
                <li key={action} className="text-encre">
                  {action}
                </li>
              ))}
            </ul>
          </Panneau>
        </div>
      ) : null}

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">Les acteurs</h2>
          <LienFlèche href={`/${accès.slug}/tendances`}>Voir tout le suivi</LienFlèche>
        </div>
        <p className="text-ardoise">
          Les concurrents et les organisations du secteur que vos lettres gardent ouverts,
          de ce qui vient de bouger à ce qui dort.
        </p>

        {acteurs.length === 0 ? (
          <p className="text-ardoise">
            Aucun acteur n’est suivi cette semaine. Les lettres en ouvriront dès qu’un
            mouvement le justifiera.
          </p>
        ) : (
          <Grille étiquette="Acteurs suivis" colonnes={3}>
            {acteurs.slice(0, ACTEURS_EN_ACCUEIL).map((acteur) => (
              // Aucun badge d'impact ici : le fond accentué est donc permis, et
              // signale l'acteur qui vient de bouger.
              <Case key={acteur.nom} accent={acteur.compteur === 0}>
                <h3 className="font-titre text-h3 font-semibold text-encre">{acteur.nom}</h3>
                {acteur.précision ? <p className="text-ardoise">{acteur.précision}</p> : null}
                <p className="mt-auto label-mono pt-1 text-ardoise">
                  {acteur.compteur === null
                    ? 'suivi'
                    : acteur.compteur === 0
                      ? 'a bougé cette semaine'
                      : `${acteur.compteur} semaine${acteur.compteur > 1 ? 's' : ''} sans mouvement`}
                </p>
              </Case>
            ))}
          </Grille>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">L’écosystème</h2>
          <LienFlèche href={`/${accès.slug}/lettres`}>Lire les lettres</LienFlèche>
        </div>
        <p className="text-ardoise">
          Les axes de la semaine, les deux lettres réunies, du signal le plus fort au plus
          calme.
        </p>

        {axes.length === 0 ? (
          <p className="text-ardoise">Les notes de cette semaine ne portent pas d’axe.</p>
        ) : (
          <Grille étiquette="Axes de la semaine">
            {axes.map((axe) => (
              <CaseAxe
                key={axe.titre}
                axe={axe}
                points={axe.points}
                href={`/${accès.slug}/tendances/${slugDAxe(axe.titre)}`}
              />
            ))}
          </Grille>
        )}
      </section>
    </>
  )
}
