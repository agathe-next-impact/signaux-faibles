'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import type { ChampDeLaDemande, Geste } from '@/lib/domaine/onboarding'
import { enregistrerLaDemande, lancerDepuisLePortail, type IssueDuLancement } from '@/lib/portail/onboarding'

/**
 * Le geste de l'opératrice sur un onboarding (lot 2 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026), depuis
 * `/espaces/onboardings` ou la section « Onboarding » de la fiche. La garde
 * passe d'abord, par `exigerOpérateur`, avant toute lecture et tout appel à
 * GitHub ; `tests/architecture.test.ts` tient l'ordre. Le résultat revient à
 * l'écran par l'URL, en un code que l'écran traduit.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const GESTES: readonly Geste[] = ['referentiels', 'premiere-lettre', 'relancer']

export async function lancerUneÉtapeDOnboarding(données: FormData): Promise<void> {
  const slug = données.get('slug')
  const geste = données.get('geste')
  const retour = données.get('retour') === 'fiche' ? 'fiche' : 'liste'
  if (typeof slug !== 'string' || !SLUG.test(slug)) notFound()
  if (typeof geste !== 'string' || !(GESTES as readonly string[]).includes(geste)) notFound()
  const accès = await exigerOpérateur()

  let issue: IssueDuLancement | 'échec'
  try {
    issue = await lancerDepuisLePortail({ slug, geste: geste as Geste, opératrice: accès.nom })
  } catch (erreur) {
    console.error(`[onboarding] ${slug} : lancement impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    issue = 'échec'
  }
  console.info(`[onboarding] ${accès.nom} : ${slug}, ${geste}, ${issue}.`)
  const code = encodeURIComponent(issue)
  redirect(
    retour === 'fiche'
      ? `/espaces/abonnements/${encodeURIComponent(slug)}?onboarding=${code}&section=onboarding#onboarding`
      : `/espaces/onboardings?lancement=${code}&slug=${encodeURIComponent(slug)}#${encodeURIComponent(slug)}`,
  )
}

// ── Le formulaire de demande (lot 3, 1er novembre 2026) ──────────────────────

export type ValeursDeLaDemande = {
  readonly nom: string
  readonly site: string
  readonly slug: string
  readonly objectifs: string
  readonly lecteurNom: string
  readonly lecteurEmail: string
  readonly exécuteur: string
}

export type ÉtatDuFormulaire =
  | { readonly état: 'repos' }
  | { readonly état: 'invalide'; readonly champs: readonly ChampDeLaDemande[]; readonly valeurs: ValeursDeLaDemande }
  | { readonly état: 'doublon'; readonly par: 'slug' | 'nom' | 'site'; readonly slug: string; readonly où: 'onboarding' | 'organisation'; readonly valeurs: ValeursDeLaDemande }
  | { readonly état: 'créneaux-cowork'; readonly pris: number; readonly valeurs: ValeursDeLaDemande }
  | { readonly état: 'échec'; readonly valeurs: ValeursDeLaDemande }

const lire = (données: FormData, clé: string, max: number) => {
  const v = données.get(clé)
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/**
 * L'envoi du formulaire `/espaces/onboardings/nouveau` : la garde d'abord, puis
 * la porte et l'écriture (`enregistrerLaDemande`). Une demande enregistrée mène
 * à la liste, où le geste « Générer les référentiels » attend (décision 4) ; un
 * refus rend les valeurs saisies au formulaire, jamais par l'URL.
 */
export async function enregistrerUneDemandeDOnboarding(_avant: ÉtatDuFormulaire, données: FormData): Promise<ÉtatDuFormulaire> {
  const accès = await exigerOpérateur()
  const valeurs: ValeursDeLaDemande = {
    nom: lire(données, 'nom', 400),
    site: lire(données, 'site', 1000),
    slug: lire(données, 'slug', 120),
    objectifs: lire(données, 'objectifs', 3000),
    lecteurNom: lire(données, 'lecteurNom', 400),
    lecteurEmail: lire(données, 'lecteurEmail', 640),
    exécuteur: lire(données, 'executeur', 10),
  }
  let issue: Awaited<ReturnType<typeof enregistrerLaDemande>>
  try {
    issue = await enregistrerLaDemande({ champs: { ...valeurs }, opératrice: accès.nom })
  } catch (erreur) {
    console.error(`[onboarding] demande impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    return { état: 'échec', valeurs }
  }
  console.info(`[onboarding] ${accès.nom} : demande, ${issue.sorte}${issue.sorte === 'enregistrée' ? ` (${issue.slug})` : ''}.`)
  switch (issue.sorte) {
    case 'invalide':
      return { état: 'invalide', champs: issue.champs, valeurs }
    case 'doublon':
      return { état: 'doublon', par: issue.par, slug: issue.slug, où: issue.où, valeurs }
    case 'créneaux-cowork':
      return { état: 'créneaux-cowork', pris: issue.pris, valeurs }
    case 'enregistrée':
      redirect(`/espaces/onboardings?demande=enregistree&slug=${encodeURIComponent(issue.slug)}#${encodeURIComponent(issue.slug)}`)
  }
}
