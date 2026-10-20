'use server'

import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { exigerAccès } from '@/lib/auth/appartenance'
import { composerLienDAccès } from '@/lib/auth/jeton'
import { lireAccèsActifParEmail } from '@/lib/auth/source-acces'
import { changerActivation, créerLecteur, révoquerLecteurParId } from '@/lib/base/ecriture-lecteurs'
import { composerCourrierDAccès } from '@/lib/email/gmail'
import { env } from '@/lib/env'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { autoriserLEnvoi, empreinte, origineDe } from '@/lib/portail/debit'
import { lecteursModifiables } from '@/lib/portail/situation'

/**
 * Ajouter ou retirer un lecteur depuis « Mon abonnement » (19 octobre 2026).
 *
 * Ce sont les gestes de `POST /api/veille/lecteurs`, offerts aux lecteurs
 * eux-mêmes, et ils en gardent les trois bornes :
 *   · **Postgres fait foi** (`lecteursModifiables`, `SOURCE_ACCES=postgres`) :
 *     avant la bascule, l'écran renvoie à l'adresse d'abonnement ;
 *   · **trois actifs au plus** par organisation, tenu dans `lib/base` ;
 *   · **l'identifiant d'accès ne sort jamais** : le lien part par le même
 *     chemin que l'activation, `envoyerCourrier`, sous la même limitation de
 *     débit, et le retrait désigne une ligne par son identifiant, pas une adresse.
 *
 * Le slug vient du formulaire : `exigerAccès` est le contrôle des écrans, et
 * l'organisation écrite est celle de la session. Une visite opérateur ne
 * modifie rien, comme pour la souscription : l'opératrice voit l'écran du
 * client sans pouvoir agir à sa place. Un lecteur ne se retire pas lui-même.
 *
 * Les journaux ne portent que des empreintes. Le résultat revient à l'écran par
 * un code dans l'URL, que la page traduit.
 */
const nomEtAdresse = z.object({
  nom: z.string().trim().min(1).max(200),
  email: z.email().max(320),
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Issue =
  | 'ajoute'
  | 'reactive'
  | 'deja'
  | 'plafond'
  | 'retire'
  | 'soi-meme'
  | 'inconnu'
  | 'invalide'
  | 'operateur'
  | 'indisponible'
  | 'echec'
  | 'lien-non-envoye'
  | 'debit'

function slugDu(données: FormData): string {
  const slug = données.get('slug')
  if (typeof slug !== 'string' || slug.length === 0) notFound()
  return slug
}

function retour(slug: string, issue: Issue): never {
  // `redirect` lève une exception de contrôle : toujours hors de tout `try`.
  redirect(`/${slug}/abonnement?lecteurs=${issue}#lecteurs`)
}

export async function ajouterLecteur(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const accès = await exigerAccès(slug)
  if (accès.enOpérateur) retour(accès.slug, 'operateur')
  if (!lecteursModifiables()) retour(accès.slug, 'indisponible')

  const lue = nomEtAdresse.safeParse({ nom: données.get('nom'), email: données.get('email') })
  if (!lue.success) retour(accès.slug, 'invalide')
  const { nom, email } = lue.data
  const marque = empreinte(email)

  let issue: Issue
  try {
    const création = await créerLecteur({ slug: accès.slug, nom, email })
    if (création.sorte === 'créé') issue = 'ajoute'
    else if (création.sorte === 'plafond-atteint') issue = 'plafond'
    else if (création.sorte === 'déjà-inscrit') {
      // Inscrit et révoqué : le réactiver est ce que le lecteur demande. Déjà
      // actif : rien à faire, et un second lien ne lui apprendrait rien.
      const réactivation = await changerActivation({ slug: accès.slug, email, actif: true })
      issue =
        réactivation.sorte === 'réactivé'
          ? 'reactive'
          : réactivation.sorte === 'inchangé'
            ? 'deja'
            : réactivation.sorte === 'plafond-atteint'
              ? 'plafond'
              : 'echec'
    } else issue = 'echec'
  } catch (erreur) {
    console.error(`[lecteurs] ${accès.slug} : ajout de ${marque} impossible (${messageDe(erreur)}).`)
    issue = 'echec'
  }

  if (issue === 'ajoute' || issue === 'reactive') {
    const envoi = await envoyerLeLien(email, accès.organisationId)
    if (envoi !== 'envoyé') issue = envoi
  }

  console.info(`[lecteurs] ${accès.slug} : ${marque} ajouté par ${empreinte(accès.email ?? '')} : ${issue}.`)
  retour(accès.slug, issue)
}

export async function retirerLecteur(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const accès = await exigerAccès(slug)
  if (accès.enOpérateur) retour(accès.slug, 'operateur')
  if (!lecteursModifiables()) retour(accès.slug, 'indisponible')

  const lecteurId = données.get('lecteur')
  if (typeof lecteurId !== 'string' || !UUID.test(lecteurId)) retour(accès.slug, 'invalide')

  let issue: Issue
  try {
    const résultat = await révoquerLecteurParId({ slug: accès.slug, lecteurId, demandeur: accès.email })
    issue =
      résultat.sorte === 'révoqué' || résultat.sorte === 'inchangé'
        ? 'retire'
        : résultat.sorte === 'soi-même'
          ? 'soi-meme'
          : résultat.sorte === 'lecteur-inconnu'
            ? 'inconnu'
            : 'echec'
  } catch (erreur) {
    console.error(`[lecteurs] ${accès.slug} : retrait impossible (${messageDe(erreur)}).`)
    issue = 'echec'
  }

  console.info(`[lecteurs] ${accès.slug} : retrait par ${empreinte(accès.email ?? '')} : ${issue}.`)
  retour(accès.slug, issue)
}

/**
 * Le lien d'accès du lecteur qui vient d'être inscrit, par le chemin de
 * l'activation : relecture de la ligne par la façade (c'est elle qui porte
 * l'identifiant), limitation de débit, journal des courriers. Un lien qui ne
 * part pas ne défait pas l'inscription : le lecteur peut le demander sur
 * « recevoir mon lien », et l'écran le dit.
 */
async function envoyerLeLien(email: string, registreNotion: string): Promise<'envoyé' | 'lien-non-envoye' | 'debit'> {
  const marque = empreinte(email)
  try {
    const lecteur = await lireAccèsActifParEmail(email)
    if (!lecteur?.email) {
      console.warn(`[lecteurs] ${marque} inscrit mais introuvable à la relecture : lien non envoyé.`)
      return 'lien-non-envoye'
    }
    const débit = autoriserLEnvoi(email, origineDe(await headers()))
    if (!débit.autorisé) {
      console.warn(`[lecteurs] ${marque} : lien refusé par la limitation de débit (${débit.motif}).`)
      return 'debit'
    }
    const lien = composerLienDAccès(lecteur.identifiant, env().ACCES_SECRET_HMAC, env().PORTAIL_URL)
    await envoyerCourrier({
      message: { ...composerCourrierDAccès(lecteur.nom, lien, { destinataire: lecteur.email }), destinataire: lecteur.email },
      sorte: 'lien_acces',
      déclencheur: 'espace-client',
      organisation: { registreNotion },
      lecteurId: null,
      unique: false,
    })
    return 'envoyé'
  } catch (erreur) {
    console.error(`[lecteurs] ${marque} : lien non envoyé (${messageDe(erreur)}).`)
    return 'lien-non-envoye'
  }
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}
