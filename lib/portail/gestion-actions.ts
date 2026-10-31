'use server'

import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import { composerLienDAccès } from '@/lib/auth/jeton'
import { lireAccèsActifParEmail } from '@/lib/auth/source-acces'
import { changerActivation, créerLecteur, révoquerLecteurParId } from '@/lib/base/ecriture-lecteurs'
import { adresseDUnLecteur, organisationÀGérer } from '@/lib/base/gestion'
import { composerCourrierDAccès } from '@/lib/email/gmail'
import { env } from '@/lib/env'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { autoriserLEnvoi, empreinte, origineDe } from '@/lib/portail/debit'
import { publierLaFicheDuPilote } from '@/lib/portail/fiche-veille'
import { lecteursModifiables } from '@/lib/portail/situation'
import { réglerLEspace, réglerLePilote, validerLaVersion } from '@/lib/portail/strategie'

/**
 * Les gestes de la page de gestion d'une organisation (31 octobre 2026,
 * `/espaces/abonnements/[slug]`). Ce sont **les mêmes** que les routes des
 * tâches, par les mêmes fonctions : `PATCH /api/veille/organisations`
 * (`outils`, `espace`), `PATCH /api/veille/grille`, `PATCH /api/veille/fiche`,
 * `POST /api/veille/lecteurs` ; plus le renvoi du lien d'accès, par le chemin de
 * l'activation. La route reste celle des tâches, ces actions sont celles de
 * l'opératrice, depuis son navigateur.
 *
 * Le slug vient du formulaire : la garde passe d'abord, par `exigerOpérateur`,
 * avant toute lecture et toute écriture ; `tests/architecture.test.ts` tient
 * l'ordre. Le résultat revient à la page par l'URL, en un code que l'écran
 * traduit. Aucun courrier au client, sauf le lien d'accès demandé.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugDu(données: FormData): string {
  const slug = données.get('slug')
  if (typeof slug !== 'string' || !SLUG.test(slug)) notFound()
  return slug
}

function retour(slug: string, code: string, section: string): never {
  redirect(`/espaces/abonnements/${encodeURIComponent(slug)}?gestion=${encodeURIComponent(code)}&section=${section}#${section}`)
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}

/** Un oui ou un non du formulaire, et rien d'autre. */
function interrupteur(données: FormData): boolean {
  const valeur = données.get('actif')
  if (valeur !== 'oui' && valeur !== 'non') notFound()
  return valeur === 'oui'
}

export async function basculerLePilote(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const actif = interrupteur(données)
  const accès = await exigerOpérateur()
  let code: string
  try {
    code = (await réglerLePilote({ slug, actif })) === 'réglé' ? (actif ? 'pilote-ouvert' : 'pilote-fermé') : 'inconnue'
  } catch (erreur) {
    console.error(`[gestion] ${slug} : pilote impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, pilote ${actif ? 'ouvert' : 'fermé'}, ${code}.`)
  retour(slug, code, 'pilote')
}

export async function basculerLEspace(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const actif = interrupteur(données)
  const accès = await exigerOpérateur()
  let code: string
  try {
    const r = await réglerLEspace({ slug, actif })
    code = r === 'réglé' ? (actif ? 'espace-ouvert' : 'espace-fermé') : r
  } catch (erreur) {
    console.error(`[gestion] ${slug} : espace impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, espace ${actif ? 'ouvert' : 'refermé'}, ${code}.`)
  retour(slug, code, 'pilote')
}

export async function validerLaGrille(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const version = Number(données.get('version'))
  if (!Number.isInteger(version) || version < 1) notFound()
  const accès = await exigerOpérateur()
  let code: string
  try {
    code = `grille-${await validerLaVersion({ slug, version })}`
  } catch (erreur) {
    console.error(`[gestion] ${slug} : validation de la grille impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, grille v${version}, ${code}.`)
  retour(slug, code, 'grille')
}

export async function publierLaFiche(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const état = données.get('etat')
  if (état !== 'publie' && état !== 'retire') notFound()
  const accès = await exigerOpérateur()
  let code: string
  try {
    const r = await publierLaFicheDuPilote({ slug, état })
    code = r.sorte === 'réglée' ? (état === 'publie' ? 'fiche-publiée' : 'fiche-retirée') : r.sorte
  } catch (erreur) {
    console.error(`[gestion] ${slug} : fiche ${état} impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, fiche ${état}, ${code}.`)
  retour(slug, code, 'fiche')
}

/**
 * Le lien d'accès d'un lecteur, par le chemin de l'activation : relecture de la
 * ligne par la façade (Notion fait foi en mode `double`), limitation de débit,
 * journal des courriers. L'adresse n'est lue qu'ici, côté serveur.
 */
async function envoyerLeLien(email: string, organisationId: string, déclencheur: string): Promise<'lien-envoyé' | 'lien-non-envoyé' | 'débit'> {
  const marque = empreinte(email)
  try {
    const lecteur = await lireAccèsActifParEmail(email)
    if (!lecteur?.email) {
      console.warn(`[gestion] ${marque} introuvable ou révoqué à la relecture : lien non envoyé.`)
      return 'lien-non-envoyé'
    }
    const débit = autoriserLEnvoi(email, origineDe(await headers()))
    if (!débit.autorisé) {
      console.warn(`[gestion] ${marque} : lien refusé par la limitation de débit (${débit.motif}).`)
      return 'débit'
    }
    const lien = composerLienDAccès(lecteur.identifiant, env().ACCES_SECRET_HMAC, env().PORTAIL_URL)
    await envoyerCourrier({
      message: { ...composerCourrierDAccès(lecteur.nom, lien, { destinataire: lecteur.email }), destinataire: lecteur.email },
      sorte: 'lien_acces',
      déclencheur,
      organisation: { id: organisationId },
      lecteurId: null,
      unique: false,
    })
    return 'lien-envoyé'
  } catch (erreur) {
    console.error(`[gestion] ${marque} : lien non envoyé (${messageDe(erreur)}).`)
    return 'lien-non-envoyé'
  }
}

function lecteurDu(données: FormData): string {
  const lecteur = données.get('lecteur')
  if (typeof lecteur !== 'string' || !/^[0-9a-f-]{36}$/i.test(lecteur)) notFound()
  return lecteur
}

export async function renvoyerLeLien(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const lecteurId = lecteurDu(données)
  const accès = await exigerOpérateur()
  const organisation = await organisationÀGérer(slug)
  if (!organisation) notFound()
  const email = await adresseDUnLecteur({ organisationId: organisation.id, lecteurId })
  const code = email ? await envoyerLeLien(email, organisation.id, 'operatrice') : 'lecteur-inconnu'
  console.info(`[gestion] ${accès.nom} : ${slug}, lien de ${email ? empreinte(email) : 'lecteur inconnu'}, ${code}.`)
  retour(slug, code, 'lecteurs')
}

const nomEtAdresse = z.object({ nom: z.string().trim().min(1).max(200), email: z.email().max(320) })

/** Inscrire un lecteur : seulement quand Postgres fait foi, comme la route ; le lien part aussitôt. */
export async function inscrireUnLecteur(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const accès = await exigerOpérateur()
  if (!lecteursModifiables()) retour(slug, 'notion-fait-foi', 'lecteurs')
  const lue = nomEtAdresse.safeParse({ nom: données.get('nom'), email: données.get('email') })
  if (!lue.success) retour(slug, 'invalide', 'lecteurs')
  const organisation = await organisationÀGérer(slug)
  if (!organisation) notFound()
  let code: string
  try {
    const r = await créerLecteur({ slug, nom: lue.data.nom, email: lue.data.email })
    code = r.sorte === 'créé' ? await envoyerLeLien(lue.data.email, organisation.id, 'operatrice') : r.sorte
  } catch (erreur) {
    console.error(`[gestion] ${slug} : inscription de ${empreinte(lue.data.email)} impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, inscription de ${empreinte(lue.data.email)}, ${code}.`)
  retour(slug, code, 'lecteurs')
}

export async function révoquerUnLecteur(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const lecteurId = lecteurDu(données)
  const accès = await exigerOpérateur()
  if (!lecteursModifiables()) retour(slug, 'notion-fait-foi', 'lecteurs')
  let code: string
  try {
    code = (await révoquerLecteurParId({ slug, lecteurId, demandeur: null })).sorte
  } catch (erreur) {
    console.error(`[gestion] ${slug} : révocation impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, révocation, ${code}.`)
  retour(slug, code, 'lecteurs')
}

export async function réactiverUnLecteur(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const lecteurId = lecteurDu(données)
  const accès = await exigerOpérateur()
  if (!lecteursModifiables()) retour(slug, 'notion-fait-foi', 'lecteurs')
  const organisation = await organisationÀGérer(slug)
  if (!organisation) notFound()
  const email = await adresseDUnLecteur({ organisationId: organisation.id, lecteurId })
  let code: string
  try {
    code = email ? (await changerActivation({ slug, email, actif: true })).sorte : 'lecteur-inconnu'
  } catch (erreur) {
    console.error(`[gestion] ${slug} : réactivation impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, réactivation, ${code}.`)
  retour(slug, code, 'lecteurs')
}
