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

/** L'onboarding complet d'une organisation (palier 4), à l'état « à onboarder ». */
export function déclencherLOnboarding(organisationId: string): Promise<Déclenchement> {
  return déclencher(TÂCHES.onboarding, { organisationId })
}

/** Le bloc « pour <organisation> » de la lettre de filière (palier 1), à la création du prospect. */
export function déclencherLeBlocPersonnalisé(prospectId: string): Promise<Déclenchement> {
  return déclencher(TÂCHES.blocPersonnalisé, { prospectId })
}

/** L'édition de découverte (palier 3), à la première visite. */
export function déclencherLÉditionDeDécouverte(organisationId: string): Promise<Déclenchement> {
  return déclencher(TÂCHES.éditionDeDécouverte, { organisationId })
}
