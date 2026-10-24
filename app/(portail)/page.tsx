import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AccueilVitrine } from '@/components/vitrine-accueil'
import { identifiantDeLaSession } from '@/lib/auth/session'
import { lireAccèsParIdentifiant } from '@/lib/auth/source-acces'

export const metadata: Metadata = {
  title: 'signauxfaibles — votre veille, rédigée',
  description:
    'Une veille hebdomadaire rédigée pour votre organisation : écosystème et concurrence réunis dans une lettre courte, datée et sourcée.',
  // Ce que voit un visiteur sans session est la vitrine : indexable, à la
  // différence du reste du portail.
  robots: { index: true, follow: true },
}

/**
 * La racine oriente, et accueille.
 *
 * Une session valide mène au portail du client ; un visiteur sans session voit
 * la vitrine (23 octobre 2026), et une session révoquée mène au formulaire.
 * Le slug n'est pas dans le cookie — il vient de Notion, seule source de
 * l'appartenance. Un accès opérateur mène au choix d'un espace.
 */
// Cette route lit le cookie avant de décider quoi rendre : la vitrine ou une
// redirection. Il n'y a donc aucune enveloppe à pré-rendre, et rien à mettre
// sous une frontière Suspense. `instant = false` assume ce blocage, qui dure le
// temps d'une lecture cachée, et rien du tout sans cookie.
export const instant = false

export default async function Racine({ searchParams }: { searchParams: Promise<{ app?: string | string[] }> }) {
  const identifiant = await identifiantDeLaSession()
  if (!identifiant) {
    // Ouverte depuis l'application installée (`start_url` du manifeste), la
    // racine sert un lecteur dont la session a expiré : il veut son lien.
    if ((await searchParams).app !== undefined) redirect('/recevoir-mon-lien')
    return <AccueilVitrine />
  }

  const accès = await lireAccèsParIdentifiant(identifiant)
  if (!accès || !accès.actif) redirect('/recevoir-mon-lien?revoque=1')

  // Un opérateur n'a pas d'espace à lui : on lui propose de choisir. Il passe
  // avant le contrôle du slug, que l'opérateur global (palier 1) n'a pas.
  if (accès.tousLesEspaces) redirect('/espaces')

  if (accès.slug.length === 0) redirect('/recevoir-mon-lien?revoque=1')
  redirect(`/${accès.slug}`)
}
