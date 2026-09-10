import { describe, expect, it } from 'vitest'
import { construireDocument, type BlocNotion } from '@/lib/domaine/document'
import { acteursAvecActualité, mentionsDe } from '@/lib/domaine/mentions'

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

describe('acteursAvecActualité', () => {
  const acteur = (nom: string, compteur: number | null) => ({ nom, compteur, précision: null })
  const lettre = (...phrases: readonly string[]) =>
    construireDocument([h2('Cadre — RAS'), ...phrases.map((phrase) => p(phrase))])

  it('garde un acteur qu’une lettre nomme', () => {
    const gardés = acteursAvecActualité(
      [acteur('CADA', 4)],
      [lettre('La CADA a rendu son avis.')],
    )
    expect(gardés.map((a) => a.nom)).toEqual(['CADA'])
  })

  it('écarte un acteur qu’aucune lettre ne nomme et qui n’a pas bougé', () => {
    const gardés = acteursAvecActualité([acteur('CADA', 4)], [lettre('Rien sur ce front.')])
    expect(gardés).toEqual([])
  })

  it('garde un acteur qui vient de bouger, même si aucune lettre ne le nomme', () => {
    // Le cas qui impose la seconde porte : une lettre peut suivre « CADA » dans
    // ses dossiers et écrire son nom en toutes lettres dans sa prose. Sans le
    // compteur, l'acteur disparaîtrait la semaine même où il bouge.
    const gardés = acteursAvecActualité(
      [acteur('CADA', 0)],
      [lettre('La Commission d’accès aux documents administratifs a tranché.')],
    )
    expect(gardés.map((a) => a.nom)).toEqual(['CADA'])
  })

  it('n’écarte rien quand il n’y a aucune lettre à interroger', () => {
    expect(acteursAvecActualité([acteur('CADA', 0)], [])).toHaveLength(1)
    expect(acteursAvecActualité([acteur('CADA', 2)], [])).toHaveLength(0)
  })

  it('interroge toutes les lettres fournies, pas seulement la première', () => {
    const gardés = acteursAvecActualité(
      [acteur('CADA', 3)],
      [lettre('Rien.'), lettre('La CADA revient dans le débat.')],
    )
    expect(gardés).toHaveLength(1)
  })
})
