import { écourterSegments, type Bloc, type Document } from '@/lib/domaine/document'
import { ESSENTIEL_CARACTÈRES_MAX, ESSENTIEL_LIGNES_MAX, estTitreDeLEssentiel } from '@/lib/domaine/texte'

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
 * Ne passe **que ce que le validateur mesure** : les paragraphes et les puces de
 * l'introduction de la rubrique, huit lignes au plus. Tout autre bloc (tableau,
 * encadré, citation, titre de niveau 3, image) échappe au contrôle des huit
 * lignes et n'est donc pas repris ; un axe placé sous « L'essentiel » non plus.
 * Chaque ligne est aussi écourtée à 140 caractères, la borne du validateur.
 * Le plafond tient même si le titre de niveau 1 suivant manquait : le corps
 * entier tomberait alors dans l'introduction, et seules ses huit premières
 * lignes sortiraient.
 */
export function tronquerÀLEssentiel(document: Document): Document {
  const essentiel = document.rubriques.find((r) => estTitreDeLEssentiel(r.titre))
  return {
    préambule: [],
    rubriques: essentiel ? [{ titre: essentiel.titre, introduction: lignesBornées(essentiel.introduction), axes: [] }] : [],
    cadrage: [],
    acteursSuivis: [],
  }
}

function lignesBornées(blocs: readonly Bloc[]): Bloc[] {
  const gardés: Bloc[] = []
  let restantes = ESSENTIEL_LIGNES_MAX
  for (const bloc of blocs) {
    if (restantes <= 0) break
    if (bloc.type === 'paragraphe') {
      if (bloc.segments.map((s) => s.texte).join('').trim().length === 0) continue
      gardés.push({ ...bloc, segments: écourterSegments(bloc.segments, ESSENTIEL_CARACTÈRES_MAX) })
      restantes -= 1
    } else if (bloc.type === 'liste') {
      const éléments = bloc.éléments
        .filter((é) => é.map((s) => s.texte).join('').trim().length > 0)
        .slice(0, restantes)
        .map((é) => écourterSegments(é, ESSENTIEL_CARACTÈRES_MAX))
      if (éléments.length === 0) continue
      gardés.push({ ...bloc, éléments })
      restantes -= éléments.length
    }
  }
  return gardés
}
