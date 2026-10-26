/**
 * Les étiquettes de l'édition n°6 Écosystème d'Infralliance (21 octobre 2026),
 * posées à la main le 26 octobre 2026 et validées telles quelles par
 * l'opératrice le même jour. C'est le lot de référence de la porte : un
 * changement de la segmentation ou des règles qui le ferait refuser est une
 * régression, pas une étiquette à corriger.
 *
 * Choix validés, fait par fait :
 *   · ①1 Digital Networks Act au Conseil : légal (un règlement en négociation).
 *   · ①2 rendez-vous du rapporteur du règlement cloud : politique (l'influence
 *     sur le texte, pas encore le texte).
 *   · ①3 billet de CISPE : rivalité, CISPE étant une voix concurrente du corpus ;
 *     mouvement « pénétration » (même débat, plus de parole).
 *   · ②1 loi de résilience en commission : légal.
 *   · ②2 Bleu et S3NS vers SecNumCloud : technologique.
 *   · ③1 règlement marchés publics au Conseil : légal.
 *   · ④1 module de 3 MW de Telehouse : économique, FORT, rupture (un fondateur
 *     communique sans Infralliance : la dilution de sa voix est la Q3).
 *   · ④2 e-Valley à Cambrai : économique.
 *   · ④3 jurisprudence des recours : légal.
 *   · ⑤1 feuille de route du Cigref : pouvoir des clients (les acheteurs
 *     organisent leur pression sur les fournisseurs).
 *   · ⑤2 présidence du GIMELEC : politique.
 */
import type { ÉtiquetteProposée } from '@/lib/domaine/strategie'

export const ÉTIQUETTES_OCTOBRE: readonly ÉtiquetteProposée[] = [
  {
    section: 'axe', axe: 1, rang: 1,
    titre: "Le groupe de travail Télécommunications du Conseil de l'Union européenne examine le 22 octobre 2026 le premier texte de compromis de la présidence irlandaise sur le Digital Networks Act.",
    date: '2026-10-16', source: 'https://data.consilium.europa.eu/doc/document/CM-4581-2026-INIT/en/pdf',
    pestel: 'legal', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 1, rang: 2,
    titre: "Le rapporteur du règlement sur le cloud et l'intelligence artificielle a reçu deux opérateurs de cloud européens, et la commission des libertés civiles a nommé son rapporteur pour avis.",
    date: '2026-10-19', source: 'https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2026/0138%28COD%29',
    pestel: 'politique', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 1, rang: 3,
    titre: "CISPE a publié le 20 octobre 2026 une réponse chiffrée à l'étude commandée par les hyperscalers américains sur le coût d'une sortie de leurs clouds.",
    date: '2026-10-20', source: 'https://www.cispe.cloud/e115-billion-to-move-over-e2-trillion-to-stay/',
    porter: 'rivalite', entite: 'CISPE', ansoff: 'penetration', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 2, rang: 1,
    titre: "La commission spéciale de l'Assemblée nationale a examiné le mercredi 14 octobre 2026 les amendements de séance de la loi de résilience, mais aucune date de séance n'a été fixée depuis.",
    date: '2026-10-14', source: 'https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/cscyber/l17cscyber2627004_compte-rendu.pdf',
    pestel: 'legal', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 2, rang: 2,
    titre: 'Bleu, le cloud de confiance à technologie Microsoft, a annoncé le 15 octobre 2026 un partenariat avec Snowflake et Orange Business, en visant la qualification SecNumCloud 3.2.',
    date: '2026-10-15', source: 'https://www.snowflake.com/fr/blog/snowflake-bleu-sovereign-cloud-france/',
    pestel: 'technologique', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 3, rang: 1,
    titre: 'Le groupe de travail du Conseil sur les marchés publics poursuit l’examen du règlement unique les 29 et 30 octobre 2026, avec un débat sur la forme juridique du texte.',
    date: '2026-10-15', source: 'https://data.consilium.europa.eu/doc/document/CM-4602-2026-INIT/en/pdf',
    pestel: 'legal', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 4, rang: 1,
    titre: 'Telehouse a annoncé le 20 octobre 2026 un nouveau module de 3 MW dédié à l’intelligence artificielle sur son campus TH3 Paris Magny, dont la puissance disponible passe à 23 MW.',
    date: '2026-10-20', source: 'https://www.telehouse.fr/actualites/telehouse-renforce-les-capacites-ia-de-son-campus-th3-paris-magny-avec-le-deploiement-dune-nouvelle-infrastructure-dediee-a-lintelligence-artificielle-et-a-linterconnexion/',
    pestel: 'economique', rupture: true, impact: 'FORT', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 4, rang: 2,
    titre: "L'agglomération de Cambrai a approuvé une seconde fois, selon DCmag le 19 octobre 2026, la vente des terrains du projet e-Valley de Data4 et Brookfield.",
    date: '2026-10-19', source: 'https://dcmag.fr/',
    pestel: 'economique', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 4, rang: 3,
    titre: 'Deux avocats ont dressé le 15 octobre 2026, dans DCmag, l’état de la jurisprudence récente sur les recours contre les centres de données.',
    date: '2026-10-15', source: 'https://www.dcmag.fr/recours-contentieux-contre-les-projets-de-data-centers-etat-des-lieux-de-la-jurisprudence-recente/',
    pestel: 'legal', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 5, rang: 1,
    titre: 'Le Cigref a dévoilé le 15 octobre 2026, lors de son assemblée générale, une feuille de route 2026-2027 dont l’un des trois programmes prioritaires est « Relations fournisseurs ».',
    date: '2026-10-15', source: 'https://www.cigref.fr/assemblee-generale-du-cigref-2026-trajectoires-numeriques-competitivite-et-performance',
    porter: 'pouvoir_clients', entite: 'Cigref', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
  {
    section: 'axe', axe: 5, rang: 2,
    titre: 'Aymeric Renaud, président de Schneider Electric France, a été nommé président du GIMELEC, selon DCmag le 14 octobre 2026.',
    date: '2026-10-14', source: 'https://dcmag.fr/aymeric-renaud-president-du-gimelec/',
    pestel: 'politique', rupture: false, impact: 'MOYEN', nouveaute: 'nouveau',
  },
]
