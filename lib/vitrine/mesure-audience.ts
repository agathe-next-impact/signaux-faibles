/**
 * Mesure d'audience des pages vitrines par Google Tag Manager (5 novembre 2026,
 * demande de l'opératrice).
 *
 * Le conteneur n'est chargé que sur les pages publiques (`CoquilleVitrine` et
 * `/demo`), jamais dans l'espace d'un client : une adresse d'espace porte le
 * slug d'une organisation et le titre de ses lettres, et la politique de contenu
 * de l'espace reste bornée à l'origine (`next.config.ts`). Il n'est chargé
 * qu'en production Vercel, pour qu'un aperçu ou un poste local ne compte pas.
 *
 * Consentement : tant que le portail n'a pas de bandeau de consentement, le
 * mode consentement de Google est posé à `denied` pour tout stockage, avant le
 * chargement du conteneur. Les balises Google qui le respectent ne déposent
 * alors aucun cookie ; une balise tierce ajoutée dans GTM doit être réglée pour
 * l'exiger elle aussi (CNIL, lignes directrices du 17 septembre 2020).
 */
export const CONTENEUR_GTM = 'GTM-NCNSG52W'

/** Les origines que le conteneur et Google Analytics 4 appellent. */
export const ORIGINES_GTM = {
  script: ['https://*.googletagmanager.com'],
  image: ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
  connexion: [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
  ],
  cadre: ['https://www.googletagmanager.com'],
} as const

/**
 * Les pages où le conteneur est chargé, à l'adresse exacte : ce sont les pages
 * que le proxy ouvre sans session (`PUBLICS_EXACTS`). Leur politique de contenu
 * admet les origines de Google, et celle-là seulement.
 */
export const PAGES_MESURÉES = ['/', '/tarifs', '/exemple', '/demo'] as const

export function mesureActive(environnement: string | undefined = process.env.VERCEL_ENV): boolean {
  return environnement === 'production'
}

/**
 * Le script en ligne, posé avant `gtm.js` : la file `dataLayer`, le
 * consentement refusé par défaut, puis l'événement `gtm.start` du snippet
 * officiel, sans lequel le conteneur ne se déclenche pas.
 */
export function scriptDInitialisation(): string {
  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});",
    "dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});",
  ].join('')
}
