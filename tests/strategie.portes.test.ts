import { describe, expect, it } from 'vitest'
import { construireDocument, phraseTitreDe, segmenterLesFaits, type Bloc } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import {
  contrôlerLaGrille,
  contrôlerLaSynthèse,
  contrôlerLesÉtiquettes,
  empreinteDeLaGrille,
  empreinteDeTitre,
  faitsDeLaLettre,
  forcesNonSuivies,
  lectureDesÉtiquettes,
  messageDeRefus,
  normaliserUrl,
  trousDuPestel,
  type ContexteDeSynthèse,
  type Grille,
  type ÉtiquetteProposée,
  type SynthèseProposée,
} from '@/lib/domaine/strategie'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { ÉTIQUETTES_OCTOBRE } from './fixtures/etiquettes-octobre'
import { BLOCS_OCTOBRE, DATE_OCTOBRE } from './fixtures/lettre-octobre'
import { BLOCS_RÉELS } from './fixtures/lettre-reelle'

const codes = (refus: readonly { code: string }[]) => refus.map((r) => r.code)

function contrôler(lot: readonly ÉtiquetteProposée[], blocs = BLOCS_OCTOBRE, entités: readonly string[] | null = null) {
  return contrôlerLesÉtiquettes({ blocs, dateÉdition: DATE_OCTOBRE, lot, entités })
}

/** Le lot à la main, un fait modifié. */
function avec(index: number, modif: Partial<ÉtiquetteProposée>): ÉtiquetteProposée[] {
  return ÉTIQUETTES_OCTOBRE.map((é, i) => (i === index ? { ...é, ...modif } : é))
}

describe('la segmentation des faits', () => {
  it('trouve les onze faits de la lettre d’octobre, par axe, phrase-titre en tête de paragraphe', () => {
    const faits = faitsDeLaLettre(construireDocument(BLOCS_OCTOBRE))
    expect(faits).toHaveLength(11)
    expect([1, 2, 3, 4, 5].map((n) => faits.filter((f) => f.axe === n).length)).toEqual([3, 2, 1, 3, 2])
    expect(faits[6]!.titre).toMatch(/^Telehouse a annoncé le 20 octobre 2026/)
    expect(faits[6]!.niveauDeLAxe).toBe('FORT')
    // Le fait court jusqu'à la phrase-titre suivante : « Ce que cela change » et la source en font partie.
    expect(faits[6]!.urls.some((u) => u.includes('telehouse.fr'))).toBe(true)
    // Les encadrés, l'essentiel et l'analyse ne sont pas des faits.
    expect(faits.every((f) => !/^Rien de neuf/.test(f.titre))).toBe(true)
  })

  it('une lettre sans phrase-titre (septembre) : chaque paragraphe est un fait', () => {
    const document = construireDocument(BLOCS_RÉELS)
    const axe = document.rubriques.flatMap((r) => r.axes).find((a) => a.blocs.length > 0)!
    const faits = segmenterLesFaits(axe.blocs)
    expect(faits.length).toBeGreaterThan(0)
    expect(faits.every((f) => f.blocs.length === 1)).toBe(true)
  })

  it('le gras qui ouvre « Ce que cela change pour vous » ou qui finit un paragraphe n’est pas une phrase-titre', () => {
    const [ccc, source, titre] = markdownVersBlocs(
      '**Ce que cela change pour vous** : une à deux phrases.\n\nSource : [x](https://x.example), le 1er octobre. <b>Impact moyen.</b>\n\n<b>Un fait daté du 3 octobre 2026 qui dit ce qui s’est passé.</b> Et la suite.',
    )
    const enBloc = (b: unknown) => construireDocument([b as never]).préambule[0] as Bloc
    expect(phraseTitreDe(enBloc(ccc))).toBeNull()
    expect(phraseTitreDe(enBloc(source))).toBeNull()
    expect(phraseTitreDe(enBloc(titre))).toBe('Un fait daté du 3 octobre 2026 qui dit ce qui s’est passé.')
  })

  it('la rubrique de l’actualité des acteurs est étiquetable, « Signaux de rupture » et les axes RAS ne le sont pas', () => {
    const blocs = markdownVersBlocs(
      [
        '# Actualités par axe',
        '## ① Marché — MOYEN',
        '<b>Un concurrent a ouvert le 2 octobre 2026 une agence à Lyon.</b> Détail. Source : [a](https://a.example).',
        '## ② Réglementation — RAS',
        '> Rien de neuf depuis le 12 mars.',
        '# L’actualité des acteurs',
        '<b>Un autre acteur a levé 3 millions d’euros le 5 octobre 2026.</b> Source : [b](https://b.example).',
        '# Signaux de rupture',
        '- La levée du 5 octobre menace le prix (axe ①).',
      ].join('\n\n'),
    )
    const faits = faitsDeLaLettre(construireDocument(blocs))
    expect(faits.map((f) => [f.section, f.axe, f.rang])).toEqual([
      ['axe', 1, 1],
      ['acteurs', null, 1],
    ])
  })
})

describe('la porte des étiquettes', () => {
  it('accepte le lot posé à la main, et ne garde du titre que son empreinte', () => {
    const r = contrôler(ÉTIQUETTES_OCTOBRE)
    expect(r.refus).toEqual([])
    expect(r.acceptées).toHaveLength(11)
    expect(r.faits).toBe(11)
    const telehouse = r.acceptées.find((é) => é.axe === 4 && é.rang === 1)!
    expect(telehouse).toMatchObject({ impact: 'FORT', rupture: true, pestel: 'economique', porter: null })
    expect(telehouse.empreinte).toBe(empreinteDeTitre(ÉTIQUETTES_OCTOBRE[6]!.titre))
    expect(telehouse).not.toHaveProperty('titre')
  })

  it('tolère apostrophes et ponctuation dans la phrase-titre recopiée, pas un autre texte', () => {
    expect(codes(contrôler(avec(0, { titre: ÉTIQUETTES_OCTOBRE[0]!.titre.replaceAll("'", '’').replace(/\.$/, '') })).refus)).toEqual([])
    expect(codes(contrôler(avec(0, { titre: 'Le Conseil a examiné un texte.' })).refus)).toEqual(['titre-différent'])
  })

  it.each([
    ['fait-introuvable', avec(0, { rang: 9 })],
    ['étiquette-inconnue', avec(0, { pestel: 'juridique' as never })],
    ['cadre-ambigu', avec(0, { porter: 'rivalite', entite: null })],
    ['cadre-ambigu', avec(0, { pestel: null })],
    ['ansoff-manquant', avec(2, { ansoff: null })],
    ['ansoff-hors-concurrent', avec(0, { ansoff: 'diversification' })],
    ['impact-supérieur-à-l-axe', avec(0, { impact: 'FORT' })],
    ['date-invalide', avec(0, { date: '16/10/2026' })],
    ['date-future', avec(0, { date: '2026-10-22' })],
    ['source-absente', avec(0, { source: 'https://www.cispe.cloud/e115-billion-to-move-over-e2-trillion-to-stay/' })],
    ['section-inconnue', avec(0, { section: 'essentiel' as never })],
  ])('refuse %s', (code, lot) => {
    expect(codes(contrôler(lot).refus)).toContain(code)
  })

  it('refuse un lot incomplet, un doublon, et une entité hors de la grille ; un refus ne laisse rien accepter', () => {
    const incomplet = contrôler(ÉTIQUETTES_OCTOBRE.slice(1))
    expect(codes(incomplet.refus)).toEqual(['lot-incomplet'])
    expect(incomplet.acceptées).toEqual([])
    expect(codes(contrôler([...ÉTIQUETTES_OCTOBRE, ÉTIQUETTES_OCTOBRE[0]!]).refus)).toEqual(['doublon'])
    expect(codes(contrôler(ÉTIQUETTES_OCTOBRE, BLOCS_OCTOBRE, ['CISPE']).refus)).toEqual(['entité-hors-grille'])
    expect(codes(contrôler(ÉTIQUETTES_OCTOBRE, BLOCS_OCTOBRE, ['CISPE', 'Cigref']).refus)).toEqual([])
  })

  it('refuse d’étiqueter un axe RAS', () => {
    const blocs = markdownVersBlocs('# Actualités par axe\n\n## ① Marché — RAS\n\nUne phrase qui n’est pas en encadré, datée du 2 octobre 2026.')
    const r = contrôlerLesÉtiquettes({ blocs, dateÉdition: DATE_OCTOBRE, lot: [{ ...ÉTIQUETTES_OCTOBRE[0]!, axe: 1, rang: 1 }] })
    expect(codes(r.refus)).toEqual(['axe-ras'])
  })

  it('rend au modèle un message de reprise qui nomme chaque refus et sa cible', () => {
    const message = messageDeRefus(contrôler(avec(0, { date: '2026-10-22' })).refus)
    expect(message).toMatch(/^LE LOT N’EST PAS ACCEPTÉ/)
    expect(message).toContain('- [date-future] axe 1, fait 1 :')
  })
})

describe('les URL se comparent sous toutes leurs formes encodées', () => {
  const FORMES = [
    'https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2026/0138%28COD%29',
    'https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2026/0138(COD)',
    // La forme que l'API Notion rend dans `href` (constaté le 26 octobre 2026).
    'https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2026%2F0138(COD)',
    'oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2026%2F0138%28COD%29/',
  ]

  it('normaliserUrl ramène les quatre formes à une seule', () => {
    expect(new Set(FORMES.map(normaliserUrl)).size).toBe(1)
    // Une URL mal encodée ne fait pas tomber la porte.
    expect(normaliserUrl('https://exemple.fr/%E0%A4%A')).toBe('exemple.fr/%e0%a4%a')
  })

  it('accepte la source d’un fait quand Notion encode la barre oblique en %2F', () => {
    const blocs = JSON.parse(
      JSON.stringify(BLOCS_OCTOBRE).replaceAll('reference=2026/0138%28COD%29', 'reference=2026%2F0138(COD)'),
    ) as typeof BLOCS_OCTOBRE
    expect(JSON.stringify(blocs)).toContain('2026%2F0138(COD)')
    const r = contrôlerLesÉtiquettes({ blocs, dateÉdition: DATE_OCTOBRE, lot: ÉTIQUETTES_OCTOBRE })
    expect(r.refus).toEqual([])
    expect(r.acceptées).toHaveLength(11)
  })
})

describe('le validateur ne compte pas « Signaux de rupture » comme des faits', () => {
  it('une édition n°1 à quatre faits reste maigre, même avec trois lignes de rupture', () => {
    const corps = (rubrique: string) =>
      markdownVersBlocs(
        [
          '# L’essentiel',
          '- Un fait.',
          '# Actualités par axe',
          '## ① Marché — MOYEN',
          'Fait un. Source : [a](https://a.example).',
          'Fait deux.',
          'Fait trois.',
          'Fait quatre.',
          `# ${rubrique}`,
          'Ligne une.',
          'Ligne deux.',
          'Ligne trois.',
        ].join('\n\n'),
      )
    const maigre = (rubrique: string) =>
      contrôlerLaLettre({ titre: 'Veille — n°1', blocs: corps(rubrique), dossiersBruts: '', numéro: 1 }).avertissements.some((a) => a.code === 'lettre-maigre')
    expect(maigre('Signaux de rupture')).toBe(true)
    expect(maigre('Signaux des niches commerciales')).toBe(false)
  })
})

const GRILLE: Grille = {
  axesGroupes: [
    { clé: 'couches', libellé: 'Couches couvertes', crans: ['usage seul', 'cloud', 'cloud et datacenter', 'trois couches'] },
    { clé: 'production', libellé: 'Production publique', crans: ['aucune', 'occasionnelle', 'régulière'] },
  ],
  familles: [
    { numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire' },
    { numéro: 2, veille: 'ecosysteme', pestel: 'politique', cadence: 'hebdomadaire' },
    { numéro: 6, veille: 'ecosysteme', pestel: 'technologique', cadence: 'mensuelle' },
    { numéro: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire' },
    { numéro: 5, veille: 'concurrentiel', porter: 'nouveaux_entrants', cadence: 'hebdomadaire' },
  ],
  entités: [
    { nom: 'CISPE', veille: 'concurrentiel', siren: null },
    { nom: 'Hexatrust', veille: 'concurrentiel', siren: '810490052' },
    { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
  ],
  partiesPrenantes: ['DGE', 'Commission européenne', 'Assemblée nationale', 'Sénat', 'ANSSI', 'RTE', 'Cnam', 'France-IX'].map((nom) => ({ nom })),
}

describe('la porte de la grille', () => {
  it('accepte une grille bornée, et en déduit les trous du PESTEL et les forces non suivies', () => {
    expect(contrôlerLaGrille(GRILLE)).toEqual([])
    expect(trousDuPestel(GRILLE)).toEqual(['economique', 'socioculturel', 'ecologique'])
    expect(forcesNonSuivies(GRILLE)).toEqual(['substituts', 'pouvoir_clients', 'pouvoir_fournisseurs'])
  })

  it('refuse ce qui sort des bornes', () => {
    const refus = contrôlerLaGrille({
      ...GRILLE,
      axesGroupes: [{ clé: 'couches', libellé: 'Prix faible ou fort', crans: ['a', 'b'] }],
      familles: [{ numéro: 1, veille: 'ecosysteme', pestel: 'legal', porter: 'rivalite', cadence: 'quotidienne' as never }],
      entités: [{ nom: 'X', veille: 'concurrentiel', siren: '123' }],
      partiesPrenantes: [{ nom: 'Seule' }],
    })
    expect(new Set(codes(refus))).toEqual(
      new Set(['axes-hors-bornes', 'vocabulaire-interdit', 'crans-hors-bornes', 'famille-sans-cadre', 'cadence-inconnue', 'siren-invalide', 'parties-prenantes-hors-bornes']),
    )
  })

  it('la même grille, réordonnée, a la même empreinte', () => {
    const réordonnée: Grille = { ...GRILLE, familles: [...GRILLE.familles].reverse(), partiesPrenantes: [...GRILLE.partiesPrenantes].reverse() }
    expect(empreinteDeLaGrille(réordonnée)).toBe(empreinteDeLaGrille(GRILLE))
    expect(empreinteDeLaGrille({ ...GRILLE, offres: ['Colloque'] })).not.toBe(empreinteDeLaGrille(GRILLE))
  })

  it('le libellé d’une famille est facultatif, borné comme les autres, et n’entre dans l’empreinte que s’il est posé', () => {
    const [première, ...autres] = GRILLE.familles
    const nommée = (libellé: string | null): Grille => ({ ...GRILLE, familles: [{ ...première!, libellé }, ...autres] })
    // Une grille postée avant le libellé garde son empreinte : pas de version en plus.
    expect(empreinteDeLaGrille(nommée(null))).toBe(empreinteDeLaGrille(GRILLE))
    expect(empreinteDeLaGrille(nommée('Technologies et substituts'))).not.toBe(empreinteDeLaGrille(GRILLE))
    expect(contrôlerLaGrille(nommée('Technologies et substituts'))).toEqual([])
    expect(codes(contrôlerLaGrille(nommée('Un libellé de famille bien trop long pour la grille')))).toEqual(['libellé-hors-bornes'])
    expect(codes(contrôlerLaGrille(nommée('Signal fort')))).toEqual(['vocabulaire-interdit'])
  })
})

describe('la porte de la synthèse', () => {
  const faits = new Map([
    ['f-cispe', { date: '2026-10-20', entite: 'CISPE' }],
    ['f-loi', { date: '2026-10-14', entite: null }],
    ['f-hexa', { date: '2026-10-07', entite: 'Hexatrust' }],
    ['f-cigref', { date: '2026-10-15', entite: 'Cigref' }],
    ['f-ancien', { date: '2026-09-02', entite: 'Hexatrust' }],
  ])
  const contexte: ContexteDeSynthèse = {
    faits,
    fenêtre: { début: '2026-10-01', fin: '2026-10-31' },
    grille: GRILLE,
    grilleVersion: 1,
    élémentsPrécédents: new Map([['prec-o1', 'opportunites']]),
    positionsPrécédentes: new Map([['groupes:hexatrust:couches', 2]]),
  }
  const élément = (id: string, c: 'forces' | 'faiblesses' | 'opportunites' | 'menaces', énoncé: string) => ({
    id, case: c, énoncé, état: 'nouveau' as const, origine: 'faits' as const, hypothèse: false, faits: ['f-loi'],
  })
  const SYNTHÈSE: SynthèseProposée = {
    mode: 'mensuel',
    grilleVersion: 1,
    pestel: [
      { lettre: 'politique', énoncé: 'Les rapporteurs du règlement cloud reçoivent CISPE et ses membres, pas les opérateurs de couches basses.', faits: ['f-cispe'] },
      { lettre: 'economique', énoncé: null, faits: [] },
      { lettre: 'socioculturel', énoncé: null, faits: [] },
      { lettre: 'technologique', énoncé: null, faits: [] },
      { lettre: 'ecologique', énoncé: null, faits: [] },
      { lettre: 'legal', énoncé: 'La loi de résilience attend sa séance depuis le 14 octobre 2026.', faits: ['f-loi'] },
    ],
    swot: [
      élément('S1', 'forces', 'Seul collectif des trois couches physiques, face à CISPE et Hexatrust.'),
      élément('W1', 'faiblesses', 'Aucune publication propre depuis avril 2024.'),
      élément('O1', 'opportunites', 'La loi de résilience peut encore nommer les points d’échange avant le 17 novembre.'),
      élément('T1', 'menaces', 'CISPE occupe le mot souveraineté sur le cloud depuis le 20 octobre 2026.'),
    ],
    casesInsuffisantes: ['forces', 'faiblesses', 'opportunites', 'menaces'],
    tows: [
      { type: 'SO', énoncé: 'Porter aux rapporteurs, avant le 27 octobre, la seule voix des trois couches.', éléments: ['S1', 'O1'], candidate: true },
      { type: 'WT', énoncé: 'Publier une position datée avant que CISPE ne fixe seul les termes du débat.', éléments: ['W1', 'T1'], candidate: false },
    ],
    positions: [{ outil: 'groupes', sujet: 'Hexatrust', axe: 'couches', cran: 3, faits: ['f-hexa'] }],
  }

  it('accepte une synthèse sourcée, et signale sans refuser un énoncé sans nom ni chiffre', () => {
    const r = contrôlerLaSynthèse(SYNTHÈSE, contexte)
    expect(r.refus).toEqual([])
    const vague = contrôlerLaSynthèse({ ...SYNTHÈSE, swot: [...SYNTHÈSE.swot.slice(0, 3), élément('T1', 'menaces', 'La concurrence se renforce sur le marché.')] }, contexte)
    expect(vague.refus).toEqual([])
    expect(codes(vague.avertissements)).toContain('spécificité')
  })

  it.each<[string, Partial<SynthèseProposée>]>([
    ['grille-périmée', { grilleVersion: 2 }],
    ['pestel-incomplet', { pestel: SYNTHÈSE.pestel.slice(1) }],
    ['trou-avec-faits', { pestel: SYNTHÈSE.pestel.map((l) => (l.lettre === 'ecologique' ? { ...l, faits: ['f-loi'] } : l)) }],
    ['case-hors-bornes', { casesInsuffisantes: [] }],
    ['candidate-unique', { tows: SYNTHÈSE.tows.map((o) => ({ ...o, candidate: true })) }],
    ['tows-hors-bornes', { tows: SYNTHÈSE.tows.slice(0, 1) }],
    ['tows-sans-croisement', { tows: [SYNTHÈSE.tows[0]!, { ...SYNTHÈSE.tows[1]!, éléments: ['W1'] }] }],
    ['vocabulaire-interdit', { swot: [...SYNTHÈSE.swot.slice(0, 3), élément('T1', 'menaces', 'Un risque FAIBLE pour Hexatrust.')] }],
    ['fait-inconnu', { positions: [{ outil: 'groupes', sujet: 'Hexatrust', axe: 'couches', cran: 2, faits: ['f-autre-client'] }] }],
    ['position-hors-grille', { positions: [{ outil: 'groupes', sujet: 'Numeum', axe: 'couches', cran: 1, faits: ['f-loi'] }] }],
    ['cran-hors-bornes', { positions: [{ outil: 'groupes', sujet: 'Hexatrust', axe: 'production', cran: 4, faits: ['f-hexa'] }] }],
    ['mouvement-sans-fait', { positions: [{ outil: 'groupes', sujet: 'Hexatrust', axe: 'couches', cran: 3, faits: ['f-cispe'] }] }],
    ['mouvement-sans-fait', { positions: [{ outil: 'groupes', sujet: 'Hexatrust', axe: 'couches', cran: 3, faits: ['f-ancien'] }] }],
    ['hors-période', { positions: [{ outil: 'forces', sujet: 'rivalite', axe: 'intensite', cran: 2, tendance: 'hausse', faits: ['f-cispe'] }] }],
    ['déclaratif-hors-forces-faiblesses', { swot: [...SYNTHÈSE.swot.slice(0, 3), { ...élément('T1', 'menaces', 'CISPE gagne le 20 octobre.'), origine: 'declaratif', hypothèse: true, faits: [], référenceFiche: 'fiche §7' }] }],
    ['hypothèse-non-marquée', { swot: [{ ...élément('S1', 'forces', 'Les fondateurs signent pour Infralliance.'), origine: 'declaratif', hypothèse: false, faits: [], référenceFiche: 'fiche §7' }, ...SYNTHÈSE.swot.slice(1)] }],
    ['filiation-inconnue', { swot: [...SYNTHÈSE.swot.slice(0, 2), { ...élément('O1', 'opportunites', 'La loi de résilience peut nommer les points d’échange.'), état: 'renforce', filiation: 'prec-absent' }, SYNTHÈSE.swot[3]!] }],
    ['fait-hors-fenêtre', { swot: [...SYNTHÈSE.swot.slice(0, 2), { ...élément('O1', 'opportunites', 'Hexatrust ouvre son accélérateur 2027.'), état: 'renforce', filiation: 'prec-o1', faits: ['f-ancien'] }, SYNTHÈSE.swot[3]!] }],
  ])('refuse %s', (code, modif) => {
    expect(codes(contrôlerLaSynthèse({ ...SYNTHÈSE, ...modif }, contexte).refus)).toContain(code)
  })

  it('accepte un mouvement justifié par un fait de la fenêtre qui nomme l’entité, et un élément inchangé appuyé sur un fait ancien', () => {
    const r = contrôlerLaSynthèse(
      {
        ...SYNTHÈSE,
        swot: [...SYNTHÈSE.swot.slice(0, 2), { ...élément('O1', 'opportunites', 'Hexatrust reste seul sur les datacenters depuis le 2 septembre.'), état: 'inchange', filiation: 'prec-o1', faits: ['f-ancien'] }, SYNTHÈSE.swot[3]!],
      },
      contexte,
    )
    expect(r.refus).toEqual([])
  })

  it('au trimestre : les cinq forces, trois scénarios, et « non suivi » seulement pour une force sans famille', () => {
    const forces = (['rivalite', 'nouveaux_entrants', 'substituts', 'pouvoir_clients', 'pouvoir_fournisseurs'] as const).map((sujet) =>
      forcesNonSuivies(GRILLE).includes(sujet)
        ? { outil: 'forces' as const, sujet, axe: 'intensite', cran: null, nonSuivi: true, faits: [] }
        : { outil: 'forces' as const, sujet, axe: 'intensite', cran: 2, tendance: 'hausse' as const, faits: ['f-cispe'] },
    )
    const scénario = (n: number) => ({ titre: `Scénario ${n}`, énoncé: `La voix d’Infralliance pèse ${n} fois moins que celle de CISPE en 2027.`, indicateurs: [{ famille: 1, signal: 'loi de résilience en séance' }, { famille: 5, signal: 'création d’un collectif concurrent' }], faits: ['f-cispe'] })
    const trimestre: SynthèseProposée = { ...SYNTHÈSE, mode: 'trimestriel', positions: [...SYNTHÈSE.positions, ...forces], scénarios: [1, 2, 3].map(scénario) }
    expect(contrôlerLaSynthèse(trimestre, contexte).refus).toEqual([])

    const sansUneForce = { ...trimestre, positions: trimestre.positions.filter((p) => p.sujet !== 'rivalite') }
    expect(codes(contrôlerLaSynthèse(sansUneForce, contexte).refus)).toContain('forces-incomplètes')
    const rivalitéNonSuivie = { ...trimestre, positions: trimestre.positions.map((p) => (p.sujet === 'rivalite' ? { ...p, cran: null, nonSuivi: true } : p)) }
    expect(codes(contrôlerLaSynthèse(rivalitéNonSuivie, contexte).refus)).toContain('non-suivi-injustifié')
    expect(codes(contrôlerLaSynthèse({ ...trimestre, scénarios: [scénario(1)] }, contexte).refus)).toContain('scénarios-hors-bornes')
  })

  it('la matrice GE : une fois l’an (T4), au moins deux offres, chaque offre sur ses deux axes ; absente, elle est signalée', () => {
    const forces = (['rivalite', 'nouveaux_entrants', 'substituts', 'pouvoir_clients', 'pouvoir_fournisseurs'] as const).map((sujet) =>
      forcesNonSuivies(GRILLE).includes(sujet)
        ? { outil: 'forces' as const, sujet, axe: 'intensite', cran: null, nonSuivi: true, faits: [] }
        : { outil: 'forces' as const, sujet, axe: 'intensite', cran: 2, tendance: 'stable' as const, faits: ['f-cispe'] },
    )
    const scénarios = [1, 2, 3].map((n) => ({ titre: `Scénario ${n}`, énoncé: `CISPE fixe ${n} des termes du règlement en 2027.`, indicateurs: [{ famille: 1, signal: 'loi en séance' }, { famille: 5, signal: 'nouveau collectif' }], faits: ['f-cispe'] }))
    const grille: Grille = { ...GRILLE, offres: ['Colloque annuel', 'Notes de position'] }
    const annuel = { ...contexte, grille, revueAnnuelle: true }
    const ge = (sujet: string, axe: string, cran: number) => ({ outil: 'ge' as const, sujet, axe, cran, faits: ['f-loi'] })
    const complète = [ge('Colloque annuel', 'attractivite', 3), ge('Colloque annuel', 'atouts', 2), ge('Notes de position', 'attractivite', 2), ge('Notes de position', 'atouts', 1)]
    const trimestre: SynthèseProposée = { ...SYNTHÈSE, mode: 'trimestriel', positions: [...SYNTHÈSE.positions, ...forces, ...complète], scénarios }

    expect(contrôlerLaSynthèse(trimestre, annuel).refus).toEqual([])
    expect(codes(contrôlerLaSynthèse(trimestre, { ...annuel, revueAnnuelle: false }).refus)).toContain('hors-période')
    expect(codes(contrôlerLaSynthèse({ ...trimestre, positions: trimestre.positions.slice(0, -1) }, annuel).refus)).toEqual(['ge-incomplète'])
    expect(codes(contrôlerLaSynthèse({ ...trimestre, positions: [...trimestre.positions, ge('Formation', 'atouts', 1)] }, annuel).refus)).toContain('position-hors-grille')
    expect(codes(contrôlerLaSynthèse({ ...trimestre, positions: [...trimestre.positions.slice(0, -1), ge('Notes de position', 'prix', 1)] }, annuel).refus)).toContain('position-hors-grille')
    expect(codes(contrôlerLaSynthèse(trimestre, { ...annuel, grille: { ...grille, offres: ['Colloque annuel'] } }).refus)).toContain('ge-sans-offres')

    const sansGE = { ...trimestre, positions: trimestre.positions.filter((p) => p.outil !== 'ge') }
    const r = contrôlerLaSynthèse(sansGE, annuel)
    expect(r.refus).toEqual([])
    expect(codes(r.avertissements)).toContain('ge-absente')
    expect(codes(contrôlerLaSynthèse(sansGE, { ...annuel, revueAnnuelle: false }).avertissements)).not.toContain('ge-absente')
  })
})

describe('la lecture des étiquettes pour l’espace client', () => {
  const fait = (f: Partial<Parameters<typeof lectureDesÉtiquettes>[0][number]>) => ({
    pestel: null, porter: null, ansoff: null, entite: null, rupture: false, date: '2026-10-20', source: null, titre: 'Un fait.', ...f,
  })

  it('garde les six dimensions et les cinq forces dans l’ordre du cadre, zéro compris', () => {
    const l = lectureDesÉtiquettes([fait({ pestel: 'legal' }), fait({ pestel: 'legal' }), fait({ porter: 'substituts' })])
    expect(l.total).toBe(3)
    expect(l.pestel.map((d) => d.clé)).toEqual(['politique', 'economique', 'socioculturel', 'technologique', 'ecologique', 'legal'])
    expect(l.pestel.find((d) => d.clé === 'legal')?.faits).toBe(2)
    expect(l.pestel.find((d) => d.clé === 'politique')?.faits).toBe(0)
    expect(l.forces.map((f) => f.libellé)).toEqual(['Rivalité entre acteurs', 'Nouveaux entrants', 'Substituts', 'Pouvoir des clients', 'Pouvoir des fournisseurs'])
  })

  it('nomme les trois entités les plus citées par force, et compte les mouvements', () => {
    const l = lectureDesÉtiquettes([
      ...['CISPE', 'CISPE', 'InfraNum', 'Hexatrust', 'EuroStack'].map((entite) => fait({ porter: 'rivalite', entite, ansoff: 'penetration' })),
      fait({ porter: 'rivalite', entite: 'InfraNum', ansoff: 'developpement_produit' }),
    ])
    expect(l.forces[0]).toMatchObject({ faits: 6, entités: ['CISPE', 'InfraNum', 'EuroStack'] })
    expect(l.mouvements).toEqual([
      { libellé: 'pénétration', faits: 5 },
      { libellé: 'développement de produit', faits: 1 },
    ])
  })

  it('ne montre que les ruptures relues, de la plus récente à la plus ancienne', () => {
    const l = lectureDesÉtiquettes([
      fait({ pestel: 'economique', rupture: true, date: '2026-10-14', titre: 'Ancienne.' }),
      fait({ pestel: 'economique', rupture: true, date: '2026-10-20', titre: 'Récente.' }),
      fait({ pestel: 'economique', rupture: true, titre: null }),
      fait({ pestel: 'legal' }),
    ])
    expect(l.ruptures.map((r) => r.titre)).toEqual(['Récente.', 'Ancienne.'])
  })

  it('ne montre qu’une fois un événement que plusieurs lettres reprennent', () => {
    const budget = 'https://www.assemblee-nationale.fr/dyn/PAP%202027%20-%20Coh%C3%A9sion.pdf'
    const l = lectureDesÉtiquettes([
      fait({ rupture: true, date: '2026-10-01', source: budget, titre: 'Le document budgétaire, lu en entier pour la première fois.' }),
      fait({ rupture: true, date: '2026-10-01', source: 'http://assemblee-nationale.fr/dyn/PAP 2027 - Cohésion.pdf/', titre: 'Le document budgétaire, lu en entier.' }),
      fait({ rupture: true, date: '2026-07-13', source: null, titre: 'Fin du GIP.' }),
      fait({ rupture: true, date: '2026-07-13', source: null, titre: 'Fin du GIP.' }),
      fait({ rupture: true, date: '2026-07-13', source: null, titre: 'Trois mois après la fermeture du GIP.' }),
      fait({ rupture: true, date: '2026-09-30', source: budget, titre: 'Le même document, une autre date.' }),
    ])
    expect(l.ruptures.map((r) => r.titre)).toEqual([
      'Le document budgétaire, lu en entier pour la première fois.',
      'Le même document, une autre date.',
      'Fin du GIP.',
      'Trois mois après la fermeture du GIP.',
    ])
  })
})

