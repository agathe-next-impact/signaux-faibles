import { describe, expect, it } from 'vitest'
import { construireDocument, type BlocNotion } from '@/lib/domaine/document'
import { mentionsDe } from '@/lib/domaine/mentions'

const texte = (contenu: string) => [{ plain_text: contenu }]

const h2 = (titre: string): BlocNotion => ({
  id: `h2-${titre}`,
  type: 'heading_2',
  heading_2: { rich_text: texte(titre) },
})
const p = (contenu: string): BlocNotion => ({
  id: `p-${contenu}`,
  type: 'paragraph',
  paragraph: { rich_text: texte(contenu) },
})
const puce = (contenu: string): BlocNotion => ({
  id: `l-${contenu}`,
  type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: texte(contenu) },
})

describe('mentionsDe', () => {
  it('rend les passages qui nomment l’acteur, avec leur axe', () => {
    const document = construireDocument([
      h2('① Cadre — FORT'),
      p('La CADA a rendu son avis.'),
      p('Un fait sans rapport.'),
      h2('② Marché — RAS'),
      puce('Rien sur ce front.'),
    ])

    const mentions = mentionsDe('CADA', document)
    expect(mentions).toHaveLength(1)
    expect(mentions[0]?.axe).toBe('Cadre')
    expect(mentions[0]?.numéro).toBe(1)
    expect(mentions[0]?.niveau).toBe('FORT')
    expect(mentions[0]?.passages).toEqual(['La CADA a rendu son avis.'])
  })

  it('ne se déclenche pas au milieu d’un mot', () => {
    // Le piège : « CADA » dans « cadastre ». Un rapprochement approximatif
    // citerait un passage qui ne parle pas de l'acteur.
    const document = construireDocument([h2('Cadre — RAS'), p('Le cadastre est révisé.')])
    expect(mentionsDe('CADA', document)).toEqual([])
  })

  it('ignore les accents et la casse, mais pas le reste du mot', () => {
    const document = construireDocument([
      h2('Cadre — RAS'),
      p('La prefecture a tranché.'),
      p('Les préfectures voisines attendent.'),
    ])
    const mentions = mentionsDe('Préfecture', document)
    expect(mentions[0]?.passages).toEqual(['La prefecture a tranché.'])
  })

  it('trouve un nom en plusieurs mots, dans une puce comme dans un tableau', () => {
    const document = construireDocument([
      h2('Concurrence — MOYEN'),
      puce('Groupe Verdier annonce une levée.'),
      {
        id: 'tab',
        type: 'table',
        table: { has_column_header: true },
        enfants: [
          {
            id: 'ligne',
            type: 'table_row',
            table_row: { cells: [texte('Groupe Verdier'), texte('12 M€')] },
          },
        ],
      },
    ])

    expect(mentionsDe('Groupe Verdier', document)[0]?.passages).toEqual([
      'Groupe Verdier annonce une levée.',
      'Groupe Verdier · 12 M€',
    ])
  })

  it('ne prend pas un nom pour un motif d’expression régulière', () => {
    const document = construireDocument([h2('Cadre — RAS'), p('Le point (a) est acté.')])
    expect(mentionsDe('(a)', document)[0]?.passages).toEqual(['Le point (a) est acté.'])
  })

  it('ne rend rien pour un nom vide', () => {
    const document = construireDocument([h2('Cadre — RAS'), p('Un texte.')])
    expect(mentionsDe('  ', document)).toEqual([])
  })
})
