import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche, Tuile } from '@/components/coquille'
import { BadgeImpact } from '@/components/badge-impact'
import { extraitDeFamille, famillesDuDocument } from '@/lib/domaine/document'
import { trierParImpact } from '@/lib/domaine/impact'
import { écart, synthétiser } from '@/lib/domaine/synthese'
import { documentsDeLaSemaine, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Vue d'ensemble : ce que la semaine dit, en un écran.
 *
 * Les chiffres se déduisent des familles des notes de la semaine, jamais d'une
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

  const familles = trierParImpact(documents.flatMap(famillesDuDocument))
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

      <section aria-label="Chiffres de la semaine" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tuile
          intitulé="familles suivies"
          valeur={synthèse.famillesTotal}
          mention={écart(synthèse.famillesTotal, précédente?.famillesTotal ?? null)}
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
      </section>

      {actions.length > 0 ? (
        <section className="mt-6 rounded-carte border border-gris-ligne bg-fond-ardoise p-5">
          <h2 className="label-mono text-ardoise">Action de la semaine</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {actions.map((action) => (
              <li key={action} className="text-encre">
                {action}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">Les familles de la semaine</h2>
          <LienFlèche href={`/${accès.slug}/signaux`}>Lire les notes</LienFlèche>
        </div>

        {familles.length === 0 ? (
          <p className="text-ardoise">Les notes de cette semaine ne portent pas de famille.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {familles.map((famille, rang) => (
              <li
                key={`${famille.titre}-${rang}`}
                className="flex flex-col gap-3 rounded-carte border border-gris-ligne p-4"
              >
                <h3 className="font-titre text-h3 font-semibold text-encre">{famille.titre}</h3>
                {extraitDeFamille(famille) ? (
                  <p className="text-ardoise">{extraitDeFamille(famille)}</p>
                ) : null}
                {/* Badge en pied, comme la carte de la maquette : le titre garde
                    toute la largeur et ne se casse pas en deux. */}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                  <BadgeImpact niveau={famille.niveau} />
                  <LienFlèche href={`/${accès.slug}/signaux`}>Détail</LienFlèche>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
