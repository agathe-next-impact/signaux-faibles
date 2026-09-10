import { axesDuDocument, type Bloc, type Document } from '@/lib/domaine/document'
import type { NiveauImpact } from '@/lib/domaine/impact'

/**
 * Ce que les lettres disent d'un acteur.
 *
 * Un dossier ouvert n'a pas de contenu propre dans Notion : c'est une entrée
 * texte, un nom et un compteur. Son contenu, ce sont les passages des notes qui
 * le nomment. On les retrouve donc en cherchant le nom dans le corps des
 * lettres, axe par axe.
 *
 * La recherche est **bornée aux mots** : « CADA » ne doit pas se déclencher sur
 * « cadastre ». Accents et casse sont ignorés, le reste ne l'est pas — on ne
 * rapproche pas deux noms voisins, on ne cite que ce qui nomme vraiment.
 */
export type Mention = {
  readonly axe: string
  readonly numéro: number | null
  readonly niveau: NiveauImpact | null
  /** Les passages qui nomment l'acteur, dans l'ordre de la note. */
  readonly passages: readonly string[]
}

function sansAccent(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Le motif d'un nom, bornes de mot comprises.
 *
 * Les accents étant retirés des deux côtés, les bornes peuvent se contenter de
 * l'alphabet latin sans diacritique.
 */
function motifDe(nom: string): RegExp {
  const échappé = sansAccent(nom).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9])${échappé}(?![a-z0-9])`)
}

/** Les textes suivis d'un bloc, ceux où un nom peut se trouver. */
function textesDuBloc(bloc: Bloc): string[] {
  switch (bloc.type) {
    case 'paragraphe':
    case 'citation':
    case 'encadré':
    case 'titre':
      return [bloc.segments.map((segment) => segment.texte).join('').trim()]

    case 'liste':
      return bloc.éléments.map((élément) =>
        élément.map((segment) => segment.texte).join('').trim(),
      )

    case 'tableau':
      return bloc.lignes.map((ligne) =>
        ligne
          .map((cellule) => cellule.map((segment) => segment.texte).join(''))
          .join(' · ')
          .trim(),
      )

    // Ni le code, ni les séparateurs, ni les images : un nom qui s'y trouverait
    // ne serait pas une mention à citer.
    default:
      return []
  }
}

/** Les axes d'une lettre qui nomment l'acteur, avec les passages qui le font. */
export function mentionsDe(nom: string, document: Document): Mention[] {
  if (nom.trim().length === 0) return []
  const motif = motifDe(nom)

  return axesDuDocument(document).flatMap((axe) => {
    const passages = axe.blocs
      .flatMap(textesDuBloc)
      .filter((texte) => texte.length > 0 && motif.test(sansAccent(texte)))

    return passages.length > 0
      ? [{ axe: axe.titre, numéro: axe.numéro, niveau: axe.niveau, passages }]
      : []
  })
}
