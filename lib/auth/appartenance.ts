import { notFound, redirect } from 'next/navigation'
import {
  lireAccèsParIdentifiant,
  organisationDuSlug,
  espacesOuverts,
  type Accès,
  type Espace,
} from '@/lib/notion/acces'
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
export type AccèsAccordé = Accès & {
  /** `true` quand la personne visite l'espace d'un client qui n'est pas le sien. */
  readonly enOpérateur: boolean
}

/**
 * L'accès opérateur, et ce qu'il autorise exactement.
 *
 * La case « Tous les espaces » d'une ligne « Accès » laisse ouvrir l'espace de
 * n'importe quel client. C'est une **exception délibérée** à la règle 2, et
 * elle est tenue étroite :
 *
 * - l'identifiant d'organisation reste lu dans la base « Accès » — celle que le
 *   portail lit déjà —, par comparaison d'un slug **exact**. Le registre n'est
 *   pas ouvert, aucun nom d'organisation n'est résolu ;
 * - les fonctions cachées de contenu ne voient toujours qu'un identifiant
 *   d'organisation : le privilège ne change rien à ce qu'elles reçoivent, ni au
 *   cloisonnement de leurs entrées de cache ;
 * - un slug qu'aucune ligne active ne porte reste `notFound`, comme pour un
 *   client ordinaire : le privilège n'ouvre pas d'énumération ;
 * - la case `Actif` le révoque comme le reste, effective à la requête suivante ;
 * - la visite est journalisée, et l'écran la signale. Sans marque visible, une
 *   capture d'écran de l'espace d'un client serait indiscernable d'une fuite.
 */
export async function exigerAccès(slugDemandé: string): Promise<AccèsAccordé> {
  const identifiant = await identifiantDeLaSession()

  // Pas de cookie, ou signature qui ne tient pas : la personne n'est pas
  // connectée. On l'envoie chercher son lien plutôt que de lui montrer une
  // page d'erreur.
  if (!identifiant) redirect('/recevoir-mon-lien')

  const accès = await lireAccèsParIdentifiant(identifiant)

  // Identifiant inconnu, ou case `Actif` décochée dans Notion : la révocation
  // devient effective à cette requête-ci.
  if (!accès || !accès.actif) redirect('/recevoir-mon-lien?revoque=1')

  // Le cas ordinaire, et de loin le plus fréquent : la personne est chez elle.
  if (accès.slug === slugDemandé) return { ...accès, enOpérateur: false }

  // La personne demande le portail d'un autre client sans y être autorisée.
  // `notFound` plutôt qu'une redirection : ne pas confirmer que ce slug existe.
  if (!accès.tousLesEspaces) notFound()

  const organisation = await organisationDuSlug(slugDemandé)
  if (!organisation) notFound()

  console.warn(
    `[opérateur] ${accès.nom} ouvre l'espace « ${slugDemandé} » ` +
      `(${organisation.organisationId}).`,
  )

  return {
    ...accès,
    organisationId: organisation.organisationId,
    organisationLibellé: organisation.organisationLibellé,
    slug: slugDemandé,
    enOpérateur: true,
  }
}

/**
 * Les espaces ouverts, pour l'opérateur qui choisit lequel ouvrir.
 *
 * La garde est **dans** cette fonction et non à côté : c'est le seul chemin qui
 * mène à la liste, et la liste est la seule lecture du portail qui traverse les
 * clients. Un écran qui appellerait `espacesOuverts` directement contournerait
 * la vérification ; `tests/architecture.test.ts` interdit cet appel ailleurs.
 *
 * Une personne sans privilège reçoit `notFound`, comme pour le slug d'un autre
 * client : ne pas confirmer que cette page existe.
 */
export async function listerLesEspaces(): Promise<{
  readonly accès: Accès
  readonly espaces: Espace[]
}> {
  const identifiant = await identifiantDeLaSession()
  if (!identifiant) redirect('/recevoir-mon-lien')

  const accès = await lireAccèsParIdentifiant(identifiant)
  if (!accès || !accès.actif) redirect('/recevoir-mon-lien?revoque=1')
  if (!accès.tousLesEspaces) notFound()

  return { accès, espaces: await espacesOuverts() }
}
