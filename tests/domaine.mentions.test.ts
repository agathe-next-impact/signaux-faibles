import { describe, expect, it } from 'vitest'
import { construireDocument, type BlocNotion } from '@/lib/domaine/document'
import { acteursEnVue, mentionsDe } from '@/lib/domaine/mentions'

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
    expect(mentions[0]?.titre).toBe('Cadre')
    expect(mentions[0]?.numéro).toBe(1)
    expect(mentions[0]?.niveau).toBe('FORT')
    expect(mentions[0]?.passages.map((p) => p.texte)).toEqual(['La CADA a rendu son avis.'])
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
    expect(mentions[0]?.passages.map((p) => p.texte)).toEqual(['La prefecture a tranché.'])
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

    expect(mentionsDe('Groupe Verdier', document)[0]?.passages.map((p) => p.texte)).toEqual([
      'Groupe Verdier annonce une levée.',
      'Groupe Verdier · 12 M€',
    ])
  })

  it('ne prend pas un nom pour un motif d’expression régulière', () => {
    const document = construireDocument([h2('Cadre — RAS'), p('Le point (a) est acté.')])
    expect(mentionsDe('(a)', document)[0]?.passages.map((p) => p.texte)).toEqual([
      'Le point (a) est acté.',
    ])
  })

  it('ne rend rien pour un nom vide', () => {
    const document = construireDocument([h2('Cadre — RAS'), p('Un texte.')])
    expect(mentionsDe('  ', document)).toEqual([])
  })
})

describe('acteursEnVue', () => {
  const acteur = (nom: string, compteur: number | null) => ({ nom, compteur, précision: null })
  const lettre = (...phrases: readonly string[]) =>
    construireDocument([h2('Cadre — RAS'), ...phrases.map((phrase) => p(phrase))])

  it('rend l’extrait de la lettre, de quoi remplir la case', () => {
    const [gardé] = acteursEnVue([acteur('CADA', 4)], [lettre('La CADA a rendu son avis.')])
    expect(gardé?.extrait).toBe('La CADA a rendu son avis.')
  })

  it('n’invente pas d’extrait quand seul le compteur retient l’acteur', () => {
    const [gardé] = acteursEnVue([acteur('CADA', 0)], [lettre('Rien sur ce front.')])
    expect(gardé?.extrait).toBeNull()
  })

  it('garde un acteur qu’une lettre nomme', () => {
    const gardés = acteursEnVue(
      [acteur('CADA', 4)],
      [lettre('La CADA a rendu son avis.')],
    )
    expect(gardés.map((acteur) => acteur.nom)).toEqual(['CADA'])
  })

  it('écarte un acteur qu’aucune lettre ne nomme et qui n’a pas bougé', () => {
    const gardés = acteursEnVue([acteur('CADA', 4)], [lettre('Rien sur ce front.')])
    expect(gardés).toEqual([])
  })

  it('garde un acteur qui vient de bouger, même si aucune lettre ne le nomme', () => {
    // Le cas qui impose la seconde porte : une lettre peut suivre « CADA » dans
    // ses dossiers et écrire son nom en toutes lettres dans sa prose. Sans le
    // compteur, l'acteur disparaîtrait la semaine même où il bouge.
    const gardés = acteursEnVue(
      [acteur('CADA', 0)],
      [lettre('La Commission d’accès aux documents administratifs a tranché.')],
    )
    expect(gardés.map((acteur) => acteur.nom)).toEqual(['CADA'])
  })

  it('n’écarte rien quand il n’y a aucune lettre à interroger', () => {
    expect(acteursEnVue([acteur('CADA', 0)], [])).toHaveLength(1)
    expect(acteursEnVue([acteur('CADA', 2)], [])).toHaveLength(0)
  })

  it('interroge toutes les lettres fournies, pas seulement la première', () => {
    const gardés = acteursEnVue(
      [acteur('CADA', 3)],
      [lettre('Rien.'), lettre('La CADA revient dans le débat.')],
    )
    expect(gardés).toHaveLength(1)
  })
})

/**
 * La mise en forme doit survivre au voyage.
 *
 * Un extrait quitte la page de la lettre pour la case d'un axe ou la page d'un
 * acteur. Tant qu'il n'était qu'une chaîne, il y arrivait à plat : un gras, un
 * lien, un italique écrits dans la note disparaissaient dès qu'on sortait du
 * rendu du document. Le texte reste là pour chercher et dédoublonner ; les
 * segments sont ce qu'on affiche.
 */
describe('les passages gardent leur mise en forme', () => {
  const richeGras = (avant: string, gras: string, après: string): BlocNotion => ({
    id: `p-${avant}`,
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { plain_text: avant },
        { plain_text: gras, annotations: { bold: true } },
        { plain_text: après },
      ],
    },
  })

  it('rend le texte entier et les segments qui le composent', () => {
    const document = construireDocument([
      h2('Cadre européen — MOYEN'),
      richeGras('Le ', 'règlement marchés publics', ' est présenté le 9 septembre.'),
    ])

    const [passage] = mentionsDe('règlement marchés publics', document)[0]!.passages

    expect(passage!.texte).toBe('Le règlement marchés publics est présenté le 9 septembre.')
    // Le texte se recompose exactement depuis les segments : la case affiche
    // donc ce que les tests mesurent, et rien d'autre.
    expect(passage!.segments.map((segment) => segment.texte).join('')).toBe(passage!.texte)
    expect(passage!.segments.filter((segment) => segment.gras).map((s) => s.texte)).toEqual([
      'règlement marchés publics',
    ])
  })

  it('recompose une ligne de tableau sans perdre ses cellules', () => {
    const document = construireDocument([
      h2('Agenda — MOYEN'),
      {
        id: 'tableau',
        type: 'table',
        table: { has_column_header: false },
        enfants: [
          {
            id: 'ligne',
            type: 'table_row',
            table_row: { cells: [texte('9/09'), texte('Règlement marchés publics')] },
          },
        ],
      },
    ])

    const [passage] = mentionsDe('règlement marchés publics', document)[0]!.passages
    expect(passage!.texte).toBe('9/09 · Règlement marchés publics')
    expect(passage!.segments.map((segment) => segment.texte).join('')).toBe(passage!.texte)
  })
})
