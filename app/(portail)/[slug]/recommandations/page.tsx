import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { Case, EntêteÉcran, Grille, LienFlèche } from '@/components/coquille'
import { semainesPubliées } from '@/lib/portail/semaine'
import { synthèseDeLEspace } from '@/lib/portail/strategie'
import { LectureDuTrimestre, SynthèseDesRecommandations } from '@/components/strategie-ecrans'

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
  const accès = await exigerLectureComplète(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const avecAction = semaines
    .map((semaine) => ({
      semaine,
      actions: semaine.éditions
        .map((édition) => ({ veille: édition.veille, action: édition.actionDeLaSemaine }))
        .filter((entrée) => entrée.action.length > 0),
    }))
    .filter((entrée) => entrée.actions.length > 0)
  // Pilote des outils stratégiques (lot 11) : l'option retenue, la TOWS, la SWOT
  // et la lecture du trimestre, de la dernière synthèse publiée. Hors du pilote
  // ou sans synthèse publiée, l'écran reste celui d'avant.
  const numéros = new Map(semaines.flatMap((s) => s.éditions).flatMap((é) => (é.numéro !== null ? [[é.pageId, é.numéro] as const] : [])))
  const synthèse = await synthèseDeLEspace({ registre: accès.organisationId, numéros })

  return (
    <>
      <EntêteÉcran
        surtitre="recommandations"
        titre="Ce que nous suggérons de faire"
        état={`${avecAction.length} semaine${avecAction.length > 1 ? 's' : ''} avec action`}
      />

      {synthèse?.mois ? <SynthèseDesRecommandations période={synthèse.mois.période} swot={synthèse.mois.swot} tows={synthèse.mois.tows} /> : null}
      {synthèse?.trimestre ? (
        <LectureDuTrimestre période={synthèse.trimestre.période} forces={synthèse.trimestre.forces} scénarios={synthèse.trimestre.scénarios} />
      ) : null}
      {synthèse ? <h2 className="mt-10 font-titre text-h2 font-bold text-encre">Les actions de vos lettres</h2> : null}

      {avecAction.length === 0 ? (
        <p className="mt-8 text-ardoise">
          Aucune action n’a encore été proposée. Les veilles d’écosystème n’en portent pas
          toujours.
        </p>
      ) : (
        <div className="mt-8">
          <Grille étiquette="Actions proposées" colonnes={2}>
            {avecAction.map(({ semaine, actions }, rang) => (
              // La semaine en cours est la seule accentuée : le fond rose
              // signale l'actualité, il ne hiérarchise pas les autres.
              <Case key={semaine.clé} accent={rang === 0}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-titre text-h3 font-semibold text-encre">
                    {semaine.libellé}
                  </h2>
                  {/* En encre et non en rose : le fond de la case est déjà
                      rose, et rose sur rose est le contraste que la charte
                      signale elle-même comme limite. */}
                  {rang === 0 ? (
                    <span className="label-mono text-encre">cette semaine</span>
                  ) : null}
                </div>

                {actions.map(({ veille, action }) => (
                  <div key={`${veille}-${action}`} className="flex flex-col gap-1">
                    {veille ? <p className="label-mono text-ardoise">{veille}</p> : null}
                    <p className="text-encre">{action}</p>
                  </div>
                ))}

                <div className="mt-auto pt-1">
                  <LienFlèche href={`/${accès.slug}/archives/${semaine.clé}`} étendu>
                    Relire cette semaine
                  </LienFlèche>
                </div>
              </Case>
            ))}
          </Grille>
        </div>
      )}
    </>
  )
}
