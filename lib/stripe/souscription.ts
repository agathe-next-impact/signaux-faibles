import Stripe from 'stripe'
import type { Forfait } from '@/lib/domaine/offre'

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

/** `fondateur` : la formule mensuelle réservée, à son propre prix Stripe ; admise seulement pour une organisation dont l'offre le dit. */
export type Formule = 'mensuelle' | 'annuelle' | 'fondateur'

export type ConfigurationStripe = {
  readonly cléSecrète: string
  /** `fondateur` est nul tant que `STRIPE_PRIX_FONDATEUR` n'est pas posée : la formule est alors indisponible, le reste non. */
  readonly prix: { readonly mensuelle: string; readonly annuelle: string; readonly fondateur: string | null }
  /**
   * Les prix des forfaits au-delà de trois lecteurs (19 novembre 2026), chacun
   * facultatif : `STRIPE_PRIX_MENSUEL_DIX`, `STRIPE_PRIX_ANNUEL_DIX`, puis
   * `_CENT` et `_ILLIMITE`. Un prix absent rend ce forfait, dans cette formule,
   * indisponible, sans toucher au reste. Le forfait de base garde
   * `STRIPE_PRIX_MENSUEL` et `STRIPE_PRIX_ANNUEL`.
   */
  readonly forfaits: Readonly<
    Record<Exclude<Forfait, 'trois'>, { readonly mensuelle: string | null; readonly annuelle: string | null }>
  >
  /**
   * Le prix unique des frais de mise en place (`STRIPE_PRIX_MISE_EN_PLACE`,
   * 7 novembre 2026), nul tant qu'il n'est pas posé : une souscription qui les
   * doit est alors refusée, jamais ouverte sans eux.
   */
  readonly miseEnPlace: string | null
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
  // L'ancien nom reste lu tant que la variable n'est pas renommée chez l'hébergeur.
  const fondateur = vide(source['STRIPE_PRIX_FONDATEUR']) ?? vide(source['STRIPE_PRIX_EARLY_ADOPTER'])
  const miseEnPlace = vide(source['STRIPE_PRIX_MISE_EN_PLACE'])
  const taux = vide(source['STRIPE_TAUX_TVA'])
  const portailUrl = vide(source['PORTAIL_URL'])
  const forfaits = {
    dix: { mensuelle: vide(source['STRIPE_PRIX_MENSUEL_DIX']), annuelle: vide(source['STRIPE_PRIX_ANNUEL_DIX']) },
    cent: { mensuelle: vide(source['STRIPE_PRIX_MENSUEL_CENT']), annuelle: vide(source['STRIPE_PRIX_ANNUEL_CENT']) },
    illimite: {
      mensuelle: vide(source['STRIPE_PRIX_MENSUEL_ILLIMITE']),
      annuelle: vide(source['STRIPE_PRIX_ANNUEL_ILLIMITE']),
    },
  }

  const manques: string[] = []
  // `rk_` : une clé restreinte, recommandée par Stripe pour un serveur.
  if (!cléSecrète || !/^(sk|rk)_(test|live)_/.test(cléSecrète)) manques.push('STRIPE_CLE_SECRETE')
  if (!mensuel || !mensuel.startsWith('price_')) manques.push('STRIPE_PRIX_MENSUEL')
  if (!annuel || !annuel.startsWith('price_')) manques.push('STRIPE_PRIX_ANNUEL')
  if (fondateur && !fondateur.startsWith('price_')) manques.push('STRIPE_PRIX_FONDATEUR')
  if (miseEnPlace && !miseEnPlace.startsWith('price_')) manques.push('STRIPE_PRIX_MISE_EN_PLACE')
  if (taux && !taux.startsWith('txr_')) manques.push('STRIPE_TAUX_TVA')
  for (const [forfait, prix] of Object.entries(forfaits)) {
    const suffixe = forfait.toUpperCase()
    if (prix.mensuelle && !prix.mensuelle.startsWith('price_')) manques.push(`STRIPE_PRIX_MENSUEL_${suffixe}`)
    if (prix.annuelle && !prix.annuelle.startsWith('price_')) manques.push(`STRIPE_PRIX_ANNUEL_${suffixe}`)
  }
  if (!portailUrl) manques.push('PORTAIL_URL')
  if (manques.length > 0) {
    console.warn(`[abonnement] souscription indisponible, à poser ou corriger : ${manques.join(', ')}.`)
    return null
  }

  return {
    cléSecrète: cléSecrète!,
    prix: { mensuelle: mensuel!, annuelle: annuel!, fondateur },
    forfaits,
    miseEnPlace,
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

/**
 * Le prix Stripe d'une formule et d'un forfait, ou `null` s'il n'est pas posé.
 * Le tarif fondateur n'existe qu'au forfait de base : il n'a pas d'autre prix.
 */
export function prixPosé(configuration: ConfigurationStripe, formule: Formule, forfait: Forfait = 'trois'): string | null {
  if (forfait === 'trois') return configuration.prix[formule]
  if (formule === 'fondateur') return null
  return configuration.forfaits[forfait][formule]
}

/** Le prix Stripe d'une formule et d'un forfait ; lève s'il n'est pas posé. */
export function prixDe(configuration: ConfigurationStripe, formule: Formule, forfait: Forfait = 'trois'): string {
  const prix = prixPosé(configuration, formule, forfait)
  if (!prix) throw new Error(`formule ${formule}, forfait ${forfait}, sans prix Stripe configuré`)
  return prix
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
 * Le forfait par nombre de lecteurs (19 novembre 2026) choisit le prix, et il
 * est posé dans les métadonnées de l'abonnement avec l'organisation.
 *
 * Les frais de mise en place, quand ils sont dus (`fraisDeMiseEnPlaceDus`),
 * sont une seconde ligne, au prix unique : Stripe les porte sur la première
 * facture de l'abonnement, et sur elle seule. Le taux de TVA y est posé
 * ligne à ligne, comme sur l'abonnement.
 *
 * Le numéro de TVA intracommunautaire et l'adresse de facturation sont
 * demandés : ce sont des mentions obligatoires d'une facture entre
 * professionnels.
 */
export function paramètresDePaiement(entrée: {
  readonly configuration: ConfigurationStripe
  readonly formule: Formule
  /** Le forfait par nombre de lecteurs ; le forfait de base par défaut. */
  readonly forfait?: Forfait
  readonly organisationId: string
  readonly slug: string
  readonly clientStripe: string | null
  readonly email: string | null
  /** Vrai : la ligne des frais de mise en place s'ajoute ; lève si leur prix n'est pas posé. */
  readonly fraisDeMiseEnPlace: boolean
}): Stripe.Checkout.SessionCreateParams {
  const { configuration, formule, organisationId, slug } = entrée
  const forfait = entrée.forfait ?? 'trois'
  // Le forfait voyage aussi dans les métadonnées de l'abonnement : le webhook le
  // lit là quand le prix ne le porte pas.
  const métadonnées = { organisation_id: organisationId, slug, forfait }
  if (entrée.fraisDeMiseEnPlace && !configuration.miseEnPlace) {
    throw new Error('frais de mise en place dus sans prix Stripe configuré')
  }
  const lignes: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: prixDe(configuration, formule, forfait), quantity: 1 }]
  if (entrée.fraisDeMiseEnPlace && configuration.miseEnPlace) {
    lignes.push({
      price: configuration.miseEnPlace,
      quantity: 1,
      ...(configuration.tauxDeTva ? { tax_rates: [configuration.tauxDeTva] } : {}),
    })
  }
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
    line_items: lignes,
    subscription_data: {
      metadata: métadonnées,
      ...(configuration.tauxDeTva ? { default_tax_rates: [configuration.tauxDeTva] } : {}),
    },
    metadata: { ...métadonnées, frais_de_mise_en_place: entrée.fraisDeMiseEnPlace ? 'oui' : 'non' },
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
