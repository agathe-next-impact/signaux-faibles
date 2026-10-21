import { describe, expect, it } from 'vitest'
import { markdownVersBlocs, segmentsDeLigne } from '@/lib/domaine/markdown'
import { construireDocument } from '@/lib/domaine/document'
import { contrôlerLaLettre } from '@/lib/portail/lint'

describe('segmentsDeLigne', () => {
  it('lit gras, italique, code, liens et balises', () => {
    const segments = segmentsDeLigne('Un **fait** daté, *source* [CNIL](https://www.cnil.fr/x), `code` et <b>gras</b>.')
    expect(segments.map((s) => s.plain_text).join('')).toBe('Un fait daté, source CNIL, code et gras.')
    expect(segments.find((s) => s.plain_text === 'fait')?.annotations.bold).toBe(true)
    expect(segments.find((s) => s.plain_text === 'source')?.annotations.italic).toBe(true)
    expect(segments.find((s) => s.plain_text === 'CNIL')?.href).toBe('https://www.cnil.fr/x')
    expect(segments.find((s) => s.plain_text === 'code')?.annotations.code).toBe(true)
    expect(segments.find((s) => s.plain_text === 'gras')?.annotations.bold).toBe(true)
  })

  it('ne prend pas une étoile isolée ni un tiret bas de mot pour de l’italique', () => {
    expect(segmentsDeLigne('5 * 3 et snake_case').map((s) => s.plain_text).join('')).toBe('5 * 3 et snake_case')
  })
})

describe('markdownVersBlocs', () => {
  it('rend les types que le parseur de lettres attend', () => {
    const blocs = markdownVersBlocs(
      [
        '# L’essentiel',
        '- Première ligne.',
        '- Seconde ligne.',
        '',
        '# Actualités par axe',
        '## ① Marché — FORT',
        '**Un fait.** Un paragraphe',
        'sur deux lignes.',
        '',
        '> Les autres sources sont muettes.',
        '> Vérifié le 20 octobre.',
        '',
        '<callout>Note de méthode.</callout>',
        '',
        '| Dossier | État |',
        '| --- | --- |',
        '| CADA | Rien de neuf. |',
        '',
        '---',
        '1. Première étape.',
      ].join('\n'),
    )
    expect(blocs.map((b) => b.type)).toEqual([
      'heading_1',
      'bulleted_list_item',
      'bulleted_list_item',
      'heading_1',
      'heading_2',
      'paragraph',
      'callout',
      'callout',
      'table',
      'divider',
      'numbered_list_item',
    ])
    const paragraphe = blocs[5] as unknown as { paragraph: { rich_text: Array<{ plain_text: string }> } }
    expect(paragraphe.paragraph.rich_text.map((s) => s.plain_text).join('')).toBe('Un fait. Un paragraphe sur deux lignes.')
    const encadré = blocs[6] as unknown as { callout: { rich_text: Array<{ plain_text: string }> } }
    expect(encadré.callout.rich_text[0]?.plain_text).toBe('Les autres sources sont muettes. Vérifié le 20 octobre.')
    const tableau = blocs[8]!
    expect(tableau.enfants?.length).toBe(2)
    expect((tableau as unknown as { table: { has_column_header: boolean } }).table.has_column_header).toBe(true)
  })

  it('produit une lettre que le validateur de production sait lire', () => {
    const markdown = [
      '> Note de méthode : fenêtre du 14 au 20 octobre.',
      '',
      '# L’essentiel',
      '- La CNIL a publié deux fiches sur la prospection le 16 octobre.',
      '- Doctolib a annoncé l’entrée de Nvidia à son capital le 13 octobre.',
      '',
      '# Actualités par axe',
      '## ① Données et plateformes — FORT',
      '**La CNIL encadre la reconstitution d’adresses professionnelles.** Deux fiches publiées le 16 octobre 2026 fixent le cadre.',
      '',
      'Ce que cela change pour vous : la prospection par courriel reste possible, sous conditions.',
      '',
      'Source : [CNIL](https://www.cnil.fr/fr/reconstitution-adresses-professionnelles-quel-cadre), 16 octobre 2026.',
      '',
      '## ② Plateformes — RAS',
      '> Rien de neuf. Crénolibre n’a rien publié depuis le 2 septembre.',
      '',
      '# Ajustements du cadrage de cette veille',
      'Aucun ajustement n’est proposé cette période.',
      '',
      'Ces ajustements ne seront appliqués qu’après votre accord. Pour demander vous-même une modification du cadrage — ajouter ou retirer un sujet suivi, une source, un acteur, un territoire, ou changer ce qui doit compter comme important — écrivez à agathe@signauxfaibles.io.',
      '',
      '---',
      '',
      '# Ce qui a été vérifié pour cette édition',
      'Dossiers suivis : le dossier Doctolib et Nvidia n’a pas bougé.',
    ].join('\n')

    const blocs = markdownVersBlocs(markdown)
    const document = construireDocument(blocs)
    expect(document.cadrage.length).toBeGreaterThan(0)

    const rapport = contrôlerLaLettre({
      titre: 'Veille test — mardi 21 octobre 2026',
      blocs,
      dossiersBruts: 'Doctolib et Nvidia (0, entrée au capital)',
      numéro: 2,
    })
    expect(rapport.ruptures).toEqual([])
    expect(rapport.aperçu.axes.map((a) => a.niveau)).toEqual(['FORT', 'RAS'])
  })
})
