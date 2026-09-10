import { describe, expect, it } from 'vitest'
import {
  axesDuDocument,
  construireDocument,
  fusionnerLesAxes,
  pointsDAxe,
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
    // Le numéro du référentiel est détaché du titre : il sera composé en
    // indice, jamais laissé dans le texte en police de secours.
    expect(axes.map((f) => [f.numéro, f.titre, f.niveau])).toEqual([
      [2, 'Cadre français', 'FORT'],
      [3, 'Filière', 'RAS'],
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
    expect(construireDocument([])).toEqual({ préambule: [], rubriques: [], cadrage: [] })
  })
})

describe('pointsDAxe', () => {
  const axeAvec = (blocs: readonly BlocNotion[]) => {
    const doc = construireDocument([h1('Rubrique'), h2('Cadre — FORT'), ...blocs])
    return doc.rubriques[0]?.axes[0]
  }

  it('prend les puces de la note quand il y en a', () => {
    const axe = axeAvec([p('Une introduction.'), puce('Premier fait.'), puce('Second fait.')])
    expect(pointsDAxe(axe!)).toEqual(['Premier fait.', 'Second fait.'])
  })

  it('retombe sur les paragraphes, une phrase chacun, quand la note n’a pas de puce', () => {
    const axe = axeAvec([p('Un premier fait. Un développement qui suit.'), p('Un second fait.')])
    expect(pointsDAxe(axe!)).toEqual(['Un premier fait.', 'Un second fait.'])
  })

  it('s’arrête au nombre demandé', () => {
    const axe = axeAvec([puce('a'), puce('b'), puce('c'), puce('d')])
    expect(pointsDAxe(axe!, 2)).toEqual(['a', 'b'])
  })

  it('coupe au mot entier, jamais au milieu d’un', () => {
    const axe = axeAvec([puce('Le comité interministériel a rendu son avis définitif au printemps')])
    const [point] = pointsDAxe(axe!, 3, 30)
    expect(point?.endsWith('…')).toBe(true)
    expect(point).not.toContain('inter…')
    expect(point!.length).toBeLessThanOrEqual(31)
  })

  it('ne rend rien pour un axe sans développement', () => {
    expect(pointsDAxe(axeAvec([])!)).toEqual([])
  })
})

describe('fusionnerLesAxes', () => {
  const lettre = (...h2EtPuces: readonly (readonly [string, readonly string[]])[]) =>
    construireDocument(
      h2EtPuces.flatMap(([titre, puces]) => [h2(titre), ...puces.map((texte) => puce(texte))]),
    )

  it('réunit les axes de deux lettres en une seule liste', () => {
    const axes = fusionnerLesAxes([
      lettre(['① Cadre — FORT', ['Un décret.']]),
      lettre(['② Marché — RAS', ['Rien à signaler.']]),
    ])

    expect(axes.map((axe) => axe.titre)).toEqual(['Cadre', 'Marché'])
  })

  it('n’en garde qu’un quand les deux lettres ouvrent le même axe', () => {
    const axes = fusionnerLesAxes([
      lettre(['① Cadre — RAS', ['Vu côté écosystème.']]),
      lettre(['① Cadre — FORT', ['Vu côté concurrentiel.']]),
    ])

    expect(axes).toHaveLength(1)
    // Le niveau le plus fort l'emporte, jamais le dernier rencontré.
    expect(axes[0]?.niveau).toBe('FORT')
    expect(axes[0]?.points).toEqual(['Vu côté écosystème.', 'Vu côté concurrentiel.'])
  })

  it('ne répète pas un fait relevé par les deux lettres', () => {
    const axes = fusionnerLesAxes([
      lettre(['Cadre — FORT', ['Le même décret.']]),
      lettre(['Cadre — MOYEN', ['Le même décret.', 'Un second fait.']]),
    ])

    expect(axes[0]?.points).toEqual(['Le même décret.', 'Un second fait.'])
  })

  it('plafonne les points même quand deux lettres en apportent', () => {
    const axes = fusionnerLesAxes(
      [lettre(['Cadre — FORT', ['a', 'b']]), lettre(['Cadre — FORT', ['c', 'd']])],
      3,
    )

    expect(axes[0]?.points).toEqual(['a', 'b', 'c'])
  })

  it('récupère le numéro de la lettre qui le porte', () => {
    const axes = fusionnerLesAxes([
      lettre(['Cadre — FORT', ['a']]),
      lettre(['② Cadre — RAS', ['b']]),
    ])

    expect(axes[0]?.numéro).toBe(2)
  })
})

describe('détachement du cadrage', () => {
  it('reconnaît la rubrique quel que soit l’habillage du titre', () => {
    for (const titre of [
      'Ajustements du cadrage de cette veille',
      'CADRAGE',
      'Le cadrage, à ajuster',
    ]) {
      const doc = construireDocument([h1(titre), p('Une proposition.')])
      expect(doc.cadrage).toHaveLength(1)
      expect(doc.rubriques).toHaveLength(0)
    }
  })

  it('laisse la lettre intacte quand aucune rubrique ne parle de cadrage', () => {
    const doc = construireDocument([h1('Analyse'), p('Un fait.')])
    expect(doc.cadrage).toEqual([])
    expect(doc.rubriques.map((r) => r.titre)).toEqual(['Analyse'])
  })

  it('prend tout quand la rubrique ne porte pas de trait de séparation', () => {
    const doc = construireDocument([h1('Cadrage'), p('Une proposition.'), p('Une autre.')])
    expect(doc.cadrage).toHaveLength(2)
    expect(doc.rubriques).toHaveLength(0)
  })

  it('coupe au premier trait, et rend la suite à la lettre', () => {
    const doc = construireDocument([
      h1('Cadrage'),
      p('Une proposition.'),
      { id: 'd', type: 'divider', divider: {} },
      p('Le pied de la lettre.'),
    ])
    expect(doc.cadrage).toHaveLength(1)
    expect(doc.rubriques).toHaveLength(1)
    expect(doc.rubriques[0]?.titre).toBe('')
  })
})
