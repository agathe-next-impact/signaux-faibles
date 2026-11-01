import { BoutonEnvoi } from '@/components/bouton-envoi'
import { dateLongueDeParis } from '@/lib/domaine/parcours'
import {
  ÉTAPES_D_ONBOARDING,
  formaterDollars,
  LIBELLÉS_DES_ÉTAPES,
  LIBELLÉS_DES_RUNS,
  PLAFONDS_DES_TÂCHES,
  commandeCoworkDeLaDemande,
  type Provenance,
} from '@/lib/domaine/onboarding'
import type { IssueDuLancement, RunVuÀLÉcran, VueDOnboarding } from '@/lib/portail/onboarding'
import { lancerUneÉtapeDOnboarding } from '@/lib/portail/onboarding-actions'

/**
 * Le suivi d'un onboarding, pour l'opératrice (lot 1 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026) : la frise des six
 * étapes, les runs et, depuis le lot 2, le seul geste possible à l'étape.
 * Communs à `/espaces/onboardings` et à la section « Onboarding » de la fiche.
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
                {run.codeHttp !== null ? ` (GitHub ${run.codeHttp})` : ''}
                {run.lancéPar ? <span className="label-mono text-ardoise"> · par {run.lancéPar}</span> : null}
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
      {o.crééPar === 'tache' ? 'suivi depuis le' : `demande enregistrée par ${o.crééPar} le`} {dateLongueDeParis(o.crééLe)}
      {o.demande ? ' · demande gardée jusqu’à la ligne du registre' : ''} · dernière nouvelle {dateEtHeure(o.misÀJourLe)} · {formaterDollars(vue.coûtTotalUsd)} au total
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

// ── Le geste (lot 2, 1er novembre 2026) ──────────────────────────────────────

/** Ce que l'écran dit après un geste, par le code que l'action renvoie dans l'URL. */
export const MESSAGES_DE_LANCEMENT: Readonly<Record<IssueDuLancement | 'échec' | 'enregistree', string>> = {
  lancé: 'Run déclenché dans GitHub Actions. Il apparaît « en cours » dès que le harnais démarre, en général sous deux minutes.',
  indisponible: 'Déclenchement indisponible : GITHUB_JETON_ACTIONS n’est pas posée. Lancer le run à la main dans GitHub Actions.',
  inconnu: 'Onboarding inconnu.',
  'geste-périmé': 'L’étape a changé depuis l’affichage de la page : rien n’a été lancé. Relire l’étape avant de recommencer.',
  'en-cours': 'Un run est déjà en cours pour cet onboarding : rien n’a été lancé.',
  cowork: 'Onboarding confié à Cowork : il se lance par les commandes /onboarding-* dans Claude Code, pas depuis le portail.',
  'budget-atteint': 'Budget du mois atteint (ONBOARDING_BUDGET_MENSUEL_USD) : le plafond de ce run ne tient pas dans ce qui reste. Rien n’a été lancé.',
  enregistree: 'Demande enregistrée. Rien n’est parti : lancer les référentiels quand la demande est prête.',
  'échec-github': 'GitHub a refusé le déclenchement ou n’a pas répondu : rien n’a tourné. Vérifier le jeton (permission « Actions ») et la branche, puis recommencer.',
  échec: 'La base n’a pas répondu : rien n’a été lancé.',
}

export function MessageDeLancement({ code }: { code: string | undefined }) {
  const message = code ? MESSAGES_DE_LANCEMENT[code as keyof typeof MESSAGES_DE_LANCEMENT] : undefined
  if (!message) return null
  return (
    <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
      {message}
    </p>
  )
}

const COMMANDE_COWORK: Readonly<Record<string, string>> = {
  demande: '/onboarding-referentiels',
  referentiels_valides: '/onboarding-premiere-lettre',
}

/**
 * Le seul geste possible, en bouton ; sinon ce qu'il y a à faire ailleurs, en
 * une phrase. Sans jeton GitHub, le bouton est remplacé par la commande à
 * lancer à la main, pour que rien ne se perde.
 */
export function GesteDOnboarding({ vue, retour, disponible }: { vue: VueDOnboarding; retour: 'liste' | 'fiche'; disponible: boolean }) {
  const g = vue.geste
  const o = vue.onboarding
  if (g.sorte === 'aucun' && g.raison === 'cowork' && vue.étape.étape === 'demande' && o.nom) {
    // Une demande Cowork enregistrée dans le portail : la commande toute prête,
    // sans l'adresse du lecteur final, que le portail ne garde pas pour Cowork.
    const commande = commandeCoworkDeLaDemande({ nom: o.nom, site: o.site, objectifs: o.demande?.objectifs ?? null, lecteurFinal: o.demande?.lecteurFinal ?? null })
    return (
      <div className="flex flex-col gap-2">
        <p className="text-ardoise">Onboarding confié à Cowork : lancer dans Claude Code, en ajoutant « · Email du lecteur final : … » si elle est connue.</p>
        <p className="border border-gris-ligne bg-fond-neutre p-4 font-mono text-label text-encre select-all">{commande}</p>
      </div>
    )
  }
  if (g.sorte === 'aucun') {
    const textes: Record<typeof g.raison, string | null> = {
      'en-cours': 'Un run est en cours : attendre sa fin avant tout autre geste.',
      cowork: `Onboarding confié à Cowork${COMMANDE_COWORK[vue.étape.étape] ? ` : lancer ${COMMANDE_COWORK[vue.étape.étape]} ${o.nom ?? o.slug} dans Claude Code` : ''}.`,
      'validation-notion': 'Valider les référentiels dans Notion (statut 3) ; le bouton « Produire la première lettre » apparaît au rapport suivant.',
      attente:
        vue.étape.étape === 'premiere_lettre_publiee'
          ? 'Première lettre publiée : l’espace s’ouvre par /onboarding-ouvrir-espace.'
          : 'Rien à lancer : la relectrice relit et publie la première lettre.',
      terminé: null,
    }
    const texte = textes[g.raison]
    return texte ? <p className="text-ardoise">{texte}</p> : null
  }
  if (!disponible) {
    return (
      <p className="text-ardoise">
        Déclenchement indisponible (GITHUB_JETON_ACTIONS absente). À la main : GitHub Actions, « Tâches planifiées (API Claude) »,
        « Run workflow », tâche <span className="font-mono text-encre">{g.tâche}</span>, organisation{' '}
        <span className="font-mono text-encre select-all">{o.slug}</span>.
      </p>
    )
  }
  return (
    <form action={lancerUneÉtapeDOnboarding} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="slug" value={o.slug} />
      <input type="hidden" name="geste" value={g.geste} />
      <input type="hidden" name="retour" value={retour} />
      <BoutonEnvoi className="rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc">{g.libellé}</BoutonEnvoi>
      <span className="label-mono text-ardoise">
        {g.tâche} · plafond {formaterDollars(PLAFONDS_DES_TÂCHES[g.tâche])}
      </span>
    </form>
  )
}

