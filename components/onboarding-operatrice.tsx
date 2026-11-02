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
import { envoyerLesLettres, ouvrirLEspaceDepuisLOnboarding } from '@/lib/portail/gestion-actions'
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
  const tâche = run.tâche === 'premiere_lettre' ? 'premiere-lettre' : run.tâche === 'onboarding' ? 'onboarding (moteur)' : run.consigne === 'activation' ? 'balayage (activation)' : 'balayage'
  return `${tâche}, ${LIBELLÉS_DES_RUNS[run.montré]}`
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
                ) : run.runTrigger ? (
                  <span className="label-mono text-ardoise select-all" title="Run Trigger.dev">
                    {run.runTrigger}
                  </span>
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
/** Les issues de l'ouverture de l'espace (lot 4), renvoyées par `ouvrirLEspaceDepuisLOnboarding`. */
type IssueDeLOuverture = 'espace-ouvert' | 'ouverture-partielle' | 'notion-fait-foi' | 'sans-registre' | 'sans-lecteur' | 'débit' | 'lien-non-envoyé' | 'ouverture-lancée'

/** Les issues de « Envoyer les lettres » (lot 6), renvoyées par `envoyerLesLettres`. */
type IssueDeLEnvoi =
  | 'lettres-envoyées'
  | 'lettres-envoyées-en-partie'
  | 'lettres-envoyées-sans-publication'
  | 'lettres-non-conformes'
  | 'lettres-non-envoyées'
  | 'sans-lettre'
  | 'sans-destinataire'

export const MESSAGES_DE_LANCEMENT: Readonly<Record<IssueDuLancement | IssueDeLOuverture | IssueDeLEnvoi | 'échec' | 'enregistree', string>> = {
  'ouverture-lancée': 'Activation lancée : la tâche active la veille (statut 6) et la ligne « Accès » ; le lien d’accès part du portail à la fin du run, à chaque lecteur actif.',
  'lettres-envoyées': 'Lettres envoyées par le portail à chaque lecteur actif ; la tâche de publication les passe au statut « Envoyé » dans Notion, en général sous quelques minutes.',
  'lettres-envoyées-en-partie': 'Lettres envoyées en partie : une lettre non conforme au lint, ou un lecteur non joint, est resté de côté. Voir le journal des courriers de la fiche ; la publication ne porte que sur les lettres parties à tous.',
  'lettres-envoyées-sans-publication': 'Lettres envoyées, mais la tâche de publication n’a pas pu être lancée (jeton GitHub absent ou refusé) : les passer au statut « Envoyé » dans Notion, ou relancer la réconciliation sur cette organisation.',
  'lettres-non-conformes': 'Aucune lettre envoyée : aucune ne passe le lint du portail. La corriger dans Notion, puis recommencer.',
  'lettres-non-envoyées': 'Aucune lettre n’est partie : voir le journal des courriers de la fiche, puis recommencer (rien ne part deux fois).',
  'sans-lettre': 'Aucune lettre à envoyer : toutes les lettres de l’organisation sont déjà publiées.',
  'sans-destinataire': 'Aucun lecteur actif à qui envoyer les lettres : la première lettre active la ligne « Accès » ; vérifier la section Lecteurs de la fiche.',
  'espace-ouvert': 'Espace ouvert : le lien d’accès est parti à chaque lecteur actif.',
  'ouverture-partielle': 'Espace ouvert en partie : le lien n’est pas parti à tous les lecteurs actifs. Voir le journal des courriers de la fiche, puis renvoyer le lien depuis la section Lecteurs.',
  'notion-fait-foi': 'Notion fait foi pour les accès (SOURCE_ACCES n’est pas postgres) : l’espace s’ouvre par /onboarding-ouvrir-espace.',
  'sans-registre': 'L’organisation n’a pas d’identifiant de registre dans le portail : aucun lecteur ne pourrait entrer. Rejouer l’entrée en essai avec le registre.',
  'sans-lecteur': 'Aucun lecteur actif : inscrire le lecteur final dans la section Lecteurs de la fiche, le lien part à l’inscription.',
  débit: 'Lien refusé par la limitation de débit : réessayer dans dix minutes.',
  'lien-non-envoyé': 'Le lien n’est parti à aucun lecteur : voir le journal des courriers de la fiche.',
  lancé: 'Run déclenché. Il apparaît « en cours » dès que la tâche démarre, en général sous deux minutes.',
  indisponible: 'Déclenchement indisponible : GITHUB_JETON_ACTIONS (tâches GitHub) ou TRIGGER_SECRET_KEY (moteur, après la bascule Payload) n’est pas posée.',
  inconnu: 'Onboarding inconnu.',
  'geste-périmé': 'L’étape a changé depuis l’affichage de la page : rien n’a été lancé. Relire l’étape avant de recommencer.',
  'en-cours': 'Un run est déjà en cours pour cet onboarding : rien n’a été lancé.',
  cowork: 'Onboarding confié à Cowork : il se lance par les commandes /onboarding-* dans Claude Code, pas depuis le portail.',
  'budget-atteint': 'Budget du mois atteint (ONBOARDING_BUDGET_MENSUEL_USD) : le plafond de ce run ne tient pas dans ce qui reste. Rien n’a été lancé.',
  enregistree: 'Demande enregistrée. Rien n’est parti : le lancement se fait d’ici, quand la demande est prête.',
  'hors-registre': 'L’organisation n’est pas au registre Payload sous ce slug : la créer dans /admin (ou par le formulaire de demande), puis relancer.',
  'échec-moteur': 'Trigger.dev n’a pas accepté le run : rien n’a tourné. Vérifier TRIGGER_SECRET_KEY et le projet Trigger.dev, puis recommencer.',
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
export function GesteDOnboarding({
  vue,
  retour,
  disponible,
  ouverture = false,
}: {
  vue: VueDOnboarding
  retour: 'liste' | 'fiche'
  disponible: boolean
  /** Vrai quand Postgres fait foi pour les accès (`lecteursModifiables`) : le portail ouvre l'espace lui-même (lot 4). */
  ouverture?: boolean
}) {
  const g = vue.geste
  const o = vue.onboarding
  if (g.sorte === 'envoyer') {
    return (
      <form action={envoyerLesLettres} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="slug" value={o.slug} />
        <input type="hidden" name="retour" value={retour} />
        <BoutonEnvoi className="rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc">{g.libellé}</BoutonEnvoi>
        <span className="label-mono text-ardoise">après lecture dans l’espace · lecteurs actifs, puis statut « Envoyé »</span>
      </form>
    )
  }
  if (g.sorte === 'ouvrir' && g.activation) {
    if (!disponible) {
      return (
        <p className="text-ardoise">
          Déclenchement indisponible (GITHUB_JETON_ACTIONS absente). À la main : GitHub Actions, « Tâches planifiées (API Claude) », « Run workflow »,
          tâche <span className="font-mono text-encre">balayage</span>, organisation <span className="font-mono text-encre select-all">{o.slug}</span>, consigne{' '}
          <span className="font-mono text-encre select-all">activation</span>.
        </p>
      )
    }
    return (
      <form action={ouvrirLEspaceDepuisLOnboarding} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="slug" value={o.slug} />
        <input type="hidden" name="retour" value={retour} />
        <BoutonEnvoi className="rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc">{g.libellé}</BoutonEnvoi>
        <span className="label-mono text-ardoise">balayage · plafond {formaterDollars(PLAFONDS_DES_TÂCHES.balayage)} · lien d’accès à la fin du run</span>
      </form>
    )
  }
  if (g.sorte === 'ouvrir') {
    if (!ouverture) return <p className="text-ardoise">Première lettre publiée : l’espace s’ouvre par /onboarding-ouvrir-espace {o.nom ?? o.slug}, tant que Notion fait foi pour les accès.</p>
    if (o.lecteursActifs === 0) {
      return (
        <p className="text-ardoise">
          Première lettre publiée, aucun lecteur actif : inscrire le lecteur final dans la section{' '}
          <a href={`/espaces/abonnements/${o.slug}#lecteurs`} className="text-encre underline underline-offset-2">
            Lecteurs
          </a>{' '}
          de la fiche ; le lien part à l’inscription.
        </p>
      )
    }
    return (
      <form action={ouvrirLEspaceDepuisLOnboarding} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="slug" value={o.slug} />
        <input type="hidden" name="retour" value={retour} />
        <BoutonEnvoi className="rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc">{g.libellé}</BoutonEnvoi>
        <span className="label-mono text-ardoise">
          lien d’accès à {o.lecteursActifs} lecteur{o.lecteursActifs > 1 ? 's' : ''} actif{o.lecteursActifs > 1 ? 's' : ''}
        </span>
      </form>
    )
  }
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
      attente: 'Rien à lancer pour l’instant : la première lettre attend sa publication.',
      terminé: null,
    }
    const texte = textes[g.raison]
    return texte ? <p className="text-ardoise">{texte}</p> : null
  }
  if (!disponible && g.tâche === 'onboarding') {
    return (
      <p className="text-ardoise">
        Déclenchement indisponible (TRIGGER_SECRET_KEY absente) : le moteur Trigger.dev ne peut pas être appelé depuis le portail.
      </p>
    )
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

