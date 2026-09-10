import { exigerAccès } from '@/lib/auth/appartenance'
import { Case, EntêteÉcran, Grille, LienFlèche, Panneau, Tuile } from '@/components/coquille'
import { CaseAxe } from '@/components/case-axe'
import { axesDuDocument, slugDAxe } from '@/lib/domaine/document'
import { lireDossiersOuverts } from '@/lib/domaine/dossiers'
import { trierParImpact } from '@/lib/domaine/impact'
import { écart, synthétiser } from '@/lib/domaine/synthese'
import {
  estVeilleConcurrentielle,
  notesDeLaSemaine,
  documentsDeLaSemaine,
  semainesPubliées,
} from '@/lib/portail/semaine'

/**
 * Vue d'ensemble : ce que la semaine dit, en un écran.
 *
 * Les chiffres se déduisent des axes des notes de la semaine, jamais d'une
 * donnée inventée. La comparaison porte sur la semaine précédente, deux
 * lectures de blocs de plus — c'est ce qui fait la valeur d'un tableau de bord,
 * et le cache l'absorbe.
 */
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

  const [notes, documentsPrécédents] = await Promise.all([
    notesDeLaSemaine(courante),
    documentsDeLaSemaine(semaines[1]),
  ])
  const documents = notes.map((note) => note.document)

  // La veille concurrentielle, si l'organisation en a une. Rien n'est relu :
  // c'est la lettre de la semaine, déjà chargée pour les axes.
  const concurrentielle = notes.find((note) => estVeilleConcurrentielle(note.édition.veille))
  const concurrents = lireDossiersOuverts(concurrentielle?.édition.dossiersOuvertsBruts)

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

  const axes = trierParImpact(documents.flatMap(axesDuDocument))
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
            intitulé="à surveiller"
            valeur={synthèse.parNiveau.MOYEN}
            mention={écart(synthèse.parNiveau.MOYEN, précédente?.parNiveau.MOYEN ?? null)}
          />
          <Tuile
            intitulé="dossiers sans mouvement"
            valeur={synthèse.dossiersEnAttente}
            mention={`sur ${synthèse.dossiers.length} suivis`}
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
          <h2 className="font-titre text-h2 font-bold text-encre">Concurrents</h2>
          {concurrentielle ? (
            <LienFlèche href={`/${accès.slug}/lettres/${concurrentielle.édition.pageId}`}>
              Lire la veille concurrentielle
            </LienFlèche>
          ) : null}
        </div>

        {/* Les dossiers de la lettre concurrentielle sont les situations que la
            veille garde ouvertes : un concurrent, un mouvement, et depuis
            combien de semaines il n'a pas bougé. */}
        {!concurrentielle ? (
          <p className="text-ardoise">
            Votre veille ne comprend pas de volet concurrentiel cette semaine.
          </p>
        ) : concurrents.length === 0 ? (
          <p className="text-ardoise">
            Aucun dossier concurrent n’est ouvert cette semaine.
          </p>
        ) : (
          <Grille étiquette="Dossiers concurrents suivis" colonnes={3}>
            {concurrents.map((dossier) => (
              <Case key={dossier.nom} accent={dossier.compteur === 0}>
                <h3 className="font-titre text-h3 font-semibold text-encre">{dossier.nom}</h3>
                {dossier.précision ? (
                  <p className="text-ardoise">{dossier.précision}</p>
                ) : null}
                <p className="mt-auto label-mono text-ardoise pt-1">
                  {dossier.compteur === null
                    ? 'suivi'
                    : dossier.compteur === 0
                      ? 'a bougé cette semaine'
                      : `${dossier.compteur} semaine${dossier.compteur > 1 ? 's' : ''} sans mouvement`}
                </p>
              </Case>
            ))}
          </Grille>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">Les axes de la semaine</h2>
          <LienFlèche href={`/${accès.slug}/lettres`}>Lire les lettres</LienFlèche>
        </div>

        {axes.length === 0 ? (
          <p className="text-ardoise">Les notes de cette semaine ne portent pas d’axe.</p>
        ) : (
          <Grille étiquette="Axes de la semaine">
            {axes.map((axe, rang) => (
              <CaseAxe
                key={`${axe.titre}-${rang}`}
                axe={axe}
                href={`/${accès.slug}/tendances/${slugDAxe(axe.titre)}`}
              />
            ))}
          </Grille>
        )}
      </section>
    </>
  )
}
