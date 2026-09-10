import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran } from '@/components/coquille'
import { suivreLesDossiers } from '@/lib/domaine/tendances'
import { semainesPubliées } from '@/lib/portail/semaine'

/**
 * Tendances : ce qui bouge, et ce qui s'enlise.
 *
 * Le compteur d'un dossier est le nombre de semaines où il a été rouvert sans
 * avoir bougé. Suivi d'une semaine sur l'autre, il dit lesquels dorment.
 *
 * Cet écran ne lit **aucun corps de note** : tout vient de la propriété texte
 * des éditions, donc d'une seule requête Notion, quelle que soit la profondeur
 * de l'archive.
 */
export default async function Tendances({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const suivis = suivreLesDossiers(semaines)

  return (
    <>
      <EntêteÉcran
        surtitre="tendances"
        titre="Ce qui bouge, ce qui dort"
        état={`${semaines.length} semaine${semaines.length > 1 ? 's' : ''} observée${semaines.length > 1 ? 's' : ''}`}
      />

      {suivis.length === 0 ? (
        <p className="mt-8 text-ardoise">
          Aucun dossier n’est suivi pour l’instant. Ils apparaîtront dès que les notes en
          ouvriront.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-gris-ligne">
          {suivis.map((dossier) => (
            <li key={dossier.nom} className="flex flex-col gap-3 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-titre text-h3 font-semibold text-encre">{dossier.nom}</h2>
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

              {/* La ligne de suivi reprend le motif de la charte : un axe, des
                  impulsions. Rose quand le dossier a bougé, ardoise sinon. */}
              <ol className="flex flex-wrap items-end gap-1" aria-label="Suivi semaine par semaine">
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
    </>
  )
}
