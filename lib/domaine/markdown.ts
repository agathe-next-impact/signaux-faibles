/**
 * Markdown vers blocs Notion.
 *
 * Le moteur qui rédige une lettre produit du Markdown, comme les tâches qui
 * écrivent aujourd'hui les pages Notion. Le portail, lui, ne lit que des blocs
 * (`BlocNotion`, `construireDocument`). Ce module fait le pont : il rend des
 * blocs de la forme minimale que le parseur attend, pour que le validateur
 * (`contrôlerLaLettre`) et le gabarit courriel (`composerLettre`) s'appliquent
 * à une lettre qui n'a jamais été dans Notion.
 *
 * Dialecte reconnu, volontairement étroit, celui des lettres :
 *   `# `, `## `, `### `       titres de niveau 1 à 3
 *   `---`                     trait horizontal
 *   `- `, `* `, `1. `         puces et listes numérotées
 *   `> `                      ENCADRÉ (callout Notion), jamais une citation :
 *                             la lettre n'a pas de citations, et le contrat de
 *                             forme veut la méthode et l'absence en encadré
 *   `<callout>…</callout>`    encadré aussi, forme du Markdown Notion
 *   `| a | b |`               tableaux, ligne `| --- |` pour l'en-tête
 *   `**gras**`, `*italique*`, `_italique_`, `` `code` ``, `[texte](url)`,
 *   `<b>`, `<i>`              mise en forme en ligne
 * Tout ce qui n'est pas reconnu est un paragraphe.
 */
import type { BlocNotion } from '@/lib/domaine/document'

type RichText = {
  readonly plain_text: string
  readonly href: string | null
  readonly annotations: {
    readonly bold: boolean
    readonly italic: boolean
    readonly code: boolean
    readonly strikethrough: boolean
  }
}

type Style = { gras: boolean; italique: boolean; code: boolean; lien: string | null }

function morceau(texte: string, style: Style): RichText {
  return {
    plain_text: texte,
    href: style.lien,
    annotations: { bold: style.gras, italic: style.italique, code: style.code, strikethrough: false },
  }
}

/** Découpe une ligne en segments Notion : gras, italique, code, liens, balises `<b>` et `<i>`. */
export function segmentsDeLigne(ligne: string): RichText[] {
  const sortie: RichText[] = []
  const style: Style = { gras: false, italique: false, code: false, lien: null }
  let tampon = ''

  const vider = () => {
    if (tampon.length > 0) sortie.push(morceau(tampon, { ...style }))
    tampon = ''
  }

  let i = 0
  while (i < ligne.length) {
    const reste = ligne.slice(i)

    // Code en ligne : rien n'y est interprété.
    if (reste.startsWith('`')) {
      const fin = ligne.indexOf('`', i + 1)
      if (fin > i) {
        vider()
        sortie.push(morceau(ligne.slice(i + 1, fin), { ...style, code: true }))
        i = fin + 1
        continue
      }
    }

    // Lien `[texte](url)` : le texte garde la mise en forme courante.
    if (reste.startsWith('[')) {
      const lien = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(reste)
      if (lien && lien[1] !== undefined && lien[2] !== undefined) {
        vider()
        for (const segment of segmentsDeLigne(lien[1])) {
          sortie.push({
            ...segment,
            href: lien[2],
            annotations: {
              ...segment.annotations,
              bold: segment.annotations.bold || style.gras,
              italic: segment.annotations.italic || style.italique,
            },
          })
        }
        i += lien[0].length
        continue
      }
    }

    const bascule = (longueur: number, clé: 'gras' | 'italique') => {
      vider()
      style[clé] = !style[clé]
      i += longueur
    }

    if (reste.startsWith('**')) { bascule(2, 'gras'); continue }
    if (reste.startsWith('<b>') || reste.startsWith('</b>')) { bascule(reste.startsWith('<b>') ? 3 : 4, 'gras'); continue }
    if (reste.startsWith('<i>') || reste.startsWith('</i>')) { bascule(reste.startsWith('<i>') ? 3 : 4, 'italique'); continue }
    if ((reste.startsWith('*') || reste.startsWith('_')) && estUneMarqueDItalique(ligne, i)) {
      bascule(1, 'italique')
      continue
    }

    tampon += ligne[i]
    i += 1
  }
  vider()
  return sortie.filter((segment) => segment.plain_text.length > 0)
}

/**
 * Une étoile ou un tiret bas n'ouvre l'italique que s'il colle à un mot : « 5 * 3 »
 * et « snake_case » restent du texte. En fermeture, il colle au mot qui précède.
 */
function estUneMarqueDItalique(ligne: string, position: number): boolean {
  const avant = ligne[position - 1] ?? ' '
  const après = ligne[position + 1] ?? ' '
  const marque = ligne[position]
  if (marque === '_' && /\w/.test(avant) && /\w/.test(après)) return false
  return /\S/.test(après) || /\S/.test(avant)
}

let compteur = 0
const identifiant = () => `md${(compteur += 1)}`

function bloc(type: string, texte: string, extra: Record<string, unknown> = {}): BlocNotion {
  return { id: identifiant(), type, [type]: { rich_text: segmentsDeLigne(texte), ...extra } }
}

function estSéparateurDeTableau(ligne: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(ligne)
}

function cellules(ligne: string): string[] {
  const nettoyée = ligne.trim().replace(/^\|/, '').replace(/\|$/, '')
  return nettoyée.split(/(?<!\\)\|/).map((cellule) => cellule.trim().replace(/\\\|/g, '|'))
}

/** Convertit un document Markdown en blocs de premier niveau, tableaux rattachés. */
export function markdownVersBlocs(markdown: string): BlocNotion[] {
  const lignes = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocs: BlocNotion[] = []
  let paragraphe: string[] = []
  let encadré: string[] | null = null

  const viderParagraphe = () => {
    if (paragraphe.length > 0) blocs.push(bloc('paragraph', paragraphe.join(' ')))
    paragraphe = []
  }
  const viderEncadré = () => {
    if (encadré && encadré.length > 0) blocs.push(bloc('callout', encadré.join(' ')))
    encadré = null
  }

  for (let i = 0; i < lignes.length; i += 1) {
    const brute = lignes[i] ?? ''
    const ligne = brute.trimEnd()
    const nue = ligne.trim()

    // Encadré en balises Notion, sur une ou plusieurs lignes.
    if (/^<callout>/i.test(nue)) {
      viderParagraphe()
      encadré = []
      let contenu = nue.replace(/^<callout>/i, '')
      while (!/<\/callout>/i.test(contenu) && i + 1 < lignes.length) {
        encadré.push(contenu.trim())
        i += 1
        contenu = (lignes[i] ?? '').trim()
      }
      encadré.push(contenu.replace(/<\/callout>.*$/i, '').trim())
      encadré = encadré.filter((l) => l.length > 0)
      viderEncadré()
      continue
    }

    if (nue.length === 0) {
      viderParagraphe()
      viderEncadré()
      continue
    }

    if (/^>\s?/.test(nue)) {
      viderParagraphe()
      encadré = encadré ?? []
      const contenu = nue.replace(/^>\s?/, '')
      if (contenu.length === 0) viderEncadré()
      else encadré.push(contenu)
      continue
    }
    viderEncadré()

    const titre = /^(#{1,3})\s+(.*)$/.exec(nue)
    if (titre && titre[1] && titre[2] !== undefined) {
      viderParagraphe()
      blocs.push(bloc(`heading_${titre[1].length}`, titre[2].trim()))
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(nue)) {
      viderParagraphe()
      blocs.push({ id: identifiant(), type: 'divider', divider: {} })
      continue
    }

    const puce = /^[-*•]\s+(.*)$/.exec(nue)
    if (puce && puce[1] !== undefined) {
      viderParagraphe()
      blocs.push(bloc('bulleted_list_item', puce[1]))
      continue
    }

    const numérotée = /^\d+[.)]\s+(.*)$/.exec(nue)
    if (numérotée && numérotée[1] !== undefined) {
      viderParagraphe()
      blocs.push(bloc('numbered_list_item', numérotée[1]))
      continue
    }

    if (nue.startsWith('|') && nue.includes('|', 1)) {
      viderParagraphe()
      const lignesDuTableau: string[][] = []
      let enTête = false
      let j = i
      while (j < lignes.length) {
        const candidate = (lignes[j] ?? '').trim()
        if (!(candidate.startsWith('|') && candidate.includes('|', 1))) break
        if (estSéparateurDeTableau(candidate)) {
          if (lignesDuTableau.length === 1) enTête = true
        } else {
          lignesDuTableau.push(cellules(candidate))
        }
        j += 1
      }
      i = j - 1
      const largeur = Math.max(...lignesDuTableau.map((l) => l.length))
      blocs.push({
        id: identifiant(),
        type: 'table',
        has_children: true,
        table: { table_width: largeur, has_column_header: enTête, has_row_header: false },
        enfants: lignesDuTableau.map((ligneDuTableau) => ({
          id: identifiant(),
          type: 'table_row',
          table_row: { cells: ligneDuTableau.map((cellule) => segmentsDeLigne(cellule)) },
        })),
      })
      continue
    }

    paragraphe.push(nue)
  }

  viderParagraphe()
  viderEncadré()
  return blocs
}
