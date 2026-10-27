import type { Ansoff, ForcePorter, Pestel } from '@/lib/domaine/strategie'

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
 *
 * Leur densité est celle des lettres que produit le moteur (mesure du
 * 24 octobre 2026 sur les sept lettres uniques du 22 octobre : 13 à 15 axes,
 * 26 à 28 faits, 1 220 à 1 420 mots) : treize axes, deux faits par axe, un seul
 * axe sans fait. Une démonstration plus mince sous-vendrait la lettre réelle.
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
  /**
   * La grille stratégique de l'organisation, comme celle d'un référentiel :
   * le cadre de chaque axe (une dimension PESTEL ou une force de Porter), les
   * entités nommées, et les faits qui changent sa position. C'est ce qui donne
   * la « Lecture stratégique » du tableau de bord (`lectureDeDémonstration`).
   */
  readonly grille: GrilleDeDémonstration
}

export type CadreDAxe = { readonly pestel: Pestel } | { readonly porter: ForcePorter }

export type GrilleDeDémonstration = {
  readonly axes: Readonly<Record<number, CadreDAxe>>
  /** Les entités que la lecture nomme sous une force, avec leur mouvement d'Ansoff. */
  readonly entités: readonly { readonly nom: string; readonly ansoff?: Ansoff }[]
  /** Les ruptures : l'axe, et un mot de la phrase-titre du fait. */
  readonly ruptures: readonly { readonly axe: number; readonly contient: string }[]
}

const CONSEIL: Démonstration = {
  grille: {
    axes: {
      1: { porter: 'pouvoir_clients' },
      2: { porter: 'rivalite' },
      3: { pestel: 'economique' },
      4: { pestel: 'legal' },
      5: { pestel: 'technologique' },
      6: { porter: 'pouvoir_clients' },
      7: { pestel: 'socioculturel' },
      8: { pestel: 'politique' },
      9: { pestel: 'ecologique' },
      10: { pestel: 'technologique' },
      11: { pestel: 'socioculturel' },
      12: { porter: 'pouvoir_fournisseurs' },
    },
    entités: [
      { nom: 'Cap Territoires', ansoff: 'developpement_marche' },
      { nom: 'Orbis Public', ansoff: 'penetration' },
      { nom: 'Préfigure', ansoff: 'developpement_marche' },
      { nom: 'Valrive' },
      { nom: 'Saint-Aubert' },
      { nom: 'Ardaine' },
    ],
    ruptures: [
      { axe: 2, contient: 'Cap Territoires' },
      { axe: 2, contient: 'Préfigure' },
    ],
  },
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
    "accord-cadre Valrive (0, candidatures jusqu'au 6 novembre) · Cap Territoires (0, levée de fonds et agence lyonnaise) · Orbis Public (0, nouveau directeur général) · schéma numérique Saint-Aubert (0, consultation ouverte) · Département de l'Ardaine (0, budget reporté au 9 décembre) · centrale d'achat Ardaine (1, renouvellement en 2027) · Atelier Civique (2, aucune nouvelle)",
  markdown: `# L'essentiel

- La Métropole de Valrive ouvre le 14 octobre un accord-cadre de conseil de quatre ans, candidatures jusqu'au 6 novembre.
- Cap Territoires lève 3 millions d'euros le 16 octobre et ouvre une agence à Lyon.
- Orbis Public nomme le 15 octobre un nouveau directeur général, venu d'un grand cabinet national.
- Le Département de l'Ardaine reporte au 9 décembre le vote de son budget 2027.
- Trois collectivités de la région lancent des consultations sur l'intelligence artificielle dans les services.
- Le seuil des marchés sans publicité préalable passe à 60 000 euros, selon un décret fictif du 13 octobre.
- Préfigure, cabinet national, décroche une première mission à 30 kilomètres de Lyon.

# Actualités par axe

## ① Appels d'offres des collectivités — FORT

La Métropole de Valrive publie le 14 octobre un accord-cadre de conseil en transformation de quatre ans, en trois lots, candidatures jusqu'au 6 novembre. Le lot « conduite du changement » correspond exactement à vos références. ([source fictive](https://exemple.example/valrive-accord-cadre))

La commune de Saint-Aubert lance le 17 octobre la consultation de son schéma numérique Saint-Aubert, plafonnée à 40 000 euros, réponses avant le 14 novembre. Le montant reste sous le seuil où vos concurrents nationaux répondent. ([source fictive](https://exemple.example/saint-aubert-schema))


Le syndicat fictif des eaux du Lizon publie le 18 octobre un marché d'assistance à sa fusion avec deux syndicats voisins, réponses avant le 25 novembre. Une mission de dix-huit mois, dans votre cœur de métier. ([source fictive](https://exemple.example/syndicat-lizon))

## ② Concurrents directs — FORT

Cap Territoires annonce le 16 octobre une levée de 3 millions d'euros et le recrutement de vingt consultants d'ici juin, dont huit à Lyon. Ce sera votre principal concurrent sur les marchés lyonnais dès le printemps. ([source fictive](https://exemple.example/cap-territoires-levee))

Orbis Public nomme le 15 octobre un nouveau directeur général, ancien associé d'un cabinet national spécialisé dans les achats publics. Attendez-vous à des offres plus agressives sur les prix dès l'hiver. ([source fictive](https://exemple.example/orbis-direction))


Préfigure, cabinet national fictif, remporte le 13 octobre la réorganisation de la ville de Corlay, à 30 kilomètres de Lyon. C'est sa première mission dans la région. ([source fictive](https://exemple.example/prefigure-corlay))

## ③ Finances locales et budgets 2027 — MOYEN

Le Département de l'Ardaine reporte le 15 octobre au 9 décembre le vote de son budget 2027, faute d'arbitrage sur les dotations de l'État. Les études prévues au premier trimestre risquent de glisser au printemps. ([source fictive](https://exemple.example/ardaine-budget))

Une note fictive de l'observatoire régional des finances locales, publiée le 16 octobre, prévoit un recul de 4 % des dépenses d'études des communes en 2027. Les petites missions d'études seront les premières touchées. ([source fictive](https://exemple.example/observatoire-finances))

## ④ Commande publique : règles et seuils — MOYEN

Un décret fictif du 13 octobre relève à 60 000 euros le seuil des marchés passés sans publicité préalable, à compter du 1er janvier. Davantage de missions pourront vous être confiées sans appel d'offres. ([source fictive](https://exemple.example/decret-seuils))

Le guide régional fictif de la commande publique, mis à jour le 17 octobre, recommande de pondérer à 40 % au moins la valeur technique des offres de conseil. La qualité de la méthode pèsera plus que le prix. ([source fictive](https://exemple.example/guide-commande))

## ⑤ Intelligence artificielle dans les services publics — MOYEN

La Communauté d'agglomération du Haut-Lizon publie le 15 octobre un appel d'offres pour cadrer l'usage de l'intelligence artificielle à l'accueil des usagers. C'est un premier marché pour votre offre naissante sur ce sujet. ([source fictive](https://exemple.example/haut-lizon-ia))

La Région Val-d'Ardaine annonce le 17 octobre un guide de doctrine sur l'intelligence artificielle, attendu en janvier, rédigé avec deux cabinets. Les deux cabinets associés ne sont pas encore nommés. ([source fictive](https://exemple.example/region-ia))

## ⑥ Centrales d'achat — MOYEN

La centrale d'achat Ardaine confirme le 14 octobre que son marché de conseil sera renouvelé en 2027, sans date de consultation. Préparer dès maintenant votre fiche de référencement vous ferait gagner du temps. ([source fictive](https://exemple.example/centrale-ardaine))

Une centrale d'achat nationale fictive ouvre le 16 octobre un catalogue de missions courtes de conseil, de cinq à vingt jours, accessible sans mise en concurrence. Vos missions courtes y seraient visibles de toutes les collectivités. ([source fictive](https://exemple.example/centrale-nationale))

## ⑦ Recrutement et rémunérations — MOYEN

Une étude fictive publiée le 16 octobre chiffre à 8 % la hausse des salaires d'embauche des consultants seniors du secteur public en un an. Vos deux recrutements de l'hiver coûteront plus cher que prévu. ([source fictive](https://exemple.example/etude-salaires))

Cap Territoires publie le 17 octobre huit offres d'emploi à Lyon, dont trois postes de manager avec cinq ans d'expérience des collectivités. Trois de vos consultants ont le profil recherché. ([source fictive](https://exemple.example/cap-territoires-offres))

## ⑧ Événements du secteur public — MOYEN

Le programme du salon des acteurs publics de Valrive, publié le 13 octobre, compte un atelier sur les achats de conseil le 26 novembre. C'est l'occasion de rencontrer les acheteurs de Valrive avant la remise des offres. ([source fictive](https://exemple.example/salon-valrive))

Les rencontres régionales des directeurs généraux des services se tiendront le 4 décembre ; l'appel à intervenants ferme le 31 octobre. Une intervention vous placerait devant cent directeurs. ([source fictive](https://exemple.example/rencontres-dgs))

## ⑨ Transition écologique des territoires — MOYEN

La Région Val-d'Ardaine ouvre le 14 octobre un fonds d'ingénierie qui finance jusqu'à 70 % des études de planification écologique des communes. Les communes pourront financer des études qu'elles repoussaient. ([source fictive](https://exemple.example/fonds-ingenierie))

La Métropole de Valrive adopte le 16 octobre son plan climat, qui prévoit une assistance à maîtrise d'ouvrage pour chaque commune membre. Ces missions d'accompagnement seront mises en concurrence en 2027. ([source fictive](https://exemple.example/valrive-plan-climat))

## ⑩ Numérique et données publiques — MOYEN

Le Département de l'Ardaine annonce le 17 octobre la refonte de son portail de données ouvertes, avec un marché d'accompagnement prévu en janvier. Votre mission de 2025 sur leurs données vous qualifie. ([source fictive](https://exemple.example/ardaine-donnees))

Une association fictive de collectivités publie le 15 octobre un référentiel de gouvernance des données, que trois métropoles s'engagent à appliquer. Les métropoles chercheront de l'aide pour l'appliquer. ([source fictive](https://exemple.example/referentiel-donnees))

## ⑪ Ressources humaines des collectivités — MOYEN

Une enquête fictive du 14 octobre indique que 62 % des communes de plus de 10 000 habitants peinent à recruter des chefs de projet. Ce déficit nourrit la demande d'appui extérieur. ([source fictive](https://exemple.example/enquete-recrutement))

Le centre de gestion fictif de l'Ardaine lance le 16 octobre un marché d'appui aux réorganisations de services, réponses avant le 20 novembre. Le marché vise directement vos compétences en organisation. ([source fictive](https://exemple.example/cdg-reorganisation))

## ⑫ Partenaires et sous-traitants — MOYEN

Atelier Civique, partenaire de concertation, n'a rien publié depuis le 30 septembre ; son site annonce une refonte le 13 octobre. Votre offre conjointe sur Valrive dépend de sa réponse. ([source fictive](https://exemple.example/atelier-civique))

Un collectif fictif de designers de services publics annonce le 18 octobre son ouverture à des partenariats avec des cabinets de conseil. Un partenaire possible pour le lot concertation. ([source fictive](https://exemple.example/collectif-design))

## ⑬ Labels et qualifications — RAS

> Aucune évolution des qualifications professionnelles du conseil depuis le 2 septembre ; deux référentiels vérifiés.

# Dossiers suivis

L'accord-cadre Valrive est ouvert depuis le 14 octobre, avec des candidatures jusqu'au 6 novembre.

Cap Territoires a annoncé une levée de fonds et une agence lyonnaise le 16 octobre.

Orbis Public change de directeur général à compter du 2 novembre. Son arrivée devrait réorienter le cabinet vers les achats publics.

Le schéma numérique Saint-Aubert est en consultation jusqu'au 14 novembre. Le cahier des charges demande une référence communale récente.

Le Département de l'Ardaine votera son budget 2027 le 9 décembre. Les études nouvelles attendront ce vote.

La centrale d'achat Ardaine renouvellera son marché de conseil en 2027. Aucune date de consultation n'est encore publiée.

Atelier Civique reste silencieux depuis deux semaines. Sa réponse conditionne votre offre conjointe sur Valrive.
`,
}

const PME: Démonstration = {
  grille: {
    axes: {
      1: { porter: 'pouvoir_clients' },
      2: { porter: 'rivalite' },
      3: { porter: 'pouvoir_fournisseurs' },
      4: { pestel: 'politique' },
      5: { porter: 'pouvoir_clients' },
      6: { pestel: 'legal' },
      7: { pestel: 'socioculturel' },
      8: { pestel: 'ecologique' },
      9: { pestel: 'economique' },
      10: { pestel: 'technologique' },
      11: { pestel: 'politique' },
      12: { pestel: 'economique' },
    },
    entités: [
      { nom: 'Précimeca', ansoff: 'developpement_marche' },
      { nom: 'Usinage Delmas', ansoff: 'penetration' },
      { nom: 'Usimat', ansoff: 'penetration' },
      { nom: 'Aérolys' },
      { nom: 'Hélivale' },
      { nom: 'Ferrovia Systèmes' },
    ],
    ruptures: [
      { axe: 1, contient: 'cadences' },
      { axe: 2, contient: 'redressement' },
      { axe: 8, contient: 'bilan carbone' },
    ],
  },
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
    "Aérolys (0, cadences relevées de 15 %) · Usinage Delmas (0, redressement judiciaire) · Ferrovia Systèmes (0, commande de 40 rames) · Précimeca (0, nouvelle ligne de rectification) · appel à projets Industrie durable (1, clôture le 28 novembre) · certification EN 9100 (2, audit en janvier)",
  markdown: `# L'essentiel

- Aérolys relève ses cadences de 15 % pour 2027 et qualifie trois nouveaux sous-traitants en usinage.
- Usinage Delmas, concurrent direct, est placé en redressement judiciaire le 16 octobre.
- Ferrovia Systèmes remporte une commande de 40 rames de tramway, livrables à partir de 2028.
- Le prix de l'électricité industrielle recule de 6 % sur le mois, selon l'indice régional fictif.
- L'appel à projets Industrie durable finance jusqu'à 30 % des machines, clôture le 28 novembre.
- Précimeca investit dans une ligne de rectification qui vise vos clients aéronautiques.
- Hélivale reporte de six mois son programme d'hélicoptère léger.
- Le contrat régional d'électricité à prix fixe rouvre jusqu'au 30 novembre.

# Actualités par axe

## ① Donneurs d'ordre aéronautiques — FORT

Aérolys annonce le 14 octobre une hausse de 15 % de ses cadences de production pour 2027, portée par les trains d'atterrissage. Vos volumes de pièces de train pourraient suivre la même hausse. ([source fictive](https://exemple.example/aerolys-cadences))

Aérolys publie le 17 octobre un appel à manifestation d'intérêt pour qualifier trois nouveaux sous-traitants en usinage, réponses avant le 20 novembre. Vous êtes déjà qualifié chez lui sur deux références. ([source fictive](https://exemple.example/aerolys-ami))


Hélivale, second donneur d'ordre fictif, reporte le 16 octobre de six mois son programme d'hélicoptère léger. Vos commandes 2027 sur ce programme seraient décalées d'autant. ([source fictive](https://exemple.example/helivale-report))

## ② Concurrents usineurs — FORT

Usinage Delmas est placé en redressement judiciaire le 16 octobre ; ses 60 salariés et ses contrats ferroviaires sont à reprendre. Ses clients ferroviaires chercheront un fournisseur dès novembre. ([source fictive](https://exemple.example/delmas-redressement))

Précimeca annonce le 15 octobre une ligne de rectification de 2 millions d'euros et cite l'aéronautique comme premier marché visé. Il entre sur votre premier marché. ([source fictive](https://exemple.example/precimeca-ligne))


Usimat, concurrent fictif de la vallée, recrute le 17 octobre quatre usineurs à des salaires 10 % au-dessus de la grille. La pression sur vos équipes va monter. ([source fictive](https://exemple.example/usimat-recrutement))

## ③ Énergie et matières premières — FORT

L'indice régional fictif de l'électricité industrielle recule de 6 % au 15 octobre par rapport au mois précédent. Votre facture du trimestre devrait baisser d'autant. ([source fictive](https://exemple.example/indice-electricite))

Le prix de l'aluminium de qualité aéronautique progresse de 4 % au 17 octobre, selon un négociant fictif, qui annonce des délais de six semaines. Vos devis à prix fermes sont exposés. ([source fictive](https://exemple.example/prix-aluminium))


Le contrat régional fictif de fourniture d'électricité des PME rouvre le 15 octobre, à prix fixe sur trois ans. Les inscriptions ferment le 30 novembre. ([source fictive](https://exemple.example/contrat-electricite))

## ④ Aides à l'investissement industriel — MOYEN

La Région Val-d'Ardaine ouvre le 13 octobre l'appel à projets Industrie durable : jusqu'à 30 % des machines financées, clôture le 28 novembre. Votre projet de centre cinq axes y est éligible. ([source fictive](https://exemple.example/industrie-durable))

Un fonds régional fictif de prêts sans garantie relève le 16 octobre son plafond à 500 000 euros pour les PME industrielles. Il peut compléter la subvention sans garantie personnelle. ([source fictive](https://exemple.example/fonds-prets))

## ⑤ Ferroviaire — MOYEN

Ferrovia Systèmes annonce le 16 octobre une commande de 40 rames de tramway, livrables à partir de 2028, assemblées dans la région. Vous avez fourni ses pièces de bogie jusqu'en 2024. ([source fictive](https://exemple.example/ferrovia-commande))

Ferrovia Systèmes publie le 18 octobre son calendrier de consultation des fournisseurs de pièces usinées, ouvert du 3 au 28 novembre. C'est la fenêtre pour revenir dans son panel. ([source fictive](https://exemple.example/ferrovia-fournisseurs))

## ⑥ Qualité et certifications — MOYEN

L'organisme certificateur fictif Certéo publie le 15 octobre ses dates d'audit EN 9100 du premier trimestre, à partir du 12 janvier. Votre renouvellement EN 9100 tombe dans cette période. ([source fictive](https://exemple.example/certeo-audits))

Une révision fictive de la norme de traçabilité des pièces aéronautiques, publiée le 14 octobre, s'appliquera aux audits à partir du 1er juillet. Votre logiciel de suivi devra produire ces nouvelles données. ([source fictive](https://exemple.example/norme-tracabilite))

## ⑦ Emploi et formation — MOYEN

Le lycée professionnel du bassin ouvre le 14 octobre une formation de régleurs sur commande numérique, douze places en alternance. Deux de vos postes ouverts correspondent à ce profil. ([source fictive](https://exemple.example/formation-regleurs))

L'observatoire fictif des métiers de la métallurgie chiffre le 17 octobre à 340 le nombre de postes d'usineur non pourvus dans le département. La tension sur vos recrutements va durer. ([source fictive](https://exemple.example/observatoire-metiers))

## ⑧ Décarbonation de la production — MOYEN

Un fonds fictif de décarbonation des PME lance le 17 octobre un diagnostic énergétique gratuit pour les sites de moins de 250 salariés. Il vous donnerait le bilan qu'Aérolys demande. ([source fictive](https://exemple.example/diagnostic-energie))

Aérolys demande le 15 octobre à ses fournisseurs de rang un leur bilan carbone avant le 31 mars, condition des contrats de 2028. Sans ce bilan, les contrats de 2028 vous seront fermés. ([source fictive](https://exemple.example/aerolys-carbone))

## ⑨ Défaillances et reprises dans la filière — MOYEN

Le tribunal fixe le 16 octobre au 4 décembre la date limite des offres de reprise d'Usinage Delmas, actifs et contrats compris. Ses machines cinq axes pourraient être reprises séparément. ([source fictive](https://exemple.example/delmas-offres))

Un tourneur fictif de 25 salariés de la vallée voisine est mis en vente le 13 octobre par son dirigeant, qui part à la retraite. Une reprise doublerait votre capacité de tournage. ([source fictive](https://exemple.example/tourneur-cession))

## ⑩ Machines et outillage — MOYEN

Un constructeur fictif de centres d'usinage cinq axes annonce le 14 octobre des délais de livraison ramenés de neuf à cinq mois. Votre investissement pourrait produire dès le printemps. ([source fictive](https://exemple.example/delais-machines))

Un distributeur fictif d'outils coupants relève ses tarifs de 3 % au 1er novembre, selon sa circulaire du 16 octobre. Commander avant le 1er novembre évite la hausse. ([source fictive](https://exemple.example/tarifs-outils))

## ⑪ Défense — MOYEN

Un programme fictif de drones de surveillance attribue le 15 octobre son marché de production, avec une part réservée aux PME régionales. Les PME retenues seront connues en décembre. ([source fictive](https://exemple.example/programme-drones))

Le pôle fictif de la défense régionale ouvre le 17 octobre les inscriptions à sa convention d'affaires du 2 décembre. Une première porte vers un marché absent de votre carnet. ([source fictive](https://exemple.example/convention-defense))

## ⑫ Export — MOYEN

Un équipementier fictif allemand annonce le 14 octobre chercher des usineurs français pour des pièces de structure, à partir de 2027. Vos pièces de structure entrent dans son besoin. ([source fictive](https://exemple.example/equipementier-allemand))

L'agence régionale fictive d'appui à l'export ouvre le 16 octobre un pavillon collectif au salon aéronautique de mars, inscriptions avant le 15 décembre. Le coût du stand est pris en charge à moitié. ([source fictive](https://exemple.example/pavillon-export))

## ⑬ Cybersécurité industrielle — RAS

> Aucune alerte de sécurité sur les commandes numériques utilisées dans l'atelier cette semaine.

# Dossiers suivis

Aérolys relève ses cadences et qualifie de nouveaux sous-traitants avant le 20 novembre. Votre réponse doit chiffrer la capacité que vous pouvez ajouter en 2027.

Usinage Delmas est en redressement judiciaire, offres de reprise attendues avant le 4 décembre. Ses deux centres cinq axes et ses contrats ferroviaires peuvent être repris séparément.

Ferrovia Systèmes consultera ses fournisseurs de pièces usinées du 3 au 28 novembre. La première livraison de pièces est attendue au second semestre 2027.

Précimeca entre sur l'aéronautique avec sa nouvelle ligne de rectification. Elle sera en service au printemps.

L'appel à projets Industrie durable reste ouvert jusqu'au 28 novembre. Le dossier demande trois devis de machines.

La certification EN 9100 sera auditée en janvier. Les nouvelles règles de traçabilité s'appliqueront à l'audit suivant.
`,
}

const ESS: Démonstration = {
  grille: {
    axes: {
      1: { pestel: 'politique' },
      2: { pestel: 'economique' },
      3: { pestel: 'economique' },
      4: { porter: 'pouvoir_clients' },
      5: { pestel: 'politique' },
      6: { porter: 'rivalite' },
      7: { pestel: 'economique' },
      8: { pestel: 'socioculturel' },
      9: { pestel: 'legal' },
      10: { pestel: 'socioculturel' },
      11: { pestel: 'economique' },
      12: { pestel: 'politique' },
    },
    entités: [
      { nom: 'Le Fil vert', ansoff: 'penetration' },
      { nom: 'Valrive' },
    ],
    ruptures: [{ axe: 6, contient: 'Fil vert' }],
  },
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
    "aides au poste 2027 (0, enveloppe régionale en hausse) · appel à projets Réemploi solidaire (0, clôture le 14 novembre) · marché réservé Valrive (0, réponses avant le 21 novembre) · Le Fil vert (0, seconde boutique) · Fondation Horizon commun (1, comité le 5 novembre) · prêt participatif territorial (2, dossier en instruction)",
  markdown: `# L'essentiel

- L'enveloppe régionale des aides au poste 2027 progresse de 5 %, selon la préfecture fictive du 15 octobre.
- L'appel à projets Réemploi solidaire ouvre le 13 octobre : jusqu'à 80 000 euros par structure.
- La Métropole de Valrive publie un marché réservé de collecte textile, réponses avant le 21 novembre.
- L'éco-organisme textile fictif relève de 10 % son soutien au tri à partir de janvier.
- La Fondation Horizon commun réunit son comité de sélection le 5 novembre.
- Le Fil vert ouvre une seconde boutique à trois kilomètres de la vôtre.
- La fondation Terres partagées finance l'achat de véhicules, jusqu'à 30 000 euros.

# Actualités par axe

## ① Aides au poste et conventionnement — FORT

La préfecture fictive du Val-d'Ardaine annonce le 15 octobre une enveloppe d'aides au poste 2027 en hausse de 5 %, répartie en décembre. Vos douze postes conventionnés pourraient être augmentés. ([source fictive](https://exemple.example/aides-au-poste))

Le dialogue de gestion annuel des structures d'insertion est fixé au 20 novembre, selon le calendrier publié le 16 octobre. Votre bilan d'activité doit être prêt avant cette date. ([source fictive](https://exemple.example/dialogue-gestion))


La préfecture fictive précise le 17 octobre que les postes non pourvus au 30 juin seront redistribués entre structures. Un poste vacant cet été vous coûterait une aide. ([source fictive](https://exemple.example/postes-redistribues))

## ② Appels à projets et fondations — FORT

L'appel à projets Réemploi solidaire ouvre le 13 octobre : jusqu'à 80 000 euros par structure pour l'investissement, clôture le 14 novembre. Votre projet de seconde ligne de tri entre dans ce plafond. ([source fictive](https://exemple.example/reemploi-solidaire))

La Fondation Horizon commun confirme le 17 octobre que son comité de sélection se réunira le 5 novembre et retiendra six projets. Votre demande fait partie des dossiers examinés. ([source fictive](https://exemple.example/horizon-commun))


La fondation fictive Terres partagées ouvre le 16 octobre un appel à projets de 30 000 euros pour l'achat de véhicules, clôture le 30 novembre. Votre camion de collecte a douze ans. ([source fictive](https://exemple.example/terres-partagees))

## ③ Filière textile et éco-organisme — FORT

L'éco-organisme textile fictif relève le 14 octobre de 10 % son soutien au tonnage trié à partir du 1er janvier. Votre recette de tri augmenterait d'environ 9 000 euros par an. ([source fictive](https://exemple.example/eco-organisme))

L'éco-organisme annonce le 16 octobre un audit de traçabilité des centres de tri conventionnés, à réaliser avant le 30 juin. Votre logiciel de pesée devra exporter les données demandées. ([source fictive](https://exemple.example/eco-organisme-audit))


Un centre de tri fictif concurrent obtient le 15 octobre le conventionnement de l'éco-organisme pour le nord du département. Il vise les mêmes points de collecte que vous. ([source fictive](https://exemple.example/centre-tri-nord))

## ④ Collectivités et marchés réservés — MOYEN

La Métropole de Valrive publie le 16 octobre un marché réservé de collecte textile pour les structures d'insertion, réponses avant le 21 novembre. Vous collectez déjà sur trois communes de la métropole. ([source fictive](https://exemple.example/valrive-marche-reserve))

Le Département de l'Ardaine annonce le 17 octobre que 10 % de ses marchés d'entretien seront réservés à l'insertion à partir de 2027. Une diversification vers l'entretien deviendrait finançable. ([source fictive](https://exemple.example/ardaine-clauses))

## ⑤ Fonds européens — MOYEN

L'autorité de gestion fictive des fonds sociaux européens annonce le 15 octobre un appel à projets inclusion, ouvert le 1er décembre. Votre parcours de formation interne peut y prétendre. ([source fictive](https://exemple.example/fonds-europeens))

Le 17 octobre, la même autorité rappelle que les dépenses de 2026 doivent être justifiées avant le 31 janvier pour être remboursées. Vos justificatifs de 2026 doivent être rassemblés en janvier. ([source fictive](https://exemple.example/fonds-europeens-justificatifs))

## ⑥ Structures du réemploi — MOYEN

La ressourcerie fictive Le Fil vert ouvre le 18 octobre une seconde boutique à Valrive, à trois kilomètres de la vôtre. Vos ventes en boutique pourraient en pâtir dès décembre. ([source fictive](https://exemple.example/fil-vert))

Un réseau fictif de recycleries régionales annonce le 14 octobre une plateforme commune de vente en ligne, ouverte aux non-adhérents en mars. Une vitrine en ligne sans développement de votre part. ([source fictive](https://exemple.example/plateforme-recycleries))

## ⑦ Financement solidaire et prêts — MOYEN

Le fonds territorial fictif annonce le 14 octobre que les prêts participatifs déposés avant le 31 octobre seront examinés en décembre. Votre dossier déposé en septembre sera examiné à cette séance. ([source fictive](https://exemple.example/pret-participatif))

Une banque coopérative fictive lance le 16 octobre un livret dont les dépôts financent l'économie sociale de la région, plafonné à 20 000 euros. Une source de prêts à taux bas pour 2027. ([source fictive](https://exemple.example/livret-solidaire))

## ⑧ Mécénat d'entreprise — MOYEN

Un club fictif d'entreprises mécènes du Val-d'Ardaine lance le 17 octobre un appel à dons de matériel de bureau pour les associations. Le don de matériel informatique allégerait votre budget de fonctionnement. ([source fictive](https://exemple.example/club-mecenes))

Une enseigne fictive de prêt-à-porter annonce le 15 octobre un partenariat de collecte en magasin avec des structures d'insertion de la région. Un partenariat de collecte augmenterait vos volumes. ([source fictive](https://exemple.example/enseigne-collecte))

## ⑨ Règles de l'insertion — MOYEN

Une instruction fictive du 13 octobre simplifie le renouvellement des agréments d'insertion, désormais valables trois ans. Votre renouvellement de 2027 sera plus simple. ([source fictive](https://exemple.example/instruction-agrements))

Le service public de l'emploi fictif publie le 16 octobre un nouveau formulaire d'orientation des candidats, obligatoire à partir du 1er décembre. Votre chargée d'accompagnement devra l'utiliser dès décembre. ([source fictive](https://exemple.example/formulaire-orientation))

## ⑩ Accompagnement des salariés en insertion — MOYEN

Un organisme fictif de formation ouvre le 14 octobre un parcours de cariste de six semaines réservé aux salariés en insertion, gratuit. Quatre de vos salariés pourraient en bénéficier. ([source fictive](https://exemple.example/parcours-cariste))

Le 17 octobre, une étude fictive chiffre à 48 % le taux de sortie vers l'emploi durable des entreprises d'insertion du textile. Votre taux de 52 % est au-dessus, un argument pour vos financeurs. ([source fictive](https://exemple.example/etude-sorties))

## ⑪ Débouchés et ventes — MOYEN

Une plateforme fictive de vente d'occasion annonce le 15 octobre une baisse de ses commissions à 8 % pour les structures de l'économie sociale. Votre marge en ligne gagnerait quatre points. ([source fictive](https://exemple.example/plateforme-occasion))

Le marché de Noël solidaire de Valrive ouvre le 16 octobre les candidatures des exposants, pour une édition du 12 au 21 décembre. C'est votre meilleure semaine de ventes de l'année. ([source fictive](https://exemple.example/marche-noel))

## ⑫ Réseaux de l'ESS — MOYEN

La chambre régionale fictive de l'économie sociale publie le 14 octobre son programme du mois de l'ESS, avec une rencontre des financeurs le 18 novembre. Vous y rencontreriez les fondations du territoire. ([source fictive](https://exemple.example/mois-ess))

Le réseau fictif des entreprises d'insertion élit le 16 octobre une nouvelle présidente, dirigeante d'une structure du réemploi. Le réemploi gagne une voix dans le réseau. ([source fictive](https://exemple.example/reseau-insertion))

## ⑬ Foncier et locaux — RAS

> Aucune offre de locaux d'activité adaptée à un atelier de tri publiée depuis le 1er octobre.

# Dossiers suivis

Les aides au poste 2027 progressent de 5 %, répartition attendue en décembre. Votre demande d'extension à quatorze postes peut être présentée au dialogue de gestion.

L'appel à projets Réemploi solidaire ferme le 14 novembre. Le dossier demande un plan de financement sur trois ans et deux devis.

Le marché réservé Valrive attend les réponses avant le 21 novembre. Il porte sur quarante points de collecte pendant trois ans.

Le Fil vert ouvre une seconde boutique à Valrive. Ses prix d'appel sont inférieurs aux vôtres de 20 %.

La Fondation Horizon commun examinera votre demande le 5 novembre. La réponse est attendue avant la fin du mois.

Le prêt participatif territorial est toujours en instruction. Il sera examiné à la séance de décembre.
`,
}

export const DÉMONSTRATIONS: readonly Démonstration[] = [CONSEIL, PME, ESS]
