/**
 * Les trois démonstrations de la vitrine (`/exemple`, 24 octobre 2026).
 *
 * Trois organisations **fictives**, trois profils de client : un cabinet de
 * conseil, une PME industrielle, une entreprise de l'économie sociale et
 * solidaire dont l'activité tient à ses financements. Les organisations, les
 * concurrents, les territoires et les faits sont inventés ; les sources pointent
 * vers le domaine réservé `.example`, qui ne mène nulle part par construction.
 * Aucune lettre d'un client, ni de Next Impact, n'est publiée ici.
 *
 * Chaque lettre est du Markdown au format de la lettre unique, converti par
 * `markdownVersBlocs` comme une lettre réelle : la page en tire le tableau de
 * bord et la lettre avec le parseur et les composants de l'espace client, et le
 * test les passe au lint de production. `dossiers` est la propriété « Dossiers
 * ouverts suivis » d'une édition, au format `nom (compteur, précision) · …`.
 */
export type Démonstration = {
  /** Identifiant d'onglet, aussi ancre de l'URL. */
  readonly clé: 'conseil' | 'pme' | 'ess'
  /** Libellé de l'onglet. */
  readonly onglet: string
  readonly organisation: string
  /** Ce qu'est l'organisation, en une phrase. */
  readonly portrait: string
  readonly veille: string
  readonly numéro: number
  readonly dateÉdition: string
  readonly périodeCouverte: string
  readonly actionDeLaSemaine: string
  readonly dossiers: string
  readonly markdown: string
}

const CONSEIL: Démonstration = {
  clé: 'conseil',
  onglet: 'Cabinet de conseil',
  organisation: 'Lisière Conseil',
  portrait:
    'Cabinet de douze consultants qui accompagne les collectivités dans leurs projets de transformation, à Lyon.',
  veille: 'Veille de Lisière Conseil',
  numéro: 14,
  dateÉdition: '2026-10-19',
  périodeCouverte: 'du 12 au 18 octobre 2026',
  actionDeLaSemaine:
    'Déposer avant le 6 novembre la candidature à l’accord-cadre Valrive, lot « conduite du changement ».',
  dossiers:
    'accord-cadre Valrive (0, candidatures jusqu’au 6 novembre) · Cap Territoires (0, levée de fonds annoncée) · Orbis Public (2, aucune publication) · centrale d’achat Ardaine (1, renouvellement en 2027)',
  markdown: `# L'essentiel

- La Métropole de Valrive ouvre le 14 octobre un accord-cadre de conseil de quatre ans, candidatures jusqu'au 6 novembre.
- Cap Territoires annonce le 16 octobre une levée de 3 millions d'euros pour recruter vingt consultants.
- Le Département de l'Ardaine reporte au 9 décembre le vote de son budget 2027.
- Deux collectivités de la région publient des appels d'offres sur l'intelligence artificielle dans les services.

# Actualités par axe

## ① Appels d'offres des collectivités — FORT

La Métropole de Valrive publie le 14 octobre un accord-cadre de conseil en transformation de quatre ans, en trois lots, candidatures jusqu'au 6 novembre. ([source fictive](https://exemple.example/valrive-accord-cadre))

La commune de Saint-Aubert lance le 17 octobre une consultation pour son schéma directeur numérique, plafonnée à 40 000 euros. ([source fictive](https://exemple.example/saint-aubert-schema))

## ② Concurrents directs — FORT

Cap Territoires annonce le 16 octobre une levée de 3 millions d'euros et le recrutement de vingt consultants d'ici juin. ([source fictive](https://exemple.example/cap-territoires-levee))

Cap Territoires ouvre aussi le 16 octobre une agence à Lyon, à deux rues de vos bureaux. ([source fictive](https://exemple.example/cap-territoires-lyon))

## ③ Finances locales et budgets 2027 — MOYEN

Le Département de l'Ardaine reporte le 15 octobre au 9 décembre le vote de son budget 2027, faute d'arbitrage sur les dotations. ([source fictive](https://exemple.example/ardaine-budget))

## ④ Commande publique : règles et seuils — MOYEN

Un décret fictif du 13 octobre relève à 60 000 euros le seuil des marchés passés sans publicité préalable. ([source fictive](https://exemple.example/decret-seuils))

## ⑤ Intelligence artificielle dans les services publics — MOYEN

La Communauté d'agglomération du Haut-Lizon publie le 15 octobre un appel d'offres pour cadrer l'usage de l'intelligence artificielle dans l'accueil des usagers. ([source fictive](https://exemple.example/haut-lizon-ia))

La Région Val-d'Ardaine annonce le 17 octobre un guide de doctrine sur l'intelligence artificielle, attendu en janvier. ([source fictive](https://exemple.example/region-ia))

## ⑥ Centrales d'achat — MOYEN

La centrale d'achat Ardaine confirme le 14 octobre que son marché de conseil sera renouvelé en 2027, sans date de consultation. ([source fictive](https://exemple.example/centrale-ardaine))

## ⑦ Recrutement et rémunérations — MOYEN

Une étude fictive publiée le 16 octobre chiffre à 8 % la hausse des salaires d'embauche des consultants seniors en un an. ([source fictive](https://exemple.example/etude-salaires))

## ⑧ Événements du secteur public — MOYEN

Le salon des acteurs publics de Valrive se tiendra le 26 novembre ; le programme publié le 13 octobre compte un atelier sur les achats de conseil. ([source fictive](https://exemple.example/salon-valrive))

## ⑨ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 septembre ; deux référentiels vérifiés.

## ⑩ Partenaires et sous-traitants — RAS

> Aucun mouvement chez les trois partenaires suivis cette semaine.

# Analyse

La concurrence se resserre au moment où la Métropole de Valrive ouvre son plus gros marché de l'année. Cap Territoires disposera de vingt consultants de plus au printemps : votre avantage tient à vos références locales, qu'il faut mettre en avant dès cette candidature.

# Dossiers suivis

L'accord-cadre Valrive est ouvert depuis le 14 octobre, avec des candidatures jusqu'au 6 novembre.

Cap Territoires a annoncé une levée de fonds et une agence lyonnaise le 16 octobre.

Orbis Public n'a rien publié depuis deux semaines.

La centrale d'achat Ardaine renouvellera son marché de conseil en 2027.
`,
}

const PME: Démonstration = {
  clé: 'pme',
  onglet: 'PME industrielle',
  organisation: 'Tolmen Mécanique',
  portrait:
    'Sous-traitant en usinage de précision de 85 salariés, qui travaille pour l’aéronautique et le ferroviaire.',
  veille: 'Veille de Tolmen Mécanique',
  numéro: 9,
  dateÉdition: '2026-10-19',
  périodeCouverte: 'du 12 au 18 octobre 2026',
  actionDeLaSemaine:
    'Demander à Aérolys avant le 31 octobre ses volumes 2027 pour les pièces de train d’atterrissage.',
  dossiers:
    'Aérolys (0, cadences relevées de 15 %) · Usinage Delmas (0, redressement judiciaire) · appel à projets Industrie durable (1, clôture le 28 novembre) · certification EN 9100 (2, audit en janvier)',
  markdown: `# L'essentiel

- Aérolys relève ses cadences de 15 % pour 2027 et cherche de nouveaux sous-traitants en usinage.
- Usinage Delmas, concurrent direct, est placé en redressement judiciaire le 16 octobre.
- Le prix de l'électricité industrielle recule de 6 % sur le mois, selon l'indice régional.
- L'appel à projets régional Industrie durable ferme le 28 novembre.

# Actualités par axe

## ① Donneurs d'ordre aéronautiques — FORT

Aérolys annonce le 14 octobre une hausse de 15 % de ses cadences de production pour 2027. ([source fictive](https://exemple.example/aerolys-cadences))

Aérolys publie le 17 octobre un appel à manifestation d'intérêt pour qualifier trois nouveaux sous-traitants en usinage, réponses avant le 20 novembre. ([source fictive](https://exemple.example/aerolys-ami))

## ② Concurrents usineurs — FORT

Usinage Delmas est placé en redressement judiciaire le 16 octobre ; ses 60 salariés et ses contrats ferroviaires sont à reprendre. ([source fictive](https://exemple.example/delmas-redressement))

## ③ Énergie et matières premières — FORT

L'indice régional fictif de l'électricité industrielle recule de 6 % au 15 octobre par rapport au mois précédent. ([source fictive](https://exemple.example/indice-electricite))

Le prix de l'aluminium de qualité aéronautique progresse de 4 % au 17 octobre, selon un négociant fictif. ([source fictive](https://exemple.example/prix-aluminium))

## ④ Aides à l'investissement industriel — MOYEN

La Région Val-d'Ardaine ouvre le 13 octobre l'appel à projets Industrie durable, jusqu'à 30 % des machines financées, clôture le 28 novembre. ([source fictive](https://exemple.example/industrie-durable))

## ⑤ Ferroviaire — MOYEN

Un constructeur fictif de tramways annonce le 16 octobre une commande de 40 rames, livrables à partir de 2028. ([source fictive](https://exemple.example/tramways-commande))

## ⑥ Qualité et certifications — MOYEN

L'organisme certificateur fictif Certéo publie le 15 octobre ses dates d'audit EN 9100 pour le premier trimestre, à partir du 12 janvier. ([source fictive](https://exemple.example/certeo-audits))

## ⑦ Emploi et formation — MOYEN

Le lycée professionnel du bassin ouvre le 14 octobre une formation de régleurs sur commande numérique, douze places en alternance. ([source fictive](https://exemple.example/formation-regleurs))

## ⑧ Décarbonation de la production — MOYEN

Un fonds fictif de décarbonation des PME lance le 17 octobre un diagnostic énergétique gratuit pour les sites de moins de 250 salariés. ([source fictive](https://exemple.example/diagnostic-energie))

## ⑨ Défaillances et reprises dans la filière — MOYEN

Le tribunal fixe le 16 octobre au 4 décembre la date limite des offres de reprise d'Usinage Delmas. ([source fictive](https://exemple.example/delmas-offres))

## ⑩ Export — RAS

> Aucun nouveau salon ni dispositif d'appui à l'export publié depuis le 30 septembre.

## ⑪ Cybersécurité industrielle — RAS

> Aucune alerte de sécurité sur les commandes numériques utilisées dans l'atelier cette semaine.

# Analyse

La semaine ouvre deux portes à la fois : Aérolys cherche de la capacité, et la défaillance d'Usinage Delmas libère des clients ferroviaires et des machines. L'appel à projets Industrie durable peut financer une partie de l'investissement nécessaire pour répondre aux deux.

# Dossiers suivis

Aérolys relève ses cadences et qualifie de nouveaux sous-traitants avant le 20 novembre.

Usinage Delmas est en redressement judiciaire, offres de reprise attendues avant le 4 décembre.

L'appel à projets Industrie durable reste ouvert jusqu'au 28 novembre.

La certification EN 9100 sera auditée en janvier.
`,
}

const ESS: Démonstration = {
  clé: 'ess',
  onglet: 'Entreprise de l’ESS',
  organisation: 'Atelier Passerelle',
  portrait:
    'Entreprise d’insertion de 40 salariés qui collecte et revend des textiles de réemploi, et dont l’équilibre tient à ses financements publics et privés.',
  veille: 'Veille d’Atelier Passerelle',
  numéro: 6,
  dateÉdition: '2026-10-19',
  périodeCouverte: 'du 12 au 18 octobre 2026',
  actionDeLaSemaine:
    'Déposer avant le 14 novembre le dossier de l’appel à projets Réemploi solidaire, volet investissement.',
  dossiers:
    'aides au poste 2027 (0, enveloppe régionale en hausse) · appel à projets Réemploi solidaire (0, clôture le 14 novembre) · Fondation Horizon commun (1, comité le 5 novembre) · prêt participatif territorial (2, dossier en instruction)',
  markdown: `# L'essentiel

- L'enveloppe régionale des aides au poste 2027 progresse de 5 %, selon la préfecture fictive du 15 octobre.
- L'appel à projets Réemploi solidaire ouvre le 13 octobre : jusqu'à 80 000 euros par structure.
- La Fondation Horizon commun réunit son comité de sélection le 5 novembre.
- L'éco-organisme textile fictif relève de 10 % son soutien au tri à partir de janvier.

# Actualités par axe

## ① Aides au poste et conventionnement — FORT

La préfecture fictive du Val-d'Ardaine annonce le 15 octobre une enveloppe d'aides au poste 2027 en hausse de 5 %, répartie en décembre. ([source fictive](https://exemple.example/aides-au-poste))

Le dialogue de gestion annuel des structures d'insertion est fixé au 20 novembre, selon le calendrier publié le 16 octobre. ([source fictive](https://exemple.example/dialogue-gestion))

## ② Appels à projets et fondations — FORT

L'appel à projets Réemploi solidaire ouvre le 13 octobre : jusqu'à 80 000 euros par structure pour l'investissement, clôture le 14 novembre. ([source fictive](https://exemple.example/reemploi-solidaire))

La Fondation Horizon commun confirme le 17 octobre que son comité de sélection se réunira le 5 novembre. ([source fictive](https://exemple.example/horizon-commun))

## ③ Filière textile et éco-organisme — FORT

L'éco-organisme textile fictif relève le 14 octobre de 10 % son soutien au tonnage trié à partir du 1er janvier. ([source fictive](https://exemple.example/eco-organisme))

## ④ Collectivités et marchés réservés — MOYEN

La Métropole de Valrive publie le 16 octobre un marché de collecte textile réservé aux structures d'insertion, réponses avant le 21 novembre. ([source fictive](https://exemple.example/valrive-marche-reserve))

## ⑤ Fonds européens — MOYEN

L'autorité de gestion fictive des fonds sociaux européens annonce le 15 octobre un appel à projets inclusion pour le 1er décembre. ([source fictive](https://exemple.example/fonds-europeens))

## ⑥ Structures du réemploi — MOYEN

La ressourcerie fictive Le Fil vert ouvre le 18 octobre une seconde boutique à Valrive, à trois kilomètres de la vôtre. ([source fictive](https://exemple.example/fil-vert))

## ⑦ Financement solidaire et prêts — MOYEN

Le fonds territorial fictif annonce le 14 octobre que les prêts participatifs déposés avant le 31 octobre seront examinés en décembre. ([source fictive](https://exemple.example/pret-participatif))

## ⑧ Mécénat d'entreprise — MOYEN

Un club fictif d'entreprises mécènes du Val-d'Ardaine lance le 17 octobre un appel à dons de matériel de bureau pour les associations. ([source fictive](https://exemple.example/club-mecenes))

## ⑨ Règles de l'insertion — MOYEN

Une instruction fictive du 13 octobre simplifie le renouvellement des agréments d'insertion, désormais valables trois ans. ([source fictive](https://exemple.example/instruction-agrements))

## ⑩ Foncier et locaux — RAS

> Aucune offre de locaux d'activité adaptée à un atelier de tri publiée depuis le 1er octobre.

# Analyse

Les financements de l'année prochaine se décident en novembre : le comité de la Fondation Horizon commun, l'appel à projets Réemploi solidaire et le dialogue de gestion tombent à quinze jours d'intervalle. Préparer un dossier d'investissement commun aux trois évite de le rédiger trois fois.

# Dossiers suivis

Les aides au poste 2027 progressent de 5 %, répartition attendue en décembre.

L'appel à projets Réemploi solidaire ferme le 14 novembre.

La Fondation Horizon commun examinera votre demande le 5 novembre.

Le prêt participatif territorial est toujours en instruction.
`,
}

export const DÉMONSTRATIONS: readonly Démonstration[] = [CONSEIL, PME, ESS]
