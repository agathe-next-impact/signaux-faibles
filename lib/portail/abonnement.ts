'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerAccès } from '@/lib/auth/appartenance'
import { baseConfigurée } from '@/lib/base/client'
import { lireFacturation } from '@/lib/base/abonnements'
import { empreinte } from '@/lib/portail/debit'
import {
  cléAccordéeAuMode,
  clientStripe,
  configurationStripe,
  paramètresDeFacturation,
  paramètresDePaiement,
  type Formule,
} from '@/lib/stripe/souscription'

/**
 * Les deux gestes d'abonnement d'un lecteur (palier 1c) : s'abonner, et gérer
 * son abonnement dans l'espace de facturation Stripe.
 *
 * Le slug vient du formulaire, donc du navigateur : il passe par `exigerAccès`,
 * le même contrôle que les écrans. L'organisation facturée est celle de la
 * session, jamais une valeur du formulaire.
 *
 * **Une visite opérateur ne souscrit ni ne gère rien.** L'opératrice qui ouvre
 * l'espace d'un client voit ce que le client voit, boutons compris, mais ne
 * peut ni engager une organisation dans un paiement ni ouvrir son espace de
 * facturation (où se trouve la résiliation). Le bouton répond par la vue
 * d'ensemble, avec un message.
 *
 * Aucune de ces actions n'écrit dans Postgres : la copie de l'abonnement n'est
 * écrite que par le webhook Stripe, quand Stripe confirme. Revenir de la page
 * de paiement ne prouve rien ; l'événement signé, si.
 */

const FORMULES = new Set<Formule>(['mensuelle', 'annuelle'])

function slugDu(données: FormData): string {
  const slug = données.get('slug')
  if (typeof slug !== 'string' || slug.length === 0) notFound()
  return slug
}

export async function souscrire(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const formule = données.get('formule')
  if (typeof formule !== 'string' || !FORMULES.has(formule as Formule)) notFound()

  const accès = await exigerAccès(slug)
  if (accès.enOpérateur) redirect(`/${accès.slug}?abonnement=operateur`)

  const destination = await pageDePaiement(accès, formule as Formule)
  // `redirect` lève une exception de contrôle : appelé hors de tout `try`.
  redirect(destination)
}

export async function gérerLAbonnement(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const accès = await exigerAccès(slug)
  if (accès.enOpérateur) redirect(`/${accès.slug}?abonnement=operateur`)

  const destination = await espaceDeFacturation(accès)
  redirect(destination)
}

type AccèsFacturé = { readonly slug: string; readonly organisationId: string; readonly email: string | null }

async function pageDePaiement(accès: AccèsFacturé, formule: Formule): Promise<string> {
  const indisponible = `/${accès.slug}?abonnement=indisponible`
  const configuration = configurationStripe()
  if (!configuration || !baseConfigurée()) return indisponible
  if (!cléAccordéeAuMode(configuration.cléSecrète, process.env['STRIPE_MODE'] === 'reel')) {
    console.error('[abonnement] la clé Stripe ne correspond pas à STRIPE_MODE : souscription refusée.')
    return indisponible
  }

  try {
    const facturation = await lireFacturation(accès.organisationId)
    if (!facturation) {
      console.warn(`[abonnement] ${accès.slug} : organisation absente de Postgres, souscription refusée.`)
      return indisponible
    }
    // Déjà abonnée : un second paiement doublerait la facture. L'espace de
    // facturation sert à changer de formule.
    if (facturation.abonnement?.ouvert) {
      return await urlDeFacturation(configuration, facturation.abonnement.clientStripe, accès.slug)
    }

    const session = await clientStripe(configuration).checkout.sessions.create(
      paramètresDePaiement({
        configuration,
        formule,
        organisationId: facturation.organisationId,
        slug: accès.slug,
        clientStripe: facturation.abonnement?.clientStripe ?? null,
        email: accès.email,
      }),
    )
    if (!session.url) throw new Error('session de paiement sans URL')
    console.info(
      `[abonnement] ${accès.slug} : page de paiement ouverte (${formule})` +
        `${accès.email ? ` pour ${empreinte(accès.email)}` : ''}.`,
    )
    return session.url
  } catch (erreur) {
    // Le message d'une erreur Stripe peut citer un paramètre ; seul le type sort.
    console.error(`[abonnement] ${accès.slug} : page de paiement impossible (${nomDErreur(erreur)}).`)
    return indisponible
  }
}

async function espaceDeFacturation(accès: AccèsFacturé): Promise<string> {
  const indisponible = `/${accès.slug}?abonnement=indisponible`
  const configuration = configurationStripe()
  if (!configuration || !baseConfigurée()) return indisponible
  try {
    const facturation = await lireFacturation(accès.organisationId)
    if (!facturation?.abonnement) return `/${accès.slug}?abonnement=aucun`
    return await urlDeFacturation(configuration, facturation.abonnement.clientStripe, accès.slug)
  } catch (erreur) {
    console.error(`[abonnement] ${accès.slug} : espace de facturation impossible (${nomDErreur(erreur)}).`)
    return indisponible
  }
}

async function urlDeFacturation(
  configuration: NonNullable<ReturnType<typeof configurationStripe>>,
  client: string,
  slug: string,
): Promise<string> {
  const session = await clientStripe(configuration).billingPortal.sessions.create(
    paramètresDeFacturation({ configuration, clientStripe: client, slug }),
  )
  return session.url
}

function nomDErreur(erreur: unknown): string {
  if (erreur && typeof erreur === 'object' && 'type' in erreur && typeof erreur.type === 'string') return erreur.type
  return erreur instanceof Error ? erreur.name : 'inconnue'
}
