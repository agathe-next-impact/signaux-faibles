import { describe, expect, it } from 'vitest'
import {
  contrôlerLesSegments,
  empreinteDesSegments,
  empreinteDuPérimètre,
  faitsDuSegment,
  fenêtreDuTrimestre,
  lectureDuSegment,
  matriceDeDécision,
  mesurerLesSegments,
  montantCourt,
  niveauDe,
  tendanceEntre,
  vueDesMarchés,
  étatDuSegment,
  type ComptesDuSegment,
  type MesureDeSegment,
  type SegmentDeMarché,
} from '@/lib/domaine/marches'
import type { Grille } from '@/lib/domaine/strategie'

/**
 * Marchés et niches, le domaine pur : la porte des segments, l'assemblage d'une
 * mesure sans chiffre inventé, l'état calculé sur la suite des mesures.
 */
const GRILLE: Grille = {
  axesGroupes: [],
  familles: [
    { numéro: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire' },
    { numéro: 4, veille: 'ecosysteme', porter: 'pouvoir_clients', cadence: 'hebdomadaire' },
  ],
  entités: [
    { nom: 'Ricoh France', veille: 'concurrentiel', siren: '337621841' },
    { nom: 'Canon France', veille: 'concurrentiel', siren: '738205269' },
    { nom: 'UGAP', veille: 'ecosysteme', siren: null },
  ],
  partiesPrenantes: [],
}
const SOURCE = 'https://exemple.example/etude'
const SEGMENTS: SegmentDeMarché[] = [
  { clé: 'marche', libellé: 'Impression et documents', parent: null },
  {
    clé: 'impression',
    libellé: 'Parc d’impression',
    parent: 'marche',
    cibles: { sorte: 'registre', tranches: ['21', '22'], départements: ['69'] },
    offre: { naf: ['46.66Z'] },
    dépense: { basse: 1000, haute: 3000, source: SOURCE },
    entités: ['Ricoh France', 'Canon France'],
    présents: ['Ricoh France', 'Canon France'],
    familles: [{ veille: 'concurrentiel', numéro: 1 }],
  },
  { clé: 'sante', libellé: 'Accords-cadres hospitaliers', parent: 'impression', cibles: { sorte: 'declare', nombre: 135, source: SOURCE }, entités: ['UGAP'], familles: [{ veille: 'ecosysteme', numéro: 4 }] },
  { clé: 'reconditionne', libellé: 'Matériel reconditionné', parent: 'impression', présents: [] },
]
const compte = (nombre: number | null, plafonné = false) => ({ nombre, plafonné, source: nombre === null ? null : 'https://recherche-entreprises.api.gouv.fr/search?x' })
const COMPTES = new Map<string, ComptesDuSegment>([['impression', { cibles: compte(1200), offreurs: compte(340), entrées: null, sorties: null }]])
const FAITS = [
  { famille: 'Concurrentiel', axe: 1, entité: null, impact: 'FORT' },
  { famille: 'Écosystème', axe: 1, entité: null, impact: 'MOYEN' },
  { famille: 'Écosystème', axe: 4, entité: null, impact: 'MOYEN' },
  { famille: 'Écosystème', axe: 2, entité: 'ugap', impact: 'MOYEN' },
  { famille: null, axe: null, entité: 'Ricoh France', impact: 'MOYEN' },
]

describe('la porte des segments', () => {
  it('accepte un arbre à trois niveaux rattaché à la grille', () => {
    expect(contrôlerLesSegments(SEGMENTS, GRILLE)).toEqual([])
    expect(SEGMENTS.map((s) => niveauDe(s, SEGMENTS))).toEqual(['marche', 'offre', 'niche', 'niche'])
  })

  it('refuse deux racines, un parent inconnu, une boucle et un quatrième niveau', () => {
    const codes = (segments: SegmentDeMarché[]) => contrôlerLesSegments(segments, GRILLE).map((r) => r.code)
    expect(codes([])).toContain('segments-absents')
    expect(codes([...SEGMENTS, { clé: 'autre', libellé: 'Autre marché', parent: null }])).toContain('racine')
    expect(codes([...SEGMENTS, { clé: 'x', libellé: 'X', parent: 'absent' }])).toContain('parent-inconnu')
    expect(codes([{ clé: 'a', libellé: 'A', parent: 'b' }, { clé: 'b', libellé: 'B', parent: 'a' }])).toEqual(expect.arrayContaining(['racine', 'arbre-invalide']))
    expect(codes([...SEGMENTS, { clé: 'trop', libellé: 'Trop profond', parent: 'sante' }])).toContain('arbre-invalide')
    expect(codes([...SEGMENTS, { clé: 'impression', libellé: 'Doublon', parent: 'marche' }])).toContain('doublon')
    expect(codes([{ clé: 'Marché', libellé: 'Clé invalide', parent: null }])).toContain('clé-invalide')
  })

  it('refuse un libellé long ou au vocabulaire de l’impact, une entité et une famille hors de la grille', () => {
    const codes = (s: Partial<SegmentDeMarché>) => contrôlerLesSegments([SEGMENTS[0]!, { clé: 'x', libellé: 'X', parent: 'marche', ...s }], GRILLE).map((r) => r.code)
    expect(codes({ libellé: 'x'.repeat(41) })).toEqual(['libellé-hors-bornes'])
    expect(codes({ libellé: 'Marché à fort potentiel' })).toEqual(['vocabulaire-interdit'])
    expect(codes({ entités: ['Inconnue SA'] })).toEqual(['entité-hors-grille'])
    // Présent : un concurrent de la grille, pas une entité de l'écosystème.
    expect(codes({ présents: ['UGAP'] })).toEqual(['présent-hors-grille'])
    expect(codes({ présents: ['Ricoh France'] })).toEqual([])
    expect(codes({ familles: [{ veille: 'concurrentiel', numéro: 9 }] })).toEqual(['famille-inconnue'])
  })

  it('refuse un périmètre vide ou mal codé, une dépense sans fourchette ni source', () => {
    const codes = (s: Partial<SegmentDeMarché>) => contrôlerLesSegments([SEGMENTS[0]!, { clé: 'x', libellé: 'X', parent: 'marche', ...s }], GRILLE).map((r) => r.code)
    expect(codes({ cibles: { sorte: 'registre' } })).toEqual(['périmètre-vide'])
    expect(codes({ cibles: { sorte: 'registre', naf: ['6202A'] } })).toEqual(['code-invalide'])
    expect(codes({ cibles: { sorte: 'registre', tranches: ['99'] } })).toEqual(['code-invalide'])
    expect(codes({ cibles: { sorte: 'registre', départements: ['690'] } })).toEqual(['code-invalide'])
    expect(codes({ cibles: { sorte: 'declare', nombre: 1.5, source: 'http://sans-tls.example' } })).toEqual(['nombre-invalide', 'source-invalide'])
    expect(codes({ offre: { texte: 'impression' } })).toEqual(['périmètre-vide'])
    expect(codes({ offre: {} })).toEqual(['périmètre-vide'])
    expect(codes({ dépense: { basse: 3000, haute: 1000, source: SOURCE } })).toEqual(['dépense-invalide'])
    expect(codes({ dépense: { basse: 1, haute: 2, source: 'une étude' } })).toEqual(['source-invalide'])
  })

  it('l’empreinte ignore l’ordre, et celle du périmètre ne bouge qu’avec ce qui chiffre', () => {
    expect(empreinteDesSegments([...SEGMENTS].reverse())).toBe(empreinteDesSegments(SEGMENTS))
    const impression = SEGMENTS[1]!
    expect(empreinteDuPérimètre({ ...impression, libellé: 'Autre nom', entités: [] })).toBe(empreinteDuPérimètre(impression))
    expect(empreinteDuPérimètre({ ...impression, dépense: { basse: 1000, haute: 4000, source: SOURCE } })).not.toBe(empreinteDuPérimètre(impression))
    expect(empreinteDesSegments([...SEGMENTS.slice(0, 3)])).not.toBe(empreinteDesSegments(SEGMENTS))
  })
})

describe('la mesure d’un segment', () => {
  it('rattache les faits par famille ou par entité, sans confondre les deux veilles', () => {
    expect(faitsDuSegment(SEGMENTS[1]!, FAITS)).toHaveLength(2) // l'axe 1 concurrentiel, et le fait qui nomme Ricoh
    expect(faitsDuSegment(SEGMENTS[2]!, FAITS)).toHaveLength(2) // l'axe 4 écosystème, et le fait qui nomme l'UGAP
    expect(faitsDuSegment(SEGMENTS[3]!, FAITS)).toHaveLength(0)
    // Une lettre unique, sans famille d'édition : le numéro seul rattache.
    expect(faitsDuSegment(SEGMENTS[1]!, [{ famille: null, axe: 1, entité: null, impact: 'MOYEN' }])).toHaveLength(1)
  })

  it('multiplie les cibles par la dépense, et additionne les offres à la racine', () => {
    const mesures = mesurerLesSegments(SEGMENTS, { comptes: COMPTES, faits: FAITS, chiffres: [{ nom: 'Ricoh France', chiffreDAffaires: 500_000_000 }, { nom: 'Canon France', chiffreDAffaires: null }] })
    const [racine, impression, santé, reconditionné] = mesures
    expect(impression).toMatchObject({
      niveau: 'offre',
      cibles: 1200,
      ciblesOrigine: 'registre',
      potentiel: { bas: 1_200_000, haut: 3_600_000, origine: 'calcul' },
      offreurs: 340,
      présents: ['Ricoh France', 'Canon France'],
      chiffreDAffairesDesPrésents: 500_000_000,
      présentsAvecComptes: 1,
      faits: 2,
      faitsForts: 1,
    })
    expect(impression!.sources).toContain(SOURCE)
    expect(racine).toMatchObject({ niveau: 'marche', cibles: null, potentiel: { bas: 1_200_000, haut: 3_600_000, origine: 'somme' } })
    expect(racine!.limites.join(' ')).toContain('1 sur 1')
    // Des cibles déclarées sans dépense : un nombre, pas d'euros, et la limite le dit.
    expect(santé).toMatchObject({ niveau: 'niche', cibles: 135, ciblesOrigine: 'declare', potentiel: null })
    expect(santé!.limites.join(' ')).toContain('aucune hypothèse de dépense')
    expect(reconditionné).toMatchObject({ cibles: null, potentiel: null, faits: 0, présents: [] })
    // Présence non renseignée : ni présents, ni « ouvert ».
    expect(santé!.présents).toBeNull()
    // La racine sans rattachement propre porte toute l'activité de la veille.
    expect(racine!.faits).toBe(FAITS.length)
  })

  it('déduit la présence des concurrents des faits du segment, sans jamais conclure à une niche ouverte', () => {
    const segments: SegmentDeMarché[] = [SEGMENTS[0]!, SEGMENTS[1]!, { clé: 'sante', libellé: 'Accords-cadres hospitaliers', parent: 'impression', familles: [{ veille: 'ecosysteme', numéro: 4 }] }, { clé: 'vide', libellé: 'Sans fait', parent: 'impression' }]
    const faits = [
      { famille: 'Écosystème', axe: 4, entité: 'Canon France', impact: 'MOYEN' },
      { famille: 'Écosystème', axe: 4, entité: 'canon france', impact: 'FORT' },
      { famille: 'Écosystème', axe: 4, entité: 'Ricoh France', impact: 'MOYEN' },
      // Un acteur de l'écosystème n'est pas un concurrent : il ne dit rien de la présence.
      { famille: 'Écosystème', axe: 4, entité: 'UGAP', impact: 'MOYEN' },
    ]
    const mesures = mesurerLesSegments(segments, { comptes: new Map(), faits, chiffres: [{ nom: 'Canon France', chiffreDAffaires: 9 }], concurrents: ['Ricoh France', 'Canon France'] })
    const [, impression, santé, vide] = mesures
    // Posée avec le segment : elle fait foi, les faits n'y ajoutent rien.
    expect(impression).toMatchObject({ présents: ['Ricoh France', 'Canon France'], présentsOrigine: 'arbre' })
    expect(santé).toMatchObject({ présents: ['Canon France', 'Ricoh France'], présentsOrigine: 'faits', présentsAvecComptes: 1, chiffreDAffairesDesPrésents: 9 })
    expect(santé!.limites.join(' ')).toContain('Canon France (2), Ricoh France (1)')
    expect(vide).toMatchObject({ présents: null, présentsOrigine: null })
  })

  it('l’achat public : une dépense constatée à part du potentiel, et les titulaires reconnus par leur SIREN', () => {
    const cpv = { cpv: ['30232', '3012'] }
    const segments: SegmentDeMarché[] = [
      SEGMENTS[0]!,
      { ...SEGMENTS[1]!, marchésPublics: cpv },
      { clé: 'public', libellé: 'Achat public d’impression', parent: 'impression', marchésPublics: cpv, familles: [{ veille: 'ecosysteme', numéro: 4 }] },
      { clé: 'muet', libellé: 'Source muette', parent: 'impression', marchésPublics: { cpv: ['7231'] } },
      { clé: 'sans', libellé: 'Aucun titulaire suivi', parent: 'impression', marchésPublics: { cpv: ['4882'] }, familles: [{ veille: 'ecosysteme', numéro: 4 }] },
    ]
    const achats = {
      marchés: 334,
      montant: 123_295_034.91,
      titulaires: 124,
      écartés: 1,
      // Deux établissements de Ricoh déjà additionnés par la lecture ; un SIREN hors grille est ignoré.
      parSiren: [
        { siren: '738205269', marchés: 12, montant: 17_618_906.2 },
        { siren: '337621841', marchés: 49, montant: 23_538_254.3 },
        { siren: '999999999', marchés: 3, montant: 1 },
      ],
      du: '2025-11-13',
      au: '2026-11-13',
      source: 'https://data.economie.gouv.fr/explore/dataset/decp-2022-marches-valides/',
    }
    const vide = { ...achats, marchés: 4, montant: 80_000, titulaires: 3, écartés: 0, parSiren: [] }
    const nu = { cibles: null, offreurs: null, entrées: null, sorties: null }
    const mesures = mesurerLesSegments(segments, {
      comptes: new Map<string, ComptesDuSegment>([
        ['impression', { ...COMPTES.get('impression')!, achats }],
        ['public', { ...nu, achats }],
        ['muet', { ...nu, achats: null }],
        ['sans', { ...nu, achats: vide }],
      ]),
      faits: [{ famille: 'Écosystème', axe: 4, entité: 'Canon France', impact: 'MOYEN' }],
      chiffres: [],
      concurrents: ['Ricoh France', 'Canon France'],
      sirens: [
        { nom: 'Ricoh France', siren: '337621841' },
        { nom: 'Canon France', siren: '738205269' },
      ],
      // Le SIREN hors des concurrents est ici celui de l'organisation : sa part, jamais une présence.
      sirenDeLOrganisation: '999999999',
    })
    const [racine, impression, pub, muet, sans] = mesures
    // La présence posée avec le segment fait foi ; l'achat public s'y ajoute sans toucher au potentiel.
    expect(impression).toMatchObject({ présentsOrigine: 'arbre', potentiel: { bas: 1_200_000, haut: 3_600_000 }, achatPublic: { montant: 123_295_035, marchés: 334, titulaires: 124 } })
    expect(pub).toMatchObject({ présents: ['Ricoh France', 'Canon France'], présentsOrigine: 'marches', potentiel: null })
    expect(pub!.achatPublic!.concurrents).toEqual([
      { nom: 'Ricoh France', marchés: 49, montant: 23_538_254.3 },
      { nom: 'Canon France', marchés: 12, montant: 17_618_906.2 },
    ])
    expect(pub!.achatPublic!.organisation).toEqual({ marchés: 3, montant: 1 })
    expect(sans!.achatPublic!.organisation).toEqual({ marchés: 0, montant: 0 })
    expect(pub!.limites.join(' ')).toContain('1 marché(s) de 100 M€ ou plus écarté(s)')
    expect(pub!.limites.join(' ')).toContain('3012, 30232')
    expect(pub!.sources).toContain(achats.source)
    // Source muette : n.d., dit, sans chiffre ni présence.
    expect(muet).toMatchObject({ achatPublic: null, présents: null })
    expect(muet!.limites.join(' ')).toContain('Achat public n.d.')
    // Aucun concurrent titulaire : les faits reprennent la main, jamais « ouverte ».
    expect(sans).toMatchObject({ présents: ['Canon France'], présentsOrigine: 'faits', achatPublic: { marchés: 4, concurrents: [] } })
    // Un segment sans code CPV ne porte pas le champ.
    expect(racine).not.toHaveProperty('achatPublic')
  })

  it('les codes CPV passent la porte, et n’entrent dans l’empreinte que s’ils existent', () => {
    const avec = (cpv: string[]): SegmentDeMarché[] => [SEGMENTS[0]!, { ...SEGMENTS[1]!, marchésPublics: { cpv } }]
    expect(contrôlerLesSegments(avec(['3012', '30232000']), GRILLE)).toEqual([])
    expect(contrôlerLesSegments(avec([]), GRILLE).map((r) => r.code)).toEqual(['périmètre-vide'])
    expect(contrôlerLesSegments(avec(['301', "3012' or 1=1"]), GRILLE).map((r) => r.code)).toEqual(['code-invalide', 'code-invalide'])
    expect(contrôlerLesSegments(avec(Array.from({ length: 11 }, (_, i) => String(3000 + i))), GRILLE).map((r) => r.code)).toEqual(['périmètre-hors-bornes'])
    const impression = SEGMENTS[1]!
    expect(empreinteDuPérimètre({ ...impression, marchésPublics: null })).toBe(empreinteDuPérimètre(impression))
    expect(empreinteDuPérimètre({ ...impression, marchésPublics: { cpv: ['3012'] } })).not.toBe(empreinteDuPérimètre(impression))
    expect(empreinteDuPérimètre({ ...impression, marchésPublics: { cpv: ['30232', '3012'] } })).toBe(empreinteDuPérimètre({ ...impression, marchésPublics: { cpv: ['3012', '30232'] } }))
  })

  it('un périmètre découpé par tranche : un nombre, son potentiel, et la limite écrite', () => {
    const découpé = { nombre: 23_500, plafonné: false, source: 'https://recherche-entreprises.api.gouv.fr/search?x', découpé: true }
    const [, impression] = mesurerLesSegments(SEGMENTS, { comptes: new Map([['impression', { cibles: découpé, offreurs: { ...découpé, plafonné: true }, entrées: null, sorties: null }]]), faits: [], chiffres: [] })
    expect(impression).toMatchObject({ cibles: 23_500, ciblesPlafonnées: false, potentiel: { bas: 23_500_000, haut: 70_500_000 }, offreursPlafonnés: true })
    const limites = impression!.limites.join(' ')
    expect(limites).toContain('Cibles : compté tranche d’effectif par tranche')
    expect(limites).toContain('Offreurs : une tranche dépasse encore le plafond')
  })

  it('n’invente aucun chiffre : registre muet ou plafonné, pas de potentiel', () => {
    const avec = (cibles: ReturnType<typeof compte>) =>
      mesurerLesSegments(SEGMENTS, { comptes: new Map([['impression', { cibles, offreurs: null, entrées: null, sorties: null }]]), faits: [], chiffres: [] })[1]!
    const muet = avec(compte(null))
    expect(muet).toMatchObject({ cibles: null, potentiel: null })
    expect(muet.limites.join(' ')).toContain('n’a pas répondu')
    const plafonné = avec(compte(10_000, true))
    expect(plafonné).toMatchObject({ cibles: 10_000, ciblesPlafonnées: true, potentiel: null })
    expect(plafonné.limites.join(' ')).toContain('ne compte pas au-delà')
    // Et la racine reste sans potentiel : aucune offre n'est chiffrée.
    expect(mesurerLesSegments(SEGMENTS, { comptes: new Map(), faits: [], chiffres: [] })[0]!.potentiel).toBeNull()
  })
})

describe('l’état d’un segment', () => {
  const m = (plus: Partial<MesureDeSegment>): MesureDeSegment => ({
    clé: 'x',
    libellé: 'X',
    parent: 'marche',
    niveau: 'offre',
    périmètre: 'aaaaaaaa',
    cibles: 1000,
    ciblesPlafonnées: false,
    ciblesOrigine: 'registre',
    potentiel: null,
    offreurs: null,
    offreursPlafonnés: false,
    entrées: null,
    sorties: null,
    présents: null,
    chiffreDAffairesDesPrésents: null,
    présentsAvecComptes: 0,
    faits: 4,
    faitsForts: 0,
    sources: [],
    limites: [],
    ...plus,
  })

  it('une seule mesure : apparu, sans tendance', () => {
    expect(étatDuSegment([m({})])).toEqual({ état: 'apparu', tendance: null, modifié: false })
  })

  it('la taille d’abord, au seuil de cinq pour cent ; l’activité départage', () => {
    expect(tendanceEntre(m({}), m({ cibles: 1040 }))).toBe('stable')
    expect(tendanceEntre(m({}), m({ cibles: 1050 }))).toBe('hausse')
    expect(tendanceEntre(m({}), m({ cibles: 940 }))).toBe('baisse')
    expect(tendanceEntre(m({}), m({ faits: 5 }))).toBe('stable') // un fait d'écart
    expect(tendanceEntre(m({}), m({ faits: 6 }))).toBe('hausse')
    expect(tendanceEntre(m({ faits: 10 }), m({ faits: 8 }))).toBe('stable') // moins d'un quart
    expect(tendanceEntre(m({ cibles: null, faits: 0 }), m({ cibles: null, faits: 3 }))).toBe('hausse')
    // Le potentiel prime sur les cibles quand il existe.
    expect(tendanceEntre(m({ potentiel: { bas: 1, haut: 100, origine: 'calcul' } }), m({ cibles: 2000, potentiel: { bas: 1, haut: 90, origine: 'calcul' } }))).toBe('baisse')
  })

  it('croissance sur une hausse, régression sur deux baisses de suite seulement', () => {
    expect(étatDuSegment([m({}), m({ cibles: 1100 })])).toMatchObject({ état: 'en_croissance', tendance: 'hausse' })
    expect(étatDuSegment([m({}), m({ cibles: 900 })])).toMatchObject({ état: 'stable', tendance: 'baisse' })
    expect(étatDuSegment([m({}), m({ cibles: 900 }), m({ cibles: 800 })])).toMatchObject({ état: 'en_regression', tendance: 'baisse' })
    expect(étatDuSegment([m({}), m({ cibles: 1100 }), m({ cibles: 1000 })])).toMatchObject({ état: 'stable', tendance: 'baisse' })
  })

  it('éteint : ni fait ni cible sur deux trimestres ; modifié : le périmètre a changé, rien n’est comparé', () => {
    expect(étatDuSegment([m({ cibles: null, faits: 0 }), m({ cibles: null, faits: 0 })])).toMatchObject({ état: 'eteint' })
    expect(étatDuSegment([m({ cibles: null, faits: 3 }), m({ cibles: null, faits: 0 })])).toMatchObject({ état: 'stable', tendance: 'baisse' })
    expect(étatDuSegment([m({}), m({ périmètre: 'bbbbbbbb', cibles: 5000 })])).toEqual({ état: 'stable', tendance: null, modifié: true })
  })

  it('la vue : l’ordre de l’arbre, les segments ouverts, les disparus', () => {
    const avant = mesurerLesSegments(SEGMENTS, { comptes: COMPTES, faits: FAITS, chiffres: [] })
    const sans = SEGMENTS.filter((s) => s.clé !== 'sante')
    const après = mesurerLesSegments(sans, { comptes: new Map([['impression', { cibles: compte(1400), offreurs: compte(340), entrées: 12, sorties: 3 }]]), faits: FAITS, chiffres: [] })
    expect(vueDesMarchés([])).toBeNull()
    const vue = vueDesMarchés([
      { période: '2026-T3', mesures: avant },
      { période: '2026-T4', mesures: [...après].reverse() },
    ])!
    expect(vue.période).toBe('2026-T4')
    expect(vue.lignes.map((l) => l.clé)).toEqual(['marche', 'impression', 'reconditionne'])
    expect(vue.lignes[1]).toMatchObject({ état: 'en_croissance', tendance: 'hausse', ouverte: false, entrées: 12, sorties: 3 })
    expect(vue.lignes[2]).toMatchObject({ ouverte: true })
    expect(vue.disparus).toEqual([{ clé: 'sante', libellé: 'Accords-cadres hospitaliers', niveau: 'niche' }])
    expect(vue.comptes).toEqual({ segments: 3, chiffrés: 2, ouverts: 1 })
    // Une seule période : tout est une première mesure.
    expect(vueDesMarchés([{ période: '2026-T3', mesures: avant }])!.lignes.every((l) => l.état === 'apparu')).toBe(true)
  })

  it('le verdict : activité et concurrence croisées, par règle, et la situation en une phrase', () => {
    const l = (plus: Partial<MesureDeSegment>, état: 'apparu' | 'en_regression' | 'eteint' = 'apparu') => ({ ...m(plus), état, tendance: null, modifié: false, ouverte: false })
    expect(lectureDuSegment(l({ faits: 16, faitsForts: 3, présents: ['A', 'B', 'C'] }))).toEqual({
      verdict: 'pousser',
      raison: 'Activité soutenue ce trimestre (16 faits, dont 3 signaux forts) et peu de concurrence : 3 concurrents suivis y sont présents.',
    })
    expect(lectureDuSegment(l({ faits: 10, présents: [] }))).toEqual({ verdict: 'pousser', raison: 'Activité soutenue ce trimestre (10 faits) et peu de concurrence : aucun concurrent suivi n’y est présent.' })
    expect(lectureDuSegment(l({ faits: 10, présents: ['A', 'B', 'C', 'D'] }))).toEqual({
      verdict: 'disputer',
      raison: 'Activité soutenue ce trimestre (10 faits) sur un segment disputé : 4 concurrents suivis y sont présents.',
    })
    expect(lectureDuSegment(l({ faits: 9, faitsForts: 1, présents: ['A'] }))).toEqual({
      verdict: 'surveiller',
      raison: 'Peu d’activité ce trimestre (9 faits, dont 1 signal fort) et peu de concurrence : 1 concurrent suivi y est présent.',
    })
    expect(lectureDuSegment(l({ faits: 9, présents: ['A', 'B', 'C', 'D'] })).verdict).toBe('ecarter')
    expect(lectureDuSegment(l({ faits: 0, présents: ['A'] })).raison).toBe('Aucun fait relevé par la veille ce trimestre et peu de concurrence : 1 concurrent suivi y est présent.')
    // Une concurrence non mesurée ne conclut jamais mieux que « à surveiller ».
    expect(lectureDuSegment(l({ faits: 30, présents: null }))).toEqual({ verdict: 'surveiller', raison: 'Activité soutenue ce trimestre (30 faits) ; la concurrence n’y est pas encore mesurée.' })
    // Un segment en recul ou éteint est écarté quelle que soit sa case.
    expect(lectureDuSegment(l({ faits: 30, présents: [] }, 'en_regression'))).toMatchObject({ verdict: 'ecarter', raison: expect.stringMatching(/^En recul depuis deux trimestres\. Activité soutenue/) })
    expect(lectureDuSegment(l({ faits: 30, présents: null }, 'en_regression')).verdict).toBe('ecarter')
    expect(lectureDuSegment(l({ faits: 0, cibles: null }, 'eteint'))).toEqual({ verdict: 'ecarter', raison: 'Le segment s’est éteint : ni fait ni cible depuis deux trimestres.' })
  })

  it('le nom des cibles : borné par la porte, porté par la mesure, dans l’empreinte seulement s’il existe', () => {
    const avec = (libellé: string) => SEGMENTS.map((s) => (s.clé === 'impression' && s.cibles?.sorte === 'registre' ? { ...s, cibles: { ...s.cibles, libellé } } : s))
    expect(contrôlerLesSegments(avec('entreprises de 250 salariés et plus'), GRILLE)).toEqual([])
    expect(contrôlerLesSegments(avec('x'.repeat(61)), GRILLE).map((r) => r.code)).toEqual(['libellé-invalide'])
    expect(contrôlerLesSegments(avec('entreprises à fort potentiel'), GRILLE).map((r) => r.code)).toEqual(['vocabulaire-interdit'])
    expect(empreinteDesSegments(avec('entreprises'))).not.toBe(empreinteDesSegments(SEGMENTS))
    const mesures = mesurerLesSegments(avec('entreprises de 250 salariés et plus'), { comptes: COMPTES, faits: FAITS, chiffres: [] })
    expect(mesures.find((x) => x.clé === 'impression')?.ciblesLibellé).toBe('entreprises de 250 salariés et plus')
    expect(mesurerLesSegments(SEGMENTS, { comptes: COMPTES, faits: FAITS, chiffres: [] }).find((x) => x.clé === 'impression')?.ciblesLibellé).toBeNull()
  })

  it('la matrice : quatre cases dans l’ordre, le marché entier à part, le plus actif d’abord', () => {
    const l = (plus: Partial<MesureDeSegment>) => ({ ...m(plus), état: 'apparu' as const, tendance: null, modifié: false, ouverte: false })
    const matrice = matriceDeDécision([
      l({ clé: 'marche', niveau: 'marche', parent: null, faits: 80 }),
      l({ clé: 'a', faits: 12, présents: ['A'] }),
      l({ clé: 'b', niveau: 'niche', faits: 20, présents: [] }),
      l({ clé: 'c', faits: 2, présents: null }),
    ])
    expect(matrice.cases.map((c) => [c.verdict, c.segments.map((x) => x.clé)])).toEqual([
      ['pousser', ['b', 'a']],
      ['disputer', []],
      ['surveiller', ['c']],
      ['ecarter', []],
    ])
    expect(matrice.faitsMax).toBe(20)
  })

  it('les bornes d’un trimestre et un montant lisible', () => {
    expect(fenêtreDuTrimestre('2026-T4')).toEqual({ début: '2026-10-01', fin: '2026-12-31' })
    expect(fenêtreDuTrimestre('2026-T1')).toEqual({ début: '2026-01-01', fin: '2026-03-31' })
    expect(fenêtreDuTrimestre('2026-11')).toBeNull()
    expect(montantCourt(1_250_000)).toBe('1,3 M€')
    expect(montantCourt(340_000)).toBe('340 k€')
    expect(montantCourt(2_400_000_000)).toBe('2,4 Md€')
    expect(montantCourt(950)).toBe('950 €')
  })
})
