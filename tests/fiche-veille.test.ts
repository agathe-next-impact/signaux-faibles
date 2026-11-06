import { describe, expect, it } from 'vitest'
import {
  contrôlerLaFiche,
  messageDeRepriseDeLaFiche,
  prochaineÉchéance,
  rendreLaFiche,
  entitésDuCorpus,
  vueDeLAxePrésenté,
  vueDeLaPrésentation,
  vueDesSources,
  vueDesThèmes,
  vueDuCalendrier,
  type FicheDeVeille,
} from '@/lib/domaine/fiche-veille'
import type { Grille } from '@/lib/domaine/strategie'

/** La fiche de veille pour le lecteur (lot 6, 30 octobre 2026) : sa porte et ses vues. */

const GRILLE: Grille = {
  axesGroupes: [],
  familles: [
    { numéro: 1, veille: 'ecosysteme', pestel: 'politique', porter: null, cadence: 'hebdomadaire', libellé: 'Politiques publiques' },
    { numéro: 2, veille: 'ecosysteme', pestel: 'economique', porter: null, cadence: 'mensuelle' },
    { numéro: 1, veille: 'concurrentiel', pestel: null, porter: 'rivalite', cadence: 'hebdomadaire', libellé: 'Lieux concurrents' },
  ],
  entités: [],
  partiesPrenantes: [],
}

const FICHE: FicheDeVeille = {
  thèmes: [
    { veille: 'ecosysteme', numéro: 1, suit: 'Les dispositifs publics qui financent les tiers-lieux ruraux.', fort: 'Un financement ouvert, supprimé ou réduit qui vous concerne.' },
    { veille: 'concurrentiel', numéro: 1, suit: 'Les lieux de séminaires résidentiels de votre zone.', fort: 'Une ouverture ou une extension à moins de deux heures de Paris.' },
  ],
  sources: [
    { veille: 'ecosysteme', numéro: 1, nom: 'ANCT, Fabriques de territoire', site: 'https://agence-cohesion-territoires.gouv.fr' },
    { veille: 'ecosysteme', numéro: 1, nom: 'Légifrance', site: 'https://www.legifrance.gouv.fr' },
    { veille: 'concurrentiel', numéro: 1, nom: 'Sites des lieux suivis', site: null },
  ],
  niches: [{ énoncé: 'Les appels à projets des fondations privées pour le patrimoine rural.', signal: 'Un appel ouvert avec une date de dépôt.' }],
  échéances: [
    { date: '2026-11-19', libellé: 'Journée régionale des tiers-lieux à Roubaix', veille: null, numéro: null },
    { date: '2026-12-15', libellé: 'Vote du budget 2027', veille: 'ecosysteme', numéro: 1 },
    { date: '2026-10-01', libellé: 'Échéance passée', veille: null, numéro: null },
    { date: '2028-01-10', libellé: 'Au-delà des douze mois', veille: null, numéro: null },
  ],
}

const codes = (fiche: FicheDeVeille) => contrôlerLaFiche(fiche, GRILLE).map((r) => r.code)

describe('contrôlerLaFiche', () => {
  it('accepte une fiche aux bornes', () => {
    expect(contrôlerLaFiche(FICHE, GRILLE)).toEqual([])
  })

  it('refuse une famille absente de la grille, un thème en double et une fiche sans thème', () => {
    expect(codes({ ...FICHE, thèmes: [...FICHE.thèmes, { ...FICHE.thèmes[0]!, numéro: 9 }] })).toEqual(['famille-inconnue'])
    expect(codes({ ...FICHE, thèmes: [...FICHE.thèmes, FICHE.thèmes[0]!] })).toEqual(['thème-en-double'])
    expect(codes({ ...FICHE, thèmes: [] })).toEqual(['fiche-vide'])
    expect(codes({ ...FICHE, échéances: [{ date: '2026-11-19', libellé: 'Sans numéro', veille: 'ecosysteme', numéro: null }] })).toEqual(['famille-inconnue'])
  })

  it('tient les bornes de longueur, le vocabulaire et l’absence de note interne', () => {
    const long = 'x'.repeat(121)
    expect(codes({ ...FICHE, thèmes: [{ ...FICHE.thèmes[0]!, suit: long }] })).toEqual(['texte-hors-bornes'])
    expect(codes({ ...FICHE, échéances: [{ ...FICHE.échéances[0]!, libellé: 'x'.repeat(81) }] })).toEqual(['texte-hors-bornes'])
    expect(codes({ ...FICHE, thèmes: [{ ...FICHE.thèmes[0]!, fort: 'Un impact faible ne compte pas.' }] })).toEqual(['vocabulaire-interdit'])
    expect(codes({ ...FICHE, sources: [{ ...FICHE.sources[0]!, nom: 'Base payante, identifiant dans le coffre' }] })).toEqual(['note-interne'])
    expect(codes({ ...FICHE, niches: [{ énoncé: 'Point de validation à trancher avec le client.', signal: 'Réponse.' }] })).toEqual(['note-interne'])
  })

  it('une source n’a qu’un nom et une adresse de site public', () => {
    expect(codes({ ...FICHE, sources: [{ ...FICHE.sources[0]!, site: 'https://agathe:secret@exemple.fr' }] })).toEqual(['site-invalide'])
    expect(codes({ ...FICHE, sources: [{ ...FICHE.sources[0]!, site: 'javascript:alert(1)' }] })).toEqual(['site-invalide'])
    expect(codes({ ...FICHE, sources: [{ ...FICHE.sources[0]!, site: 'intranet' }] })).toEqual(['site-invalide'])
  })

  it('une échéance a une vraie date, et les listes ont un plafond', () => {
    expect(codes({ ...FICHE, échéances: [{ ...FICHE.échéances[0]!, date: '2026-02-30' }] })).toEqual(['date-invalide'])
    const niches = Array.from({ length: 13 }, (_, i) => ({ énoncé: `Niche ${i}.`, signal: 'Signal.' }))
    expect(codes({ ...FICHE, niches })).toEqual(['trop-de-lignes'])
  })

  it('le message de reprise nomme chaque refus et sa cible', () => {
    const refus = contrôlerLaFiche({ ...FICHE, thèmes: [{ ...FICHE.thèmes[0]!, suit: '' }] }, GRILLE)
    expect(messageDeRepriseDeLaFiche(refus)).toBe('[texte-hors-bornes] thèmes.0.suit : texte vide ou de plus de 120 caractères')
  })
})

describe('les vues des écrans « Votre veille »', () => {
  it('les thèmes : une case par famille de la grille, le texte de la fiche quand elle est publiée', () => {
    const thèmes = vueDesThèmes(GRILLE, FICHE)
    expect(thèmes.map((t) => [t.veille, t.numéro, t.nom, t.cadre, t.sources, t.segment])).toEqual([
      ['ecosysteme', 1, 'Politiques publiques', 'Politique', 2, 'politiques-publiques'],
      ['ecosysteme', 2, 'Famille 2', 'Économique', 0, 'famille-ecosysteme-2'],
      ['concurrentiel', 1, 'Lieux concurrents', 'Rivalité entre acteurs', 1, 'lieux-concurrents'],
    ])
    expect(thèmes[1]).toMatchObject({ suit: null, fort: null })
    expect(vueDesThèmes(GRILLE, null).every((t) => t.suit === null && t.sources === 0)).toBe(true)
  })

  it('les sources : rangées par famille, dans l’ordre de la grille, une famille sans source absente', () => {
    expect(vueDesSources(GRILLE, FICHE).map((f) => [f.nom, f.sources.length])).toEqual([
      ['Politiques publiques', 2],
      ['Lieux concurrents', 1],
    ])
  })

  it('le calendrier : douze mois à partir du mois courant, sans le passé ni l’au-delà', () => {
    const mois = vueDuCalendrier(GRILLE, FICHE, '2026-10-30')
    expect(mois).toHaveLength(12)
    expect(mois[0]).toMatchObject({ mois: '2026-10', libellé: 'oct. 2026', échéances: [] })
    expect(mois[1]?.échéances).toEqual([{ date: '2026-11-19', libellé: 'Journée régionale des tiers-lieux à Roubaix', famille: null }])
    expect(mois[2]?.échéances[0]?.famille).toBe('1 Politiques publiques')
    expect(mois.at(-1)?.mois).toBe('2027-09')
    expect(mois.flatMap((m) => m.échéances)).toHaveLength(2)
    expect(prochaineÉchéance(FICHE, '2026-10-30')).toEqual({ date: '2026-11-19', libellé: 'Journée régionale des tiers-lieux à Roubaix' })
    expect(prochaineÉchéance(FICHE, '2029-01-01')).toBeNull()
  })

  it('le texte de relecture dit l’état et reprend chaque ligne', () => {
    const texte = rendreLaFiche(FICHE, GRILLE, 'propose')
    expect(texte).toContain('proposée : rien n’est montré au client')
    expect(texte).toContain('- 1 Politiques publiques (ecosysteme) : Les dispositifs publics')
    expect(texte).toContain('- 2026-12-15 : Vote du budget 2027 (1 Politiques publiques)')
  })
})

describe('les fiches de présentation du référentiel (6 novembre 2026)', () => {
  const CORPUS: Grille = {
    ...GRILLE,
    axesGroupes: [
      { clé: 'gamme', libellé: 'Gamme', crans: ['accessible', 'intermédiaire', 'premium'] },
      { clé: 'capacite', libellé: 'Capacité', crans: ['petite', 'moyenne', 'grande'] },
    ],
    entités: [
      { nom: 'L’Hermitage', veille: 'concurrentiel', siren: null },
      { nom: 'Chartreuse de Neuville', veille: 'concurrentiel', siren: '123456789' },
      { nom: 'Région Hauts-de-France', veille: 'ecosysteme', siren: null },
    ],
    partiesPrenantes: [{ nom: 'Région Hauts-de-France' }, { nom: 'ANCT' }],
  }
  const PRÉSENTÉE: FicheDeVeille = {
    ...FICHE,
    présentations: [
      { nom: 'chartreuse de neuville', texte: 'Un monastère reconverti en lieu de séminaires, à une heure de Lille.' },
      { nom: 'ANCT', texte: 'L’agence qui finance les tiers-lieux.' },
    ],
  }
  const position = (sujet: string, outil: string, axe: string, cran: number, période: string, origine = 'faits') => ({
    outil,
    sujet,
    axe,
    cran,
    nonSuivi: false,
    tendance: null,
    faits: [],
    origine,
    période,
    référence: origine === 'declaratif' ? '§2, famille A' : null,
  })

  it('la porte : un nom de la grille, une seule fois, dans sa borne', () => {
    const c = (fiche: FicheDeVeille) => contrôlerLaFiche(fiche, CORPUS).map((r) => r.code)
    expect(c(PRÉSENTÉE)).toEqual([])
    expect(c({ ...FICHE, présentations: [{ nom: 'Inconnue', texte: 'Un nom inventé.' }] })).toEqual(['nom-inconnu'])
    expect(c({ ...FICHE, présentations: [PRÉSENTÉE.présentations![1]!, PRÉSENTÉE.présentations![1]!] })).toEqual(['présentation-en-double'])
    expect(c({ ...FICHE, présentations: [{ nom: 'ANCT', texte: 'x'.repeat(241) }] })).toEqual(['texte-hors-bornes'])
    expect(c({ ...FICHE, présentations: [{ nom: 'ANCT', texte: 'Un poids faible.' }] })).toEqual(['vocabulaire-interdit'])
    expect(rendreLaFiche(PRÉSENTÉE, CORPUS, 'propose')).toContain('PRÉSENTATIONS\n- chartreuse de neuville : Un monastère')
  })

  it('le corpus : concurrents, acteurs, puis parties prenantes qui ne sont pas déjà une entité ; jamais l’organisation', () => {
    expect(entitésDuCorpus(CORPUS, "L'Hermitage")).toEqual([
      { nom: 'Chartreuse de Neuville', sorte: 'concurrent' },
      { nom: 'Région Hauts-de-France', sorte: 'acteur' },
      { nom: 'ANCT', sorte: 'partie-prenante' },
    ])
  })

  it('la fiche d’une entité : sa présentation, ses derniers crans publiés, son pouvoir et son intérêt', () => {
    const positions = [
      position('Chartreuse de Neuville', 'groupes', 'gamme', 2, '2026-09', 'declaratif'),
      position('Chartreuse de Neuville', 'groupes', 'gamme', 3, '2026-10'),
      position('Chartreuse de Neuville', 'groupes', 'capacite', 1, '2026-10'),
      position('Région Hauts-de-France', 'mendelow', 'pouvoir', 3, '2026-10', 'declaratif'),
      position('Région Hauts-de-France', 'mendelow', 'interet', 2, '2026-10', 'declaratif'),
    ]
    const concurrent = vueDeLaPrésentation(CORPUS, PRÉSENTÉE, 'chartreuse-de-neuville', positions, "L'Hermitage")
    expect(concurrent).toMatchObject({
      nom: 'Chartreuse de Neuville',
      sorte: 'concurrent',
      siren: '123456789',
      présentation: 'Un monastère reconverti en lieu de séminaires, à une heure de Lille.',
      variables: { période: '2026-10', déclaratif: false, crans: [{ axe: 'Gamme', libellé: 'premium' }, { axe: 'Capacité', libellé: 'petite' }] },
      mendelow: null,
    })
    const région = vueDeLaPrésentation(CORPUS, PRÉSENTÉE, 'region-hauts-de-france', positions, "L'Hermitage")
    expect(région).toMatchObject({ sorte: 'acteur', partiePrenante: true, présentation: null, variables: null, mendelow: { pouvoir: 'élevé', intérêt: 'intermédiaire', déclaratif: true } })
    expect(vueDeLaPrésentation(CORPUS, null, 'anct', [], "L'Hermitage")).toMatchObject({ sorte: 'partie-prenante', présentation: null, mendelow: null })
    // Un segment inventé, ou l'organisation elle-même : pas de fiche.
    expect(vueDeLaPrésentation(CORPUS, PRÉSENTÉE, 'inconnue', positions, "L'Hermitage")).toBeNull()
    expect(vueDeLaPrésentation(CORPUS, PRÉSENTÉE, 'l-hermitage', positions, "L'Hermitage")).toBeNull()
  })

  it('la fiche d’un axe : ce qu’il suit, ses sources, ses échéances à venir', () => {
    const axe = vueDeLAxePrésenté(GRILLE, FICHE, 'politiques-publiques', '2026-11-01')
    expect(axe).toMatchObject({ numéro: 1, nom: 'Politiques publiques', cadre: 'Politique', veilleNommée: 'votre environnement', suit: FICHE.thèmes[0]!.suit })
    expect(axe?.sourcesNommées.map((s) => s.nom)).toEqual(['ANCT, Fabriques de territoire', 'Légifrance'])
    expect(axe?.échéances).toEqual([{ date: '2026-12-15', libellé: 'Vote du budget 2027' }])
    expect(vueDeLAxePrésenté(GRILLE, null, 'famille-ecosysteme-2', '2026-11-01')).toMatchObject({ suit: null, sourcesNommées: [], échéances: [] })
    expect(vueDeLAxePrésenté(GRILLE, FICHE, 'inconnu', '2026-11-01')).toBeNull()
  })
})
