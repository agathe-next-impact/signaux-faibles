import { describe, expect, it } from 'vitest'
import type { BlocNotion } from '@/lib/domaine/document'
import { LETTRE_UNIQUE, contrôlerLaLettre } from '@/lib/portail/lint'

/**
 * Le contrat de la lettre unique (programme du 22 octobre 2026, §2) : dix à
 * quinze axes, un ou deux faits courts par axe, datés et sourcés, un RAS nu en
 * encadré, une rubrique « Dossiers suivis », rien du rapport de collecte.
 * Aucun humain ne relit : ce que la forme double tolérait devient une rupture.
 */

let n = 0
const segments = (contenu: string, lien: string | null = null) => [{ plain_text: contenu, href: lien }]
const bloc = (type: string, contenu = '', lien: string | null = null): BlocNotion => ({
  id: `u${(n += 1)}`,
  type,
  [type]: { rich_text: segments(contenu, lien) },
})
const h1 = (t: string) => bloc('heading_1', t)
const h2 = (t: string) => bloc('heading_2', t)
const p = (t: string) => bloc('paragraph', t)
const fait = (t: string) => bloc('paragraph', t, 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000000001')
const encadré = (t: string) => bloc('callout', t)

const NIVEAUX = ['FORT', 'MOYEN', 'RAS'] as const
const CERCLÉS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯'] as const

/** Une lettre unique au contrat, à `combien` axes, les niveaux alternés. */
function lettreUnique(combien = 12, options: { faitsParAxe?: number } = {}): BlocNotion[] {
  const faitsParAxe = options.faitsParAxe ?? 1
  const blocs: BlocNotion[] = [
    h1('L’essentiel'),
    p('Le décret sur la facturation électronique est paru le 12 septembre.'),
    p('Kyocera a présenté sa gamme le 3 octobre à Lyon.'),
    h1('Actualités par axe'),
  ]
  for (let i = 0; i < combien; i += 1) {
    const niveau = NIVEAUX[i % 3]!
    blocs.push(h2(`${CERCLÉS[i]} Axe ${i + 1} — ${niveau}`))
    if (niveau === 'RAS') {
      blocs.push(encadré('RAS'))
      continue
    }
    for (let j = 0; j < faitsParAxe; j += 1) {
      blocs.push(fait(`Le texte ${i + 1}.${j + 1} est paru le ${(j % 28) + 1} octobre 2026. Il s’applique au 1er janvier.`))
    }
  }
  blocs.push(h1('Dossiers suivis'))
  blocs.push(p('Le dossier facturation électronique attend son décret d’application.'))
  blocs.push(p('Le dossier Kyocera suit la gamme présentée le 3 octobre.'))
  return blocs
}

const DOSSIERS = 'facturation électronique (2, décret attendu) · Kyocera (1)'
const TITRE = 'Veille Konica Minolta, édition n° 12 du 26 octobre 2026'

function contrôler(blocs: BlocNotion[], dossiers = DOSSIERS) {
  return contrôlerLaLettre({ titre: TITRE, blocs, dossiersBruts: dossiers, numéro: 12, forme: 'unique' })
}

describe('contrôlerLaLettre, forme unique : une lettre au contrat', () => {
  it('douze axes, un fait daté et sourcé par axe, RAS en encadré : conforme, sans avertissement', () => {
    const rapport = contrôler(lettreUnique(12))
    expect(rapport.ruptures).toEqual([])
    expect(rapport.avertissements).toEqual([])
    expect(rapport.conforme).toBe(true)
    expect(rapport.aperçu.axes).toHaveLength(12)
  })

  it('dix et quinze axes sont les bornes incluses', () => {
    expect(contrôler(lettreUnique(LETTRE_UNIQUE.axesMin)).conforme).toBe(true)
    expect(contrôler(lettreUnique(LETTRE_UNIQUE.axesMax)).conforme).toBe(true)
  })

  it('deux faits par axe restent admis', () => {
    expect(contrôler(lettreUnique(12, { faitsParAxe: 2 })).conforme).toBe(true)
  })

  it('la même lettre, en forme double, est conforme aussi : le contrat commun ne change pas', () => {
    const rapport = contrôlerLaLettre({ titre: TITRE, blocs: lettreUnique(12), dossiersBruts: DOSSIERS, numéro: 12 })
    expect(rapport.conforme).toBe(true)
  })
})

describe('contrôlerLaLettre, forme unique : le nombre d’axes', () => {
  it('neuf axes : axes-trop-peu, portée portail', () => {
    const rapport = contrôler(lettreUnique(9))
    expect(rapport.ruptures.map((r) => r.code)).toContain('axes-trop-peu')
    expect(rapport.ruptures.find((r) => r.code === 'axes-trop-peu')?.portée).toBe('portail')
  })

  it('seize axes : axes-trop-nombreux', () => {
    expect(contrôler(lettreUnique(16)).ruptures.map((r) => r.code)).toContain('axes-trop-nombreux')
  })

  it('aucun axe : la rupture commune aucun-axe, pas axes-trop-peu en plus', () => {
    const codes = contrôler([h1('L’essentiel'), p('Rien le 3 octobre.'), h1('Dossiers suivis'), p('Kyocera et facturation électronique.')]).ruptures.map((r) => r.code)
    expect(codes).toContain('aucun-axe')
    expect(codes).not.toContain('axes-trop-peu')
  })

  it('en forme double, neuf axes ne sont pas une rupture', () => {
    const rapport = contrôlerLaLettre({ titre: TITRE, blocs: lettreUnique(9), dossiersBruts: DOSSIERS })
    expect(rapport.ruptures).toEqual([])
  })
})

describe('contrôlerLaLettre, forme unique : chaque fait est court, daté et sourcé', () => {
  it('trois faits dans un axe : axe-trop-fourni', () => {
    expect(contrôler(lettreUnique(12, { faitsParAxe: 3 })).ruptures.map((r) => r.code)).toContain('axe-trop-fourni')
  })

  it('un fait de trois phrases : fait-trop-long', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'paragraph' && b.id !== blocs[1]!.id && b.id !== blocs[2]!.id)
    blocs[i] = fait('Le décret est paru le 12 septembre. Il entre en vigueur au 1er janvier. Les entreprises doivent se mettre en conformité.')
    const rupture = contrôler(blocs).ruptures.find((r) => r.code === 'fait-trop-long')
    expect(rupture?.message).toContain('3 phrase(s)')
  })

  it('un fait de plus de 220 caractères : fait-trop-long', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'paragraph' && b.id !== blocs[1]!.id && b.id !== blocs[2]!.id)
    blocs[i] = fait(`Le décret est paru le 12 septembre ${'et précise les obligations des plateformes de dématérialisation partenaires '.repeat(4)}.`)
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('fait-trop-long')
  })

  it('un fait sans date : fait-sans-date', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'paragraph' && b.id !== blocs[1]!.id && b.id !== blocs[2]!.id)
    blocs[i] = fait('Le décret est paru récemment et s’applique à toutes les entreprises.')
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('fait-sans-date')
  })

  it('reconnaît une date numérique et le premier du mois', () => {
    const blocs = lettreUnique(12)
    const indices = blocs.map((b, i) => (b.type === 'paragraph' && i > 3 ? i : -1)).filter((i) => i > 0)
    blocs[indices[0]!] = fait('Le décret est paru le 12/09/2026.')
    blocs[indices[1]!] = fait('La gamme a été présentée le 1er octobre.')
    expect(contrôler(blocs).ruptures.map((r) => r.code)).not.toContain('fait-sans-date')
  })

  it('deux sources en fin de fait ne comptent ni dans la longueur ni dans les phrases', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'paragraph' && b.id !== blocs[1]!.id && b.id !== blocs[2]!.id)
    blocs[i] = {
      id: 'deux-sources',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { plain_text: 'Le décret est paru le 12 septembre (', href: null },
          { plain_text: 'legifrance.gouv.fr', href: 'https://www.legifrance.gouv.fr/' },
          { plain_text: ', ', href: null },
          { plain_text: 'cnil.fr', href: 'https://www.cnil.fr/' },
          { plain_text: ')', href: null },
        ],
      },
    }
    expect(contrôler(blocs).ruptures).toEqual([])
  })

  it('un fait sans lien : fait-sans-source', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'paragraph' && b.id !== blocs[1]!.id && b.id !== blocs[2]!.id)
    blocs[i] = p('Le décret est paru le 12 septembre.')
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('fait-sans-source')
  })

  it('un RAS qui écrit une phrase, même courte : ras-trop-long', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'callout')
    blocs[i] = encadré('Rien de neuf, sources muettes depuis le 3 juillet.')
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('ras-trop-long')
  })

  it('« RAS. » avec un point reste un RAS nu', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'callout')
    blocs[i] = encadré('RAS.')
    expect(contrôler(blocs).ruptures).toEqual([])
  })

  it('un RAS écrit en prose : absence-en-prose devient une rupture', () => {
    const blocs = lettreUnique(12)
    const i = blocs.findIndex((b) => b.type === 'callout')
    blocs[i] = p('Rien de neuf depuis le 3 juillet.')
    const rapport = contrôler(blocs)
    expect(rapport.ruptures.map((r) => r.code)).toContain('absence-en-prose')
    expect(rapport.avertissements.map((a) => a.code)).not.toContain('absence-en-prose')
  })
})

describe('contrôlerLaLettre, forme unique : dossiers, collecte, longueur', () => {
  it('des dossiers sans rubrique « Dossiers suivis » : dossiers-sans-rubrique', () => {
    const blocs = lettreUnique(12).filter((b) => !(b.type === 'heading_1' && (b.heading_1 as { rich_text: Array<{ plain_text: string }> }).rich_text[0]!.plain_text === 'Dossiers suivis'))
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('dossiers-sans-rubrique')
  })

  it('un dossier que le corps ne nomme pas : dossier-non-nommé devient une rupture', () => {
    const rapport = contrôler(lettreUnique(12), `${DOSSIERS} · SecNumCloud 3.2 (0)`)
    expect(rapport.ruptures.map((r) => r.code)).toContain('dossier-non-nommé')
  })

  it('une liste de liens « Sources non consultées » est admise', () => {
    const blocs = [
      ...lettreUnique(12),
      h1('Sources non consultées'),
      bloc('bulleted_list_item', 'legifrance.gouv.fr', 'https://www.legifrance.gouv.fr/'),
      bloc('bulleted_list_item', 'cnil.fr', 'https://www.cnil.fr/'),
    ]
    const rapport = contrôler(blocs)
    expect(rapport.ruptures).toEqual([])
    expect(rapport.avertissements).toEqual([])
  })

  it('« Sources non consultées » avec une phrase de rédaction : collecte-dans-la-lettre', () => {
    const blocs = [
      ...lettreUnique(12),
      h1('Sources non consultées'),
      p('Le site de la DGFiP a refusé la lecture le 20 octobre.'),
      bloc('bulleted_list_item', 'legifrance.gouv.fr', 'https://www.legifrance.gouv.fr/'),
    ]
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('collecte-dans-la-lettre')
  })

  it('une puce de « Sources non consultées » qui ajoute du texte au lien : collecte-dans-la-lettre', () => {
    const blocs = [...lettreUnique(12), h1('Sources non consultées'), bloc('bulleted_list_item', 'legifrance.gouv.fr, refusée le 20 octobre')]
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('collecte-dans-la-lettre')
  })

  it('« Sources non ouvertes » reste du rapport de collecte même en liste de liens', () => {
    const blocs = [...lettreUnique(12), h1('Sources non ouvertes'), bloc('bulleted_list_item', 'legifrance.gouv.fr', 'https://www.legifrance.gouv.fr/')]
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('collecte-dans-la-lettre')
  })

  it('le rapport de collecte dans la lettre : rupture', () => {
    const blocs = [...lettreUnique(12), h1('Sources non ouvertes'), p('Le site de la DGFiP a refusé la lecture le 20 octobre.')]
    const rapport = contrôler(blocs)
    expect(rapport.ruptures.map((r) => r.code)).toContain('collecte-dans-la-lettre')
    expect(rapport.avertissements.map((a) => a.code)).not.toContain('collecte-dans-la-lettre')
  })

  it('un bloc de cadrage : rupture', () => {
    const blocs = [...lettreUnique(12), h1('Ajustements du cadrage de cette veille'), p('Aucun ajustement n’est proposé cette période.'), bloc('divider')]
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('cadrage-présent')
  })

  it('une ligne de « L’essentiel » trop longue : rupture', () => {
    const blocs = lettreUnique(12)
    blocs[1] = p(`Le décret est paru le 12 septembre ${'et concerne toutes les entreprises assujetties '.repeat(3)}.`)
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('essentiel-ligne-longue')
  })

  it('plus de 1 400 mots : lettre-trop-longue', () => {
    const blocs = lettreUnique(15, { faitsParAxe: 3 })
    const longs = blocs.map((b) =>
      b.type === 'paragraph' && b.id !== blocs[1]!.id && b.id !== blocs[2]!.id
        ? fait(`Le 3 octobre, ${'mot '.repeat(40)}.`)
        : b,
    )
    const rapport = contrôler(longs)
    expect(rapport.ruptures.map((r) => r.code)).toContain('lettre-trop-longue')
  })

  it('une rubrique « Trois idées de posts » : recommandation-de-post', () => {
    const blocs = [...lettreUnique(12), h1('Trois idées de posts'), p('Publier un billet le 3 octobre sur la facturation électronique.')]
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('recommandation-de-post')
  })

  it('une rubrique « Recommandation de post LinkedIn » : recommandation-de-post', () => {
    const blocs = [...lettreUnique(12), h1('Recommandation de post LinkedIn')]
    expect(contrôler(blocs).ruptures.map((r) => r.code)).toContain('recommandation-de-post')
  })

  it('un axe nommé comme un dossier suivi : axe-est-un-acteur', () => {
    const blocs = lettreUnique(12)
    blocs[4] = h2('② Kyocera — MOYEN')
    const rapport = contrôler(blocs)
    expect(rapport.ruptures.find((r) => r.code === 'axe-est-un-acteur')?.message).toContain('Kyocera')
  })

  it('un axe thématique dont le nom contient celui d’un acteur reste admis', () => {
    const blocs = lettreUnique(12)
    blocs[4] = h2('② Offre de gamme chez Kyocera — MOYEN')
    expect(contrôler(blocs).ruptures.map((r) => r.code)).not.toContain('axe-est-un-acteur')
  })
})
