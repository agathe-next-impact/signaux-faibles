import Stripe from 'stripe'

/**
 * La souscription en ligne (palier 1c) : ce que le portail demande à Stripe
 * pour ouvrir une page de paiement, ou l'espace de facturation d'un abonné.
 *
 * Même forme que `lib/stripe/webhook.ts` : la décision est ici, en fonctions
 * pures d'entrées explicites, et l'action serveur (`lib/portail/abonnement.ts`)
 * ne fait que les entrées-sorties. Ce qui compte se teste donc sans compte
 * Stripe : l'organisation posée dans les métadonnées de l'**abonnement**, la
 * seule chose que le webhook lira ensuite.
 *
 * **La configuration est lue dans `process.env`, jamais dans `env()`.** Tant
 * que le compte Stripe n'est pas posé, aucune page ne doit tomber : la
 * souscription répond simplement « indisponible » et l'écran garde l'adresse
 * d'abonnement par courrier.
 *
 * Les identifiants de prix sont dans l'environnement et non dans le code :
 * ceux de l'environnement de test et ceux du compte réel diffèrent, et le
 * passage en réel ne doit demander aucun commit.
 */

export type Formule = 'mensuelle' | 'annuelle'

export type ConfigurationStripe = {
  readonly cléSecrète: string
  readonly prix: Readonly<Record<Formule, string>>
  /** Taux de TVA fixe (`txr_…`), appliqué à l'abonnement. Absent : aucune taxe ajoutée par le portail. */
  readonly tauxDeTva: string | null
  readonly portailUrl: string
}

const vide = (valeur: string | undefined): string | null => {
  const propre = valeur?.trim()
  return propre ? propre : null
}

/**
 * La configuration complète, ou `null` s'il manque une pièce. Une valeur mal
 * formée compte comme absente, et la raison est journalisée sans la valeur :
 * une clé secrète collée dans le mauvais champ ne doit pas finir dans les
 * journaux.
 */
export function configurationStripe(source: NodeJS.ProcessEnv = process.env): ConfigurationStripe | null {
  const cléSecrète = vide(source['STRIPE_CLE_SECRETE'])
  const mensuel = vide(source['STRIPE_PRIX_MENSUEL'])
  const annuel = vide(source['STRIPE_PRIX_ANNUEL'])
  const taux = vide(source['STRIPE_TAUX_TVA'])
  const portailUrl = vide(source['PORTAIL_URL'])

  const manques: string[] = []
  // `rk_` : une clé restreinte, recommandée par Stripe pour un serveur.
  if (!cléSecrète || !/^(sk|rk)_(test|live)_/.test(cléSecrète)) manques.push('STRIPE_CLE_SECRETE')
  if (!mensuel || !mensuel.startsWith('price_')) manques.push('STRIPE_PRIX_MENSUEL')
  if (!annuel || !annuel.startsWith('price_')) manques.push('STRIPE_PRIX_ANNUEL')
  if (taux && !taux.startsWith('txr_')) manques.push('STRIPE_TAUX_TVA')
  if (!portailUrl) manques.push('PORTAIL_URL')
  if (manques.length > 0) {
    console.warn(`[abonnement] souscription indisponible, à poser ou corriger : ${manques.join(', ')}.`)
    return null
  }

  return {
    cléSecrète: cléSecrète!,
    prix: { mensuelle: mensuel!, annuelle: annuel! },
    tauxDeTva: taux,
    portailUrl: portailUrl!.replace(/\/+$/, ''),
  }
}

/**
 * Une clé de test sur un portail déclaré en mode réel, ou l'inverse : le
 * paiement aboutirait chez Stripe, et le webhook refuserait ensuite
 * l'événement (`autre-mode`). Le client paierait pour rien. On refuse avant.
 */
export function cléAccordéeAuMode(cléSecrète: string, modeRéel: boolean): boolean {
  return cléSecrète.includes('_live_') === modeRéel
}

export function clientStripe(configuration: ConfigurationStripe): Stripe {
  return new Stripe(configuration.cléSecrète, {
    // Une page de paiement se crée en une requête ; au-delà, mieux vaut
    // rendre la main au lecteur que le laisser devant un bouton figé.
    timeout: 10_000,
    maxNetworkRetries: 1,
    appInfo: { name: 'portail signauxfaibles' },
  })
}

/**
 * Les paramètres de la page de paiement.
 *
 * **L'organisation est posée dans les métadonnées de l'abonnement**
 * (`subscription_data.metadata`), pas seulement dans celles de la session : le
 * webhook ne lit que les événements d'abonnement, et c'est là qu'il la cherche.
 * C'est l'identifiant Postgres de l'organisation, tiré par le portail ; jamais
 * un nom, jamais une adresse.
 *
 * Un client Stripe déjà connu (abonnement résilié puis repris) est réutilisé,
 * pour que ses factures restent sous un même client ; sinon l'adresse du
 * lecteur pré-remplit le formulaire, qu'il peut changer pour celle de sa
 * comptabilité.
 *
 * Le numéro de TVA intracommunautaire et l'adresse de facturation sont
 * demandés : ce sont des mentions obligatoires d'une facture entre
 * professionnels.
 */
export function paramètresDePaiement(entrée: {
  readonly configuration: ConfigurationStripe
  readonly formule: Formule
  readonly organisationId: string
  readonly slug: string
  readonly clientStripe: string | null
  readonly email: string | null
}): Stripe.Checkout.SessionCreateParams {
  const { configuration, formule, organisationId, slug } = entrée
  const métadonnées = { organisation_id: organisationId, slug }
  const retour = `${configuration.portailUrl}/${slug}`

  return {
    mode: 'subscription',
    // Next Impact vend et facture, avec sa TVA (décision du 17 octobre 2026).
    // Un compte Stripe créé en 2026 active par défaut Managed Payments, où Stripe
    // (Link) devient le vendeur officiel et refuse tout taux de TVA imposé : la
    // première page de paiement de recette a échoué ainsi. Le désactiver ici,
    // à chaque session, rend le paiement indépendant de ce réglage du compte.
    managed_payments: { enabled: false },
    locale: 'fr',
    line_items: [{ price: configuration.prix[formule], quantity: 1 }],
    subscription_data: {
      metadata: métadonnées,
      ...(configuration.tauxDeTva ? { default_tax_rates: [configuration.tauxDeTva] } : {}),
    },
    metadata: métadonnées,
    client_reference_id: organisationId,
    ...(entrée.clientStripe
      ? {
          customer: entrée.clientStripe,
          // Exigé par Stripe pour collecter un numéro de TVA sur un client existant.
          customer_update: { address: 'auto', name: 'auto' },
        }
      : entrée.email
        ? { customer_email: entrée.email }
        : {}),
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    success_url: `${retour}?abonnement=merci`,
    cancel_url: retour,
  }
}

/**
 * La page d'un abonnement dans le tableau de bord Stripe, pour l'opératrice.
 * C'est là, et nulle part dans le portail, que l'abonnement se modifie : le
 * portail n'en tient qu'une copie, écrite par le webhook.
 */
export function lienTableauDeBordStripe(abonnementStripe: string, modeRéel: boolean): string {
  return `https://dashboard.stripe.com/${modeRéel ? '' : 'test/'}subscriptions/${abonnementStripe}`
}

/** L'espace de facturation Stripe d'un abonné : factures, moyen de paiement, résiliation. */
export function paramètresDeFacturation(entrée: {
  readonly configuration: ConfigurationStripe
  readonly clientStripe: string
  readonly slug: string
}): Stripe.BillingPortal.SessionCreateParams {
  return {
    customer: entrée.clientStripe,
    locale: 'fr',
    return_url: `${entrée.configuration.portailUrl}/${entrée.slug}`,
  }
}
