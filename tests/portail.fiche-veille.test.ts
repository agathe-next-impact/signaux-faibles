import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * La fiche de veille (lot 6, 30 octobre 2026), sur une vraie base en mémoire :
 * le pilote et la grille avant la porte, la porte avant l'écriture, rien de
 * montré avant la publication, rien d'un autre registre.
 */
const { ficheDeLEspace, lireLaFicheDuPilote, publierLaFicheDuPilote, recevoirLaFiche } = await import('@/lib/portail/fiche-veille')
const { recevoirLaGrille, réglerLEspace } = await import('@/lib/portail/strategie')
const { réglerLesOutilsStratégiques } = await import('@/lib/base/strategie')

const REGISTRE = '1f2fe829ce71802a9c3bd1f4e8a7b6c5'
const AUTRE_REGISTRE = '2f2fe829ce71802a9c3bd1f4e8a7b6c5'
// La grille du test d'orchestration stratégique, le premier thème nommé.
const GRILLE = {
  axesGroupes: [
    { clé: 'couches', libellé: 'Couches couvertes', crans: ['usage seul', 'cloud', 'cloud et datacenter', 'trois couches'] },
    { clé: 'production', libellé: 'Production publique', crans: ['aucune', 'occasionnelle', 'régulière'] },
  ],
  familles: [
    { numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire', libellé: 'Règlements numériques' },
    { numéro: 2, veille: 'ecosysteme', pestel: 'economique', cadence: 'mensuelle' },
    { numéro: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire' },
  ],
  entités: [
    { nom: 'CISPE', veille: 'concurrentiel', siren: null },
    { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
  ],
  partiesPrenantes: ['DGE', 'Commission européenne', 'Assemblée nationale', 'Sénat', 'ANSSI', 'RTE', 'Cnam', 'France-IX'].map((nom) => ({ nom })),
} as const
const FICHE = {
  thèmes: [{ veille: 'ecosysteme' as const, numéro: 1, suit: 'Les règlements européens qui touchent le cloud.', fort: 'Un texte adopté qui change vos obligations.' }],
  sources: [{ veille: 'ecosysteme' as const, numéro: 1, nom: 'EUR-Lex', site: 'https://eur-lex.europa.eu' }],
  niches: [],
  échéances: [{ date: '2026-12-01', libellé: 'Entrée en application du règlement', veille: 'ecosysteme' as const, numéro: 1 }],
}

describe('la fiche de veille', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'infralliance', nom: 'Infralliance', registreNotion: REGISTRE }, db)
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await fermer()
  })

  it('hors du pilote, sans grille ou sur une grille périmée : rien d’écrit', async () => {
    expect(await recevoirLaFiche({ slug: 'inconnue', grilleVersion: 1, fiche: FICHE }, db)).toEqual({ sorte: 'organisation-inconnue' })
    expect(await recevoirLaFiche({ slug: 'infralliance', grilleVersion: 1, fiche: FICHE }, db)).toEqual({ sorte: 'hors-pilote' })
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    expect(await recevoirLaFiche({ slug: 'infralliance', grilleVersion: 1, fiche: FICHE }, db)).toEqual({ sorte: 'grille-absente' })
    expect(await recevoirLaGrille({ slug: 'infralliance', référentiel: '3d2fe829ce71801eae49fa7fc4a0e76c', grille: GRILLE }, db)).toMatchObject({ sorte: 'créée' })
    expect(await recevoirLaFiche({ slug: 'infralliance', grilleVersion: 2, fiche: FICHE }, db)).toEqual({ sorte: 'grille-périmée', attendue: 1 })
    expect(await lireLaFicheDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucune' })
  })

  it('la porte avant l’écriture ; une version proposée, publiée par l’opératrice, lue par les écrans', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
    vi.stubEnv('SOURCE_ACCES', 'double')
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    await recevoirLaGrille({ slug: 'infralliance', référentiel: '3d2fe829ce71801eae49fa7fc4a0e76c', grille: GRILLE }, db)

    const refusée = await recevoirLaFiche({ slug: 'infralliance', grilleVersion: 1, fiche: { ...FICHE, sources: [{ ...FICHE.sources[0]!, numéro: 7 }] } }, db)
    expect(refusée).toMatchObject({ sorte: 'refusée', refus: [{ code: 'famille-inconnue' }] })
    expect(await lireLaFicheDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucune' })

    const reçue = await recevoirLaFiche({ slug: 'infralliance', grilleVersion: 1, fiche: FICHE }, db)
    expect(reçue).toMatchObject({ sorte: 'enregistrée', version: 1 })
    if (reçue.sorte === 'enregistrée') expect(reçue.texte).toContain('- 1 Règlements numériques (ecosysteme) : Les règlements européens')
    expect(await lireLaFicheDuPilote({ slug: 'infralliance' }, db)).toMatchObject({ sorte: 'lue', version: 1, état: 'propose' })

    // L'espace réorganisé lit la grille, mais rien de la fiche avant sa publication.
    expect(await ficheDeLEspace({ registre: REGISTRE }, db)).toBeNull()
    expect(await réglerLEspace({ slug: 'infralliance', actif: true }, db)).toBe('réglé')
    expect(await ficheDeLEspace({ registre: REGISTRE }, db)).toMatchObject({ fiche: null, grille: { familles: GRILLE.familles } })

    expect(await publierLaFicheDuPilote({ slug: 'infralliance', état: 'publie' }, db)).toEqual({ sorte: 'réglée', version: 1, état: 'publie' })
    const lue = await ficheDeLEspace({ registre: REGISTRE }, db)
    expect(lue?.fiche?.thèmes).toHaveLength(1)
    expect(lue?.publiéeLe).toBeInstanceOf(Date)

    // Une nouvelle version reste proposée : la publiée continue d'être lue.
    await recevoirLaFiche({ slug: 'infralliance', grilleVersion: 1, fiche: { ...FICHE, niches: [{ énoncé: 'Les décisions de la CNIL.', signal: 'Une sanction publiée.' }] } }, db)
    expect((await ficheDeLEspace({ registre: REGISTRE }, db))?.fiche?.niches).toEqual([])
    // Retirer cache toute version publiée.
    expect(await publierLaFicheDuPilote({ slug: 'infralliance', état: 'retire' }, db)).toMatchObject({ sorte: 'réglée', version: 2 })
    expect((await ficheDeLEspace({ registre: REGISTRE }, db))?.fiche).toBeNull()

    // Rien pour un autre registre ; rien en mode notion.
    expect(await ficheDeLEspace({ registre: AUTRE_REGISTRE }, db)).toBeNull()
    vi.stubEnv('SOURCE_ACCES', 'notion')
    expect(await ficheDeLEspace({ registre: REGISTRE }, db)).toBeNull()
  })
})
