/**
 * La lettre de démonstration de la vitrine (`/exemple`, 23 octobre 2026).
 *
 * C'est une édition réelle : la veille de Next Impact, l'entreprise de
 * l'opératrice, du 21 octobre 2026, produite par le moteur et acceptée par ses
 * portes (`evaluation/sorties/2026-10-22T07-13-56/next-impact`). Jamais la
 * lettre d'un client : elle serait publique. Deux retraits par rapport à la
 * sortie du moteur, et rien d'autre : la liste « Sources non consultées »
 * (rapport de collecte, qui ne va plus au client depuis le 22 octobre) et le
 * dossier France Num, qui porte sur la fiche de Next Impact elle-même. Un fait
 * de l'axe ② est réécrit en une phrase, le lint de production n'en admettant
 * plus trois.
 *
 * Le texte est du Markdown, converti par `markdownVersBlocs`, le convertisseur
 * de production : la page rend la lettre avec le même parseur et les mêmes
 * composants que l'espace client. Elle ne lit ni Notion ni Postgres.
 */
export const LETTRE_DE_DÉMONSTRATION = {
  organisation: 'Next Impact',
  veille: 'Veille de Next Impact',
  numéro: 1,
  dateÉdition: '2026-10-21',
  périodeCouverte: 'du 14 au 21 octobre 2026',
  actionDeLaSemaine: "Vérifier cette semaine, sur les sites suivis, la suppression des clés UpdraftCentral et le passage de PHP en 8.5.12, 8.4.27, 8.3.36 ou 8.2.35.",
  markdown: `# L'essentiel

- Des clés UpdraftCentral volées ont servi à piéger des sites WordPress les 18 et 19 octobre, selon Patchstack.
- PHP corrige deux failles critiques d'exécution de code à distance, exploitées selon Patchstack le 21 octobre.
- WordPress 7.2 sort en bêta 1 le 20 octobre ; la bêta 2 est prévue le 27 octobre.
- Next.js corrige le 14 octobre une faille critique d'exécution de code à distance dans ses versions 16.4.1 et 15.5.28.
- Google ajoute le 15 octobre des liens dans AI Mode et les Aperçus IA, sans publier de données de clics.
- Le projet de loi Résilience n'est pas réinscrit à l'ordre du jour de l'Assemblée nationale le 13 octobre.
- WPFormation met à jour le 16 octobre son offre headless : Run de 290 à 590 € hors taxes par mois.

# Actualités par axe

## ① Sécurité des sites WordPress — FORT

Patchstack signale le 19 octobre qu'un attaquant muni de clés UpdraftCentral volées a installé pendant 18 heures des portes dérobées sur des sites WordPress connectés à UpdraftPlus. ([patchstack.com](https://patchstack.com/articles/updraftcentral-key-compromise-wordpress-backdoors/), [wordfence.com](https://www.wordfence.com/blog/))

Patchstack signale le 21 octobre que deux failles critiques de PHP permettent d'exécuter du code à distance sans authentification et sont déjà exploitées. ([patchstack.com](https://patchstack.com/articles/php-major-vulnerability-alert-10-2026/), [wordpress.org](https://wordpress.org/news/2026/10/critical-php-security-release/))

## ② WordPress et piles headless — MOYEN

La version bêta 1 de WordPress 7.2 est publiée le 20 octobre, et la bêta 2 est prévue le 27 octobre. ([wordpress.org](https://wordpress.org/news/2026/10/wordpress-7-2-beta-1-is-ready-for-download-and-testing/), [make.wordpress.org](https://make.wordpress.org/core/2026/10/21/dev-chat-agenda-oct-21-2026/))

Next.js publie le 14 octobre les versions 16.4.1 et 15.5.28, qui corrigent une exécution de code à distance sans authentification de gravité critique. ([nextjs.org](https://nextjs.org/blog/nextjs-security-update-october-14-2026))

## ③ IA et production des sites — MOYEN

Gemini 4 Argon, le modèle de Google, prend la première place du classement Text Arena devant Anthropic, selon le Blog du Modérateur du 19 octobre. ([blogdumoderateur.com](https://www.blogdumoderateur.com/top-20-modeles-ia-performants-octobre-2026/))

Au 21 octobre, IOActive affiche que 31,6 % des échantillons de code produits par 27 modèles d'intelligence artificielle testés sont entièrement exploitables. (élément de contexte, non nouveau) ([ioactive.com](https://www.ioactive.com/the-security-gap-in-ai-generated-code/))

## ④ Recherche et visibilité à l'heure de l'IA — MOYEN

Google annonce le 15 octobre davantage de liens, placés plus haut, dans AI Mode et les Aperçus IA, sans publier de données sur les clics. ([abondance.com](https://www.abondance.com/))

Minddex publie le 16 octobre une étude sur 151 718 réponses françaises : 7,8 % des vidéos YouTube citées par les Aperçus IA figurent dans les résultats classiques. ([abondance.com](https://www.abondance.com/20261021-3027287-suivi-position-mesure-visibilite-sociale-ia-minddex.html))

## ⑤ Obligations réglementaires des sites — MOYEN

La Conférence des présidents de l'Assemblée nationale ne réinscrit pas le 13 octobre le projet de loi Résilience, retiré de l'ordre du jour le 6 octobre sans nouvelle date. (élément de contexte, non nouveau) ([forum-des-competences.org](https://www.forum-des-competences.org/loi-resilience-nis2/))

Au 21 octobre, la direction interministérielle du numérique annonce la version 5 de la norme française d'accessibilité numérique (RGAA) pour fin 2026. (élément de contexte, non nouveau) ([accessibilite.numerique.gouv.fr](https://accessibilite.numerique.gouv.fr/))

## ⑥ Demande numérique des PME et de l'ESS, aides publiques — MOYEN

Le baromètre France Num 2026, mis à jour le 12 octobre, indique que 71 % des dirigeants de très petites et moyennes entreprises voient un bénéfice réel au numérique, soit 7 points de moins. (élément de contexte, non nouveau) ([francenum.gouv.fr](https://www.francenum.gouv.fr/guides-et-conseils/strategie-numerique/comprendre-le-numerique/barometre-france-num-2026-le))

Au 21 octobre, la demande de site d'une association de vacances sur Codeur affiche 106 réponses de freelances. (élément de contexte, non nouveau) ([codeur.com](https://www.codeur.com/projects/491362-association-de-vacances-nous-developpons-notre-site-internet))

## ⑦ Achats inclusifs TIH et contribution OETH — MOYEN

L'Association de gestion du fonds pour l'insertion professionnelle des personnes handicapées (Agefiph) publie le 20 octobre les lauréats 2026 de ses Trophées de l'Innovation. ([agefiph.fr](https://www.agefiph.fr/personne-en-situation-de-handicap))

Au 21 octobre, Hosmoz annonce les Rendez-vous de l'Inclusion 2026 le 19 novembre à l'Institut Pasteur, à Paris. (élément de contexte, non nouveau) ([hosmoz.fr](https://www.hosmoz.fr/))

## ⑧ Prix et contenu de la maintenance WordPress — MOYEN

WeComm affiche depuis le 21 mai des forfaits de maintenance WordPress sans engagement à partir de 79 € hors taxes par mois. (élément de contexte, non nouveau) ([wecomm.fr](https://wecomm.fr/tarif-maintenance-wordpress/))

Au 21 octobre, Maintenance WP affiche son forfait de maintenance L'Essentiel à 39 € hors taxes par mois. (élément de contexte, non nouveau) ([maintenance-wp.fr](https://www.maintenance-wp.fr/maintenance-wordpress/))

## ⑨ Direction technique à temps partagé : paliers et engagements — MOYEN

Cœur du Web publie le 28 septembre un relevé de six grilles françaises : un jour de direction technique par mois coûte 500 à 1 500 € hors taxes par mois. (élément de contexte, non nouveau) ([coeurduweb.com](https://coeurduweb.com/offres/cto-externalise))

Au 21 octobre, Sicollab affiche son directeur informatique à temps partagé à 1 000 à 1 500 € hors taxes par mois pour un jour par mois. (élément de contexte, non nouveau) ([sicollab.com](https://www.sicollab.com/services/dsi-externalise-pme/))

## ⑩ Prix de l'audit, de la refonte et des web apps — MOYEN

Pilot'in publie le 21 octobre un guide sur la reprise de site web, sa méthode et son coût. ([pilot-in.com](https://www.pilot-in.com/blog/reprise-site-web/))

Agency Inside met à jour le 31 août sa page de sites pour associations, qui revendique 280 sites développés depuis 2006 et propose un audit gratuit. (élément de contexte, non nouveau) ([agency-inside.com](https://agency-inside.com/creation-site-web-association/))

## ⑪ Marque blanche et sous-traitance pour agences — MOYEN

Creative Web Dev. annonce le 9 septembre un dépannage WordPress en urgence sous 24 heures ouvrées, avec diagnostic gratuit. (élément de contexte, non nouveau) ([creative-webdeveloper.com](https://www.creative-webdeveloper.com/depannage-wordpress/))

Au 21 octobre, Creative Web Dev. affiche sa sous-traitance WordPress en marque blanche pour agences à 250 à 400 € par jour. (élément de contexte, non nouveau) ([creative-webdeveloper.com](https://www.creative-webdeveloper.com/sous-traitance-wordpress/))

## ⑫ Maintenance headless et migration vers headless — MOYEN

WPFormation met à jour le 16 octobre sa page headless : migration de 4 990 à 8 990 € hors taxes, puis Run de 290 à 590 € hors taxes par mois. ([wpformation.com](https://wpformation.com/migration-headless-wordpress/))

Lonestone publie le 20 octobre un guide qui chiffre la tierce maintenance applicative à 10 à 20 % du coût de création par an. ([lonestone.io](https://lonestone.io/blog/tma-informatique))

## ⑬ Créateurs de sites en libre-service IA — MOYEN

Bolt.new publie le 21 octobre un comparatif qui chiffre l'hébergement géré d'un site WordPress dès 336 dollars par an et propose son créateur de sites à la place. ([bolt.new](https://bolt.new/blog/wordpress-alternative))

Au 21 octobre, Simplébo affiche un site créé par un expert et une intelligence artificielle dès 30 € par mois, plus 200 € de lancement. (élément de contexte, non nouveau) ([simplebo.fr](https://www.simplebo.fr/tarifs))

# Dossiers suivis

Automattic et WP Engine : Sans changement : procès attendu le 19 octobre 2027.

UpdraftPlus : Patchstack signale le 19 octobre des portes dérobées installées avec des clés UpdraftCentral volées. On attend la confirmation par l'éditeur de la fin de la campagne.

DGCCRF : Sans changement : contrôles d'accessibilité hors e-commerce attendus, prochain relevé le 28 octobre.

Sicollab : Sans changement : grille de direction informatique inchangée, prochain relevé le 28 octobre.

Challenge My Project : Sans changement : palier de direction technique à vérifier, prochain relevé le 28 octobre.

WPFormation met à jour le 16 octobre sa page de migration headless, prix inchangés. On attend un éventuel changement de grille.

Lonestone publie le 20 octobre un guide de la tierce maintenance applicative. On attend un éventuel changement de son offre Run.

Webflow : Sans changement : suite d'AEO Analytics attendue, prochain relevé le 28 octobre.

Lovable publie le 20 octobre son bilan des nouveautés entreprise d'octobre et le 21 octobre une note sur la conformité des applications. On attend une offre visant les PME françaises.

`,
} as const
