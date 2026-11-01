/**
 * Le seul endroit du portail qui parle à Trigger.dev.
 *
 * Le portail déclenche une tâche, il ne l'exécute jamais : la collecte, la
 * rédaction et les portes vivent dans `trigger/`, hors de la requête. Sans
 * `TRIGGER_SECRET_KEY`, rien ne part, et le déclencheur le dit : un crochet
 * Payload ou une première visite ne doivent jamais tomber parce que le projet
 * Trigger.dev n'est pas encore créé. Le contrôle du soir signalera la clé
 * absente ; ici, on journalise et on rend `déclenché: false`.
 *
 * Le SDK est importé à la demande, dans la fonction : il ne pèse ainsi ni sur
 * les écrans ni sur les tests, et la clé est lue à l'appel, jamais à l'import.
 */
export type Déclenchement = { readonly déclenché: false } | { readonly déclenché: true; readonly run: string }

export const TÂCHES = {
  onboarding: 'onboarding',
  blocPersonnalisé: 'bloc-personnalise',
  éditionDeDécouverte: 'edition-de-decouverte',
} as const

async function déclencher(idDeLaTâche: string, charge: Record<string, string>): Promise<Déclenchement> {
  const clé = process.env['TRIGGER_SECRET_KEY']
  if (!clé) {
    console.warn(`[moteur] déclenchement ignoré : TRIGGER_SECRET_KEY absente (${idDeLaTâche})`)
    return { déclenché: false }
  }
  const { tasks } = await import('@trigger.dev/sdk')
  const handle = await tasks.trigger(idDeLaTâche, charge)
  console.info(`[moteur] tâche ${idDeLaTâche} déclenchée : run ${handle.id}`)
  return { déclenché: true, run: handle.id }
}

/** Vrai si le portail peut déclencher une tâche : sans clé, l'écran le dit au lieu de réserver un run qui ne partirait pas. */
export function déclencheurConfiguré(): boolean {
  return Boolean(process.env['TRIGGER_SECRET_KEY'])
}

/*
 * Les charges portent les clés que les tâches lisent (`trigger/onboarding.ts` :
 * `payload.organisation`, `payload.prospect`). Jusqu'au 1er novembre 2026, elles
 * portaient `organisationId` et `prospectId`, que les tâches ne lisaient pas :
 * à la bascule, chaque run serait parti sur une organisation indéfinie. Le test
 * `tests/moteur.declencher.test.ts` tient l'accord des deux côtés.
 */

/**
 * L'onboarding complet d'une organisation (palier 4). Depuis le lot 5 de
 * `docs/proposition-onboarding-admin.md`, seul `lib/portail/onboarding.ts`
 * l'appelle, après la réservation et le budget ; `lancement` est la ligne
 * réservée, que la tâche renvoie au début de son run.
 */
export function déclencherLOnboarding(organisationId: string, options: { readonly lancement?: string } = {}): Promise<Déclenchement> {
  return déclencher(TÂCHES.onboarding, { organisation: organisationId, ...(options.lancement ? { lancement: options.lancement } : {}) })
}

/** Le bloc « pour <organisation> » de la lettre de filière (palier 1), à la création du prospect. */
export function déclencherLeBlocPersonnalisé(prospectId: string): Promise<Déclenchement> {
  return déclencher(TÂCHES.blocPersonnalisé, { prospect: prospectId })
}

/** L'édition de découverte (palier 3), à la première visite. */
export function déclencherLÉditionDeDécouverte(organisationId: string): Promise<Déclenchement> {
  return déclencher(TÂCHES.éditionDeDécouverte, { organisation: organisationId })
}
