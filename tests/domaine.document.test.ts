import { describe, expect, it } from 'vitest'
import {
  construireDocument,
  axesDuDocument,
  type BlocNotion,
} from '@/lib/domaine/document'

const texte = (contenu: string, extras: Record<string, unknown> = {}) => ({
  plain_text: contenu,
  href: null,
  annotations: { bold: false, italic: false, code: false, strikethrough: false },
  ...extras,
})

const h1 = (t: string): BlocNotion => ({
  id: `h1-${t}`, type: 'heading_1', heading_1: { rich_text: [texte(t)] },
})
const h2 = (t: string): BlocNotion => ({
  id: `h2-${t}`, type: 'heading_2', heading_2: { rich_text: [texte(t)] },
})
const p = (t: string): BlocNotion => ({
  id: `p-${t}`, type: 'paragraph', paragraph: { rich_text: [texte(t)] },
})
const puce = (t: string): BlocNotion => ({
  id: `li-${t}`, type: 'bulleted_list_item', bulleted_list_item: { rich_text: [texte(t)] },
})

describe('construireDocument', () => {
  it('range le chapeau en préambule, avant toute rubrique', () => {
    const doc = construireDocument([p('Première édition.'), h1("L'essentiel"), p('Un fait.')])
    expect(doc.préambule).toHaveLength(1)
    expect(doc.rubriques).toHaveLength(1)
    expect(doc.rubriques[0]?.titre).toBe("L'essentiel")
  })

  it('ouvre un axe par H2 et lit son badge dans le suffixe', () => {
    const doc = construireDocument([
      h1('Actualités par axe'),
      h2('② Cadre français — FORT'),
      p('Un fait.'),
      h2('③ Filière — RAS'),
    ])
    const axes = doc.rubriques[0]?.axes ?? []
    expect(axes.map((f) => [f.titre, f.niveau])).toEqual([
      ['② Cadre français', 'FORT'],
      ['③ Filière', 'RAS'],
    ])
    expect(axes[0]?.blocs).toHaveLength(1)
  })

  it('range ce qui suit un H1 avant tout H2 dans l’introduction de la rubrique', () => {
    const doc = construireDocument([h1('Analyse'), p('Mise en contexte.'), h2('Axe — FORT')])
    expect(doc.rubriques[0]?.introduction).toHaveLength(1)
    expect(doc.rubriques[0]?.axes).toHaveLength(1)
  })

  it('fusionne les puces consécutives en une seule liste', () => {
    const doc = construireDocument([h1('Essentiel'), puce('a'), puce('b'), p('texte'), puce('c')])
    const blocs = doc.rubriques[0]?.introduction ?? []
    expect(blocs.map((b) => b.type)).toEqual(['liste', 'paragraphe', 'liste'])
    expect(blocs[0]).toMatchObject({ ordonnée: false })
    expect(blocs[0]?.type === 'liste' && blocs[0].éléments).toHaveLength(2)
  })

  it('ne mélange pas puces et numéros dans une même liste', () => {
    const doc = construireDocument([
      puce('a'),
      { id: 'n1', type: 'numbered_list_item', numbered_list_item: { rich_text: [texte('1')] } },
    ])
    expect(doc.préambule.map((b) => b.type)).toEqual(['liste', 'liste'])
  })

  it('ne laisse aucune URL de fichier Notion dans l’arbre, seulement l’identifiant du bloc', () => {
    const doc = construireDocument([
      {
        id: 'bloc-image',
        type: 'image',
        image: {
          type: 'file',
          file: { url: 'https://prod-files.notion/secret?X-Amz-Signature=…', expiry_time: '…' },
          caption: [texte('Une légende')],
        },
      },
    ])
    const image = doc.préambule[0]
    expect(image).toEqual({ type: 'image', blocId: 'bloc-image', légende: 'Une légende' })
    expect(JSON.stringify(doc)).not.toContain('prod-files.notion')
    expect(JSON.stringify(doc)).not.toContain('X-Amz-Signature')
  })

  it('n’écrit pas non plus une URL d’image externe dans l’arbre', () => {
    const doc = construireDocument([
      {
        id: 'bloc-externe',
        type: 'image',
        image: { type: 'external', external: { url: 'https://exemple.test/photo.png' }, caption: [] },
      },
    ])
    expect(JSON.stringify(doc)).not.toContain('exemple.test')
  })

  it('reconstruit un tableau depuis ses lignes enfants', () => {
    const doc = construireDocument([
      {
        id: 'tab',
        type: 'table',
        table: { has_column_header: true, table_width: 2 },
        enfants: [
          { id: 'r1', type: 'table_row', table_row: { cells: [[texte('Dossier')], [texte('Compteur')]] } },
          { id: 'r2', type: 'table_row', table_row: { cells: [[texte('CADA')], [texte('2')]] } },
        ],
      },
    ])
    const tableau = doc.préambule[0]
    expect(tableau?.type).toBe('tableau')
    expect(tableau?.type === 'tableau' && tableau.enTête).toBe(true)
    expect(tableau?.type === 'tableau' && tableau.lignes).toHaveLength(2)
  })

  it('conserve gras, italique et lien d’un paragraphe', () => {
    const doc = construireDocument([
      {
        id: 'p1',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            texte('Voir ', {}),
            texte('la source', {
              href: 'https://exemple.test',
              annotations: { bold: true, italic: false, code: false, strikethrough: false },
            }),
          ],
        },
      },
    ])
    const bloc = doc.préambule[0]
    expect(bloc?.type === 'paragraphe' && bloc.segments[1]).toMatchObject({
      texte: 'la source',
      gras: true,
      lien: 'https://exemple.test',
    })
  })

  it('ignore un type de bloc inconnu plutôt que de le rendre de travers', () => {
    const doc = construireDocument([p('gardé'), { id: 'x', type: 'unsupported_widget' }])
    expect(doc.préambule).toHaveLength(1)
  })

  it('écarte les paragraphes vides', () => {
    const doc = construireDocument([{ id: 'vide', type: 'paragraph', paragraph: { rich_text: [] } }])
    expect(doc.préambule).toHaveLength(0)
  })

  it('rattache un axe orphelin plutôt que de le perdre', () => {
    const doc = construireDocument([h2('Axe — MOYEN'), p('un fait')])
    expect(doc.rubriques).toHaveLength(1)
    expect(doc.rubriques[0]?.titre).toBe('')
    expect(doc.rubriques[0]?.axes[0]?.blocs).toHaveLength(1)
  })

  it('rassemble les axes de toutes les rubriques pour un tri global', () => {
    const doc = construireDocument([
      h1('Un'), h2('A — RAS'),
      h1('Deux'), h2('B — FORT'),
    ])
    expect(axesDuDocument(doc).map((f) => f.titre)).toEqual(['A', 'B'])
  })

  it('rend un document vide sans broncher', () => {
    expect(construireDocument([])).toEqual({ préambule: [], rubriques: [] })
  })
})
