import {
  écourter,
  type Bloc,
  type Document,
  type Extrait,
  type Segment,
} from '@/lib/domaine/document'
import type { DossierOuvert } from '@/lib/domaine/dossiers'
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
  /** L'axe ou la rubrique d'où viennent les passages ; vide pour un chapeau. */
  readonly titre: string
  readonly numéro: number | null
  /** Le niveau d'impact, quand la source est un axe. */
  readonly niveau: NiveauImpact | null
  /** Les passages qui nomment l'acteur, dans l'ordre de la note. */
  readonly passages: readonly Extrait[]
}

function sansAccent(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Le motif d'un nom, bornes de mot comprises et petits mots de liaison tolérés.
 *
 * Un nom de dossier est souvent un syntagme que la prose reprend avec ses
 * articles : le dossier dit « raccordement Telehouse Magny », la lettre écrit
 * « le raccordement **de** Telehouse Magny ». Les mots du nom doivent donc se
 * suivre dans l'ordre, mais on tolère entre eux jusqu'à deux mots d'au plus
 * quatre lettres — de, du, des, la, les, sur, pour. Au-delà, ce ne serait plus
 * le même syntagme mais deux idées voisines, et on préfère ne rien citer.
 *
 * Les accents sont retirés des deux côtés, et le découpage ne garde que des
 * caractères alphanumériques : aucun métacaractère ne peut donc survivre
 * jusqu'au motif.
 */
function motifDe(nom: string): RegExp | null {
  const mots = sansAccent(nom).split(/[^a-z0-9]+/).filter((mot) => mot.length > 0)
  if (mots.length === 0) return null

  const liaison = '(?:[^a-z0-9]+[a-z0-9]{1,4}){0,2}[^a-z0-9]+'
  return new RegExp(`(?<![a-z0-9])${mots.join(liaison)}(?![a-z0-9])`)
}

/** Un séparateur de cellules, sans mise en forme propre. */
const ENTRE_CELLULES: Segment = {
  texte: ' · ',
  gras: false,
  italique: false,
  code: false,
  barré: false,
  lien: null,
}

function enExtrait(segments: readonly Segment[]): Extrait {
  return { texte: segments.map((segment) => segment.texte).join('').trim(), segments }
}

/**
 * Les passages suivis d'un bloc, ceux où un nom peut se trouver.
 *
 * Chaque passage garde ses **segments** en plus de son texte. La recherche
 * travaille sur le texte, l'affichage sur les segments : un gras, un lien ou un
 * italique de la note survit donc jusqu'à la page de l'acteur, au lieu d'y
 * arriver à plat.
 */
function passagesDuBloc(bloc: Bloc): Extrait[] {
  switch (bloc.type) {
    case 'paragraphe':
    case 'citation':
    case 'encadré':
    case 'titre':
      return [enExtrait(bloc.segments)]

    case 'liste':
      return bloc.éléments.map(enExtrait)

    case 'tableau':
      return bloc.lignes.map((ligne) =>
        enExtrait(
          ligne.flatMap((cellule, index) => (index === 0 ? cellule : [ENTRE_CELLULES, ...cellule])),
        ),
      )

    // Ni le code, ni les séparateurs, ni les images : un nom qui s'y trouverait
    // ne serait pas une mention à citer.
    default:
      return []
  }
}

/**
 * Les passages d'une lettre qui nomment l'acteur, avec leur provenance.
 *
 * **Toute la note est parcourue, pas seulement les axes.** Une lettre porte son
 * essentiel, son analyse, son agenda et son récapitulatif de dossiers hors de
 * toute section thématique : ne chercher que dans les axes revenait à ignorer
 * une bonne moitié du texte, et précisément les endroits où un dossier est
 * nommé en clair.
 */
export function mentionsDe(nom: string, document: Document): Mention[] {
  const motif = motifDe(nom)
  if (!motif) return []

  const trouver = (blocs: readonly Bloc[]): Extrait[] =>
    blocs
      .flatMap(passagesDuBloc)
      .filter(({ texte }) => texte.length > 0 && motif.test(sansAccent(texte)))

  const mentions: Mention[] = []

  const chapeau = trouver(document.préambule)
  if (chapeau.length > 0) {
    mentions.push({ titre: '', numéro: null, niveau: null, passages: chapeau })
  }

  for (const rubrique of document.rubriques) {
    const introduction = trouver(rubrique.introduction)
    if (introduction.length > 0) {
      mentions.push({
        titre: rubrique.titre,
        numéro: null,
        niveau: null,
        passages: introduction,
      })
    }

    for (const axe of rubrique.axes) {
      const passages = trouver(axe.blocs)
      if (passages.length > 0) {
        mentions.push({
          titre: axe.titre,
          numéro: axe.numéro,
          niveau: axe.niveau,
          passages,
        })
      }
    }
  }

  return mentions
}

/**
 * Un acteur retenu pour l'accueil, avec de quoi remplir sa case.
 *
 * `extrait` est la première phrase d'une lettre qui le nomme. Il existe parce
 * que la moitié des dossiers d'une lettre réelle n'ont pas de précision — leur
 * case ne portait alors qu'un nom et un état, et n'apprenait rien.
 */
export type ActeurEnVue = DossierOuvert & { readonly extrait: string | null }

/**
 * Les acteurs dont les dernières lettres ont quelque chose à dire.
 *
 * Un dossier peut rester ouvert des semaines sans que rien ne bouge ; sur
 * l'accueil, il occupe une case pour ne rien apprendre. On ne le supprime pas
 * pour autant : le suivi complet reste sur l'écran Acteurs, et c'est là qu'un
 * dossier qui s'enlise doit se voir.
 *
 * **Deux portes, et il en faut deux.** Une lettre le nomme, ou son compteur est
 * retombé à zéro. La seconde n'est pas une commodité : une lettre peut suivre
 * « SecNumCloud 3.2 » dans ses dossiers, écrire « SecNumCloud » d'un côté et
 * « référentiel 3.2 » de l'autre, et n'être rapprochée par aucune recherche
 * honnête. Le compteur, lui, est tenu par la veille : à zéro, il y a du
 * mouvement, quels que soient les mots employés.
 */
export function acteursEnVue(
  acteurs: readonly DossierOuvert[],
  documents: readonly Document[],
  longueur = 130,
): ActeurEnVue[] {
  return acteurs.flatMap((acteur) => {
    const passage = documents
      .flatMap((document) => mentionsDe(acteur.nom, document))
      .flatMap((mention) => mention.passages)
      .at(0)

    if (!passage && acteur.compteur !== 0) return []
    return [{ ...acteur, extrait: passage ? écourter(passage.texte, longueur) : null }]
  })
}
