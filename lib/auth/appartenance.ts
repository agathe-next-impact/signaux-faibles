import { notFound, redirect } from 'next/navigation'
import {
  lireAccèsParIdentifiant,
  organisationDuSlug,
  espacesOuverts,
} from '@/lib/auth/source-acces'
import type { Accès, Espace } from '@/lib/notion/acces'
import { sourceAccès } from '@/lib/auth/source-acces'
import { identifiantDeLaSession } from '@/lib/auth/session'
import { baseConfigurée } from '@/lib/base/client'
import { tableauDesAbonnements, type LigneDAbonnement } from '@/lib/base/situation'
import { tableauDesPrescripteurs, type LigneDePrescripteur } from '@/lib/base/prescripteurs'
import { lireLaFile } from '@/lib/portail/file'
import type { ÉtatDeLaFile } from '@/lib/base/travaux'
import { lectureDeLEspace, type Lecture } from '@/lib/portail/lecture'

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
 * L'accès, et ce que l'espace a le droit de montrer aujourd'hui (palier 1c).
 *
 * Le contrôle d'appartenance passe d'abord, inchangé : le droit de lecture ne
 * se calcule que pour une personne déjà reconnue membre de l'espace.
 */
export async function exigerLecture(slugDemandé: string): Promise<{ accès: AccèsAccordé } & Lecture> {
  const accès = await exigerAccès(slugDemandé)
  // La ligne Notion de l'opérateur porte le slug d'un client : chez ce client,
  // `enOpérateur` vaut faux. C'est le privilège qui compte, pas la visite.
  return {
    accès,
    ...(await lectureDeLEspace({ organisationId: accès.organisationId, enOpérateur: accès.enOpérateur || accès.tousLesEspaces })),
  }
}

/**
 * Pour les écrans qui ne montrent que du contenu complet (axes, acteurs,
 * recommandations, archives, périmètre) : hors lecture complète, retour à la vue
 * d'ensemble, qui explique la situation. Ces écrans assemblent des passages de
 * plusieurs lettres ; aucune troncature honnête ne les réduirait à
 * « L'essentiel », et les garder ouverts laisserait lire ce que l'essai réserve
 * aux abonnés. `tests/architecture.test.ts` vérifie que chacun l'appelle.
 */
export async function exigerLectureComplète(slugDemandé: string): Promise<AccèsAccordé> {
  const { accès, lecture } = await exigerLecture(slugDemandé)
  if (lecture !== 'complète') redirect(`/${accès.slug}`)
  return accès
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
  const accès = await exigerOpérateur()
  return { accès, espaces: await espacesOuverts() }
}

/**
 * Le privilège opérateur, seul, pour ce qui ne se rapporte à aucun espace :
 * le sélecteur, le tableau des abonnements et ses réglages. Même ordre que
 * `exigerAccès` : session, ligne active, puis la case « Tous les espaces », et
 * `notFound` sans elle, pour ne pas confirmer que la page existe.
 */
export async function exigerOpérateur(): Promise<Accès> {
  const identifiant = await identifiantDeLaSession()
  if (!identifiant) redirect('/recevoir-mon-lien')

  const accès = await lireAccèsParIdentifiant(identifiant)
  if (!accès || !accès.actif) redirect('/recevoir-mon-lien?revoque=1')
  if (!accès.tousLesEspaces) notFound()
  return accès
}

/**
 * Le tableau des abonnements de l'opératrice (19 octobre 2026).
 *
 * Comme `listerLesEspaces`, la garde est **dans** la fonction : la lecture
 * traverse les clients, et `tableauDesAbonnements` n'a pas d'autre appelant
 * (`tests/architecture.test.ts`). `lignes` vaut `null` quand Postgres n'est pas
 * en service (`SOURCE_ACCES=notion`, base absente) : l'écran le dit, au lieu de
 * montrer un tableau vide qu'on prendrait pour « aucun abonnement ».
 */
export async function listerLesAbonnements(): Promise<{
  readonly accès: Accès
  readonly lignes: LigneDAbonnement[] | null
}> {
  const accès = await exigerOpérateur()
  if (!baseConfigurée() || sourceAccès() === 'notion') return { accès, lignes: null }
  return { accès, lignes: await tableauDesAbonnements() }
}

/**
 * Les prescripteurs et les organisations qu'ils ont recommandées, pour
 * l'opératrice (24 octobre 2026, `docs/prescripteurs.md`).
 *
 * Même forme que `listerLesAbonnements` : la garde est **dans** la fonction,
 * avant la lecture qui traverse les clients, et `tableauDesPrescripteurs` n'a
 * pas d'autre appelant (`tests/architecture.test.ts`). `lignes` vaut `null`
 * quand Postgres n'est pas en service.
 */
export async function listerLesPrescripteurs(): Promise<{
  readonly accès: Accès
  readonly lignes: LigneDePrescripteur[] | null
}> {
  const accès = await exigerOpérateur()
  if (!baseConfigurée() || sourceAccès() === 'notion') return { accès, lignes: null }
  return { accès, lignes: await tableauDesPrescripteurs() }
}

/**
 * La file de travaux, pour l'opératrice (décision du 22 octobre 2026 : la file
 * est le seul point de décision des lettres, et son seul journal).
 *
 * Même forme que `listerLesAbonnements` : la garde est **dans** la fonction,
 * la lecture traverse les clients (un travail par organisation), et `lireLaFile`
 * n'a pas d'autre appelant côté écran (`tests/architecture.test.ts`). `file`
 * vaut `null` quand Postgres n'est pas en service.
 */
export async function listerLaFile(): Promise<{
  readonly accès: Accès
  readonly file: ÉtatDeLaFile | null
}> {
  const accès = await exigerOpérateur()
  if (!baseConfigurée() || sourceAccès() === 'notion') return { accès, file: null }
  return { accès, file: await lireLaFile() }
}
