import { dateLongueDeParis } from '@/lib/domaine/parcours'
import {
  ÉTAPES_D_ONBOARDING,
  formaterDollars,
  LIBELLÉS_DES_ÉTAPES,
  LIBELLÉS_DES_RUNS,
  type Provenance,
} from '@/lib/domaine/onboarding'
import type { RunVuÀLÉcran, VueDOnboarding } from '@/lib/portail/onboarding'

/**
 * Le suivi d'un onboarding, pour l'opératrice (lot 1 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026) : la frise des six
 * étapes et les runs. Lecture seule : aucun geste au lot 1. Communs à
 * `/espaces/onboardings` et à la section « Onboarding » de la fiche.
 *
 * Chaque étape dit d'où le portail la tient : « rapportée » par la tâche,
 * « constatée » dans Postgres, ou « non rapportée » quand une étape plus avancée
 * est connue sans que la tâche ait dit celle-ci (un onboarding Cowork, ou une
 * tâche qui n'a pas encore l'outil). Un carré plein pour ce qui est acquis, vide
 * pour ce qui vient ; le rose ne marque que le blocage.
 */

const PROVENANCES: Readonly<Record<Provenance, string>> = {
  rapportée: 'rapportée',
  constatée: 'constatée',
  'non-rapportée': 'non rapportée',
  'à-venir': 'à venir',
}

const HEURE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' })

export function dateEtHeure(instant: Date): string {
  return HEURE.format(instant)
}

function durée(ms: number | null): string {
  if (ms === null) return 'n.c.'
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

export function libelléDuRun(run: RunVuÀLÉcran): string {
  return `${run.tâche === 'premiere_lettre' ? 'premiere-lettre' : 'balayage'}, ${LIBELLÉS_DES_RUNS[run.montré]}`
}

/** « 3 sur 6 · Référentiels validés », la ligne courte de la liste. */
export function résuméDeLÉtape(vue: VueDOnboarding): string {
  return `${vue.étape.rang + 1} sur ${ÉTAPES_D_ONBOARDING.length} · ${LIBELLÉS_DES_ÉTAPES[vue.étape.étape]}`
}

export function FriseDOnboarding({ vue }: { vue: VueDOnboarding }) {
  return (
    <ol className="flex flex-col gap-2">
      {ÉTAPES_D_ONBOARDING.map((étape, i) => {
        const provenance = vue.étape.provenances[étape]
        const acquise = provenance !== 'à-venir'
        const courante = i === vue.étape.rang
        return (
          <li key={étape} className="flex items-baseline gap-3">
            <span
              aria-hidden="true"
              className={`inline-block size-2 shrink-0 border ${courante && vue.bloqué ? 'border-rose bg-rose' : acquise ? 'border-encre bg-encre' : 'border-gris-ligne bg-blanc'}`}
            />
            <span className={acquise ? 'text-encre' : 'text-ardoise'}>
              {i + 1}. {LIBELLÉS_DES_ÉTAPES[étape]}
            </span>
            <span className="label-mono text-ardoise">{PROVENANCES[provenance]}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function MotifDeBlocage({ vue }: { vue: VueDOnboarding }) {
  if (!vue.bloqué) return null
  const motif = vue.onboarding.motifDeBlocage
  const run = vue.dernierRun
  return (
    <p className="border-l-2 border-rose pl-4 text-encre">
      <span className="label-mono text-rose-texte">bloqué</span>{' '}
      {motif ?? (run ? `dernier run ${LIBELLÉS_DES_RUNS[run.montré]}, sans motif rapporté : voir le compte rendu du job.` : '')}
    </p>
  )
}

export function RunsDOnboarding({ runs }: { runs: readonly RunVuÀLÉcran[] }) {
  if (runs.length === 0) return <p className="text-ardoise">Aucun run rapporté.</p>
  return (
    <div className="overflow-x-auto border border-gris-ligne">
      <table className="w-full border-collapse text-corps">
        <thead>
          <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
            {['début', 'tâche et état', 'durée', 'coût', 'job'].map((entête) => (
              <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                {entête}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gris-ligne last:border-b-0">
              <td className="label-mono px-4 py-3 text-ardoise">{dateEtHeure(run.début ?? run.crééLe)}</td>
              <td className={`px-4 py-3 ${run.montré === 'echec' || run.montré === 'bloque' || run.montré === 'refuse' || run.montré === 'sans_nouvelles' ? 'text-rose-texte' : 'text-encre'}`}>
                {libelléDuRun(run)}
              </td>
              <td className="px-4 py-3 text-ardoise">{durée(run.duréeMs)}</td>
              <td className="px-4 py-3 text-ardoise">
                {run.coûtUsd !== null ? formaterDollars(run.coûtUsd) : run.plafondUsd !== null ? `plafond ${formaterDollars(run.plafondUsd)}` : 'n.c.'}
              </td>
              <td className="px-4 py-3">
                {run.lien ? (
                  <a href={run.lien} target="_blank" rel="noreferrer" className="text-label text-encre underline underline-offset-2">
                    ouvrir
                  </a>
                ) : (
                  <span className="text-ardoise">hors GitHub</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Les faits de l'onboarding en une ligne : registre, dernière nouvelle, coût cumulé. */
export function MétaDOnboarding({ vue }: { vue: VueDOnboarding }) {
  const o = vue.onboarding
  return (
    <p className="label-mono text-ardoise">
      suivi depuis le {dateLongueDeParis(o.crééLe)} · dernière nouvelle {dateEtHeure(o.misÀJourLe)} · {formaterDollars(vue.coûtTotalUsd)} au total
      {o.registreNotion ? (
        <>
          {' · '}
          <a href={`https://www.notion.so/${o.registreNotion}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            ligne du registre
          </a>
        </>
      ) : null}
    </p>
  )
}
