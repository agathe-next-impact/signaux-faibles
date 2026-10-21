import { redirect } from 'next/navigation'
import { identifiantDeLaSession } from '@/lib/auth/session'
import { lireAccèsParIdentifiant } from '@/lib/auth/source-acces'

/**
 * La racine n'affiche rien : elle oriente.
 *
 * Une session valide mène au portail du client ; tout le reste mène au
 * formulaire. Le slug n'est pas dans le cookie — il vient de Notion, seule
 * source de l'appartenance. Un accès opérateur mène au choix d'un espace.
 */
// Cette route ne rend rien : elle lit le cookie et redirige. Il n'y a donc
// aucune enveloppe à pré-rendre, et rien à mettre sous une frontière Suspense.
// `instant = false` assume ce blocage, qui dure le temps d'une lecture cachée.
export const instant = false

export default async function Racine() {
  const identifiant = await identifiantDeLaSession()
  if (!identifiant) redirect('/recevoir-mon-lien')

  const accès = await lireAccèsParIdentifiant(identifiant)
  if (!accès || !accès.actif) redirect('/recevoir-mon-lien?revoque=1')

  // Un opérateur n'a pas d'espace à lui : on lui propose de choisir. Il passe
  // avant le contrôle du slug, que l'opérateur global (palier 1) n'a pas.
  if (accès.tousLesEspaces) redirect('/espaces')

  if (accès.slug.length === 0) redirect('/recevoir-mon-lien?revoque=1')
  redirect(`/${accès.slug}`)
}
