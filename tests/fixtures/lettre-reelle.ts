/**
 * Un extrait de la première lettre Infralliance, telle qu'elle a été envoyée le
 * 8 septembre 2026.
 *
 * Cette fixture existe parce qu'une note réelle ne ressemble pas aux notes que
 * l'on invente pour un test : ses dossiers sont des syntagmes descriptifs, et
 * la moitié de son texte vit hors des sections thématiques. C'est elle qui a
 * révélé que la recherche de mentions ignorait les rubriques.
 */
import type { BlocNotion } from '@/lib/domaine/document'

const texte = (contenu: string) => [{ plain_text: contenu }]
let compteur = 0
const bloc = (type: string, contenu: string): BlocNotion => ({
  id: `b${(compteur += 1)}`,
  type,
  [type]: { rich_text: texte(contenu) },
})

export const DOSSIERS_RÉELS =
  'Loi Résilience (0) · CADA (0, rapporteurs identifiés) · règlement marchés publics (0) · ' +
  'catalogue franco-allemand (0) · SecNumCloud 3.2 (0) · PINM (0, aucun décret) · ' +
  'Rovaltain (0) · raccordement Telehouse Magny (0, règle RTE fin 2026) · ' +
  'DNA (0, date corrigée) · colloque Cnam (0)'

export const BLOCS_RÉELS: BlocNotion[] = [
  bloc(
    'paragraph',
    'Ce que suit cette veille. Infralliance est le think & do tank créé en 2023 par Telehouse, Terralpha, France-IX et Axione pour défendre une idée : la souveraineté numérique se joue dans les infrastructures.',
  ),

  bloc('heading_1', 'L’essentiel'),
  bloc(
    'bulleted_list_item',
    '1er septembre. L’ANSSI a qualifié SecNumCloud le cloud public d’OVHcloud ainsi que l’IaaS de Numspot. C’est la première vague depuis que le référentiel 3.2 est devenu contraignant.',
  ),
  bloc(
    'bulleted_list_item',
    '9 septembre. La Commission présente son règlement marchés publics assorti d’une « préférence européenne ».',
  ),
  bloc(
    'bulleted_list_item',
    'Loi Résilience. Le texte n’est toujours pas inscrit à l’Assemblée.',
  ),

  bloc('heading_1', 'Actualités par famille'),
  bloc('heading_2', '① Cadre européen — MOYEN'),
  bloc(
    'paragraph',
    'CADA. Correctif : le texte a des rapporteurs. Reinier van Lanschot a été nommé le 7/07 rapporteur de la commission IMCO.',
  ),
  bloc(
    'paragraph',
    'Catalogue franco-allemand. Rien à signaler. Ni la DGE ni le BMDS n’ont communiqué sur la task-force depuis le 17/06.',
  ),
  bloc('heading_2', '② Cadre français — FORT'),
  bloc(
    'paragraph',
    'PINM (loi n° 2026-403, art. 35). Rien à signaler. Aucun décret de qualification d’un datacenter n’a été publié. Rovaltain. Rien à signaler non plus.',
  ),
  bloc('heading_2', '④ Datacenters, énergie, raccordement — MOYEN',),
  bloc(
    'paragraph',
    'Un site fast-track obtient 240 MW en dix-huit mois quand l’extension de Telehouse Magny attend 2032.',
  ),

  bloc('heading_1', 'Analyse'),
  bloc(
    'paragraph',
    'La semaine oppose deux façons de définir qui est souverain. Le 1er septembre, l’ANSSI l’a dit par la qualification.',
  ),

  bloc('heading_1', 'Ajustements du cadrage de cette veille'),
  bloc(
    'bulleted_list_item',
    'Deux dates à corriger dans ce que nous suivons. La proposition européenne sur les réseaux (Digital Networks Act) date du 21 janvier 2026, et non de mars.',
  ),
  bloc(
    'bulleted_list_item',
    'Suivre à part les qualifications de cloud en cours. Douze candidats restent en lice après OVHcloud et Numspot.',
  ),
  bloc(
    'paragraph',
    'Ces ajustements ne seront appliqués qu’après votre accord. Pour demander vous-même une modification du cadrage, écrivez-nous.',
  ),

  // Le trait ferme le cadrage : ce qui suit est le pied de la lettre, et non
  // une suite de la discussion sur le cadrage.
  bloc('divider', ''),
  bloc(
    'paragraph',
    'Dossiers ouverts. Dix dossiers restent ouverts et leur compteur reste à zéro. La loi Résilience n’a pas avancé. Le CADA a désormais ses rapporteurs identifiés. Le règlement marchés publics a son jalon le 9/09. Le catalogue franco-allemand reste au même point. Aucun décret n’est paru sur le PINM. Rovaltain n’a fait l’objet d’aucun appel. Le raccordement de Telehouse Magny attend la règle RTE, attendue fin 2026. La date du DNA est corrigée au 21/01/2026. Le dossier du colloque Cnam reste ouvert.',
  ),
]
