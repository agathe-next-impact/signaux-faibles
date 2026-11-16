# Référencement de la vitrine, SEO et GEO

16 novembre 2026, demande de l'opératrice : optimiser la vitrine pour les moteurs
de recherche (SEO) et pour les moteurs de réponse par IA (GEO : ChatGPT,
Perplexity, Google AI Overviews, Claude, Mistral). Ce document consigne l'état
des lieux mesuré en production, ce qui a été changé, et ce qui reste à décider.

La vitrine, ce sont les pages publiques servies à un visiteur sans session :
`/` (accueil), `/tarifs`, `/exemple`, plus `/demo` (formulaire) et les espaces
et lettres de démonstration. Tout le reste du portail est privé et le reste.

## 1. État des lieux (production, 16 novembre 2026)

| Point | Constat | Gravité |
|---|---|---|
| `robots.txt` | N'existait pas : le proxy redirigeait l'adresse (307) vers « recevoir mon lien ». Un robot lisait une page de connexion à la place de ses règles. | Haute |
| `sitemap.xml` | Absent, redirigé de même ; aucune page déclarée aux moteurs. | Haute |
| `llms.txt` | Absent, redirigé de même. | Moyenne (GEO) |
| Hôte canonique | L'apex `signauxfaibles.io` redirige en 308 vers `www.` ; aucune balise `canonical` ne le disait. | Moyenne |
| `metadataBase` | Absente : aucune URL absolue possible dans les métadonnées. | Moyenne |
| Open Graph, carte de partage | Absents : un lien partagé sur LinkedIn ou dans une messagerie s'affichait sans image ni titre choisi. | Moyenne |
| Données structurées | Seulement un `Service` sur `/tarifs`, isolé ; rien sur l'accueil (ni `Organization`, ni `WebSite`, ni FAQ). | Moyenne (GEO surtout) |
| Titres | Accueil « signauxfaibles — votre veille, rédigée » : la marque seule, aucun terme recherché (« veille stratégique », « veille concurrentielle »). | Moyenne |
| `/demo` | Pas de `h1` (titre en `h2`), pas de description, `nofollow` hérité du layout. | Faible |
| Courriel de démonstration encadré | Document HTML servi sans `noindex`. | Faible |
| Robots d'IA | Admis par le pare-feu (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Googlebot : 200 sur `/tarifs`). | Correct |
| Rendu | Les pages sont rendues côté serveur, onglets compris (panneaux `hidden`, présents dans le HTML) : lisibles sans JavaScript, condition des robots d'IA qui n'exécutent pas de script. | Correct |
| Pages privées | Layout racine en `noindex, nofollow`, espaces clients redirigés sans session. | Correct |

## 2. Ce qui a été changé

Tout passe par `lib/vitrine/referencement.ts`, seul module de ce qu'un robot lit
de la vitrine ; les chiffres viennent de `lib/domaine/offre.ts` et du contrat de
la lettre, jamais écrits en dur (149 € HT inchangé).

- **`/robots.txt`** (`app/robots.ts`) : tout robot admis sur la vitrine,
  exclusions `/api/`, `/acces/`, `/admin`, `/payload-api`, `/espaces`,
  `/quitter`, `/hors-ligne` ; les robots d'IA nommés un par un avec les mêmes
  exclusions (un robot qui trouve un groupe à son nom ignore le groupe `*`) ;
  le sitemap annoncé. Les espaces clients ne sont pas listés : leurs slugs ne
  se publient pas, le proxy et le `noindex` les gardent.
- **`/sitemap.xml`** (`app/sitemap.ts`) : les trois pages indexables, en URL
  absolues sur `www.`, sans date de modification inventée.
- **`/llms.txt`** (`app/llms.txt/route.ts`) : la vitrine résumée en Markdown
  pour les moteurs de réponse (ce que contient la lettre, l'espace, l'offre et
  ses prix, l'essai, les pages, le contact). Rien n'y est affirmé que les pages
  ne disent pas déjà.
- **Proxy** : les trois fichiers ouverts à l'adresse exacte ; slugs réservés.
- **Origine canonique** : `origineCanonique()` lit `PORTAIL_URL` et ramène
  l'apex à `www.` ; `metadataBase` posée dans le layout.
- **Métadonnées des pages** (`métadonnéesDeVitrine`) : titre, description, URL
  canonique, Open Graph (`fr_FR`), carte `summary_large_image`, et
  `max-snippet: -1`, `max-image-preview: large` pour Google, qui conditionnent
  les extraits longs et la reprise dans les réponses générées.
- **Image de partage** `public/vitrine/partage.png`, 1 200 × 630, à la charte
  (bande encre, motif, mot-symbole, baseline en Lora italique).
- **Données structurées** reliées par `@id` : `Organization`, `WebSite`,
  `Service` avec ses offres et `FAQPage` sur l'accueil ; `Organization`,
  `Service` (offre early adopter comprise) et `FAQPage` sur `/tarifs`. Les
  questions fréquentes sont un seul tableau, rendu à l'écran et posé dans le
  JSON-LD : les deux ne peuvent plus diverger.
- **Titres** : « Veille stratégique et concurrentielle hebdomadaire ·
  signauxfaibles », « Tarifs de la veille stratégique : 149 € HT par mois ·
  signauxfaibles », « Exemples de lettres de veille stratégique ·
  signauxfaibles ». Ils reprennent les mots du `h1` de l'accueil.
- **`/demo`** : `h1`, description, canonique, `noindex, follow`.
- **Courriel de démonstration** : en-tête `X-Robots-Tag: noindex, follow`.

Garde : `tests/vitrine.referencement.test.ts` (robots, sitemap, métadonnées,
noindex du portail, FAQ identique à l'écran, prix lus dans l'offre, llms.txt).

## 3. Ce qui reste à décider par l'opératrice

1. **Robots d'entraînement** (GPTBot, ClaudeBot, Google-Extended,
   Applebot-Extended, CCBot) : admis, comme ils l'étaient de fait. Les admettre
   fait entrer la marque dans ce que les modèles savent sans chercher ; les
   refuser n'enlève rien à la citation en direct. Recommandation : les garder.
2. **Liens `sameAs` de l'`Organization`** : page LinkedIn de signauxfaibles,
   profil de la fondatrice, fiche Societe.com ou Pappers. Ce sont les liens qui
   permettent à un moteur de reconnaître l'entité et de la citer avec
   confiance. À fournir.
3. **Mentions légales et page « Qui sommes-nous »** : absentes. Obligatoires en
   France (LCEN, art. 6) et premier signal de confiance (E-E-A-T) pour Google
   comme pour les moteurs de réponse. Il faut la raison sociale, le SIREN,
   l'adresse et la directrice de publication.
4. **Contenus citables** : une vitrine de trois pages n'offre que peu de
   réponses à citer. Pages proposées, à rédiger avec l'opératrice : « Qu'est-ce
   que la veille stratégique » (définition, différence avec la veille
   concurrentielle et l'alerte), « Veille interne, outil ou service rédigé :
   comparatif chiffré », une page par profil de client (cabinet de conseil,
   PME industrielle, ESS, collectivité ou CCI), et une méthode (sources,
   niveaux d'impact, rythme). Chacune avec une réponse directe en tête, des
   chiffres sourcés et une date de mise à jour.
5. **Citer les clients** : les logos sont affichés ; les nommer dans le texte,
   le JSON-LD ou `llms.txt` (et ajouter des témoignages) renforcerait la
   preuve, mais suppose leur accord.
6. **Indexer `/demo`** : laissé hors index (formulaire sans contenu).
7. **Présence hors site** (GEO) : annuaires de logiciels (Capterra, G2,
   Appvizer), articles invités, comparatifs. Les moteurs de réponse citent bien
   plus souvent des sources tierces que le site de la marque.
8. **Search Console et Bing Webmaster Tools** : déclarer le sitemap une fois la
   PR déployée ; Bing alimente aussi ChatGPT et Copilot.
