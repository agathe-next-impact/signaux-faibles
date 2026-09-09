import { lireTitreDeFamille, type NiveauImpact } from '@/lib/domaine/impact'

/**
 * La note est rendue comme un document.
 *
 * Décision du 9 septembre 2026 : il n'y a pas de base « Items ». Le corps de la
 * page Notion *est* la note. Ce module le transforme en un arbre de rendu :
 * les H1 ouvrent des rubriques, les H2 des familles repliables dont le badge
 * d'impact est lu dans le suffixe, le reste s'empile.
 *
 * Aucune URL de fichier Notion ne survit à cette transformation : les URL
 * signées expirent en une heure, seul l'identifiant du bloc est conservé et le
 * rendu passe par la route proxy des médias (règle 5).
 */

export type Segment = {
  readonly texte: string
  readonly gras: boolean
  readonly italique: boolean
  readonly code: boolean
  readonly barré: boolean
  readonly lien: string | null
}

export type Bloc =
  | { readonly type: 'paragraphe'; readonly segments: readonly Segment[] }
  | { readonly type: 'titre'; readonly niveau: 3; readonly segments: readonly Segment[] }
  | {
      readonly type: 'liste'
      readonly ordonnée: boolean
      readonly éléments: readonly (readonly Segment[])[]
    }
  | { readonly type: 'citation'; readonly segments: readonly Segment[] }
  | { readonly type: 'encadré'; readonly segments: readonly Segment[] }
  | { readonly type: 'code'; readonly langage: string; readonly texte: string }
  | {
      readonly type: 'tableau'
      readonly enTête: boolean
      readonly lignes: readonly (readonly (readonly Segment[])[])[]
    }
  | { readonly type: 'séparateur' }
  | { readonly type: 'image'; readonly blocId: string; readonly légende: string }

export type Famille = {
  readonly titre: string
  readonly niveau: NiveauImpact | null
  readonly blocs: readonly Bloc[]
}

export type Rubrique = {
  readonly titre: string
  /** Ce qui précède la première famille de la rubrique. */
  readonly introduction: readonly Bloc[]
  readonly familles: readonly Famille[]
}

export type Document = {
  /** Ce qui précède la première rubrique : chapeau, note de méthode. */
  readonly préambule: readonly Bloc[]
  readonly rubriques: readonly Rubrique[]
}

/** Forme minimale d'un bloc Notion, enfants éventuellement rattachés. */
export type BlocNotion = {
  readonly id: string
  readonly type: string
  readonly has_children?: boolean
  readonly enfants?: readonly BlocNotion[]
  readonly [clé: string]: unknown
}

type RichTextNotion = {
  plain_text?: string
  href?: string | null
  annotations?: {
    bold?: boolean
    italic?: boolean
    code?: boolean
    strikethrough?: boolean
  }
}

function lireSegments(valeur: unknown): Segment[] {
  if (!Array.isArray(valeur)) return []

  return (valeur as RichTextNotion[])
    .map((morceau) => ({
      texte: morceau.plain_text ?? '',
      gras: morceau.annotations?.bold ?? false,
      italique: morceau.annotations?.italic ?? false,
      code: morceau.annotations?.code ?? false,
      barré: morceau.annotations?.strikethrough ?? false,
      lien: morceau.href ?? null,
    }))
    .filter((segment) => segment.texte.length > 0)
}

function contenu(bloc: BlocNotion): Record<string, unknown> {
  const valeur = bloc[bloc.type]
  return typeof valeur === 'object' && valeur !== null
    ? (valeur as Record<string, unknown>)
    : {}
}

function texteDeSegments(segments: readonly Segment[]): string {
  return segments.map((segment) => segment.texte).join('')
}

/** Convertit un bloc Notion en bloc de rendu, ou `null` s'il n'a rien à dire. */
function convertir(bloc: BlocNotion): Bloc | null {
  const corps = contenu(bloc)
  const segments = lireSegments(corps['rich_text'])

  switch (bloc.type) {
    case 'paragraph':
      return segments.length > 0 ? { type: 'paragraphe', segments } : null

    // Les H1 et H2 sont consommés par la structure, pas rendus comme blocs.
    case 'heading_3':
      return segments.length > 0 ? { type: 'titre', niveau: 3, segments } : null

    case 'quote':
      return segments.length > 0 ? { type: 'citation', segments } : null

    case 'callout':
      return segments.length > 0 ? { type: 'encadré', segments } : null

    case 'code':
      return {
        type: 'code',
        langage: typeof corps['language'] === 'string' ? corps['language'] : 'text',
        texte: texteDeSegments(segments),
      }

    case 'divider':
      return { type: 'séparateur' }

    case 'image':
      // Ni l'URL signée ni l'URL externe ne sont conservées : le rendu passe
      // par /api/media/[block_id], qui les résout à la demande.
      return {
        type: 'image',
        blocId: bloc.id,
        légende: texteDeSegments(lireSegments(corps['caption'])),
      }

    case 'table': {
      const lignes = (bloc.enfants ?? [])
        .filter((enfant) => enfant.type === 'table_row')
        .map((ligne) => {
          const cellules = contenu(ligne)['cells']
          return Array.isArray(cellules) ? cellules.map(lireSegments) : []
        })
      return lignes.length > 0
        ? { type: 'tableau', enTête: corps['has_column_header'] === true, lignes }
        : null
    }

    // Types sans équivalent dans la note : ignorés plutôt que rendus de travers.
    default:
      return null
  }
}

/** Empile les blocs en fusionnant les puces consécutives en une seule liste. */
class Pile {
  private readonly blocs: Bloc[] = []

  ajouter(bloc: BlocNotion): void {
    const ordonnée = bloc.type === 'numbered_list_item'

    if (ordonnée || bloc.type === 'bulleted_list_item') {
      const éléments = lireSegments(contenu(bloc)['rich_text'])
      if (éléments.length === 0) return

      const dernier = this.blocs.at(-1)
      if (dernier?.type === 'liste' && dernier.ordonnée === ordonnée) {
        // `éléments` est déclaré en lecture seule vers l'extérieur ; la mutation
        // reste interne à la construction de l'arbre.
        ;(dernier.éléments as (readonly Segment[])[]).push(éléments)
        return
      }

      this.blocs.push({ type: 'liste', ordonnée, éléments: [éléments] })
      return
    }

    const converti = convertir(bloc)
    if (converti) this.blocs.push(converti)
  }

  vider(): Bloc[] {
    return this.blocs
  }
}

/**
 * Construit le document à partir des blocs de premier niveau d'une page.
 *
 * Le tri par impact ne se fait pas ici : l'arbre garde l'ordre de la note, et
 * c'est l'écran qui décide de trier les familles ou non.
 */
export function construireDocument(blocs: readonly BlocNotion[]): Document {
  const préambule = new Pile()
  const rubriques: Rubrique[] = []

  let rubriqueCourante: {
    titre: string
    introduction: Pile
    familles: Array<{ titre: string; niveau: NiveauImpact | null; blocs: Pile }>
  } | null = null

  const clore = (): void => {
    if (!rubriqueCourante) return
    rubriques.push({
      titre: rubriqueCourante.titre,
      introduction: rubriqueCourante.introduction.vider(),
      familles: rubriqueCourante.familles.map((famille) => ({
        titre: famille.titre,
        niveau: famille.niveau,
        blocs: famille.blocs.vider(),
      })),
    })
    rubriqueCourante = null
  }

  for (const bloc of blocs) {
    if (bloc.type === 'heading_1') {
      clore()
      rubriqueCourante = {
        titre: texteDeSegments(lireSegments(contenu(bloc)['rich_text'])),
        introduction: new Pile(),
        familles: [],
      }
      continue
    }

    if (bloc.type === 'heading_2') {
      const brut = texteDeSegments(lireSegments(contenu(bloc)['rich_text']))
      const { famille, niveau } = lireTitreDeFamille(brut)

      // Un H2 avant tout H1 : on ouvre une rubrique sans titre plutôt que de
      // laisser la famille orpheline.
      rubriqueCourante ??= { titre: '', introduction: new Pile(), familles: [] }
      rubriqueCourante.familles.push({ titre: famille, niveau, blocs: new Pile() })
      continue
    }

    if (!rubriqueCourante) {
      préambule.ajouter(bloc)
      continue
    }

    const familleCourante = rubriqueCourante.familles.at(-1)
    if (familleCourante) familleCourante.blocs.ajouter(bloc)
    else rubriqueCourante.introduction.ajouter(bloc)
  }

  clore()

  return { préambule: préambule.vider(), rubriques }
}

/** Toutes les familles du document, à plat, pour un tri global par impact. */
export function famillesDuDocument(document: Document): Famille[] {
  return document.rubriques.flatMap((rubrique) => rubrique.familles)
}
