import type { Metadata } from 'next'
import { ADRESSE_DE_CONTACT } from '@/lib/email/gabarit'
import {
  DÉFINITIONS_DES_FORFAITS,
  enEuros,
  FORFAITS,
  FRAIS_DE_MISE_EN_PLACE_HT,
  finDuTarifEarlyAdopter,
  HEURES_DE_PRISE_EN_MAIN,
  PRIX_MENSUEL_HT,
  prixAnnuelDuForfaitHT,
} from '@/lib/domaine/offre'
import { PARUTIONS_D_ESSAI } from '@/lib/domaine/parcours'
import { ESSENTIEL_LIGNES_MAX } from '@/lib/domaine/texte'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'

/**
 * Le référencement de la vitrine (16 novembre 2026, demande de l'opératrice :
 * SEO et GEO, c'est-à-dire les moteurs de recherche et les moteurs de réponse
 * par IA). Un seul module pour ce qu'un robot lit de la vitrine : l'origine
 * canonique, les pages indexables, les robots admis, les métadonnées de
 * partage et les données structurées (schema.org). Les chiffres viennent tous
 * de `lib/domaine/offre.ts` et du contrat de la lettre, jamais écrits ici.
 *
 * Rien de ce module ne rend une page privée indexable : le layout racine reste
 * en `noindex`, et seules les pages qui appellent `métadonnéesDeVitrine`
 * passent en `index`.
 */

/** Le nom de la marque, tel que la charte l'écrit, soudé et en minuscules. */
export const MARQUE = 'signauxfaibles'

/** La baseline de la charte, telle quelle. */
export const BASELINE = 'Votre veille, rédigée.'

/**
 * L'origine canonique du site public.
 *
 * `PORTAIL_URL` porte le domaine (règle du 10 septembre 2026 : rien en dur),
 * mais l'apex `signauxfaibles.io` répond par une redirection 308 vers `www.`
 * (constaté le 16 novembre 2026). Une URL canonique sur l'apex désignerait
 * une adresse qui redirige, signal contradictoire pour un moteur : l'apex est
 * donc ramené à `www.`. Sans variable (tests, build local), l'origine de
 * production sert.
 */
export function origineCanonique(valeur: string | undefined = process.env['PORTAIL_URL']): string {
  const défaut = 'https://www.signauxfaibles.io'
  if (!valeur || valeur.trim().length === 0) return défaut
  let url: URL
  try {
    url = new URL(valeur)
  } catch {
    return défaut
  }
  if (url.hostname === 'signauxfaibles.io') url.hostname = 'www.signauxfaibles.io'
  return url.origin
}

/**
 * Les pages indexables de la vitrine, et elles seules : ce sont celles du
 * sitemap. `/demo` (formulaire), les espaces de démonstration et les lettres
 * de démonstration restent hors index : ils dupliqueraient « Exemples » ou
 * n'ont rien à répondre à une recherche.
 */
export const PAGES_INDEXABLES = [
  { chemin: '/', fréquence: 'weekly', priorité: 1 },
  { chemin: '/tarifs', fréquence: 'monthly', priorité: 0.8 },
  { chemin: '/exemple', fréquence: 'monthly', priorité: 0.8 },
] as const

/**
 * Les chemins que les robots n'ont pas à parcourir. Les espaces clients
 * (`/[slug]`) n'y sont pas, et ne peuvent pas y être : leurs slugs ne doivent
 * pas être publiés. Ils sont gardés autrement, par le proxy (redirection sans
 * session) et par le `noindex` du layout racine. Les lettres de démonstration
 * (`/exemple/lettre/`) non plus : exclues ici, un moteur ne lirait jamais leur
 * `noindex` et pourrait indexer leur adresse seule, liée depuis « Exemples ».
 */
export const CHEMINS_EXCLUS_DES_ROBOTS = [
  '/api/',
  '/acces/',
  '/admin',
  '/payload-api',
  '/espaces',
  '/quitter',
  '/hors-ligne',
] as const

/**
 * Les robots des moteurs de réponse par IA, nommés pour être admis en clair.
 * Un robot qui trouve un groupe à son nom ignore le groupe `*` : chacun reçoit
 * donc les mêmes exclusions. Deux familles, que l'opératrice peut séparer :
 * la recherche et la citation en direct (sans elles, la vitrine ne peut pas
 * être citée dans une réponse), et l'entraînement des modèles (sans elles, la
 * marque reste absente de ce que les modèles savent sans chercher).
 */
export const ROBOTS_D_IA = {
  rechercheEtCitation: [
    'OAI-SearchBot',
    'ChatGPT-User',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
    'DuckAssistBot',
    'MistralAI-User',
  ],
  entraînement: ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'],
} as const

/** L'image de partage (1 200 × 630), à la charte : bande encre, logo, baseline. */
export const IMAGE_DE_PARTAGE = {
  url: '/vitrine/partage.png',
  width: 1200,
  height: 630,
  alt: `${MARQUE}, ${BASELINE} Veille stratégique et concurrentielle hebdomadaire.`,
} as const

/**
 * Les métadonnées d'une page vitrine : titre, description, URL canonique,
 * Open Graph et carte de partage, et les directives qui laissent un moteur
 * citer un extrait long (`max-snippet: -1`), condition des réponses générées.
 */
export function métadonnéesDeVitrine({
  titre,
  description,
  chemin,
}: {
  titre: string
  description: string
  chemin: string
}): Metadata {
  return {
    title: { absolute: titre },
    description,
    alternates: { canonical: chemin },
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: MARQUE,
      url: chemin,
      title: titre,
      description,
      images: [IMAGE_DE_PARTAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: titre,
      description,
      images: [IMAGE_DE_PARTAGE.url],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
    },
  }
}

/** Une question de la foire aux questions : le texte affiché est celui des données structurées. */
export type QuestionFréquente = { readonly question: string; readonly réponse: string }

const ID_ORGANISATION = '/#organisation'
const ID_SITE = '/#site'
const ID_SERVICE = '/#service'

/** Une URL absolue sur l'origine canonique. */
export function absolue(chemin: string, origine = origineCanonique()): string {
  return new URL(chemin, origine).toString()
}

/** Ce que fait le service, en une phrase reprise par les données structurées et `llms.txt`. */
export function descriptionDuService(): string {
  return `Une veille stratégique et concurrentielle rédigée chaque semaine pour une seule organisation : une lettre courte, datée et sourcée, qui réunit l’écosystème et la concurrence, et un espace en ligne qui garde toutes les lettres.`
}

/** L'éditeur du site, référencé par les autres nœuds. */
export function nœudOrganisation(origine = origineCanonique()) {
  return {
    '@type': 'Organization',
    '@id': absolue(ID_ORGANISATION, origine),
    name: MARQUE,
    url: absolue('/', origine),
    logo: { '@type': 'ImageObject', url: absolue('/icone-512.png', origine), width: 512, height: 512 },
    image: absolue(IMAGE_DE_PARTAGE.url, origine),
    slogan: BASELINE,
    description: descriptionDuService(),
    email: ADRESSE_DE_CONTACT,
    areaServed: { '@type': 'Country', name: 'France' },
    knowsLanguage: 'fr',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: ADRESSE_DE_CONTACT,
      availableLanguage: 'French',
      areaServed: 'FR',
    },
  }
}

/** Le site, rattaché à son éditeur. */
export function nœudSite(origine = origineCanonique()) {
  return {
    '@type': 'WebSite',
    '@id': absolue(ID_SITE, origine),
    url: absolue('/', origine),
    name: MARQUE,
    description: descriptionDuService(),
    inLanguage: 'fr-FR',
    publisher: { '@id': absolue(ID_ORGANISATION, origine) },
  }
}

/**
 * Le service et ses offres, tirés des mêmes constantes que les pages : les
 * abonnements mensuel et annuel, et les frais de mise en place.
 */
export function nœudService(origine = origineCanonique()) {
  return {
    '@type': 'Service',
    '@id': absolue(ID_SERVICE, origine),
    name: `${MARQUE}, veille hebdomadaire rédigée`,
    serviceType: 'Veille stratégique et concurrentielle',
    description: descriptionDuService(),
    url: absolue('/', origine),
    provider: { '@id': absolue(ID_ORGANISATION, origine) },
    areaServed: { '@type': 'Country', name: 'France' },
    audience: { '@type': 'BusinessAudience', name: 'Entreprises, cabinets de conseil et organisations' },
    offers: [
      ...FORFAITS.flatMap((forfait) => {
        const { libellé, prixMensuelHT } = DÉFINITIONS_DES_FORFAITS[forfait]
        const annuel = prixAnnuelDuForfaitHT(forfait)
        return [
          {
            '@type': 'Offer',
            name: `Abonnement mensuel, ${libellé.toLowerCase()}, création du référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises`,
            url: absolue('/tarifs', origine),
            priceCurrency: 'EUR',
            price: prixMensuelHT,
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: prixMensuelHT,
              priceCurrency: 'EUR',
              valueAddedTaxIncluded: false,
              unitCode: 'MON',
              referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
            },
          },
          {
            '@type': 'Offer',
            name: `Abonnement annuel, ${libellé.toLowerCase()}, deux mois offerts, création du référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises`,
            url: absolue('/tarifs', origine),
            priceCurrency: 'EUR',
            price: annuel,
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: annuel,
              priceCurrency: 'EUR',
              valueAddedTaxIncluded: false,
              unitCode: 'ANN',
              referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'ANN' },
            },
          },
        ]
      }),
      {
        '@type': 'Offer',
        name: 'Frais de mise en place',
        url: absolue('/tarifs', origine),
        priceCurrency: 'EUR',
        price: FRAIS_DE_MISE_EN_PLACE_HT,
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: FRAIS_DE_MISE_EN_PLACE_HT,
          priceCurrency: 'EUR',
          valueAddedTaxIncluded: false,
        },
      },
    ],
  }
}

/** La foire aux questions d'une page, mot pour mot ce que la page affiche. */
export function nœudFAQ(chemin: string, questions: readonly QuestionFréquente[], origine = origineCanonique()) {
  return {
    '@type': 'FAQPage',
    '@id': absolue(`${chemin}#faq`, origine),
    url: absolue(chemin, origine),
    inLanguage: 'fr-FR',
    isPartOf: { '@id': absolue(ID_SITE, origine) },
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.réponse },
    })),
  }
}

/** Un graphe JSON-LD : plusieurs nœuds reliés par leurs `@id`. */
export function graphe(nœuds: readonly object[]) {
  return { '@context': 'https://schema.org', '@graph': nœuds }
}

/** Sérialise un objet JSON-LD pour une balise `script` : « < » échappé, la balise ne se ferme jamais. */
export function enJsonLd(données: object): string {
  return JSON.stringify(données).replace(/</g, '\\u003c')
}

/**
 * Le contenu de `/llms.txt` (proposition llmstxt.org) : la vitrine résumée en
 * Markdown pour un moteur de réponse, avec ses liens. Rien n'y est affirmé que
 * les pages ne disent pas déjà ; les chiffres sont ceux de l'offre.
 */
export function texteLlms(origine = origineCanonique()): string {
  const lien = (chemin: string) => absolue(chemin, origine)
  return `# ${MARQUE}

> ${descriptionDuService()} Service français, en français, à partir de ${enEuros(PRIX_MENSUEL_HT)} € HT par mois et par organisation.

${MARQUE} (${BASELINE}) est un service de veille stratégique et concurrentielle par abonnement. Chaque semaine, le même jour, chaque lecteur de l’organisation abonnée reçoit par courriel une lettre écrite pour elle seule, qui reste ensuite lisible dans un espace en ligne.

## Ce que contient la lettre

- « L’essentiel » : ${ESSENTIEL_LIGNES_MAX} lignes au plus, à lire en trente secondes.
- De ${LETTRE_UNIQUE.axesMin} à ${LETTRE_UNIQUE.axesMax} axes, qui réunissent l’écosystème de l’organisation et sa concurrence.
- Chaque axe porte un niveau d’impact parmi trois : fort, moyen ou RAS (rien à signaler). Il n’y en a pas d’autre.
- Chaque fait est daté et lié à sa source.
- Les concurrents et acteurs suivis, dossier par dossier, d’une semaine à l’autre.

## L’espace en ligne

- Toutes les lettres et leurs archives, semaine par semaine, et chaque axe suivi d’une lettre à l’autre.
- Un écran par lecture : concurrents, environnement, stratégie.
- Un lien personnel par lecteur, sans mot de passe ; installable sur téléphone, lisible hors ligne.

## Offre et tarifs

${FORFAITS.map((forfait) => `- ${DÉFINITIONS_DES_FORFAITS[forfait].libellé} actifs : ${enEuros(DÉFINITIONS_DES_FORFAITS[forfait].prixMensuelHT)} € HT par mois, ou ${enEuros(prixAnnuelDuForfaitHT(forfait))} € HT par an (deux mois offerts), par organisation.`).join('\n')}
- Compris dans chaque forfait : la création du référentiel de veille (axes, sources, acteurs), ${HEURES_DE_PRISE_EN_MAIN} h de prise en main, l’espace et ses archives.
- Frais de mise en place : offerts pour toute inscription jusqu’au ${finDuTarifEarlyAdopter()}, puis ${enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT une fois.
- Essai : ${PARUTIONS_D_ESSAI} parutions complètes, sans carte bancaire, à partir de la première lettre publiée.
- Résiliation de la formule mensuelle à tout moment, depuis l’espace.

## Pages

- [Accueil](${lien('/')}) : ce que contient la lettre, ce qu’elle coûte face à une veille interne, les deux supports.
- [Tarifs](${lien('/tarifs')}) : formules, frais de mise en place, déroulé de l’essai, questions fréquentes.
- [Exemples](${lien('/exemple')}) : trois organisations fictives (cabinet de conseil, PME industrielle, entreprise de l’ESS), leur espace en lecture seule et leurs lettres de la semaine.
- [Demander une démo](${lien('/demo')}) : formulaire de contact.

## Contact

- ${ADRESSE_DE_CONTACT}
`
}
