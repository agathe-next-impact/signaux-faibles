import { lireTitreDAxe, rangDImpact, type NiveauImpact } from '@/lib/domaine/impact'

/**
 * La note est rendue comme un document.
 *
 * Décision du 9 septembre 2026 : il n'y a pas de base « Items ». Le corps de la
 * page Notion *est* la note. Ce module le transforme en un arbre de rendu :
 * les H1 ouvrent des rubriques, les H2 des axes repliables dont le badge
 * d'impact est lu dans le suffixe, le reste s'empile.
 *
 * « Axe » désigne ici une section thématique du corps de la note. La propriété
 * Notion `Famille` est tout autre chose — une clé de gestion interne — et
 * n'entre jamais dans cet arbre.
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

export type Axe = {
  readonly titre: string
  /** Le rang dans le référentiel, détaché du titre pour être composé en indice. */
  readonly numéro: number | null
  readonly niveau: NiveauImpact | null
  readonly blocs: readonly Bloc[]
}

export type Rubrique = {
  readonly titre: string
  /** Ce qui précède le premier axe de la rubrique. */
  readonly introduction: readonly Bloc[]
  readonly axes: readonly Axe[]
}

export type Document = {
  /** Ce qui précède la première rubrique : chapeau, note de méthode. */
  readonly préambule: readonly Bloc[]
  readonly rubriques: readonly Rubrique[]
  /**
   * Les ajustements de cadrage, retirés de la lecture.
   *
   * Ce sont des propositions de modification du périmètre de la veille, à
   * valider par le client. Elles ne relèvent pas de la lettre de la semaine et
   * ont leur écran ; les laisser dans le corps les mêlerait aux faits.
   */
  readonly cadrage: readonly Bloc[]
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
 * c'est l'écran qui décide de trier les axes ou non.
 */
export function construireDocument(blocs: readonly BlocNotion[]): Document {
  const préambule = new Pile()
  const rubriques: Rubrique[] = []

  let rubriqueCourante: {
    titre: string
    introduction: Pile
    axes: Array<{
      titre: string
      numéro: number | null
      niveau: NiveauImpact | null
      blocs: Pile
    }>
  } | null = null

  const clore = (): void => {
    if (!rubriqueCourante) return
    rubriques.push({
      titre: rubriqueCourante.titre,
      introduction: rubriqueCourante.introduction.vider(),
      axes: rubriqueCourante.axes.map((axe) => ({
        titre: axe.titre,
        numéro: axe.numéro,
        niveau: axe.niveau,
        blocs: axe.blocs.vider(),
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
        axes: [],
      }
      continue
    }

    if (bloc.type === 'heading_2') {
      const brut = texteDeSegments(lireSegments(contenu(bloc)['rich_text']))
      const { axe, numéro, niveau } = lireTitreDAxe(brut)

      // Un H2 avant tout H1 : on ouvre une rubrique sans titre plutôt que de
      // laisser l'axe orphelin.
      rubriqueCourante ??= { titre: '', introduction: new Pile(), axes: [] }
      rubriqueCourante.axes.push({ titre: axe, numéro, niveau, blocs: new Pile() })
      continue
    }

    if (!rubriqueCourante) {
      préambule.ajouter(bloc)
      continue
    }

    const axeCourant = rubriqueCourante.axes.at(-1)
    if (axeCourant) axeCourant.blocs.ajouter(bloc)
    else rubriqueCourante.introduction.ajouter(bloc)
  }

  clore()

  return { préambule: préambule.vider(), ...détacherLeCadrage(rubriques) }
}

/**
 * Reconnaît la rubrique d'ajustements du cadrage à son titre.
 *
 * C'est le seul signal disponible : le cadrage vit dans le corps de la note, et
 * aucune propriété Notion ne le marque. La reconnaissance est donc une
 * convention avec les tâches Cowork, tenue lâche — accents et casse ignorés,
 * le mot « cadrage » suffit. Si le titre était reformulé au point de ne plus le
 * contenir, la section **réapparaîtrait dans la lettre** : une panne visible,
 * pas une disparition silencieuse.
 */
function estRubriqueDeCadrage(titre: string): boolean {
  return titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('cadrage')
}

/**
 * Sort les ajustements de cadrage des rubriques de lecture.
 *
 * **Le trait horizontal ferme la section.** Dans les lettres, la rubrique de
 * cadrage est suivie d'un `---` puis du pied de la lettre — dossiers ouverts,
 * sources vérifiées, prochaine parution. Retirer la rubrique entière
 * emporterait ce pied, qui est du contenu de veille et nomme la plupart des
 * dossiers suivis. Seul ce qui précède le trait est donc du cadrage ; ce qui
 * suit revient à la lettre, dans une rubrique sans titre.
 *
 * Une rubrique de cadrage n'est pas censée porter de H2. Si elle en portait,
 * ses axes resteraient dans la lettre — un titre apparaîtrait, ce qui se voit.
 */
function détacherLeCadrage(rubriques: readonly Rubrique[]): {
  rubriques: Rubrique[]
  cadrage: Bloc[]
} {
  const cadrage: Bloc[] = []
  const gardées: Rubrique[] = []

  for (const rubrique of rubriques) {
    if (!estRubriqueDeCadrage(rubrique.titre)) {
      gardées.push(rubrique)
      continue
    }

    const trait = rubrique.introduction.findIndex((bloc) => bloc.type === 'séparateur')
    const avant = trait === -1 ? rubrique.introduction : rubrique.introduction.slice(0, trait)
    const après = trait === -1 ? [] : rubrique.introduction.slice(trait + 1)

    cadrage.push(...avant)

    if (après.length > 0 || rubrique.axes.length > 0) {
      gardées.push({ titre: '', introduction: après, axes: rubrique.axes })
    }
  }

  return { rubriques: gardées, cadrage }
}

/** Tous les axes du document, à plat, pour un tri global par impact. */
export function axesDuDocument(document: Document): Axe[] {
  return document.rubriques.flatMap((rubrique) => rubrique.axes)
}

/**
 * Les éléments importants d'un axe, pour une case de grille.
 *
 * Les puces de la note passent d'abord : quand l'auteur en a écrit, ce sont
 * elles les éléments importants, et les reformuler n'apporterait rien. Sans
 * puces, on retombe sur les paragraphes, une phrase chacun.
 *
 * Le texte est coupé au mot, jamais au milieu d'un : une case n'a pas la place
 * d'un paragraphe, et la page de l'axe porte le texte entier.
 */
/**
 * Un extrait de note : son texte nu, et les segments qui le composent.
 *
 * Les deux sont nécessaires et ne font pas double emploi. Le **texte** sert à
 * chercher, dédoublonner et comparer — c'est lui que les tests mesurent. Les
 * **segments** servent à afficher : sans eux, un gras, un lien ou un italique
 * de la note se perdaient dès qu'un extrait quittait la page de la lettre, et
 * les cases d'axes comme les mentions d'acteurs rendaient un texte plat là où
 * Notion montre un document.
 */
export type Extrait = {
  readonly texte: string
  readonly segments: readonly Segment[]
}

/**
 * Écourte une suite de segments sans perdre leur mise en forme.
 *
 * `écourter` ne sait travailler que sur une chaîne : appliquée à des segments,
 * elle les aurait aplatis, ce qui était exactement le défaut à corriger. On
 * coupe donc **dans** le segment qui dépasse, au mot, et on jette la suite.
 */
export function écourterSegments(
  segments: readonly Segment[],
  longueur: number,
): Segment[] {
  const entier = texteDeSegments(segments)
  if (entier.length <= longueur) return [...segments]

  const gardés: Segment[] = []
  let reste = longueur

  for (const segment of segments) {
    if (reste <= 0) break

    if (segment.texte.length <= reste) {
      gardés.push(segment)
      reste -= segment.texte.length
      continue
    }

    // Le segment déborde : on le coupe au mot, et l'ellipse reste dans sa
    // propre mise en forme — elle appartient à la phrase, pas au composant.
    gardés.push({ ...segment, texte: écourter(segment.texte, reste) })
    reste = 0
  }

  return gardés
}

/**
 * Garde les `combien` premiers caractères d'une suite de segments, exactement.
 *
 * Distinct d'`écourterSegments` : ici on coupe à un offset connu — la fin de la
 * première phrase — sans chercher de mot entier et sans ajouter d'ellipse. Une
 * phrase complète ne doit pas se terminer par « … ».
 */
function couperSegments(segments: readonly Segment[], combien: number): Segment[] {
  const gardés: Segment[] = []
  let reste = combien

  for (const segment of segments) {
    if (reste <= 0) break
    if (segment.texte.length <= reste) {
      gardés.push(segment)
      reste -= segment.texte.length
      continue
    }
    gardés.push({ ...segment, texte: segment.texte.slice(0, reste) })
    reste = 0
  }

  return gardés
}

function extraitDe(segments: readonly Segment[], longueur: number): Extrait | null {
  const texte = texteDeSegments(segments).trim()
  if (texte.length === 0) return null
  return { texte: écourter(texte, longueur), segments: écourterSegments(segments, longueur) }
}

export function pointsDAxe(axe: Axe, combien = 3, longueur = 110): Extrait[] {
  const puces: Extrait[] = []
  const phrases: Extrait[] = []

  for (const bloc of axe.blocs) {
    if (bloc.type === 'liste') {
      for (const élément of bloc.éléments) {
        const extrait = extraitDe(élément, longueur)
        if (extrait) puces.push(extrait)
      }
      continue
    }

    if (bloc.type === 'paragraphe' || bloc.type === 'citation') {
      // La première phrase seulement. Le découpage se fait sur le texte — c'est
      // là que vit la ponctuation —, puis se reporte sur les segments par le
      // même offset. Deux coupes, donc, et deux fonctions : `couperSegments`
      // s'arrête net à la fin de la phrase, `écourterSegments` plafonne la
      // longueur au mot et pose l'ellipse.
      const entier = texteDeSegments(bloc.segments)
      if (entier.trim().length === 0) continue
      const début = premièrePhrase(entier.trimStart())
      const décalage = entier.length - entier.trimStart().length
      const segments = couperSegments(bloc.segments, décalage + début.length)

      phrases.push({
        texte: écourter(début.trim(), longueur),
        segments: écourterSegments(segments, décalage + longueur),
      })
    }
  }

  return (puces.length > 0 ? puces : phrases).slice(0, combien)
}

/** La première phrase d'un texte, ou le texte entier s'il n'en porte qu'une. */
function premièrePhrase(texte: string): string {
  const fin = /[.!?…]\s/.exec(texte)
  return fin ? texte.slice(0, fin.index + 1) : texte
}

/** Coupe au dernier mot entier, et ne coupe pas si ce n'est pas nécessaire. */
export function écourter(texte: string, longueur: number): string {
  if (texte.length <= longueur) return texte
  const tronqué = texte.slice(0, longueur)
  const dernierEspace = tronqué.lastIndexOf(' ')
  return `${(dernierEspace > longueur / 2 ? tronqué.slice(0, dernierEspace) : tronqué).trimEnd()}…`
}

/** Un axe tel que les lettres de la semaine le donnent, une fois réunies. */
export type AxeFusionné = {
  readonly titre: string
  readonly numéro: number | null
  readonly niveau: NiveauImpact | null
  readonly points: readonly Extrait[]
}

/**
 * Réunit les axes de plusieurs lettres en une seule liste.
 *
 * Une semaine porte deux lettres, une par famille de veille. Elles ouvrent des
 * axes distincts la plupart du temps ; quand elles ouvrent le même, il ne doit
 * en rester qu'un — deux cases au même nom se liraient comme un défaut. On garde
 * alors le **niveau le plus fort** des deux, jamais le dernier rencontré, et on
 * réunit leurs éléments importants.
 *
 * L'ordre de sortie est celui des notes ; c'est à l'écran de trier par impact,
 * comme partout ailleurs.
 */
function dédoublonner(extraits: readonly Extrait[]): Extrait[] {
  const vus = new Map<string, Extrait>()
  for (const extrait of extraits) {
    if (!vus.has(extrait.texte)) vus.set(extrait.texte, extrait)
  }
  return [...vus.values()]
}

export function fusionnerLesAxes(
  documents: readonly Document[],
  combien = 3,
): AxeFusionné[] {
  const parTitre = new Map<string, AxeFusionné>()

  for (const document of documents) {
    for (const axe of axesDuDocument(document)) {
      const points = pointsDAxe(axe, combien)
      const connu = parTitre.get(axe.titre)

      if (!connu) {
        parTitre.set(axe.titre, {
          titre: axe.titre,
          numéro: axe.numéro,
          niveau: axe.niveau,
          points,
        })
        continue
      }

      parTitre.set(axe.titre, {
        titre: axe.titre,
        numéro: connu.numéro ?? axe.numéro,
        niveau: rangDImpact(axe.niveau) < rangDImpact(connu.niveau) ? axe.niveau : connu.niveau,
        // Les deux lettres peuvent avoir relevé le même fait : une seule puce.
        // Le dédoublonnage porte sur le TEXTE, pas sur l'objet : deux extraits
        // identiques venus de deux lettres n'ont pas la même identité.
        points: dédoublonner([...connu.points, ...points]).slice(0, combien),
      })
    }
  }

  return [...parTitre.values()]
}
