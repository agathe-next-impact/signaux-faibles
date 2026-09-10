import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { semainesPubliées } from '@/lib/portail/semaine'

/**
 * Recommandations : l'action de la semaine, et celles des semaines passées.
 *
 * Une seule propriété d'édition porte tout cet écran ; il ne lit aucun corps de
 * note, et tient donc en une requête Notion.
 */
export default async function Recommandations({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const avecAction = semaines
    .map((semaine) => ({
      semaine,
      actions: semaine.éditions
        .map((édition) => ({ veille: édition.veille, action: édition.actionDeLaSemaine }))
        .filter((entrée) => entrée.action.length > 0),
    }))
    .filter((entrée) => entrée.actions.length > 0)

  return (
    <>
      <EntêteÉcran
        surtitre="recommandations"
        titre="Ce que nous suggérons de faire"
        état={`${avecAction.length} semaine${avecAction.length > 1 ? 's' : ''} avec action`}
      />

      {avecAction.length === 0 ? (
        <p className="mt-8 text-ardoise">
          Aucune action n’a encore été proposée. Les veilles d’écosystème n’en portent pas
          toujours.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {avecAction.map(({ semaine, actions }, rang) => (
            <li
              key={semaine.clé}
              className={`flex flex-col gap-3 rounded-carte border p-5 ${
                rang === 0 ? 'border-rose bg-fond-rose' : 'border-gris-ligne bg-blanc'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-titre text-h3 font-semibold text-encre">{semaine.libellé}</h2>
                {rang === 0 ? <span className="label-mono text-rose">cette semaine</span> : null}
              </div>

              {actions.map(({ veille, action }) => (
                <div key={`${veille}-${action}`} className="flex flex-col gap-1">
                  {veille ? <p className="label-mono text-ardoise">{veille}</p> : null}
                  <p className="text-encre">{action}</p>
                </div>
              ))}

              <LienFlèche href={`/${accès.slug}/archives/${semaine.clé}`}>
                Relire cette semaine
              </LienFlèche>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
