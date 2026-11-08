import type { CléDeDémonstration } from '@/lib/domaine/demonstration'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'

/**
 * Les lettres hebdomadaires **fictives** des trois organisations de « Exemples »,
 * pour leurs espaces de démonstration (7 novembre 2026, demande de l'opératrice).
 * Chaque organisation a sa série, un lundi sur l'autre, dont la dernière lettre
 * est celle de « Exemples » et de l'accueil (`DÉMONSTRATIONS`) :
 *
 * - Lisière Conseil, du n° 7 au n° 14 (huit parutions) : l'accord-cadre de la
 *   Métropole de Valrive qui s'annonce puis s'ouvre, Cap Territoires qui lève des
 *   fonds, Orbis Public qui change de direction, le budget du Département de
 *   l'Ardaine qui glisse, Atelier Civique qui se tait ;
 * - Tolmen Mécanique, du n° 5 au n° 9 (cinq parutions) : Aérolys qui revoit ses
 *   plans 2027 puis relève ses cadences, Usinage Delmas qui glisse de la
 *   sauvegarde au redressement, Ferrovia Systèmes qui remporte le tramway de
 *   Valrive, Précimeca qui s'équipe ;
 * - Atelier Passerelle, du n° 2 au n° 6 (cinq parutions) : les aides au poste
 *   2027 qui se négocient, l'appel à projets Réemploi solidaire qui s'annonce
 *   puis s'ouvre, le marché réservé de Valrive, Le Fil vert qui ouvre sa
 *   seconde boutique, deux financements en instruction.
 *
 * Chaque lettre passe le lint de la lettre unique (`tests/vitrine.espace-demonstration.test.ts`),
 * comme une lettre qui part chez un client. Les dossiers suivis portent leur
 * compteur de semaines sans mouvement, d'une lettre à l'autre, pour que
 * « Acteurs » et la vue d'ensemble aient une vraie chronologie à montrer. Tout
 * est inventé : organisations, faits, sources (domaine réservé `.example`).
 */
export type LettreDeDémonstration = {
  readonly numéro: number
  readonly dateÉdition: string
  readonly périodeCouverte: string
  readonly actionDeLaSemaine: string
  readonly dossiers: string
  readonly markdown: string
}

// ── Lisière Conseil ─────────────────────────────────────────────────────────

const N7: LettreDeDémonstration = {
  numéro: 7,
  dateÉdition: '2026-08-31',
  périodeCouverte: 'du 24 au 30 août 2026',
  actionDeLaSemaine:
    'Confirmer avant le 5 septembre l’offre conjointe avec Atelier Civique sur les concertations de la Métropole de Valrive.',
  dossiers:
    "Département de l'Ardaine (0, orientations budgétaires 2027 présentées) · Orbis Public (0, recrute un directeur général) · Atelier Civique (0, partenariat de concertation signé) · Cap Territoires (1, rumeur de levée de fonds) · centrale d'achat Ardaine (3, marché de conseil échu en 2027)",
  markdown: `# L'essentiel

- Le Département de l'Ardaine présente le 27 août ses orientations budgétaires 2027 : les études sont gelées jusqu'au vote.
- Orbis Public ouvre le 25 août le recrutement de son directeur général, après le départ du fondateur.
- Atelier Civique signe le 28 août votre partenariat de concertation : l'offre conjointe sur Valrive peut partir.
- La Métropole de Valrive évoque le 26 août un accord-cadre de conseil pour l'automne, sans calendrier.
- Le fonds régional d'ingénierie écologique sera doté de 12 millions d'euros, selon une délibération du 28 août.

# Actualités par axe

## ① Appels d'offres des collectivités — MOYEN

La Métropole de Valrive indique le 26 août, dans son rapport d'activité, qu'un accord-cadre de conseil en transformation sera lancé à l'automne. Aucun calendrier ni allotissement n'est encore publié. ([source fictive](https://exemple.example/valrive-rapport-activite))

La commune fictive de Corlay attribue le 27 août son marché d'audit organisationnel à un cabinet parisien, pour 48 000 euros. Votre offre était deuxième sur la valeur technique. ([source fictive](https://exemple.example/corlay-attribution))

## ② Concurrents directs — MOYEN

Orbis Public publie le 25 août une annonce de recrutement de directeur général, le fondateur quittant ses fonctions au 1er novembre. La transition peut ralentir ses réponses aux appels d'offres de l'automne. ([source fictive](https://exemple.example/orbis-recrutement-dg))

Un article fictif de la presse économique régionale du 29 août prête à Cap Territoires un projet de levée de fonds à la rentrée. Rien n'est confirmé par le cabinet. ([source fictive](https://exemple.example/cap-territoires-rumeur))

## ③ Finances locales et budgets 2027 — FORT

Le Département de l'Ardaine présente le 27 août ses orientations budgétaires 2027 : les crédits d'études nouvelles sont gelés jusqu'au vote du budget, prévu en novembre. Vos deux propositions en attente ne seront pas instruites avant. ([source fictive](https://exemple.example/ardaine-orientations))

## ④ Commande publique : règles et seuils — RAS

> Aucun texte nouveau sur les seuils ni sur les procédures depuis le 12 août ; journal officiel fictif et portail régional vérifiés.

## ⑤ Intelligence artificielle dans les services publics — MOYEN

La Région Val-d'Ardaine annonce le 28 août une mission d'étude sur l'intelligence artificielle dans ses services, confiée en interne. Aucun cabinet n'est sollicité à ce stade. ([source fictive](https://exemple.example/region-ia-interne))

## ⑥ Centrales d'achat — RAS

> La centrale d'achat Ardaine n'a rien publié depuis le 7 juillet ; son marché de conseil arrive à échéance en 2027 sans annonce de consultation.

## ⑦ Recrutement et rémunérations — MOYEN

Le baromètre fictif de l'emploi du conseil, publié le 26 août, compte 140 offres de consultants secteur public en Auvergne-Rhône-Alpes, un record. Vos recrutements de l'hiver se feront sur un marché tendu. ([source fictive](https://exemple.example/barometre-emploi-conseil))

## ⑧ Événements du secteur public — MOYEN

Le salon des acteurs publics de Valrive annonce le 25 août ses dates, les 26 et 27 novembre, avec un atelier sur les achats de conseil. Les inscriptions des exposants ouvrent le 15 septembre. ([source fictive](https://exemple.example/salon-valrive-dates))

## ⑨ Transition écologique des territoires — MOYEN

La Région Val-d'Ardaine délibère le 28 août la création d'un fonds d'ingénierie écologique doté de 12 millions d'euros pour les communes. Les modalités d'accès seront publiées en octobre. ([source fictive](https://exemple.example/fonds-ingenierie-dotation))

## ⑩ Numérique et données publiques — RAS

> Aucun marché ni publication sur les données publiques dans la région depuis le 18 août ; trois portails de collectivités vérifiés.

## ⑪ Ressources humaines des collectivités — MOYEN

Le centre de gestion fictif de l'Ardaine publie le 27 août son bilan social : 38 % des postes de chef de projet ouverts en 2025 sont restés vacants plus de six mois. La demande d'appui extérieur devrait suivre. ([source fictive](https://exemple.example/cdg-bilan-social))

## ⑫ Partenaires et sous-traitants — FORT

Atelier Civique signe le 28 août le partenariat de concertation que vous lui proposiez depuis juin. Votre offre conjointe sur les concertations de Valrive peut être déposée. ([source fictive](https://exemple.example/atelier-civique-partenariat))

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 juin ; deux référentiels vérifiés.

# Dossiers suivis

Le Département de l'Ardaine a présenté le 27 août ses orientations budgétaires 2027 ; les études nouvelles attendent le vote.

Orbis Public recrute son directeur général depuis le 25 août.

Atelier Civique a signé le partenariat de concertation le 28 août.

Cap Territoires ferait l'objet d'une levée de fonds, selon la presse régionale ; rien de confirmé.

La centrale d'achat Ardaine n'a rien publié depuis trois semaines ; son marché de conseil échoit en 2027.
`,
}

const N8: LettreDeDémonstration = {
  numéro: 8,
  dateÉdition: '2026-09-07',
  périodeCouverte: 'du 31 août au 6 septembre 2026',
  actionDeLaSemaine:
    'Inscrire deux consultants à l’atelier achats du salon des acteurs publics de Valrive avant le 15 septembre.',
  dossiers:
    "Cap Territoires (0, levée de fonds confirmée) · accord-cadre Valrive (0, annoncé pour octobre) · Département de l'Ardaine (1, orientations budgétaires 2027 présentées) · Orbis Public (1, recrute un directeur général) · Atelier Civique (1, partenariat de concertation signé) · centrale d'achat Ardaine (4, marché de conseil échu en 2027)",
  markdown: `# L'essentiel

- Cap Territoires confirme le 2 septembre une levée de fonds en cours, sans en donner le montant.
- La Métropole de Valrive annonce le 3 septembre que son accord-cadre de conseil sera publié en octobre.
- Le guide régional fictif de la commande publique entre en révision le 1er septembre.
- Deux intercommunalités de l'Ardaine lancent des études de mutualisation, réponses fin septembre.
- Le salon des acteurs publics de Valrive ouvre ses inscriptions le 15 septembre.

# Actualités par axe

## ① Appels d'offres des collectivités — FORT

La Métropole de Valrive précise le 3 septembre, en conseil, que l'accord-cadre de conseil en transformation sera publié en octobre, en trois lots. Le lot « conduite du changement » est confirmé. ([source fictive](https://exemple.example/valrive-conseil-septembre))

La communauté de communes fictive du Val-Lizon publie le 4 septembre une étude de mutualisation de ses services techniques, réponses avant le 30 septembre. Mission de six mois, 35 000 euros. ([source fictive](https://exemple.example/val-lizon-mutualisation))

## ② Concurrents directs — FORT

Cap Territoires confirme le 2 septembre, par communiqué, qu'une levée de fonds est en cours de finalisation, sans montant ni calendrier. Le cabinet évoque « une présence renforcée en région ». ([source fictive](https://exemple.example/cap-territoires-communique))

## ③ Finances locales et budgets 2027 — MOYEN

L'association fictive des maires de l'Ardaine alerte le 5 septembre sur une baisse de 3 % des dotations attendue en 2027 pour les communes de moins de 5 000 habitants. Les petites missions d'études en pâtiront. ([source fictive](https://exemple.example/maires-ardaine-dotations))

## ④ Commande publique : règles et seuils — MOYEN

La Région Val-d'Ardaine ouvre le 1er septembre la révision de son guide de la commande publique, avec une consultation des cabinets jusqu'au 30 septembre. Vous pouvez y défendre la pondération de la valeur technique. ([source fictive](https://exemple.example/guide-revision))

## ⑤ Intelligence artificielle dans les services publics — RAS

> Aucun marché ni annonce sur l'intelligence artificielle dans les collectivités de la région depuis le 28 août ; quatre portails vérifiés.

## ⑥ Centrales d'achat — RAS

> La centrale d'achat Ardaine reste silencieuse depuis le 7 juillet ; aucune consultation n'est annoncée pour le marché de conseil de 2027.

## ⑦ Recrutement et rémunérations — MOYEN

Orbis Public publie le 4 septembre trois offres de consultants confirmés à Lyon, avec des salaires affichés 10 % au-dessus de votre grille. La concurrence sur les profils seniors s'accentue. ([source fictive](https://exemple.example/orbis-offres-lyon))

## ⑧ Événements du secteur public — MOYEN

Le salon des acteurs publics de Valrive ouvre le 15 septembre les inscriptions à ses ateliers, dont celui sur les achats de conseil, limité à quarante places. Les acheteurs de Valrive y interviendront. ([source fictive](https://exemple.example/salon-valrive-ateliers))

## ⑨ Transition écologique des territoires — MOYEN

Le syndicat fictif des eaux du Lizon annonce le 2 septembre une étude de fusion avec deux syndicats voisins, dont le marché sera lancé « avant la fin de l'année ». Une mission d'assistance de longue durée se profile. ([source fictive](https://exemple.example/syndicat-lizon-annonce))

## ⑩ Numérique et données publiques — MOYEN

La Métropole de Valrive publie le 5 septembre un bilan de son portail de données, qui annonce un chantier de gouvernance en 2027. Le chantier sera conduit avec un prestataire. ([source fictive](https://exemple.example/valrive-donnees-bilan))

## ⑪ Ressources humaines des collectivités — RAS

> Aucune publication nouvelle sur l'emploi des collectivités de la région depuis le bilan social du 27 août ; centre de gestion et observatoire vérifiés.

## ⑫ Partenaires et sous-traitants — MOYEN

Atelier Civique annonce le 3 septembre la signature d'un partenariat avec un second cabinet, à Grenoble, pour la concertation. Votre exclusivité ne couvre que les marchés lyonnais. ([source fictive](https://exemple.example/atelier-civique-grenoble))

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 juin ; deux référentiels vérifiés.

# Dossiers suivis

Cap Territoires a confirmé sa levée de fonds le 2 septembre.

L'accord-cadre Valrive est annoncé pour octobre, en trois lots.

Le Département de l'Ardaine n'a rien ajouté à ses orientations budgétaires du 27 août.

Orbis Public recrute toujours son directeur général, sans annonce.

Atelier Civique a signé votre partenariat la semaine passée et en signe un second à Grenoble.

La centrale d'achat Ardaine n'a rien publié depuis quatre semaines.
`,
}

const N9: LettreDeDémonstration = {
  numéro: 9,
  dateÉdition: '2026-09-14',
  périodeCouverte: 'du 7 au 13 septembre 2026',
  actionDeLaSemaine:
    'Constituer le dossier de références communales pour l’accord-cadre Valrive avant le 30 septembre.',
  dossiers:
    "Orbis Public (0, trois candidats pour la direction générale) · accord-cadre Valrive (1, annoncé pour octobre) · Cap Territoires (1, levée de fonds confirmée) · Département de l'Ardaine (2, orientations budgétaires 2027 présentées) · Atelier Civique (2, partenariat de concertation signé) · centrale d'achat Ardaine (5, marché de conseil échu en 2027)",
  markdown: `# L'essentiel

- Orbis Public auditionne le 10 septembre trois candidats à la direction générale, dont un associé d'un cabinet national.
- La Métropole de Valrive publie le 9 septembre le règlement type de ses accords-cadres : trois références communales exigées.
- Le décret fictif sur les seuils de la commande publique est mis en consultation le 11 septembre.
- Une enquête fictive du 8 septembre place le conseil en organisation en tête des besoins des communes moyennes.
- Le Département de l'Ardaine lance le 12 septembre un appel à candidatures pour son conseil scientifique.

# Actualités par axe

## ① Appels d'offres des collectivités — MOYEN

La Métropole de Valrive publie le 9 septembre le règlement type de ses accords-cadres de prestations intellectuelles : trois références communales de moins de trois ans sont exigées par lot. Vos références de 2024 et 2025 comptent, celle de 2022 non. ([source fictive](https://exemple.example/valrive-reglement-type))

## ② Concurrents directs — FORT

Orbis Public auditionne le 10 septembre trois candidats à la direction générale, dont un associé d'un cabinet national d'achats publics, selon la presse économique fictive. Une orientation vers les achats changerait son positionnement. ([source fictive](https://exemple.example/orbis-auditions))

Cap Territoires recrute le 12 septembre un directeur régional pour Auvergne-Rhône-Alpes, venu d'un grand cabinet. Le poste est basé à Lyon. ([source fictive](https://exemple.example/cap-territoires-directeur-regional))

## ③ Finances locales et budgets 2027 — MOYEN

La Cour fictive des comptes régionale publie le 11 septembre un rapport sur les dépenses d'études du Département de l'Ardaine, jugées « peu suivies ». Le Département devra justifier chaque étude nouvelle. ([source fictive](https://exemple.example/crc-ardaine))

## ④ Commande publique : règles et seuils — MOYEN

Un projet de décret fictif relevant le seuil des marchés sans publicité est mis en consultation le 11 septembre, pour une entrée en vigueur au 1er janvier. Le seuil envisagé est de 60 000 euros. ([source fictive](https://exemple.example/decret-consultation))

## ⑤ Intelligence artificielle dans les services publics — MOYEN

La Communauté d'agglomération du Haut-Lizon vote le 8 septembre une feuille de route sur l'intelligence artificielle à l'accueil des usagers, avec un marché de cadrage à venir. Le cadrage est budgété à 30 000 euros. ([source fictive](https://exemple.example/haut-lizon-feuille-de-route))

## ⑥ Centrales d'achat — RAS

> La centrale d'achat Ardaine n'a rien publié depuis le 7 juillet ; le renouvellement du marché de conseil de 2027 reste sans calendrier.

## ⑦ Recrutement et rémunérations — RAS

> Aucune offre nouvelle de vos concurrents ni étude de rémunération depuis le 4 septembre ; sites et baromètre vérifiés.

## ⑧ Événements du secteur public — MOYEN

Les rencontres régionales des directeurs généraux des services, le 4 décembre, publient le 9 septembre leur appel à intervenants, clos le 31 octobre. Le thème est la transformation des services. ([source fictive](https://exemple.example/rencontres-dgs-appel))

## ⑨ Transition écologique des territoires — RAS

> Aucune publication nouvelle sur les fonds et plans écologiques régionaux depuis le 2 septembre ; Région et syndicat du Lizon vérifiés.

## ⑩ Numérique et données publiques — MOYEN

Une association fictive de collectivités ouvre le 10 septembre la rédaction d'un référentiel de gouvernance des données, attendu pour octobre. Trois métropoles participent au groupe de travail. ([source fictive](https://exemple.example/referentiel-redaction))

## ⑪ Ressources humaines des collectivités — MOYEN

Une enquête fictive publiée le 8 septembre place le conseil en organisation en tête des besoins d'appui extérieur des communes de 10 000 à 50 000 habitants. 54 % d'entre elles prévoient une mission d'ici 2027. ([source fictive](https://exemple.example/enquete-besoins))

Le Département de l'Ardaine lance le 12 septembre un appel à candidatures pour son conseil scientifique de la transformation publique. Les candidatures ferment le 15 octobre. ([source fictive](https://exemple.example/ardaine-conseil-scientifique))

## ⑫ Partenaires et sous-traitants — RAS

> Atelier Civique n'a rien publié depuis le 3 septembre ; votre offre conjointe sur Valrive est en préparation.

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 juin ; deux référentiels vérifiés.

# Dossiers suivis

Orbis Public auditionne trois candidats à la direction générale depuis le 10 septembre.

L'accord-cadre Valrive est attendu en octobre ; le règlement type exige trois références communales par lot.

Cap Territoires recrute un directeur régional à Lyon, après sa levée de fonds.

Le Département de l'Ardaine n'a rien ajouté à ses orientations budgétaires depuis deux semaines.

Atelier Civique reste sans nouvelle depuis le partenariat de Grenoble.

La centrale d'achat Ardaine n'a rien publié depuis cinq semaines.
`,
}

const N10: LettreDeDémonstration = {
  numéro: 10,
  dateÉdition: '2026-09-21',
  périodeCouverte: 'du 14 au 20 septembre 2026',
  actionDeLaSemaine:
    'Répondre avant le 3 octobre à l’enquête de la centrale d’achat Ardaine, qui prépare son prochain marché de conseil.',
  dossiers:
    "Département de l'Ardaine (0, débat d'orientation budgétaire reporté) · Cap Territoires (0, bureau de recrutement ouvert à Lyon) · centrale d'achat Ardaine (0, enquête auprès des adhérents) · Orbis Public (1, trois candidats pour la direction générale) · accord-cadre Valrive (2, annoncé pour octobre) · Atelier Civique (3, partenariat de concertation signé)",
  markdown: `# L'essentiel

- Le Département de l'Ardaine reporte le 17 septembre son débat d'orientation budgétaire au 22 octobre.
- La centrale d'achat Ardaine interroge ses adhérents le 15 septembre sur leurs besoins de conseil pour 2027.
- Cap Territoires ouvre le 18 septembre un bureau de recrutement à Lyon, huit postes prévus.
- Le fonds régional d'ingénierie écologique publie le 16 septembre son règlement : 70 % des études financées.
- Trois communes de l'Ardaine s'associent pour un marché de conseil en organisation, consultation en novembre.

# Actualités par axe

## ① Appels d'offres des collectivités — MOYEN

Trois communes fictives de l'Ardaine annoncent le 19 septembre un groupement de commandes pour un marché de conseil en organisation, consultation prévue en novembre. Le montant cumulé serait de 90 000 euros. ([source fictive](https://exemple.example/groupement-ardaine))

## ② Concurrents directs — FORT

Cap Territoires ouvre le 18 septembre un bureau de recrutement à Lyon et annonce huit postes de consultants d'ici juin. C'est la première traduction concrète de sa levée de fonds dans la région. ([source fictive](https://exemple.example/cap-territoires-bureau-lyon))

## ③ Finances locales et budgets 2027 — FORT

Le Département de l'Ardaine reporte le 17 septembre son débat d'orientation budgétaire au 22 octobre, dans l'attente des arbitrages de l'État sur les dotations. Le vote du budget glissera en décembre au plus tôt. ([source fictive](https://exemple.example/ardaine-dob-report))

## ④ Commande publique : règles et seuils — RAS

> Aucune suite à la consultation du projet de décret du 11 septembre ; journal officiel fictif et portail régional vérifiés le 19 septembre.

## ⑤ Intelligence artificielle dans les services publics — MOYEN

La ville fictive de Corlay publie le 16 septembre un bilan de son expérimentation d'assistant conversationnel, jugée « non concluante » faute de cadrage. Les collectivités chercheront d'abord un cadrage avant d'outiller. ([source fictive](https://exemple.example/corlay-bilan-ia))

## ⑥ Centrales d'achat — FORT

La centrale d'achat Ardaine adresse le 15 septembre à ses adhérents une enquête sur leurs besoins de conseil pour 2027, réponses attendues le 3 octobre. C'est le premier signe du renouvellement de son marché. ([source fictive](https://exemple.example/centrale-ardaine-enquete))

## ⑦ Recrutement et rémunérations — MOYEN

Une école fictive de management public publie le 17 septembre son enquête d'insertion : 61 % des diplômés rejoignent un cabinet, contre 48 % en 2024. Le vivier de jeunes consultants s'élargit. ([source fictive](https://exemple.example/insertion-diplomes))

## ⑧ Événements du secteur public — RAS

> Aucune annonce nouvelle depuis l'ouverture des inscriptions au salon de Valrive le 15 septembre ; programmes vérifiés.

## ⑨ Transition écologique des territoires — MOYEN

La Région Val-d'Ardaine publie le 16 septembre le règlement du fonds d'ingénierie écologique : jusqu'à 70 % des études de planification des communes, dossiers à partir du 14 octobre. Les communes de moins de 3 500 habitants sont prioritaires. ([source fictive](https://exemple.example/fonds-reglement))

## ⑩ Numérique et données publiques — RAS

> Aucun marché ni publication nouvelle sur les données publiques dans la région depuis le 10 septembre ; portails vérifiés.

## ⑪ Ressources humaines des collectivités — MOYEN

Le centre de gestion fictif de l'Ardaine annonce le 18 septembre un marché d'appui aux réorganisations de services pour octobre, destiné aux communes adhérentes. Le périmètre est l'organisation des services, votre cœur de métier. ([source fictive](https://exemple.example/cdg-annonce-marche))

## ⑫ Partenaires et sous-traitants — RAS

> Atelier Civique n'a rien publié depuis le 3 septembre ; votre offre conjointe sur Valrive attend le règlement de l'accord-cadre.

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 juin ; deux référentiels vérifiés.

# Dossiers suivis

Le Département de l'Ardaine a reporté son débat d'orientation budgétaire au 22 octobre.

Cap Territoires a ouvert un bureau de recrutement à Lyon le 18 septembre.

La centrale d'achat Ardaine interroge ses adhérents sur leurs besoins de conseil pour 2027.

Orbis Public n'a pas annoncé le nom de son directeur général.

L'accord-cadre Valrive est toujours attendu en octobre.

Atelier Civique reste silencieux depuis trois semaines.
`,
}

const N11: LettreDeDémonstration = {
  numéro: 11,
  dateÉdition: '2026-09-28',
  périodeCouverte: 'du 21 au 27 septembre 2026',
  actionDeLaSemaine:
    'Bloquer les 15 et 16 octobre pour lire l’accord-cadre Valrive dès sa publication, annoncée le 14 octobre.',
  dossiers:
    "accord-cadre Valrive (0, publication le 14 octobre) · schéma numérique Saint-Aubert (0, étude décidée en conseil) · Département de l'Ardaine (1, débat d'orientation budgétaire reporté) · Cap Territoires (1, bureau de recrutement ouvert à Lyon) · centrale d'achat Ardaine (1, enquête auprès des adhérents) · Orbis Public (2, trois candidats pour la direction générale) · Atelier Civique (4, partenariat de concertation signé)",
  markdown: `# L'essentiel

- La Métropole de Valrive fixe le 24 septembre la publication de son accord-cadre de conseil au 14 octobre.
- La commune de Saint-Aubert décide le 22 septembre une étude de schéma numérique, consultation en octobre.
- Le guide régional de la commande publique retient le 25 septembre une pondération technique de 40 % au moins.
- Une étude fictive du 23 septembre évalue à 8 % la hausse des salaires des consultants seniors du secteur public.
- La Métropole de Valrive mettra son plan climat au vote le 16 octobre.

# Actualités par axe

## ① Appels d'offres des collectivités — FORT

La Métropole de Valrive annonce le 24 septembre que l'accord-cadre de conseil en transformation sera publié le 14 octobre, pour quatre ans et en trois lots. Les candidatures seront ouvertes trois semaines. ([source fictive](https://exemple.example/valrive-date-publication))

La commune fictive de Saint-Aubert décide le 22 septembre, en conseil municipal, une étude de schéma numérique, dont la consultation sera lancée en octobre. Le budget voté est de 40 000 euros. ([source fictive](https://exemple.example/saint-aubert-deliberation))

## ② Concurrents directs — MOYEN

Préfigure, cabinet national fictif, est cité le 26 septembre parmi les trois finalistes de la réorganisation de la ville de Corlay. Ce serait sa première mission dans la région. ([source fictive](https://exemple.example/prefigure-finaliste))

## ③ Finances locales et budgets 2027 — RAS

> Rien de nouveau depuis le report du débat d'orientation budgétaire de l'Ardaine au 22 octobre ; ordres du jour vérifiés le 26 septembre.

## ④ Commande publique : règles et seuils — MOYEN

La Région Val-d'Ardaine clôt le 25 septembre la révision de son guide de la commande publique et retient une pondération de la valeur technique de 40 % au moins pour le conseil. Le guide sera publié en octobre. ([source fictive](https://exemple.example/guide-ponderation))

## ⑤ Intelligence artificielle dans les services publics — MOYEN

La Région Val-d'Ardaine annonce le 23 septembre qu'elle confiera à deux cabinets la rédaction d'un guide de doctrine sur l'intelligence artificielle, attendu en janvier. La consultation des cabinets n'est pas encore publiée. ([source fictive](https://exemple.example/region-guide-doctrine))

## ⑥ Centrales d'achat — RAS

> La centrale d'achat Ardaine recueille les réponses de ses adhérents jusqu'au 3 octobre ; rien de nouveau depuis le 15 septembre.

## ⑦ Recrutement et rémunérations — MOYEN

Une étude fictive publiée le 23 septembre évalue à 8 % la hausse des salaires d'embauche des consultants seniors du secteur public en un an. Vos deux recrutements de l'hiver coûteront plus cher que budgété. ([source fictive](https://exemple.example/etude-salaires-septembre))

## ⑧ Événements du secteur public — MOYEN

Le salon des acteurs publics de Valrive publie le 22 septembre son programme provisoire : l'atelier sur les achats de conseil est fixé au 26 novembre. Deux acheteurs de la Métropole y interviennent. ([source fictive](https://exemple.example/salon-programme-provisoire))

## ⑨ Transition écologique des territoires — MOYEN

La Métropole de Valrive inscrit le 25 septembre son plan climat à l'ordre du jour du conseil du 16 octobre. Le projet prévoit une assistance à maîtrise d'ouvrage pour chaque commune membre. ([source fictive](https://exemple.example/valrive-plan-climat-ordre-du-jour))

## ⑩ Numérique et données publiques — RAS

> Le référentiel de gouvernance des données est toujours en rédaction ; aucune publication nouvelle depuis le 10 septembre.

## ⑪ Ressources humaines des collectivités — RAS

> Le marché d'appui aux réorganisations du centre de gestion de l'Ardaine n'est pas encore publié ; portail vérifié le 26 septembre.

## ⑫ Partenaires et sous-traitants — MOYEN

Un collectif fictif de designers de services publics organise le 27 septembre une rencontre avec des cabinets de conseil lyonnais, en vue de partenariats. Une solution de repli si Atelier Civique ne répond pas. ([source fictive](https://exemple.example/collectif-design-rencontre))

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 juin ; deux référentiels vérifiés.

# Dossiers suivis

L'accord-cadre Valrive sera publié le 14 octobre, en trois lots.

Le schéma numérique Saint-Aubert a été décidé le 22 septembre ; la consultation suit en octobre.

Le Département de l'Ardaine tient son débat d'orientation budgétaire le 22 octobre.

Cap Territoires recrute à Lyon depuis le 18 septembre.

La centrale d'achat Ardaine attend les réponses de ses adhérents jusqu'au 3 octobre.

Orbis Public n'a toujours pas nommé son directeur général.

Atelier Civique reste silencieux depuis quatre semaines.
`,
}

const N12: LettreDeDémonstration = {
  numéro: 12,
  dateÉdition: '2026-10-05',
  périodeCouverte: 'du 28 septembre au 4 octobre 2026',
  actionDeLaSemaine:
    'Relancer Atelier Civique avant le 10 octobre sur l’offre conjointe de concertation, et préparer un repli avec le collectif de designers.',
  dossiers:
    "Atelier Civique (0, dernier message le 30 septembre, refonte annoncée) · accord-cadre Valrive (1, publication le 14 octobre) · schéma numérique Saint-Aubert (1, étude décidée en conseil) · Département de l'Ardaine (2, débat d'orientation budgétaire reporté) · Cap Territoires (2, bureau de recrutement ouvert à Lyon) · centrale d'achat Ardaine (2, enquête auprès des adhérents) · Orbis Public (3, trois candidats pour la direction générale)",
  markdown: `# L'essentiel

- Atelier Civique annonce le 30 septembre une refonte de son activité et suspend ses réponses jusqu'à mi-octobre.
- Le guide régional de la commande publique est publié le 2 octobre, avec sa pondération technique de 40 %.
- La Communauté d'agglomération du Haut-Lizon annonce le 1er octobre son appel d'offres sur l'intelligence artificielle pour la mi-octobre.
- Une centrale d'achat nationale fictive prépare un catalogue de missions courtes de conseil, ouverture en octobre.
- Le Département de l'Ardaine annonce le 3 octobre la refonte de son portail de données en 2027.

# Actualités par axe

## ① Appels d'offres des collectivités — MOYEN

La Communauté d'agglomération du Haut-Lizon annonce le 1er octobre que son appel d'offres de cadrage de l'intelligence artificielle sera publié à la mi-octobre. Le marché est estimé à 30 000 euros. ([source fictive](https://exemple.example/haut-lizon-annonce-ao))

## ② Concurrents directs — MOYEN

Orbis Public confirme le 2 octobre que son directeur général sera nommé « dans les quinze jours », sans donner de nom. Le cabinet reporte deux réponses à des consultations en attendant. ([source fictive](https://exemple.example/orbis-nomination-imminente))

## ③ Finances locales et budgets 2027 — MOYEN

L'observatoire régional fictif des finances locales annonce le 1er octobre une note sur les dépenses d'études des communes, à paraître mi-octobre. Les premiers éléments font état d'un recul en 2027. ([source fictive](https://exemple.example/observatoire-annonce))

## ④ Commande publique : règles et seuils — FORT

Le guide régional fictif de la commande publique est publié le 2 octobre : la valeur technique des offres de conseil est pondérée à 40 % au moins. Les collectivités de la région sont invitées à l'appliquer dès les consultations d'automne. ([source fictive](https://exemple.example/guide-publication))

## ⑤ Intelligence artificielle dans les services publics — MOYEN

La ville fictive de Corlay relance le 3 octobre son projet d'assistant conversationnel, précédé cette fois d'une mission de cadrage confiée à un cabinet. La consultation est attendue en novembre. ([source fictive](https://exemple.example/corlay-relance-ia))

## ⑥ Centrales d'achat — MOYEN

Une centrale d'achat nationale fictive annonce le 30 septembre un catalogue de missions courtes de conseil, de cinq à vingt jours, accessible sans mise en concurrence, ouvert en octobre. Le référencement des cabinets se fera sur dossier. ([source fictive](https://exemple.example/centrale-nationale-annonce))

## ⑦ Recrutement et rémunérations — RAS

> Aucune offre nouvelle de vos concurrents à Lyon depuis le 18 septembre ; sites et baromètre vérifiés le 3 octobre.

## ⑧ Événements du secteur public — RAS

> Programme du salon de Valrive et appel à intervenants des rencontres des directeurs généraux inchangés depuis le 22 septembre.

## ⑨ Transition écologique des territoires — MOYEN

Le syndicat fictif des eaux du Lizon confirme le 2 octobre que son marché d'assistance à la fusion sera publié avant la fin octobre, pour dix-huit mois. Le cahier des charges est en relecture. ([source fictive](https://exemple.example/syndicat-lizon-confirmation))

## ⑩ Numérique et données publiques — MOYEN

Le Département de l'Ardaine annonce le 3 octobre la refonte de son portail de données ouvertes en 2027, avec un marché d'accompagnement. Votre mission de 2025 sur leurs données vous qualifie. ([source fictive](https://exemple.example/ardaine-donnees-annonce))

## ⑪ Ressources humaines des collectivités — RAS

> Le marché d'appui aux réorganisations du centre de gestion de l'Ardaine n'est pas encore publié ; portail vérifié le 3 octobre.

## ⑫ Partenaires et sous-traitants — FORT

Atelier Civique annonce le 30 septembre, par un message à ses partenaires, une refonte de son activité et la suspension de ses réponses jusqu'à la mi-octobre. Votre offre conjointe sur Valrive dépend de sa reprise. ([source fictive](https://exemple.example/atelier-civique-refonte))

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 juin ; deux référentiels vérifiés.

# Dossiers suivis

Atelier Civique a annoncé une refonte le 30 septembre et ne répond plus jusqu'à la mi-octobre.

L'accord-cadre Valrive sera publié le 14 octobre.

Le schéma numérique Saint-Aubert attend sa consultation, prévue en octobre.

Le Département de l'Ardaine tient son débat d'orientation budgétaire le 22 octobre.

Cap Territoires n'a rien annoncé de nouveau depuis l'ouverture de son bureau lyonnais.

La centrale d'achat Ardaine dépouille les réponses de son enquête.

Orbis Public nommera son directeur général dans les quinze jours.
`,
}

const N13: LettreDeDémonstration = {
  numéro: 13,
  dateÉdition: '2026-10-12',
  périodeCouverte: 'du 5 au 11 octobre 2026',
  actionDeLaSemaine:
    'Préparer la fiche de référencement pour le renouvellement 2027 du marché de conseil de la centrale d’achat Ardaine.',
  dossiers:
    "centrale d'achat Ardaine (0, renouvellement du marché confirmé pour 2027) · Département de l'Ardaine (0, calendrier budgétaire en débat) · Atelier Civique (1, dernier message le 30 septembre, refonte annoncée) · accord-cadre Valrive (2, publication le 14 octobre) · schéma numérique Saint-Aubert (2, étude décidée en conseil) · Cap Territoires (3, bureau de recrutement ouvert à Lyon) · Orbis Public (4, trois candidats pour la direction générale)",
  markdown: `# L'essentiel

- La centrale d'achat Ardaine confirme le 8 octobre que son marché de conseil sera renouvelé en 2027, résultats de l'enquête à l'appui.
- Le Département de l'Ardaine envisage le 9 octobre de reporter le vote de son budget 2027 à décembre.
- Le décret fictif sur les seuils est annoncé pour la semaine du 13 octobre.
- Le fonds régional d'ingénierie écologique ouvre ses dossiers le 14 octobre.
- Le centre de gestion de l'Ardaine publiera son marché d'appui aux réorganisations « mi-octobre ».

# Actualités par axe

## ① Appels d'offres des collectivités — MOYEN

La commune fictive de Saint-Aubert indique le 7 octobre que la consultation de son schéma numérique sera publiée « dans les dix jours », pour des réponses mi-novembre. Le cahier des charges demandera une référence communale récente. ([source fictive](https://exemple.example/saint-aubert-consultation-imminente))

## ② Concurrents directs — MOYEN

Cap Territoires annonce le 9 octobre la signature de deux missions dans l'Ardaine, pour des intercommunalités de taille moyenne. Ce sont ses premières références dans le département. ([source fictive](https://exemple.example/cap-territoires-missions-ardaine))

## ③ Finances locales et budgets 2027 — FORT

Le Département de l'Ardaine envisage le 9 octobre, en commission des finances, de reporter le vote de son budget 2027 à décembre, faute d'arbitrage sur les dotations. Les études du premier trimestre risquent de glisser. ([source fictive](https://exemple.example/ardaine-commission-finances))

## ④ Commande publique : règles et seuils — MOYEN

Le ministère fictif annonce le 10 octobre la publication du décret sur les seuils des marchés sans publicité pour la semaine du 13 octobre. Le seuil de 60 000 euros est confirmé dans le projet. ([source fictive](https://exemple.example/decret-annonce))

## ⑤ Intelligence artificielle dans les services publics — RAS

> L'appel d'offres du Haut-Lizon n'est pas encore publié ; portail vérifié le 10 octobre.

## ⑥ Centrales d'achat — FORT

La centrale d'achat Ardaine publie le 8 octobre les résultats de son enquête : 71 % des adhérents prévoient une mission de conseil en 2027, et le marché sera renouvelé. La consultation n'est pas encore datée. ([source fictive](https://exemple.example/centrale-ardaine-resultats))

## ⑦ Recrutement et rémunérations — MOYEN

Orbis Public publie le 6 octobre deux offres de manager à Lyon, avec cinq ans d'expérience des collectivités exigés. Deux de vos consultants ont ce profil. ([source fictive](https://exemple.example/orbis-offres-manager))

## ⑧ Événements du secteur public — RAS

> Programme du salon de Valrive inchangé ; l'appel à intervenants des rencontres des directeurs généraux ferme le 31 octobre.

## ⑨ Transition écologique des territoires — MOYEN

La Région Val-d'Ardaine confirme le 7 octobre l'ouverture des dossiers du fonds d'ingénierie écologique le 14 octobre, avec une première commission en décembre. Les communes cherchent déjà des bureaux d'études. ([source fictive](https://exemple.example/fonds-ouverture-dossiers))

## ⑩ Numérique et données publiques — RAS

> La refonte du portail de données de l'Ardaine n'a pas de calendrier de marché ; rien de nouveau depuis le 3 octobre.

## ⑪ Ressources humaines des collectivités — MOYEN

Le centre de gestion fictif de l'Ardaine annonce le 9 octobre que son marché d'appui aux réorganisations de services sera publié à la mi-octobre, pour des réponses en novembre. Le marché sera alloti par taille de commune. ([source fictive](https://exemple.example/cdg-publication-imminente))

## ⑫ Partenaires et sous-traitants — MOYEN

Le collectif fictif de designers de services publics publie le 8 octobre les conditions de ses partenariats avec les cabinets de conseil. Une réponse conjointe sur le lot concertation de Valrive est possible. ([source fictive](https://exemple.example/collectif-conditions))

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 septembre ; deux référentiels vérifiés.

# Dossiers suivis

La centrale d'achat Ardaine renouvellera son marché de conseil en 2027, sans date de consultation.

Le Département de l'Ardaine envisage de voter son budget 2027 en décembre.

Atelier Civique reste silencieux depuis sa refonte annoncée le 30 septembre.

L'accord-cadre Valrive sera publié le 14 octobre.

Le schéma numérique Saint-Aubert sera mis en consultation dans les dix jours.

Cap Territoires signe ses premières missions dans l'Ardaine.

Orbis Public n'a pas encore nommé son directeur général.
`,
}


// ── Tolmen Mécanique ────────────────────────────────────────────────────────

const P5: LettreDeDémonstration = {
  numéro: 5,
  dateÉdition: '2026-09-21',
  périodeCouverte: 'du 14 au 20 septembre 2026',
  actionDeLaSemaine:
    'Demander à Aérolys un rendez-vous avant le 10 octobre pour présenter votre capacité 2027 sur les pièces de train d’atterrissage.',
  dossiers:
    "Aérolys (0, revue des plans 2027 engagée) · Usinage Delmas (0, retards de paiement signalés) · Ferrovia Systèmes (0, présélectionné pour le tramway de Valrive) · certification EN 9100 (3, renouvellement en 2027)",
  markdown: `# L'essentiel

- Aérolys engage le 15 septembre la revue de ses plans de production 2027 avec ses fournisseurs de rang un.
- Usinage Delmas règle ses sous-traitants avec soixante jours de retard, selon un fournisseur commun.
- Ferrovia Systèmes est présélectionné le 17 septembre pour le tramway de Valrive.
- Le prix de l'aluminium aéronautique recule de 2 % sur le mois.
- Le pôle régional de la défense annonce une convention d'affaires pour décembre.

# Actualités par axe

## ① Donneurs d'ordre aéronautiques — FORT

Aérolys annonce le 15 septembre la revue de ses plans de production 2027, menée avec ses fournisseurs de rang un jusqu'à la fin octobre. Vos volumes de pièces de train seront discutés à cette occasion. ([source fictive](https://exemple.example/aerolys-revue-2027))

Hélivale confirme le 18 septembre le calendrier de son programme d'hélicoptère léger, premiers vols en 2027. Vos commandes sur ce programme restent prévues au premier semestre. ([source fictive](https://exemple.example/helivale-calendrier))

## ② Concurrents usineurs — MOYEN

Un fournisseur fictif d'outils coupants indique le 16 septembre qu'Usinage Delmas règle ses factures avec soixante jours de retard depuis l'été. Ses clients ferroviaires pourraient chercher un second fournisseur. ([source fictive](https://exemple.example/delmas-retards))

## ③ Énergie et matières premières — MOYEN

Un négociant fictif relève le 17 septembre un recul de 2 % du prix de l'aluminium de qualité aéronautique sur un mois, avec des délais de quatre semaines. Vos devis d'automne peuvent intégrer cette baisse. ([source fictive](https://exemple.example/aluminium-septembre))

## ④ Aides à l'investissement industriel — RAS

> Aucun appel à projets régional ouvert aux machines-outils cette semaine ; portail de la Région vérifié le 19 septembre.

## ⑤ Ferroviaire — FORT

La Métropole de Valrive présélectionne le 17 septembre Ferrovia Systèmes parmi deux candidats pour ses 40 rames de tramway, décision attendue en octobre. Vous avez fourni ses pièces de bogie jusqu'en 2024. ([source fictive](https://exemple.example/ferrovia-preselection))

## ⑥ Qualité et certifications — RAS

> Votre certification EN 9100 court jusqu'en mars 2027 ; aucune date d'audit publiée par Certéo au 19 septembre.

## ⑦ Emploi et formation — MOYEN

Le lycée professionnel du bassin annonce le 16 septembre l'ouverture d'une formation de régleurs sur commande numérique à la rentrée d'octobre, douze places en alternance. Vos deux postes de régleur ouverts peuvent accueillir un alternant. ([source fictive](https://exemple.example/formation-regleurs-annonce))

## ⑧ Décarbonation de la production — MOYEN

Aérolys indique le 18 septembre qu'il demandera un bilan carbone à ses fournisseurs de rang un pour ses contrats de 2028, modalités à préciser. Votre site n'a jamais fait de bilan carbone. ([source fictive](https://exemple.example/aerolys-bilan-annonce))

## ⑨ Défaillances et reprises dans la filière — RAS

> Aucune procédure collective ouverte parmi les usineurs de la vallée cette semaine ; registre fictif des procédures vérifié le 19 septembre.

## ⑩ Machines et outillage — MOYEN

Un constructeur fictif de centres d'usinage cinq axes annonce le 15 septembre des délais de livraison de neuf mois pour les commandes d'automne. Votre projet de centre cinq axes ne produirait pas avant l'été 2027. ([source fictive](https://exemple.example/delais-neuf-mois))

## ⑪ Défense — MOYEN

Le pôle fictif de la défense régionale annonce le 17 septembre une convention d'affaires le 2 décembre, ouverte aux PME d'usinage. Un premier contact avec un marché absent de votre carnet. ([source fictive](https://exemple.example/convention-annonce))

## ⑫ Export — RAS

> Aucune demande d'un donneur d'ordre étranger relevée cette semaine ; trois plateformes fictives de sourcing vérifiées le 18 septembre.

## ⑬ Cybersécurité industrielle — RAS

> Aucune alerte de sécurité sur les commandes numériques de l'atelier cette semaine.

# Dossiers suivis

Aérolys revoit ses plans 2027 avec ses fournisseurs jusqu'à la fin octobre.

Usinage Delmas paie ses sous-traitants avec soixante jours de retard.

Ferrovia Systèmes est présélectionné pour le tramway de Valrive, décision en octobre.

La certification EN 9100 doit être renouvelée en mars 2027.
`,
}

const P6: LettreDeDémonstration = {
  numéro: 6,
  dateÉdition: '2026-09-28',
  périodeCouverte: 'du 21 au 27 septembre 2026',
  actionDeLaSemaine:
    'Contacter avant le 10 octobre les deux clients ferroviaires d’Usinage Delmas pour proposer une seconde source.',
  dossiers:
    "Aérolys (1, revue des plans 2027 en cours) · Usinage Delmas (0, contrat ferroviaire perdu) · Ferrovia Systèmes (1, décision du tramway attendue) · Précimeca (0, ingénieur rectification recruté) · certification EN 9100 (4, renouvellement en 2027)",
  markdown: `# L'essentiel

- Usinage Delmas perd le 23 septembre le contrat de pièces de bogie d'un constructeur ferroviaire fictif.
- Précimeca recrute un ingénieur rectification venu de l'aéronautique.
- L'indice régional de l'électricité industrielle progresse de 3 % sur le mois.
- La norme de traçabilité des pièces aéronautiques sera révisée en octobre.
- L'observatoire des métiers chiffre à 310 les postes d'usineur non pourvus dans le département.

# Actualités par axe

## ① Donneurs d'ordre aéronautiques — RAS

> La revue des plans 2027 d'Aérolys se poursuit ; aucune information nouvelle publiée au 26 septembre.

## ② Concurrents usineurs — FORT

Un constructeur ferroviaire fictif retire le 23 septembre à Usinage Delmas son contrat de pièces de bogie, pour retards de livraison répétés. Ce contrat de 400 000 euros par an est à reprendre. ([source fictive](https://exemple.example/delmas-contrat-perdu))

Précimeca annonce le 25 septembre le recrutement d'un ingénieur rectification venu d'un équipementier aéronautique. Il prépare une entrée sur votre premier marché. ([source fictive](https://exemple.example/precimeca-ingenieur))

## ③ Énergie et matières premières — MOYEN

L'indice régional fictif de l'électricité industrielle progresse de 3 % au 25 septembre par rapport au mois précédent. Votre facture du quatrième trimestre suivra. ([source fictive](https://exemple.example/indice-electricite-septembre))

## ④ Aides à l'investissement industriel — RAS

> Aucun appel à projets régional ouvert aux machines-outils ; portail de la Région vérifié le 26 septembre.

## ⑤ Ferroviaire — RAS

> La décision du tramway de Valrive est attendue en octobre ; aucune publication de la Métropole au 26 septembre.

## ⑥ Qualité et certifications — MOYEN

L'organisme fictif de normalisation annonce le 24 septembre la révision de la norme de traçabilité des pièces aéronautiques, publication en octobre. Votre logiciel de suivi devra produire les données ajoutées. ([source fictive](https://exemple.example/norme-revision-annonce))

## ⑦ Emploi et formation — MOYEN

L'observatoire fictif des métiers de la métallurgie chiffre le 22 septembre à 310 le nombre de postes d'usineur non pourvus dans le département, en hausse de 40 sur un an. Vos recrutements resteront longs. ([source fictive](https://exemple.example/observatoire-septembre))

## ⑧ Décarbonation de la production — RAS

> Aérolys n'a pas précisé les modalités du bilan carbone demandé à ses fournisseurs ; rien de nouveau au 26 septembre.

## ⑨ Défaillances et reprises dans la filière — MOYEN

Un tourneur fictif de 25 salariés de la vallée voisine confie le 24 septembre à la chambre des métiers un mandat de cession, départ en retraite du dirigeant. La reprise doublerait votre capacité de tournage. ([source fictive](https://exemple.example/tourneur-mandat))

## ⑩ Machines et outillage — RAS

> Délais de livraison des centres cinq axes inchangés à neuf mois ; deux constructeurs fictifs vérifiés le 25 septembre.

## ⑪ Défense — MOYEN

Un programme fictif de drones de surveillance publie le 23 septembre son calendrier : attribution du marché de production en octobre, part réservée aux PME régionales. Les sous-traitants d'usinage seront choisis ensuite. ([source fictive](https://exemple.example/programme-drones-calendrier))

## ⑫ Export — MOYEN

L'agence régionale fictive d'appui à l'export annonce le 22 septembre un pavillon collectif au salon aéronautique de mars, inscriptions à l'automne. Le coût du stand serait pris en charge à moitié. ([source fictive](https://exemple.example/pavillon-annonce))

## ⑬ Cybersécurité industrielle — RAS

> Aucune alerte de sécurité sur les commandes numériques de l'atelier cette semaine.

# Dossiers suivis

Aérolys poursuit la revue de ses plans 2027.

Usinage Delmas perd un contrat ferroviaire de 400 000 euros par an.

Ferrovia Systèmes attend la décision du tramway de Valrive.

Précimeca recrute un ingénieur rectification venu de l'aéronautique.

La certification EN 9100 doit être renouvelée en mars 2027.
`,
}

const P7: LettreDeDémonstration = {
  numéro: 7,
  dateÉdition: '2026-10-05',
  périodeCouverte: 'du 28 septembre au 4 octobre 2026',
  actionDeLaSemaine:
    'Répondre avant le 9 octobre à l’enquête de capacité d’Aérolys, avec la capacité que le centre cinq axes ajouterait en 2027.',
  dossiers:
    "Aérolys (0, enquête de capacité auprès des fournisseurs) · Usinage Delmas (0, procédure de sauvegarde ouverte le 1er octobre) · Ferrovia Systèmes (0, attributaire pressenti du tramway) · Précimeca (1, ingénieur rectification recruté) · appel à projets Industrie durable (0, ouverture annoncée pour le 13 octobre) · certification EN 9100 (0, calendrier d'audit annoncé pour janvier)",
  markdown: `# L'essentiel

- Aérolys envoie le 29 septembre une enquête de capacité 2027 à ses fournisseurs, réponses avant le 9 octobre.
- Usinage Delmas obtient le 1er octobre l'ouverture d'une procédure de sauvegarde.
- Ferrovia Systèmes est désigné attributaire pressenti du tramway de Valrive.
- La Région annonce l'appel à projets Industrie durable pour le 13 octobre.
- Certéo tiendra ses audits EN 9100 du premier trimestre à partir de janvier.
- Le diagnostic énergétique gratuit des PME sera lancé mi-octobre.

# Actualités par axe

## ① Donneurs d'ordre aéronautiques — FORT

Aérolys adresse le 29 septembre à ses fournisseurs de rang un une enquête de capacité pour 2027, réponses attendues avant le 9 octobre. Votre réponse doit chiffrer la capacité ajoutée par le centre cinq axes. ([source fictive](https://exemple.example/aerolys-enquete-capacite))

## ② Concurrents usineurs — FORT

Le tribunal fictif ouvre le 1er octobre une procédure de sauvegarde pour Usinage Delmas, période d'observation de six mois. Ses clients ferroviaires sécurisent déjà une seconde source. ([source fictive](https://exemple.example/delmas-sauvegarde))

Usimat annonce le 2 octobre l'embauche de deux régleurs débauchés chez un usineur voisin, à des salaires au-dessus de la grille. La pression sur vos salaires commence. ([source fictive](https://exemple.example/usimat-debauchage))

## ③ Énergie et matières premières — RAS

> Prix de l'aluminium et indice de l'électricité stables sur la semaine ; relevés fictifs du 2 octobre.

## ④ Aides à l'investissement industriel — MOYEN

La Région Val-d'Ardaine annonce le 30 septembre l'appel à projets Industrie durable pour le 13 octobre : jusqu'à 30 % des machines financées, cahier des charges à venir. Votre projet de centre cinq axes pourrait y être présenté. ([source fictive](https://exemple.example/industrie-durable-annonce))

## ⑤ Ferroviaire — FORT

La Métropole de Valrive désigne le 1er octobre Ferrovia Systèmes attributaire pressenti de ses 40 rames de tramway, vote du conseil le 15 octobre. Ferrovia ouvrira ensuite une consultation de fournisseurs de pièces usinées. ([source fictive](https://exemple.example/ferrovia-pressenti))

## ⑥ Qualité et certifications — MOYEN

Certéo annonce le 30 septembre que ses audits EN 9100 du premier trimestre se tiendront à partir de janvier, dates détaillées mi-octobre. Votre renouvellement de mars devra être audité dans cette fenêtre. ([source fictive](https://exemple.example/certeo-annonce))

## ⑦ Emploi et formation — RAS

> La formation de régleurs du lycée du bassin ouvre à la rentrée d'octobre ; douze places, aucune information nouvelle au 2 octobre.

## ⑧ Décarbonation de la production — MOYEN

Un fonds fictif de décarbonation des PME annonce le 1er octobre le lancement mi-octobre d'un diagnostic énergétique gratuit pour les sites de moins de 250 salariés. Il fournirait le bilan qu'Aérolys demandera. ([source fictive](https://exemple.example/diagnostic-annonce))

## ⑨ Défaillances et reprises dans la filière — MOYEN

La chambre des métiers fictive publie le 2 octobre la fiche de cession du tourneur de la vallée voisine : 25 salariés, 1,8 million d'euros de chiffre d'affaires, offres avant le 15 novembre. Le dossier de reprise demande un plan de financement. ([source fictive](https://exemple.example/tourneur-fiche))

## ⑩ Machines et outillage — RAS

> Délais de livraison des centres cinq axes inchangés ; deux constructeurs fictifs vérifiés le 2 octobre.

## ⑪ Défense — RAS

> L'attribution du marché de production des drones de surveillance est attendue en octobre ; rien de publié au 2 octobre.

## ⑫ Export — RAS

> Aucune demande d'un donneur d'ordre étranger relevée ; trois plateformes fictives de sourcing vérifiées le 1er octobre.

## ⑬ Cybersécurité industrielle — MOYEN

L'agence fictive de sécurité industrielle publie le 30 septembre une alerte sur une faille des commandes numériques d'un constructeur, correctif disponible. Deux de vos centres portent cette commande. ([source fictive](https://exemple.example/alerte-commandes))

# Dossiers suivis

Aérolys attend les réponses à son enquête de capacité avant le 9 octobre.

Usinage Delmas est en procédure de sauvegarde depuis le 1er octobre.

Ferrovia Systèmes est attributaire pressenti du tramway de Valrive.

Précimeca prépare son entrée sur l'aéronautique.

L'appel à projets Industrie durable ouvrira le 13 octobre.

La certification EN 9100 sera auditée à partir de janvier.
`,
}

const P8: LettreDeDémonstration = {
  numéro: 8,
  dateÉdition: '2026-10-12',
  périodeCouverte: 'du 5 au 11 octobre 2026',
  actionDeLaSemaine:
    'Réunir avant le 28 octobre les trois devis de machines que demandera le dossier Industrie durable.',
  dossiers:
    "Aérolys (1, réponse à l'enquête de capacité envoyée) · Usinage Delmas (0, conversion en redressement demandée) · Ferrovia Systèmes (0, vote du conseil métropolitain le 15 octobre) · Précimeca (0, permis d'extension accordé) · appel à projets Industrie durable (0, cahier des charges publié) · certification EN 9100 (1, audit en janvier)",
  markdown: `# L'essentiel

- Usinage Delmas demande le 8 octobre la conversion de sa sauvegarde en redressement judiciaire.
- La Région publie le cahier des charges d'Industrie durable : trois devis de machines exigés.
- Précimeca obtient le permis d'extension de son atelier.
- Le vote du tramway de Valrive est inscrit au conseil métropolitain du 15 octobre.
- Le contrat régional d'électricité à prix fixe rouvrira le 15 octobre.
- Un équipementier allemand cherche des usineurs français pour 2027.

# Actualités par axe

## ① Donneurs d'ordre aéronautiques — RAS

> Aérolys dépouille les réponses à son enquête de capacité ; aucune communication au 9 octobre.

## ② Concurrents usineurs — FORT

L'administrateur fictif d'Usinage Delmas demande le 8 octobre la conversion de la sauvegarde en redressement judiciaire, faute de trésorerie. Le tribunal statuera le 16 octobre. ([source fictive](https://exemple.example/delmas-conversion))

Précimeca obtient le 7 octobre le permis d'extension de son atelier de 800 mètres carrés, pour une ligne de rectification. L'investissement sera annoncé dans les semaines qui viennent. ([source fictive](https://exemple.example/precimeca-permis))

## ③ Énergie et matières premières — MOYEN

La Région fictive annonce le 9 octobre que son contrat de fourniture d'électricité des PME rouvrira le 15 octobre, à prix fixe sur trois ans. Une inscription avant le 30 novembre fixerait votre prix jusqu'en 2029. ([source fictive](https://exemple.example/contrat-electricite-annonce))

## ④ Aides à l'investissement industriel — FORT

La Région Val-d'Ardaine publie le 6 octobre le cahier des charges d'Industrie durable : trois devis de machines, un plan de financement et un gain énergétique chiffré, clôture le 28 novembre. Votre centre cinq axes coche les trois critères. ([source fictive](https://exemple.example/industrie-durable-cahier))

## ⑤ Ferroviaire — MOYEN

La Métropole de Valrive inscrit le 8 octobre l'attribution des 40 rames de tramway à l'ordre du jour de son conseil du 15 octobre. Ferrovia Systèmes consultera ses fournisseurs dès novembre. ([source fictive](https://exemple.example/valrive-ordre-du-jour))

## ⑥ Qualité et certifications — RAS

> Les dates d'audit EN 9100 de Certéo sont annoncées pour la mi-octobre ; rien de publié au 9 octobre.

## ⑦ Emploi et formation — MOYEN

Le lycée professionnel du bassin ouvre le 6 octobre sa formation de régleurs sur commande numérique, douze alternants inscrits, entreprises d'accueil recherchées. Vos deux postes de régleur peuvent en accueillir un. ([source fictive](https://exemple.example/formation-regleurs-ouverture))

## ⑧ Décarbonation de la production — RAS

> Le diagnostic énergétique gratuit des PME sera lancé mi-octobre ; aucune ouverture des inscriptions au 9 octobre.

## ⑨ Défaillances et reprises dans la filière — RAS

> Les offres de reprise du tourneur de la vallée voisine sont attendues avant le 15 novembre ; rien de nouveau au 9 octobre.

## ⑩ Machines et outillage — MOYEN

Un distributeur fictif d'outils coupants annonce le 9 octobre une hausse de ses tarifs au 1er novembre, montant précisé dans une circulaire à venir. Une commande d'automne avant le 1er novembre éviterait la hausse. ([source fictive](https://exemple.example/tarifs-outils-annonce))

## ⑪ Défense — RAS

> L'attribution du marché de production des drones de surveillance est attendue dans les jours qui viennent ; rien de publié au 9 octobre.

## ⑫ Export — MOYEN

Un équipementier fictif allemand indique le 8 octobre, sur une plateforme de sourcing, chercher des usineurs français pour des pièces de structure à partir de 2027. Vos pièces de structure entrent dans son besoin. ([source fictive](https://exemple.example/equipementier-sourcing))

## ⑬ Cybersécurité industrielle — RAS

> Le correctif de la faille des commandes numériques est appliqué ; aucune alerte nouvelle cette semaine.

# Dossiers suivis

Aérolys a reçu votre réponse à son enquête de capacité.

Usinage Delmas demande son passage en redressement judiciaire, décision le 16 octobre.

Ferrovia Systèmes attend le vote du conseil métropolitain du 15 octobre.

Précimeca a son permis d'extension pour une ligne de rectification.

L'appel à projets Industrie durable ouvre le 13 octobre, trois devis exigés.

La certification EN 9100 sera auditée en janvier.
`,
}

// ── Atelier Passerelle ──────────────────────────────────────────────────────

const E2: LettreDeDémonstration = {
  numéro: 2,
  dateÉdition: '2026-09-21',
  périodeCouverte: 'du 14 au 20 septembre 2026',
  actionDeLaSemaine:
    'Déposer avant le 30 septembre la demande à la Fondation Horizon commun, pour la seconde ligne de tri.',
  dossiers:
    "aides au poste 2027 (0, circulaire nationale publiée) · Le Fil vert (0, recrute une responsable de boutique) · Fondation Horizon commun (0, appel à projets ouvert jusqu'au 30 septembre)",
  markdown: `# L'essentiel

- La circulaire nationale fictive du 15 septembre annonce une enveloppe d'aides au poste 2027 stable.
- La Fondation Horizon commun ferme son appel à projets le 30 septembre.
- Le Fil vert recrute une responsable de boutique à Valrive.
- L'éco-organisme textile ouvre la concertation sur ses soutiens 2027.
- Le marché de Noël solidaire de Valrive se tiendra du 12 au 21 décembre.

# Actualités par axe

## ① Aides au poste et conventionnement — FORT

La circulaire nationale fictive du 15 septembre annonce une enveloppe d'aides au poste 2027 stable, répartie entre régions en décembre. Vos douze postes conventionnés seraient reconduits à l'identique. ([source fictive](https://exemple.example/circulaire-aides-au-poste))

## ② Appels à projets et fondations — FORT

La Fondation Horizon commun rappelle le 16 septembre que son appel à projets ferme le 30 septembre, pour des subventions de 20 000 à 50 000 euros. Votre seconde ligne de tri entre dans ses priorités. ([source fictive](https://exemple.example/horizon-commun-appel))

## ③ Filière textile et éco-organisme — MOYEN

L'éco-organisme textile fictif ouvre le 17 septembre une concertation sur ses soutiens au tri pour 2027, conclusions en octobre. Une hausse du soutien au tonnage est demandée par les centres de tri. ([source fictive](https://exemple.example/eco-organisme-concertation))

## ④ Collectivités et marchés réservés — RAS

> Aucun marché réservé à l'insertion publié par les collectivités de l'Ardaine cette semaine ; profils d'acheteur vérifiés le 18 septembre.

## ⑤ Fonds européens — RAS

> Aucun appel à projets inclusion ouvert par l'autorité de gestion fictive ; calendrier vérifié le 18 septembre.

## ⑥ Structures du réemploi — MOYEN

La ressourcerie fictive Le Fil vert publie le 15 septembre une offre de responsable de boutique à Valrive, pour une ouverture « à l'automne ». Une seconde boutique dans la ville viserait votre clientèle. ([source fictive](https://exemple.example/fil-vert-recrute))

## ⑦ Financement solidaire et prêts — MOYEN

Le fonds territorial fictif annonce le 16 septembre une séance d'examen des prêts participatifs en décembre, dossiers à déposer avant le 31 octobre. Votre projet de camion de collecte pourrait y être présenté. ([source fictive](https://exemple.example/pret-participatif-seance))

## ⑧ Mécénat d'entreprise — RAS

> Aucun appel à dons ou partenariat lancé par les entreprises du Val-d'Ardaine cette semaine ; club de mécènes vérifié le 18 septembre.

## ⑨ Règles de l'insertion — MOYEN

Le ministère fictif annonce le 17 septembre une instruction sur le renouvellement des agréments d'insertion, attendue en octobre. Votre renouvellement de 2027 pourrait changer de forme. ([source fictive](https://exemple.example/instruction-annonce))

## ⑩ Accompagnement des salariés en insertion — RAS

> Aucune formation nouvelle réservée aux salariés en insertion ouverte dans le département ; catalogue fictif vérifié le 17 septembre.

## ⑪ Débouchés et ventes — MOYEN

La Ville de Valrive fixe le 18 septembre les dates du marché de Noël solidaire, du 12 au 21 décembre, candidatures en octobre. C'est votre meilleure semaine de ventes de l'année. ([source fictive](https://exemple.example/marche-noel-dates))

## ⑫ Réseaux de l'ESS — MOYEN

La chambre régionale fictive de l'économie sociale annonce le 15 septembre le mois de l'ESS en novembre, programme en octobre. Une rencontre des financeurs y est prévue. ([source fictive](https://exemple.example/mois-ess-annonce))

## ⑬ Foncier et locaux — RAS

> Aucune offre de locaux d'activité adaptée à un atelier de tri publiée cette semaine.

# Dossiers suivis

Les aides au poste 2027 sont annoncées stables par la circulaire nationale.

Le Fil vert recrute une responsable de boutique à Valrive.

La Fondation Horizon commun ferme son appel à projets le 30 septembre.
`,
}

const E3: LettreDeDémonstration = {
  numéro: 3,
  dateÉdition: '2026-09-28',
  périodeCouverte: 'du 21 au 27 septembre 2026',
  actionDeLaSemaine:
    'Écrire avant le 10 octobre à la Métropole de Valrive pour être informé de la consultation de collecte textile.',
  dossiers:
    "aides au poste 2027 (0, concertation régionale ouverte) · marché réservé Valrive (0, schéma des achats responsables voté) · Le Fil vert (1, recrutement en cours) · Fondation Horizon commun (0, dossier déposé le 25 septembre)",
  markdown: `# L'essentiel

- La préfecture fictive ouvre le 22 septembre la concertation régionale sur les aides au poste 2027.
- La Métropole de Valrive vote le 24 septembre un schéma qui réserve la collecte textile à l'insertion.
- Votre dossier Horizon commun est déposé le 25 septembre.
- L'autorité de gestion des fonds européens annonce un appel à projets inclusion pour décembre.
- Une plateforme de vente d'occasion prépare un tarif pour l'économie sociale.

# Actualités par axe

## ① Aides au poste et conventionnement — MOYEN

La préfecture fictive du Val-d'Ardaine ouvre le 22 septembre la concertation régionale sur la répartition des aides au poste 2027, contributions avant le 15 octobre. Votre demande d'extension à quatorze postes peut y être portée. ([source fictive](https://exemple.example/concertation-aides))

## ② Appels à projets et fondations — MOYEN

La Fondation Horizon commun accuse réception le 25 septembre des dossiers déposés, examen en comité « avant la fin de l'année ». Votre demande pour la seconde ligne de tri est enregistrée. ([source fictive](https://exemple.example/horizon-commun-reception))

## ③ Filière textile et éco-organisme — RAS

> La concertation de l'éco-organisme sur les soutiens 2027 se poursuit ; conclusions annoncées pour octobre.

## ④ Collectivités et marchés réservés — FORT

La Métropole de Valrive vote le 24 septembre son schéma de promotion des achats responsables, qui réserve la collecte textile aux structures d'insertion dès 2027. Une consultation suivra à l'automne. ([source fictive](https://exemple.example/valrive-schema-achats))

## ⑤ Fonds européens — MOYEN

L'autorité de gestion fictive des fonds sociaux européens annonce le 23 septembre un appel à projets inclusion pour décembre, pour les parcours de formation interne. Votre parcours de formation pourrait y prétendre. ([source fictive](https://exemple.example/fonds-europeens-annonce))

## ⑥ Structures du réemploi — RAS

> Le Fil vert n'a pas annoncé de date pour sa boutique de Valrive ; recrutement toujours ouvert au 26 septembre.

## ⑦ Financement solidaire et prêts — RAS

> Les prêts participatifs du fonds territorial se déposent jusqu'au 31 octobre ; rien de nouveau cette semaine.

## ⑧ Mécénat d'entreprise — MOYEN

Une enseigne fictive de prêt-à-porter annonce le 25 septembre qu'elle cherche des structures d'insertion pour une collecte en magasin dans la région. Un partenariat augmenterait vos volumes collectés. ([source fictive](https://exemple.example/enseigne-recherche))

## ⑨ Règles de l'insertion — RAS

> L'instruction sur le renouvellement des agréments est attendue en octobre ; rien de publié au 26 septembre.

## ⑩ Accompagnement des salariés en insertion — MOYEN

Un organisme fictif de formation annonce le 24 septembre un parcours de cariste réservé aux salariés en insertion, ouverture en octobre, gratuit. Quatre de vos salariés pourraient en bénéficier. ([source fictive](https://exemple.example/parcours-cariste-annonce))

## ⑪ Débouchés et ventes — MOYEN

Une plateforme fictive de vente d'occasion annonce le 22 septembre un tarif réservé à l'économie sociale pour octobre, commissions à préciser. Votre marge en ligne pourrait progresser. ([source fictive](https://exemple.example/plateforme-tarif-annonce))

## ⑫ Réseaux de l'ESS — RAS

> Le programme du mois de l'ESS est attendu en octobre ; rien de publié au 26 septembre.

## ⑬ Foncier et locaux — RAS

> Aucune offre de locaux d'activité adaptée à un atelier de tri publiée cette semaine.

# Dossiers suivis

Les aides au poste 2027 sont en concertation régionale jusqu'au 15 octobre.

Le marché réservé Valrive suivra le schéma voté le 24 septembre.

Le Fil vert cherche toujours sa responsable de boutique.

La Fondation Horizon commun a enregistré votre dossier le 25 septembre.
`,
}

const E4: LettreDeDémonstration = {
  numéro: 4,
  dateÉdition: '2026-10-05',
  périodeCouverte: 'du 28 septembre au 4 octobre 2026',
  actionDeLaSemaine:
    'Demander avant le 13 octobre deux devis pour la seconde ligne de tri, que l’appel à projets Réemploi solidaire exigera.',
  dossiers:
    "aides au poste 2027 (1, concertation régionale en cours) · appel à projets Réemploi solidaire (0, ouverture annoncée pour le 13 octobre) · marché réservé Valrive (1, consultation attendue) · Le Fil vert (0, bail signé pour une seconde boutique) · Fondation Horizon commun (1, dossier en instruction) · prêt participatif territorial (0, dossier déposé le 30 septembre)",
  markdown: `# L'essentiel

- La Région annonce le 1er octobre l'appel à projets Réemploi solidaire pour le 13 octobre.
- Le Fil vert signe le bail d'une seconde boutique à Valrive.
- Votre dossier de prêt participatif territorial est déposé le 30 septembre.
- L'éco-organisme textile conclura sa concertation le 14 octobre.
- Le réseau des entreprises d'insertion renouvelle sa présidence le 16 octobre.

# Actualités par axe

## ① Aides au poste et conventionnement — RAS

> La concertation régionale sur les aides au poste 2027 court jusqu'au 15 octobre ; rien de nouveau au 2 octobre.

## ② Appels à projets et fondations — FORT

La Région Val-d'Ardaine annonce le 1er octobre l'appel à projets Réemploi solidaire pour le 13 octobre, volet investissement, règlement à venir. Votre seconde ligne de tri pourrait y être financée. ([source fictive](https://exemple.example/reemploi-solidaire-annonce))

## ③ Filière textile et éco-organisme — MOYEN

L'éco-organisme textile fictif annonce le 2 octobre que les conclusions de sa concertation sur les soutiens 2027 seront publiées le 14 octobre. Les centres de tri demandent une hausse de 10 % du soutien au tonnage. ([source fictive](https://exemple.example/eco-organisme-conclusions-annonce))

## ④ Collectivités et marchés réservés — RAS

> La consultation de collecte textile de la Métropole de Valrive n'est pas encore publiée ; profil d'acheteur vérifié le 2 octobre.

## ⑤ Fonds européens — RAS

> L'appel à projets inclusion est annoncé pour décembre ; rien de nouveau au 2 octobre.

## ⑥ Structures du réemploi — FORT

Le Fil vert annonce le 30 septembre la signature du bail d'une seconde boutique à Valrive, rue des Tanneurs, ouverture le 18 octobre. Elle sera à trois kilomètres de la vôtre. ([source fictive](https://exemple.example/fil-vert-bail))

## ⑦ Financement solidaire et prêts — MOYEN

Le fonds territorial fictif accuse réception le 30 septembre de votre dossier de prêt participatif, examen à la séance de décembre. Le dossier est complet. ([source fictive](https://exemple.example/pret-participatif-reception))

## ⑧ Mécénat d'entreprise — RAS

> L'enseigne de prêt-à-porter n'a pas encore choisi ses partenaires de collecte ; rien de nouveau au 2 octobre.

## ⑨ Règles de l'insertion — MOYEN

Le service public de l'emploi fictif annonce le 1er octobre un nouveau formulaire d'orientation des candidats, obligatoire à partir du 1er décembre. Votre chargée d'accompagnement devra s'y former. ([source fictive](https://exemple.example/formulaire-annonce))

## ⑩ Accompagnement des salariés en insertion — RAS

> Le parcours de cariste réservé aux salariés en insertion ouvre en octobre ; inscriptions non ouvertes au 2 octobre.

## ⑪ Débouchés et ventes — MOYEN

Le marché de Noël solidaire de Valrive annonce le 29 septembre l'ouverture des candidatures des exposants pour la mi-octobre. Une candidature tôt garantit un emplacement en entrée. ([source fictive](https://exemple.example/marche-noel-candidatures-annonce))

## ⑫ Réseaux de l'ESS — MOYEN

Le réseau fictif des entreprises d'insertion annonce le 1er octobre l'élection de sa présidence le 16 octobre, deux candidates dont une dirigeante du réemploi. Le réemploi pourrait gagner une voix dans le réseau. ([source fictive](https://exemple.example/reseau-election-annonce))

## ⑬ Foncier et locaux — RAS

> Aucune offre de locaux d'activité adaptée à un atelier de tri publiée cette semaine.

# Dossiers suivis

Les aides au poste 2027 sont en concertation régionale jusqu'au 15 octobre.

L'appel à projets Réemploi solidaire ouvrira le 13 octobre.

Le marché réservé Valrive attend sa consultation.

Le Fil vert ouvrira sa seconde boutique le 18 octobre.

La Fondation Horizon commun instruit votre dossier.

Le prêt participatif territorial est déposé, examen en décembre.
`,
}

const E5: LettreDeDémonstration = {
  numéro: 5,
  dateÉdition: '2026-10-12',
  périodeCouverte: 'du 5 au 11 octobre 2026',
  actionDeLaSemaine:
    'Préparer avant le 20 octobre le plan de financement sur trois ans que demandera Réemploi solidaire.',
  dossiers:
    "aides au poste 2027 (0, hausse envisagée par la préfecture) · appel à projets Réemploi solidaire (0, règlement publié) · marché réservé Valrive (0, avis de pré-information publié) · Le Fil vert (1, ouverture prévue le 18 octobre) · Fondation Horizon commun (0, comité fixé au 5 novembre) · prêt participatif territorial (1, dossier en instruction)",
  markdown: `# L'essentiel

- La préfecture fictive indique le 8 octobre qu'une hausse des aides au poste 2027 est envisagée.
- La Région publie le règlement de Réemploi solidaire : jusqu'à 80 000 euros, clôture le 14 novembre.
- La Métropole de Valrive publie un avis de pré-information pour son marché réservé de collecte textile.
- La Fondation Horizon commun fixe son comité de sélection au 5 novembre.
- Un club d'entreprises mécènes prépare un appel à dons de matériel.

# Actualités par axe

## ① Aides au poste et conventionnement — MOYEN

La préfecture fictive du Val-d'Ardaine indique le 8 octobre, en clôture de concertation, qu'une hausse de l'enveloppe 2027 est envisagée, décision mi-octobre. Votre demande d'extension à quatorze postes a été enregistrée. ([source fictive](https://exemple.example/prefecture-hausse-envisagee))

## ② Appels à projets et fondations — FORT

La Région Val-d'Ardaine publie le 7 octobre le règlement de Réemploi solidaire : jusqu'à 80 000 euros par structure, plan de financement sur trois ans et deux devis, clôture le 14 novembre. Votre seconde ligne de tri entre dans ce plafond. ([source fictive](https://exemple.example/reemploi-solidaire-reglement))

La Fondation Horizon commun fixe le 9 octobre son comité de sélection au 5 novembre, six projets retenus sur quarante dossiers. Votre demande est parmi les dossiers examinés. ([source fictive](https://exemple.example/horizon-commun-comite))

## ③ Filière textile et éco-organisme — RAS

> Les conclusions de la concertation de l'éco-organisme sont attendues le 14 octobre ; rien de publié au 9 octobre.

## ④ Collectivités et marchés réservés — FORT

La Métropole de Valrive publie le 8 octobre un avis de pré-information pour un marché réservé de collecte textile, quarante points de collecte sur trois ans, consultation en octobre. Vous collectez déjà sur trois communes de la métropole. ([source fictive](https://exemple.example/valrive-pre-information))

## ⑤ Fonds européens — MOYEN

L'autorité de gestion fictive rappelle le 6 octobre que les dépenses de 2026 devront être justifiées avant le 31 janvier. Vos justificatifs de 2026 sont à rassembler dès décembre. ([source fictive](https://exemple.example/fonds-europeens-rappel))

## ⑥ Structures du réemploi — RAS

> Le Fil vert ouvre sa seconde boutique le 18 octobre ; travaux en cours, aucune information nouvelle au 9 octobre.

## ⑦ Financement solidaire et prêts — RAS

> Le prêt participatif territorial est en instruction pour la séance de décembre ; rien de nouveau cette semaine.

## ⑧ Mécénat d'entreprise — MOYEN

Un club fictif d'entreprises mécènes du Val-d'Ardaine annonce le 9 octobre un appel à dons de matériel de bureau pour les associations, ouvert mi-octobre. Le don de matériel informatique allégerait votre budget. ([source fictive](https://exemple.example/club-mecenes-annonce))

## ⑨ Règles de l'insertion — RAS

> L'instruction sur le renouvellement des agréments est attendue « dans les jours qui viennent » ; rien de publié au 9 octobre.

## ⑩ Accompagnement des salariés en insertion — MOYEN

L'organisme fictif de formation ouvre le 7 octobre les inscriptions au parcours de cariste réservé aux salariés en insertion, six semaines à partir de novembre, douze places. Quatre de vos salariés peuvent candidater. ([source fictive](https://exemple.example/parcours-cariste-inscriptions))

## ⑪ Débouchés et ventes — MOYEN

Une plateforme fictive de vente d'occasion publie le 8 octobre son tarif pour l'économie sociale : commissions ramenées de 12 % à 8 % à partir du 15 octobre. Votre marge en ligne gagnerait quatre points. ([source fictive](https://exemple.example/plateforme-tarif))

## ⑫ Réseaux de l'ESS — RAS

> L'élection de la présidence du réseau des entreprises d'insertion a lieu le 16 octobre ; programme du mois de l'ESS attendu la semaine prochaine.

## ⑬ Foncier et locaux — RAS

> Aucune offre de locaux d'activité adaptée à un atelier de tri publiée depuis le 1er octobre.

# Dossiers suivis

Les aides au poste 2027 pourraient augmenter, décision mi-octobre.

L'appel à projets Réemploi solidaire ouvre le 13 octobre, clôture le 14 novembre.

Le marché réservé Valrive est annoncé par un avis de pré-information.

Le Fil vert ouvre sa seconde boutique le 18 octobre.

La Fondation Horizon commun tiendra son comité le 5 novembre.

Le prêt participatif territorial est en instruction.
`,
}

/** La lettre de « Exemples » et de l'accueil, dernière de la série. */
function dernière(clé: CléDeDémonstration): LettreDeDémonstration {
  const d = DÉMONSTRATIONS.find((d) => d.clé === clé)
  if (!d) throw new Error(`démonstration « ${clé} » absente`)
  return {
    numéro: d.numéro,
    dateÉdition: d.dateÉdition,
    périodeCouverte: d.périodeCouverte,
    actionDeLaSemaine: d.actionDeLaSemaine,
    dossiers: d.dossiers,
    markdown: d.markdown,
  }
}

const PRÉCÉDENTES: Readonly<Record<CléDeDémonstration, readonly LettreDeDémonstration[]>> = {
  conseil: [N13, N12, N11, N10, N9, N8, N7],
  pme: [P8, P7, P6, P5],
  ess: [E5, E4, E3, E2],
}

/** Les lettres d'une démonstration, de la plus récente à la plus ancienne, comme une liste d'éditions. */
export function lettresDeDémonstration(clé: CléDeDémonstration): readonly LettreDeDémonstration[] {
  return [dernière(clé), ...PRÉCÉDENTES[clé]]
}
