import Link from 'next/link'
import { Grille, Tuile } from '@/components/coquille'
import { aRéussi, dollars, duréeLisible, libelléDeTâche, libelléDuMois, moisVoisins, organisationsDuRun, type RunMesuré, type TotauxDuMois } from '@/lib/domaine/couts'

/**
 * Le coût des tâches d'un mois (16 novembre 2026, `/espaces/couts`) : le total,
 * puis par tâche, par organisation, et run par run. Aucune lecture ici : la
 * page, derrière sa garde, passe ce qu'elle a lu.
 */

const formatDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'medium', timeStyle: 'short' })

const cellule = 'px-4 py-3'
const chiffre = 'label-mono whitespace-nowrap px-4 py-3 text-right text-ardoise'

function Tableau({ étiquette, entêtes, children }: { étiquette: string; entêtes: readonly { nom: string; droite?: boolean }[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border border-gris-ligne">
      <table className="w-full border-collapse text-corps" aria-label={étiquette}>
        <thead>
          <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
            {entêtes.map((entête) => (
              <th key={entête.nom} scope="col" className={`label-mono px-4 py-3 font-normal text-ardoise ${entête.droite ? 'text-right' : ''}`}>
                {entête.nom}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Le mois affiché, et les liens vers ses voisins ; jamais au-delà du mois en cours. */
export function ChoixDuMois({ mois, moisEnCours }: { mois: string; moisEnCours: string }) {
  const { précédent, suivant } = moisVoisins(mois)
  return (
    <nav aria-label="Mois" className="flex flex-wrap items-center gap-4">
      <Link href={`/espaces/couts?mois=${précédent}`} className="text-encre underline underline-offset-2">
        {libelléDuMois(précédent)}
      </Link>
      <span className="label-mono text-ardoise" aria-current="page">
        {libelléDuMois(mois)}
      </span>
      {suivant <= moisEnCours ? (
        <Link href={`/espaces/couts?mois=${suivant}`} className="text-encre underline underline-offset-2">
          {libelléDuMois(suivant)}
        </Link>
      ) : null}
    </nav>
  )
}

export function TotauxDesCoûts({ totaux }: { totaux: TotauxDuMois }) {
  return (
    <Grille étiquette="Totaux du mois" colonnes={4}>
      <Tuile intitulé="coût du mois" valeur={dollars(totaux.coûtUsd)} />
      <Tuile intitulé="runs" valeur={totaux.runs} mention={totaux.échecs > 0 ? `${totaux.échecs} sans réussite` : 'tous réussis'} accent={totaux.échecs > 0} />
      <Tuile intitulé="réparti à parts égales" valeur={dollars(totaux.répartiUsd)} mention="runs à plusieurs organisations" />
      <Tuile intitulé="non attribué" valeur={dollars(totaux.nonAttribuéUsd)} mention="runs sans organisation" />
    </Grille>
  )
}

export function CoûtsParTâche({ totaux }: { totaux: TotauxDuMois }) {
  return (
    <Tableau
      étiquette="Coût par tâche"
      entêtes={[{ nom: 'tâche' }, { nom: 'runs', droite: true }, { nom: 'sans réussite', droite: true }, { nom: 'durée', droite: true }, { nom: 'plafonds cumulés', droite: true }, { nom: 'coût', droite: true }, { nom: 'part', droite: true }]}
    >
      {totaux.parTâche.map((t) => (
        <tr key={t.tâche} className="border-b border-gris-ligne align-top">
          <td className={`${cellule} text-encre`}>{libelléDeTâche(t.tâche)}</td>
          <td className={chiffre}>{t.runs}</td>
          <td className={`${chiffre} ${t.échecs > 0 ? 'text-rose-texte' : ''}`}>{t.échecs}</td>
          <td className={chiffre}>{duréeLisible(t.duréeMs)}</td>
          <td className={chiffre}>{t.plafondUsd > 0 ? dollars(t.plafondUsd) : '·'}</td>
          <td className={`${chiffre} text-encre`}>{dollars(t.coûtUsd)}</td>
          <td className={chiffre}>{totaux.coûtUsd > 0 ? `${Math.round((t.coûtUsd / totaux.coûtUsd) * 100)} %` : '·'}</td>
        </tr>
      ))}
    </Tableau>
  )
}

export function CoûtsParOrganisation({ totaux, noms }: { totaux: TotauxDuMois; noms: Readonly<Record<string, string>> }) {
  if (totaux.parOrganisation.length === 0) return <p className="text-ardoise">Aucun run de ce mois ne nomme une organisation.</p>
  return (
    <Tableau
      étiquette="Coût par organisation"
      entêtes={[{ nom: 'organisation' }, { nom: 'runs', droite: true }, { nom: 'imputé en entier', droite: true }, { nom: 'part estimée', droite: true }, { nom: 'coût', droite: true }]}
    >
      {totaux.parOrganisation.map((o) => (
        <tr key={o.slug} className="border-b border-gris-ligne align-top">
          <td className={cellule}>
            {noms[o.slug] ? (
              <>
                <Link href={`/espaces/abonnements/${o.slug}`} className="text-encre underline underline-offset-2">
                  {noms[o.slug]}
                </Link>
                <p className="label-mono text-ardoise">{o.slug}</p>
              </>
            ) : (
              <>
                <p className="text-encre">{o.slug}</p>
                <p className="label-mono text-ardoise">pas encore dans le portail</p>
              </>
            )}
          </td>
          <td className={chiffre}>{o.runs}</td>
          <td className={chiffre}>{o.exactUsd > 0 ? dollars(o.exactUsd) : '·'}</td>
          <td className={chiffre}>{o.estiméUsd > 0 ? dollars(o.estiméUsd) : '·'}</td>
          <td className={`${chiffre} text-encre`}>{dollars(o.coûtUsd)}</td>
        </tr>
      ))}
    </Tableau>
  )
}

export function RunsDuMois({ runs }: { runs: readonly RunMesuré[] }) {
  return (
    <Tableau
      étiquette="Runs du mois"
      entêtes={[{ nom: 'début' }, { nom: 'tâche' }, { nom: 'organisations' }, { nom: 'issue' }, { nom: 'durée', droite: true }, { nom: 'plafond', droite: true }, { nom: 'coût', droite: true }]}
    >
      {runs.map((run, i) => {
        const slugs = organisationsDuRun(run)
        return (
          <tr key={`${run.mesuréLe.toISOString()}:${run.runGithub ?? i}`} className="border-b border-gris-ligne align-top">
            <td className="label-mono whitespace-nowrap px-4 py-3 text-ardoise">
              {run.lien ? (
                <a href={run.lien} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {formatDate.format(run.mesuréLe)}
                </a>
              ) : (
                formatDate.format(run.mesuréLe)
              )}
            </td>
            <td className={`${cellule} text-encre`}>{libelléDeTâche(run.tâche)}</td>
            <td className="label-mono px-4 py-3 text-ardoise">{slugs.length === 0 ? '·' : slugs.length > 4 ? `${slugs.slice(0, 4).join(', ')} et ${slugs.length - 4} de plus` : slugs.join(', ')}</td>
            <td className={`label-mono px-4 py-3 ${aRéussi(run) ? 'text-ardoise' : 'text-rose-texte'}`}>{aRéussi(run) ? 'réussi' : run.issue}</td>
            <td className={chiffre}>{duréeLisible(run.duréeMs)}</td>
            <td className={chiffre}>{run.plafondUsd !== null ? dollars(run.plafondUsd) : '·'}</td>
            <td className={`${chiffre} text-encre`}>{dollars(run.coûtUsd)}</td>
          </tr>
        )
      })}
    </Tableau>
  )
}
