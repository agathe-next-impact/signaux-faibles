import type { Document } from '@/lib/domaine/document'
import { estTitreDeLEssentiel } from '@/lib/domaine/texte'

/**
 * La lettre tronquée de la fin d'essai : « L'essentiel », et rien d'autre.
 *
 * L'offre (17 octobre 2026) prévoit qu'à J+21, sans abonnement, chaque lettre
 * ne montre que sa rubrique « L'essentiel ». Cette rubrique existe déjà dans
 * toutes les lettres, bornée par le contrat de forme (huit lignes de
 * 140 caractères) et contrôlée par le validateur : la troncature ne demande
 * aucune écriture nouvelle aux tâches.
 *
 * **La troncature se fait sur le document, avant le rendu**, et non en masquant
 * des sections à l'affichage. Masquer laisserait le reste de la lettre dans le
 * HTML ou dans les props sérialisées envoyées au navigateur, d'où un prospect
 * le lirait sans payer. C'est la même règle que pour le cadrage : ce qui ne
 * doit pas être lu est retiré à la construction.
 *
 * Seule l'**introduction** de la rubrique est gardée, c'est-à-dire ce que le
 * validateur compte comme ses lignes. Un éventuel axe placé sous « L'essentiel »
 * ne passe pas : ce serait une porte vers le détail que l'essai réserve aux
 * abonnés.
 */
export function tronquerÀLEssentiel(document: Document): Document {
  const essentiel = document.rubriques.find((r) => estTitreDeLEssentiel(r.titre))
  return {
    préambule: [],
    rubriques: essentiel ? [{ titre: essentiel.titre, introduction: essentiel.introduction, axes: [] }] : [],
    cadrage: [],
    acteursSuivis: [],
  }
}
