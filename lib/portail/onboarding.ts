import { sourceDocuments } from '@/lib/documents/source'
import { déclencherLOnboarding, déclencheurConfiguré } from '@/lib/moteur/declencher'
import { cléDeCloisonnement, ouvrirDansLePortail } from '@/lib/payload/portail'
import {
  assurerUnOnboarding,
  conclureUnLancement,
  conclureUnRunDOnboarding,
  demandeÀTransmettre,
  effacerLesDemandesAnciennes,
  enregistrerUneDemande,
  onboardingDUnSlug,
  onboardingsPourLeContrôle,
  ouvrirUnRunDOnboarding,
  réserverUnLancement,
  rapporterUnOnboarding,
  type DemandeÀTransmettre,
  type EnregistrementDeDemande,
  type OnboardingLu,
  type OuvertureDeRun,
  type RunLu,
  type TâcheDOnboarding,
} from '@/lib/base/onboardings'
import { configurationGithub, déclencherLeWorkflow } from '@/lib/github/workflow'
import type { Défaut } from '@/lib/portail/etat'
import {
  alertesDUnOnboarding,
  contrôlerLaDemande,
  type ChampDeLaDemande,
  débutDuMoisDeParis,
  gesteDisponible,
  PLAFONDS_DES_TÂCHES,
  type Geste,
  type GesteDisponible,
  type Moteur,
  déciderDuBudget,
  dépenseDuMois,
  estBloqué,
  estClos,
  étapeDeLOnboarding,
  étatMontré,
  lireLeBudget,
  moisDeParis,
  type DécisionDeBudget,
  type ÉtapeCalculée,
  type ÉtatDeRun,
} from '@/lib/domaine/onboarding'

/**
 * L'orchestration du suivi des onboardings (lot 1 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026). Seule entrée
 * d'écriture de `lib/base/onboardings.ts`, appelée par la seule route
 * `POST /api/veille/onboardings`, derrière le jeton du dispositif.
 *
 * Le portail ne lance rien au lot 1 : il reçoit ce que le harnais des tâches
 * (`scripts/taches/executer.ts`) rapporte au début et à la fin d'un run
 * `balayage` ou `premiere-lettre` sur une organisation, et ce que la tâche
 * rapporte du registre par l'outil `rapporter_onboarding`. Au début, il décide
 * du budget du mois (décision 5 du 1er novembre 2026) : un refus arrête le run
 * avant que la session ne s'ouvre, donc avant toute dépense.
 */

/**
 * Le budget mensuel des onboardings. Variable facultative : absente ou vide,
 * rien n'est bloqué. Lue à chaque appel, pour qu'un changement dans Vercel
 * prenne effet au déploiement suivant sans autre geste.
 */
export function budgetDesOnboardings(): number | null {
  const lu = lireLeBudget(process.env['ONBOARDING_BUDGET_MENSUEL_USD'])
  if (lu.illisible) console.warn('[onboarding] ONBOARDING_BUDGET_MENSUEL_USD illisible : aucun blocage appliqué.')
  return lu.budgetUsd
}

export const TÂCHES_SUIVIES: Readonly<Record<string, TâcheDOnboarding>> = {
  balayage: 'balayage',
  'premiere-lettre': 'premiere_lettre',
  onboarding: 'onboarding',
}

/**
 * Le moteur des onboardings (lot 5) : les tâches GitHub tant que Notion porte
 * les documents, le moteur Trigger.dev après la bascule `SOURCE_DOCUMENTS=payload`.
 * Lu à chaque appel, comme l'aiguillage des documents dont il dépend.
 */
export function moteurDesOnboardings(): Moteur {
  return sourceDocuments() === 'payload' ? 'trigger' : 'github'
}

export async function recevoirUnDébut(
  entrée: {
    readonly slug: string
    readonly tâche: TâcheDOnboarding
    readonly runGithub: number | null
    readonly tentative: number | null
    readonly lien: string | null
    readonly plafondUsd: number
    readonly lancement?: string | null
    readonly runTrigger?: string | null
  },
  maintenant: Date = new Date(),
): Promise<OuvertureDeRun & { readonly demande: DemandeÀTransmettre | null }> {
  const ouverture = await ouvrirUnRunDOnboarding({ ...entrée, budgetUsd: budgetDesOnboardings(), débutDuMois: débutDuMoisDeParis(maintenant), maintenant })
  // La demande du formulaire (lot 3) part avec le début, tant que la ligne du
  // registre n'est pas rapportée : la tâche la recopie dans le registre.
  const demande = ouverture.sorte === 'refusé' ? null : await demandeÀTransmettre(entrée.slug)
  return { ...ouverture, demande }
}

export function recevoirUneFin(
  entrée: { readonly slug: string; readonly runId: string; readonly issue: 'reussi' | 'echec'; readonly coûtUsd: number | null },
  maintenant: Date = new Date(),
) {
  return conclureUnRunDOnboarding({ ...entrée, maintenant })
}

export function recevoirUnRapport(
  entrée: {
    readonly slug: string
    readonly statut: number | null
    readonly registre: string | null
    readonly motif: string | null
    readonly nom: string | null
    readonly site: string | null
    readonly exécuteur?: 'cowork' | null
  },
  maintenant: Date = new Date(),
) {
  return rapporterUnOnboarding({ ...entrée, maintenant })
}

/** La vue d'un onboarding, pour le geste d'ouverture de l'espace (lot 4) ; `null` sans onboarding suivi. */
export async function vueDeLOnboarding(slug: string, maintenant: Date = new Date()): Promise<VueDOnboarding | null> {
  const lu = await onboardingDUnSlug(slug)
  return lu ? vueDUnOnboarding(lu, maintenant) : null
}

/** Pour `GET /api/veille/onboardings` : la tâche ou l'opératrice relisent ce que le portail a reçu. */
export function lireUnOnboarding(slug: string): Promise<OnboardingLu | null> {
  return onboardingDUnSlug(slug)
}

// ── Ce que les écrans montrent ───────────────────────────────────────────────

export type RunVuÀLÉcran = RunLu & { readonly montré: ÉtatDeRun | 'sans_nouvelles'; readonly duréeMs: number | null }

export type VueDOnboarding = {
  readonly onboarding: OnboardingLu
  readonly étape: ÉtapeCalculée
  readonly bloqué: boolean
  readonly clos: boolean
  readonly runs: readonly RunVuÀLÉcran[]
  readonly dernierRun: RunVuÀLÉcran | null
  readonly coûtTotalUsd: number
  /** Le seul geste possible à cette étape (lot 2). */
  readonly geste: GesteDisponible
}

export function vueDUnOnboarding(onboarding: OnboardingLu, maintenant: Date): VueDOnboarding {
  const étape = étapeDeLOnboarding({
    statutRapporté: onboarding.statutRapporté,
    organisation: onboarding.organisation,
    lecteursActifs: onboarding.lecteursActifs,
    dernierLienEnvoyéLe: onboarding.dernierLienEnvoyéLe,
  })
  const runs = onboarding.runs.map((r) => ({
    ...r,
    montré: étatMontré(r, maintenant),
    duréeMs: r.début && r.fin ? r.fin.getTime() - r.début.getTime() : null,
  }))
  const dernierRun = runs[0] ?? null
  const bloqué = estBloqué({ motifDeBlocage: onboarding.motifDeBlocage, dernierRun }, maintenant)
  return {
    onboarding,
    étape,
    bloqué,
    geste: gesteDisponible({ étape: étape.étape, exécuteur: onboarding.exécuteur, bloqué, dernierRun, moteur: moteurDesOnboardings() }),
    clos: estClos(étape.étape, onboarding.dernierLienEnvoyéLe, maintenant),
    runs,
    dernierRun,
    coûtTotalUsd: Math.round(onboarding.runs.reduce((t, r) => t + (r.coûtUsd ?? 0), 0) * 10_000) / 10_000,
  }
}

export type TableauDesOnboardings = {
  readonly enCours: readonly VueDOnboarding[]
  readonly clos: readonly VueDOnboarding[]
  readonly mois: string
  readonly budget: DécisionDeBudget
}

/**
 * La liste de l'opératrice : bloqués d'abord, puis du moins avancé au plus
 * avancé, à étape égale le plus ancien d'abord. Le budget est dit pour un run
 * de plafond nul : ce qui reste avant que le prochain run ne soit refusé dépend
 * du plafond de sa tâche, que l'écran rappelle.
 */
export function vueDuTableau(données: { readonly onboardings: readonly OnboardingLu[]; readonly runsDuMois: readonly RunLu[] }, maintenant: Date): TableauDesOnboardings {
  const vues = données.onboardings.map((o) => vueDUnOnboarding(o, maintenant))
  const enCours = vues
    .filter((v) => !v.clos)
    .sort((a, b) => Number(b.bloqué) - Number(a.bloqué) || a.étape.rang - b.étape.rang || a.onboarding.misÀJourLe.getTime() - b.onboarding.misÀJourLe.getTime())
  const clos = vues.filter((v) => v.clos)
  const budget = déciderDuBudget({ dépenséUsd: dépenseDuMois(données.runsDuMois, maintenant), plafondUsd: 0, budgetUsd: budgetDesOnboardings() })
  return { enCours, clos, mois: moisDeParis(maintenant), budget }
}

// ── Lancer depuis le portail (lot 2, 1er novembre 2026) ──────────────────────

export type IssueDuLancement =
  | 'lancé'
  | 'indisponible'
  | 'inconnu'
  | 'geste-périmé'
  | 'en-cours'
  | 'cowork'
  | 'budget-atteint'
  | 'échec-github'
  /** Lot 5 : l'organisation n'est pas au registre Payload sous ce slug. */
  | 'hors-registre'
  /** Lot 5 : Trigger.dev n'a pas accepté le run. */
  | 'échec-moteur'

/** Vrai si le portail peut déclencher le workflow : l'écran montre sinon la commande à lancer à la main. */
export function lancementDisponible(): boolean {
  if (moteurDesOnboardings() === 'trigger') return déclencheurConfiguré()
  return configurationGithub() !== null
}

/**
 * Le geste de l'opératrice, dans l'ordre du §5 de la proposition : l'appelant a
 * vérifié le privilège (`exigerOpérateur`) ; ici, le jeton GitHub, l'étape
 * calculée qui doit être celle du bouton (un formulaire rejoué ne relance
 * rien), puis la réservation, qui refuse un run en cours et un budget dépassé,
 * **avant** l'appel à GitHub, enfin l'appel et sa conclusion. Le run porte
 * l'identifiant de la réservation dans l'entrée `lancement` du workflow : le
 * harnais la reprend au début.
 */
export async function lancerDepuisLePortail(
  entrée: { readonly slug: string; readonly geste: Geste; readonly opératrice: string },
  maintenant: Date = new Date(),
): Promise<IssueDuLancement> {
  if (moteurDesOnboardings() === 'trigger') return lancerParLeMoteur({ ...entrée, origine: 'portail' }, maintenant)
  const github = configurationGithub()
  if (!github) return 'indisponible'
  const lu = await onboardingDUnSlug(entrée.slug)
  if (!lu) return 'inconnu'
  const vue = vueDUnOnboarding(lu, maintenant)
  if (vue.geste.sorte === 'ouvrir') return 'geste-périmé'
  if (vue.geste.sorte !== 'geste') return vue.geste.raison === 'en-cours' ? 'en-cours' : vue.geste.raison === 'cowork' ? 'cowork' : 'geste-périmé'
  if (vue.geste.geste !== entrée.geste) return 'geste-périmé'

  const tâche = vue.geste.tâche
  // Le run complet du moteur ne se lance pas par GitHub.
  if (tâche === 'onboarding') return 'geste-périmé'
  const réservation = await réserverUnLancement({
    slug: entrée.slug,
    tâche: TÂCHES_SUIVIES[tâche]!,
    plafondUsd: PLAFONDS_DES_TÂCHES[tâche],
    budgetUsd: budgetDesOnboardings(),
    débutDuMois: débutDuMoisDeParis(maintenant),
    opératrice: entrée.opératrice,
    maintenant,
  })
  if (réservation.sorte !== 'réservé') return réservation.sorte

  let déclenchement: Awaited<ReturnType<typeof déclencherLeWorkflow>>
  try {
    déclenchement = await déclencherLeWorkflow(github, { tache: tâche, organisation: entrée.slug, lancement: réservation.runId })
  } catch {
    déclenchement = { sorte: 'échec', codeHttp: null }
  }
  if (déclenchement.sorte === 'échec') {
    await conclureUnLancement({ runId: réservation.runId, sorte: 'échec', codeHttp: déclenchement.codeHttp, maintenant })
    console.warn(`[onboarding] ${entrée.slug} : ${tâche} non déclenché (GitHub ${déclenchement.codeHttp ?? 'sans réponse'}).`)
    return 'échec-github'
  }
  await conclureUnLancement({ runId: réservation.runId, sorte: 'lancé', runGithub: déclenchement.runGithub, lien: déclenchement.lien, maintenant })
  return 'lancé'
}

// ── Le moteur Trigger.dev (lot 5, 1er novembre 2026) ─────────────────────────

/** Le registre Payload, chargé à la demande : la collection `organisations` importe ce module, un import statique bouclerait. */
const registre = () => import('@/lib/payload/registre-onboarding')

/**
 * Le lancement par le moteur, commun au bouton de l'opératrice et au crochet
 * de l'admin Payload, dans l'ordre : la clé Trigger.dev, l'organisation au
 * registre, l'onboarding (créé s'il manque, pour le crochet), le geste de
 * l'étape, la réservation (run en cours, budget au plafond du run), l'ouverture
 * dans le portail (organisation en essai, veille unique, lecteur : ce que le
 * crochet faisait avant), puis le déclenchement et sa conclusion. Depuis le
 * bouton seulement, l'organisation passe enfin « à onboarder », sans que le
 * crochet relance (`CONTEXTE_LANCÉ_PAR_LE_PORTAIL`).
 */
async function lancerParLeMoteur(
  entrée: { readonly slug: string; readonly geste: Geste | 'depuis-le-registre'; readonly opératrice: string; readonly origine: 'portail' | 'registre' },
  maintenant: Date,
): Promise<IssueDuLancement> {
  if (!déclencheurConfiguré()) return 'indisponible'
  const { organisationDuRegistre, marquerÀOnboarder } = await registre()
  const organisation = await organisationDuRegistre(entrée.slug)
  if (!organisation) return 'hors-registre'
  if (entrée.origine === 'registre') await assurerUnOnboarding({ slug: entrée.slug, nom: organisation.nom, crééPar: entrée.opératrice, maintenant })

  const lu = await onboardingDUnSlug(entrée.slug)
  if (!lu) return 'inconnu'
  const vue = vueDUnOnboarding(lu, maintenant)
  if (vue.geste.sorte === 'ouvrir') return 'geste-périmé'
  if (vue.geste.sorte !== 'geste') return vue.geste.raison === 'en-cours' ? 'en-cours' : vue.geste.raison === 'cowork' ? 'cowork' : 'geste-périmé'
  // Le crochet accepte le geste de l'étape, quel qu'il soit ; le bouton, le sien seulement.
  if (entrée.geste !== 'depuis-le-registre' && vue.geste.geste !== entrée.geste) return 'geste-périmé'

  const réservation = await réserverUnLancement({
    slug: entrée.slug,
    tâche: 'onboarding',
    plafondUsd: PLAFONDS_DES_TÂCHES.onboarding,
    budgetUsd: budgetDesOnboardings(),
    débutDuMois: débutDuMoisDeParis(maintenant),
    opératrice: entrée.opératrice,
    maintenant,
  })
  if (réservation.sorte !== 'réservé') return réservation.sorte

  try {
    await ouvrirDansLePortail({ id: organisation.id, nom: organisation.nom, slug: organisation.slug, contact: organisation.contact }, { prospection: false })
    // La ligne du registre est connue : la copie de la demande est effacée (décision 1).
    await rapporterUnOnboarding({ slug: entrée.slug, statut: null, registre: cléDeCloisonnement(organisation.id), motif: null, nom: null, site: null, maintenant })
    const déclenchement = await déclencherLOnboarding(organisation.id, { lancement: réservation.runId })
    if (!déclenchement.déclenché) throw new Error('clé Trigger.dev absente au déclenchement')
    await conclureUnLancement({ runId: réservation.runId, sorte: 'lancé', runGithub: null, lien: null, runTrigger: déclenchement.run, maintenant })
  } catch (erreur) {
    await conclureUnLancement({ runId: réservation.runId, sorte: 'échec', codeHttp: null, maintenant })
    console.warn(`[onboarding] ${entrée.slug} : onboarding non déclenché (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    return 'échec-moteur'
  }
  if (entrée.origine === 'portail' && organisation.etat !== 'a_onboarder') await marquerÀOnboarder(organisation.id)
  return 'lancé'
}

/**
 * Le crochet `afterChange` de la collection `organisations` (passage « à
 * onboarder » dans l'admin Payload) passe par ici, et non plus directement par
 * Trigger.dev (décision du 1er novembre 2026) : réservation, budget et suivi
 * valent pour tous les lancements. Le refus éventuel (budget, run en cours) se
 * lit sur `/espaces/onboardings`.
 */
export async function lancerDepuisLeRegistre(entrée: { readonly slug: string }, maintenant: Date = new Date()): Promise<IssueDuLancement> {
  return lancerParLeMoteur({ slug: entrée.slug, geste: 'depuis-le-registre', opératrice: 'admin Payload', origine: 'registre' }, maintenant)
}

/** Les alertes du contrôle du soir sur les onboardings (lot 2), en défauts rangés par slug. */
export async function alertesDesOnboardings(maintenant: Date = new Date()): Promise<Défaut[]> {
  const défauts: Défaut[] = []
  for (const o of await onboardingsPourLeContrôle()) {
    const vue = vueDUnOnboarding(o, maintenant)
    for (const a of alertesDUnOnboarding({ étape: vue.étape.étape, clos: vue.clos, misÀJourLe: o.misÀJourLe, dernierRun: o.runs[0] ?? null }, maintenant)) {
      défauts.push({ slug: o.slug, code: a.code, message: a.message })
    }
  }
  return défauts
}

// ── La demande du formulaire (lot 3, 1er novembre 2026) ──────────────────────

export type IssueDeLaDemande =
  | { readonly sorte: 'invalide'; readonly champs: readonly ChampDeLaDemande[] }
  | Exclude<EnregistrementDeDemande, { readonly sorte: 'enregistrée' }>
  | { readonly sorte: 'enregistrée'; readonly onboardingId: string; readonly slug: string }

/**
 * La porte puis l'écriture : `contrôlerLaDemande` avant `enregistrerUneDemande`
 * (`tests/architecture.test.ts` tient l'ordre). L'appelant a vérifié le
 * privilège. Rien n'est lancé : le geste « Générer les référentiels » suit.
 */
export async function enregistrerLaDemande(
  entrée: {
    readonly champs: { readonly nom: string; readonly site: string; readonly slug?: string; readonly objectifs?: string; readonly lecteurNom?: string; readonly lecteurEmail?: string; readonly exécuteur?: string }
    readonly opératrice: string
  },
  maintenant: Date = new Date(),
): Promise<IssueDeLaDemande> {
  const contrôle = contrôlerLaDemande(entrée.champs)
  if (contrôle.sorte === 'invalide') return contrôle
  const d = contrôle.demande
  if (moteurDesOnboardings() === 'github') {
    const r = await enregistrerUneDemande({ demande: d, opératrice: entrée.opératrice, maintenant })
    return r.sorte === 'enregistrée' ? { ...r, slug: d.slug } : r
  }

  // Lot 5 : le registre est la collection `organisations` de Payload. Cowork
  // n'y a pas de place (il écrit dans Notion) ; le slug doit y être libre ;
  // l'organisation y est créée au statut « prospect », avec le lecteur final en
  // contact, puis la copie du portail est effacée (décision 1).
  if (d.exécuteur === 'cowork') return { sorte: 'invalide', champs: ['exécuteur'] }
  const { organisationDuRegistre, créerDansLeRegistre } = await registre()
  if (await organisationDuRegistre(d.slug)) return { sorte: 'doublon', par: 'slug', slug: d.slug, où: 'organisation' }
  const r = await enregistrerUneDemande({ demande: d, opératrice: entrée.opératrice, maintenant })
  if (r.sorte !== 'enregistrée') return r
  const créée = await créerDansLeRegistre({
    nom: d.nom,
    slug: d.slug,
    site: d.site,
    contact: { nom: d.intake.lecteurFinal, email: d.intake.emailDuLecteurFinal },
  })
  if (créée.sorte === 'slug-pris') return { sorte: 'doublon', par: 'slug', slug: d.slug, où: 'organisation' }
  await rapporterUnOnboarding({ slug: d.slug, statut: 1, registre: cléDeCloisonnement(créée.id), motif: null, nom: null, site: null, maintenant })
  return { ...r, slug: d.slug }
}

/** Pour le passage quotidien : l'intake de plus de trente jours est effacé. */
export function effacerLesDemandesExpirées(maintenant: Date = new Date()): Promise<number> {
  return effacerLesDemandesAnciennes(maintenant)
}

