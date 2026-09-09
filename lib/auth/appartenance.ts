import { notFound, redirect } from 'next/navigation'
import { lireAccèsParIdentifiant, type Accès } from '@/lib/notion/acces'
import { identifiantDeLaSession } from '@/lib/auth/session'

/**
 * Le contrôle d'appartenance, en un seul endroit.
 *
 * Il s'exécute dans le layout, **avant** tout appel de lecture de contenu, et
 * il rend l'identifiant d'organisation que ces appels recevront. Aucune
 * fonction cachée de contenu ne voit l'identité de la personne : elle ne reçoit
 * que cet identifiant, et son résultat est partagé entre les membres du client.
 *
 * Il n'y a plus de RLS derrière : une seule ligne oubliée suffirait. C'est
 * pourquoi ce chemin est unique et qu'aucun écran ne compose son propre
 * contrôle.
 */
export async function exigerAccès(slugDemandé: string): Promise<Accès> {
  const identifiant = await identifiantDeLaSession()

  // Pas de cookie, ou signature qui ne tient pas : la personne n'est pas
  // connectée. On l'envoie chercher son lien plutôt que de lui montrer une
  // page d'erreur.
  if (!identifiant) redirect('/recevoir-mon-lien')

  const accès = await lireAccèsParIdentifiant(identifiant)

  // Identifiant inconnu, ou case `Actif` décochée dans Notion : la révocation
  // devient effective à cette requête-ci.
  if (!accès || !accès.actif) redirect('/recevoir-mon-lien?revoque=1')

  // La personne est connectée, mais demande le portail d'un autre client.
  // `notFound` plutôt qu'une redirection : ne pas confirmer que ce slug existe.
  if (accès.slug !== slugDemandé) notFound()

  return accès
}
