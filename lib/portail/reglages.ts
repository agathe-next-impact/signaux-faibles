'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import { réglerLeParcours, type RésultatDuRéglage } from '@/lib/base/organisations'

/**
 * Les réglages du parcours depuis le tableau des abonnements (19 octobre 2026).
 *
 * Ce sont **les mêmes réglages** que `PATCH /api/veille/organisations`, par le
 * même `réglerLeParcours` : prolonger l'essai d'une à trois semaines, envoyer
 * les courriers de fin d'essai à la relecture plutôt qu'au client. La route
 * reste celle de la tâche Cowork ; ces actions sont celles de l'opératrice,
 * depuis son navigateur. Rien d'autre ne se règle ici : l'abonnement lui-même
 * se modifie chez Stripe, et l'état de l'organisation par ses propres chemins.
 *
 * Le slug vient du formulaire, donc du navigateur : la garde passe d'abord,
 * par `exigerOpérateur`, avant toute écriture ; `tests/architecture.test.ts`
 * tient l'ordre. Le résultat est rendu au tableau par l'URL, sans message
 * libre : un code que l'écran traduit.
 */
function slugDu(données: FormData): string {
  const slug = données.get('slug')
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  return slug
}

async function appliquer(
  slug: string,
  action: string,
  réglage: Parameters<typeof réglerLeParcours>[1],
): Promise<never> {
  const accès = await exigerOpérateur()

  let sorte: RésultatDuRéglage['sorte'] | 'échec'
  try {
    sorte = (await réglerLeParcours(slug, réglage)).sorte
  } catch (erreur) {
    console.error(`[réglage] ${slug} : ${action} impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    sorte = 'échec'
  }
  console.info(`[réglage] ${accès.nom} : ${slug}, ${action}, ${sorte}.`)
  // `redirect` lève une exception de contrôle : hors de tout `try`.
  redirect(`/espaces/abonnements?reglage=${sorte}&slug=${encodeURIComponent(slug)}`)
}

export async function prolongerLEssai(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const semaines = Number(données.get('semaines'))
  if (semaines !== 1 && semaines !== 2 && semaines !== 3) notFound()
  await appliquer(slug, `prolonger de ${semaines}`, { sorte: 'prolonger', semaines })
}

export async function réglerLaRelecture(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const requise = données.get('requise')
  if (requise !== 'oui' && requise !== 'non') notFound()
  await appliquer(slug, requise === 'oui' ? 'courriers à la relecture' : 'courriers au client', {
    sorte: 'relecture',
    requise: requise === 'oui',
  })
}
