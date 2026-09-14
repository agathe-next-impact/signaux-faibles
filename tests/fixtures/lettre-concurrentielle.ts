/**
 * Un extrait de la première lettre concurrentielle de Konica Minolta, telle
 * qu'elle a été publiée le 12 septembre 2026.
 *
 * Cette fixture existe pour une raison précise : c'est la lettre
 * **concurrentielle** qui porte la rubrique « Les acteurs que nous suivons pour
 * vous », absente de la lettre écosystème. Le corpus y est décrit, les trous de
 * couverture y sont nommés, et surtout chaque dossier ouvert y est repris en
 * clair — au point que, pour plusieurs d'entre eux, c'est le seul endroit de la
 * lettre où leur nom figure. Détacher cette rubrique sans continuer à la
 * parcourir aurait vidé leurs pages sans que rien ne casse.
 */
import type { BlocNotion } from '@/lib/domaine/document'

const texte = (contenu: string) => [{ plain_text: contenu }]
let compteur = 0
const bloc = (type: string, contenu: string): BlocNotion => ({
  id: `c${(compteur += 1)}`,
  type,
  [type]: { rich_text: texte(contenu) },
})

export const DOSSIERS_CONCURRENTIELS =
  'Division informatique de Ricoh France (1, aucun point d’étape) · ' +
  'Convergence Xerox et Lexmark (1, calendrier non corroboré) · ' +
  'Division informatique de Sharp (1, objectif non actualisé) · ' +
  'Intégration d’Open Bee et Doxense (1, communications annoncées non parues) · ' +
  'Comptes d’Everial et d’Econocom France (0, résultats redressés en 2025) · ' +
  'Couverture de Kyocera France (0, fil accessible par une autre adresse) · ' +
  'Groupe Desk (1, aucune entité immatriculée) · SESIN (0, identité et comptes établis) · ' +
  'Rythme comparé sur les cinq marchés (1, aucun mouvement daté)'

export const BLOCS_CONCURRENTIELS: BlocNotion[] = [
  bloc('heading_1', 'L’essentiel'),
  bloc(
    'paragraph',
    'Vous détenez l’agrément décisif de la facture électronique, et deux de vos concurrents les plus directs ne l’ont pas. Open Bee, que vous avez reprise le 5 août, figure depuis janvier 2026 dans la liste officielle des opérateurs immatriculés comme plateformes agréées.',
  ),
  bloc(
    'paragraph',
    'La semaine a été calme chez vos concurrents, et nous le documentons plutôt que de le meubler. Aucun des trois grands chantiers que nous suivons n’a produit le moindre point d’étape.',
  ),

  bloc('heading_1', 'Actualités par axe'),
  bloc('heading_2', '① Recomposition capitalistique et périmètres — MOYEN'),
  bloc(
    'paragraph',
    'Fujifilm cède à un industriel chinois sa production de plaques offset et sa commercialisation sur l’Europe. L’accord a été signé le 28 août 2026 et publié le 10 septembre.',
  ),
  bloc('heading_2', '② Bascule des constructeurs vers le service et la cybersécurité — MOYEN'),
  bloc(
    'paragraph',
    'Rien de neuf chez les trois concurrents engagés dans la même course. Ricoh France n’a rien publié sur sa division informatique depuis le 25 mai 2026, et Sharp rien depuis le 24 juin 2026.',
  ),

  // La rubrique du corpus. Elle ne raconte pas la semaine : elle dit ce que la
  // veille surveille, et où en est chacun des dossiers ouverts.
  bloc('heading_1', 'Les acteurs que nous suivons pour vous'),
  bloc(
    'paragraph',
    'Notre corpus compte trente-six entreprises, rangées en cinq logiques concurrentielles différentes. Cette semaine, deux d’entre elles ont produit un fait daté : Everial et Econocom France, par le dépôt de leurs comptes 2025.',
  ),
  bloc(
    'paragraph',
    'Deux trous de couverture, que nous préférons nommer. Le fil d’actualités de Kyocera France est accessible, contrairement à ce que nous pensions : c’est une adresse particulière qui boucle, pas le site.',
  ),
  bloc(
    'paragraph',
    'Les dossiers que nous suivons, et où ils en sont. La division informatique de Ricoh France n’a donné aucun point d’étape. La convergence des réseaux Xerox et Lexmark est en cours mais son calendrier ne nous est pas confirmé. La division informatique de Sharp n’a pas actualisé son objectif. L’intégration d’Open Bee et Doxense n’a produit aucune des communications annoncées pour septembre. Les comptes d’Everial et d’Econocom France se sont redressés. La couverture de Kyocera France est rétablie par une autre adresse. Le Groupe Desk se révèle introuvable au registre. SESIN est désormais identifiée et ses comptes sont lisibles. Enfin, le rythme comparé sur vos cinq marchés de croissance n’a produit aucun mouvement daté cette semaine.',
  ),
  bloc(
    'paragraph',
    'Un dossier se ferme cette semaine : celui de l’immatriculation d’Open Bee comme plateforme agréée. Elle est acquise depuis janvier 2026.',
  ),

  bloc('heading_1', 'Ajustements du cadrage de cette veille'),
  bloc(
    'bulleted_list_item',
    'Nous annoncions une date pour l’unification des réseaux Xerox et Lexmark, et nous ne l’avons pas retrouvée. Nous vous proposons de retirer ces deux éléments.',
  ),
  bloc(
    'bulleted_list_item',
    'Une entreprise de notre liste de concurrents n’existe pas sous ce nom. Le Groupe Desk n’est immatriculé nulle part.',
  ),
  bloc(
    'paragraph',
    'Ces ajustements ne seront appliqués qu’après votre accord. Pour demander vous-même une modification du cadrage, écrivez-nous.',
  ),

  // Le trait ferme le cadrage, comme dans la lettre écosystème.
  bloc('divider', ''),
]
