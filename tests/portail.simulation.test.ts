import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import { faitsÉtiquetés, organisations } from '@/lib/base/schema'
import type { SegmentDeMarché } from '@/lib/domaine/marches'
import { jouerLaPartie, type TableDEffets } from '@/lib/domaine/simulation'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * La simulation, sur une vraie base en mémoire : le pilote, la grille et
 * l'arbre avant la porte, la porte avant l'écriture, une table jamais publiée
 * d'office, rien de montré au client avant la publication, rien d'un autre
 * registre, et une table que l'arbre a dépassée n'est pas jouée.
 */
const { lireLaTableDuPilote, publierLaTableDuPilote, recevoirLaTableDEffets, simulationDeLEspace, tableauDesSimulations } = await import('@/lib/portail/simulation')
const { mesurerLesMarchésDuPilote, publierLesMarchésDuPilote, recevoirLesSegments } = await import('@/lib/portail/marches')
const { espaceDeLOrganisation, recevoirLaGrille, réglerLEspace } = await import('@/lib/portail/strategie')
const { réglerLesOutilsStratégiques } = await import('@/lib/base/strategie')
const { ongletsDe } = await import('@/lib/portail/semaine')

const REGISTRE = '1f2fe829ce71802a9c3bd1f4e8a7b6c5'
const AUTRE_REGISTRE = '2f2fe829ce71802a9c3bd1f4e8a7b6c5'
const GRILLE = {
  axesGroupes: [
    { clé: 'couches', libellé: 'Couches couvertes', crans: ['usage seul', 'cloud', 'cloud et datacenter', 'trois couches'] },
    { clé: 'production', libellé: 'Production publique', crans: ['aucune', 'occasionnelle', 'régulière'] },
  ],
  familles: [
    { numéro: 1, veille: 'ecosysteme', pestel: 'legal', cadence: 'hebdomadaire' },
    { numéro: 1, veille: 'concurrentiel', porter: 'rivalite', cadence: 'hebdomadaire' },
    { numéro: 2, veille: 'ecosysteme', pestel: 'economique', cadence: 'hebdomadaire' },
  ],
  entités: [
    { nom: 'CISPE', veille: 'concurrentiel', siren: null },
    { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
  ],
  partiesPrenantes: ['DGE', 'Commission européenne', 'Assemblée nationale', 'Sénat', 'ANSSI', 'RTE', 'Cnam', 'France-IX'].map((nom) => ({ nom })),
} as const
const SEGMENTS: SegmentDeMarché[] = [
  { clé: 'marche', libellé: 'Hébergement de données', parent: null },
  { clé: 'colocation', libellé: 'Colocation', parent: 'marche', entités: ['Cigref'], présents: ['Cigref'], familles: [{ veille: 'concurrentiel', numéro: 1 }] },
  { clé: 'souverain', libellé: 'Cloud qualifié', parent: 'colocation', présents: [], familles: [{ veille: 'ecosysteme', numéro: 1 }] },
]
const TABLE: TableDEffets = {
  engagements: [
    { segment: 'colocation', cran: 2, référence: 'fiche de veille, niches' },
    { segment: 'souverain', cran: 0, référence: 'référentiel §2' },
  ],
  actions: [
    { clé: 'tester-souverain', libellé: 'Tester une offre qualifiée', geste: 'tester', segment: 'souverain', coût: 2, effets: { marche: 3 }, référence: 'mesure 2026-T4' },
    { clé: 'allier-anssi', libellé: 'Travailler avec l’ANSSI', geste: 'allier', partiePrenante: 'ANSSI', coût: 2, effets: { alliances: 6 }, référence: 'fiche de veille, sources' },
  ],
  cartes: [
    { clé: 'texte', libellé: 'Un texte durcit le cadre', famille: 1, veille: 'ecosysteme', effets: { environnement: -4 }, référence: 'famille 1, écosystème' },
    { clé: 'rival', libellé: 'Un rival bouge', famille: 1, veille: 'concurrentiel', effets: { concurrence: -3 }, référence: 'famille 1, concurrentiel' },
    { clé: 'prix', libellé: 'Les prix de l’énergie montent', famille: 2, effets: { marche: -2 }, référence: 'famille 2' },
    { clé: 'rupture', libellé: 'Une rupture', rupture: true, effets: { marche: -6 }, référence: 'faits marqués en rupture' },
  ],
}

const registres = (async (entrée: string | URL | Request) => (String(entrée).includes('recherche-entreprises') ? Response.json({ total_results: 100 }) : Response.json({ total_count: 3 }))) as typeof fetch
const dépendances = { f: registres, maintenant: () => Date.parse('2026-11-12T08:00:00Z'), attente: () => Promise.resolve() }

describe('la simulation', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'infralliance', nom: 'Infralliance', registreNotion: REGISTRE }, db)
    await ouvrirEnEssai({ slug: 'autre', nom: 'Autre', registreNotion: AUTRE_REGISTRE }, db)
    vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
    vi.stubEnv('SOURCE_ACCES', 'double')
    // La publication automatique est en service : la table d'effets, elle, n'est jamais publiée d'office.
    vi.stubEnv('PUBLICATION_AUTOMATIQUE', 'oui')
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await fermer()
  })

  async function ouvrir() {
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    expect(await recevoirLaGrille({ slug: 'infralliance', référentiel: '3d2fe829ce71801eae49fa7fc4a0e76c', grille: GRILLE }, db)).toMatchObject({ sorte: 'créée' })
    await réglerLEspace({ slug: 'infralliance', actif: true }, db)
  }

  /** Treize semaines de lettres, du 24 août au 16 novembre 2026 : la famille 1 de l'écosystème chaque semaine, le rival une semaine sur deux. */
  async function poserDesFaits(semaines = 13) {
    const [organisation] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.slug, 'infralliance'))
    const lignes: (typeof faitsÉtiquetés.$inferInsert)[] = []
    for (let i = 0; i < semaines; i++) {
      const jour = new Date(Date.UTC(2026, 10, 16) - i * 7 * 86_400_000).toISOString().slice(0, 10)
      const commun = { organisationId: organisation!.id, dateÉdition: jour, dateFait: jour, section: 'axe' as const, empreinteTitre: '0123abcd', rupture: false, impact: 'MOYEN' as const, nouveauté: 'nouveau' as const }
      lignes.push({ ...commun, éditionNotion: `e${String(i).padStart(31, '0')}`, familleÉdition: 'Écosystème', numéroAxe: 1, rang: 1, sourceUrl: `https://journal.example/texte-${i}`, pestel: 'legal', impact: i === 0 ? 'FORT' : 'MOYEN' })
      if (i % 2 === 0) lignes.push({ ...commun, éditionNotion: `c${String(i).padStart(31, '0')}`, familleÉdition: 'Concurrentiel', numéroAxe: 1, rang: 1, sourceUrl: `https://presse.example/rival-${i}`, forcePorter: 'rivalite', rupture: i === 4 })
    }
    await db.insert(faitsÉtiquetés).values(lignes)
  }

  it('hors du pilote, sans grille ou sans arbre : rien d’écrit', async () => {
    expect(await recevoirLaTableDEffets({ slug: 'inconnue', table: TABLE }, db)).toEqual({ sorte: 'organisation-inconnue' })
    expect(await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)).toEqual({ sorte: 'hors-pilote' })
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    expect(await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)).toEqual({ sorte: 'grille-absente' })
    await ouvrir()
    expect(await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)).toEqual({ sorte: 'arbre-absent' })
    expect(await lireLaTableDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucune' })
    expect(await tableauDesSimulations(db)).toEqual([])
  })

  it('la porte avant l’écriture ; la même table ne crée pas de version', async () => {
    await ouvrir()
    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)
    const refusée = await recevoirLaTableDEffets({ slug: 'infralliance', table: { ...TABLE, actions: [{ ...TABLE.actions[0]!, segment: 'croisieres', effets: { marche: 30 } }, TABLE.actions[1]!] } }, db)
    expect(refusée).toMatchObject({ sorte: 'refusée' })
    if (refusée.sorte === 'refusée') {
      expect(refusée.refus.map((r) => r.code).sort()).toEqual(['effet-hors-bornes', 'segment-inconnu'])
      expect(refusée.message).toContain('action 1')
    }
    // La famille 1 existe dans les deux veilles : une carte qui ne dit pas la sienne est refusée.
    expect(await recevoirLaTableDEffets({ slug: 'infralliance', table: { ...TABLE, cartes: [{ ...TABLE.cartes[0]!, veille: null }] } }, db)).toMatchObject({ sorte: 'refusée', refus: [{ code: 'famille-ambiguë' }] })
    expect(await lireLaTableDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucune' })

    expect(await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)).toEqual({ sorte: 'créée', version: 1, actions: 2, cartes: 4, engagements: 2 })
    expect(await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)).toMatchObject({ sorte: 'inchangée', version: 1 })
    expect(await lireLaTableDuPilote({ slug: 'infralliance' }, db)).toMatchObject({ sorte: 'lue', versions: [{ version: 1, état: 'propose' }], refus: [] })
  })

  it('jamais publiée d’office ; le client ne la joue qu’une fois publiée, l’opératrice la relit avant', async () => {
    await ouvrir()
    await poserDesFaits()
    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)
    expect(await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, dépendances)).toMatchObject({ sorte: 'enregistrées' })
    await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)
    const lecture = { registre: REGISTRE, fin: '2026-11-16' }

    // Proposée : rien pour le client, le rail ne montre pas l'écran ; l'opératrice la joue sous un bandeau.
    expect(await simulationDeLEspace(lecture, db)).toBeNull()
    expect((await espaceDeLOrganisation(REGISTRE, db))?.simulation).toEqual({ publiée: false, proposée: true })
    const aperçu = await simulationDeLEspace({ ...lecture, aperçu: true }, db)
    expect(aperçu).toMatchObject({ sorte: 'jouable', version: 1, nonPublié: true, période: '2026-T4' })
    expect(await simulationDeLEspace({ registre: AUTRE_REGISTRE, fin: '2026-11-16', aperçu: true }, db)).toBeNull()

    expect(await publierLaTableDuPilote({ slug: 'infralliance', version: 3, état: 'publie' }, db)).toEqual({ sorte: 'aucune' })
    expect(await publierLaTableDuPilote({ slug: 'infralliance', version: 1, état: 'publie' }, db)).toEqual({ sorte: 'réglée', version: 1, état: 'publie' })
    expect((await espaceDeLOrganisation(REGISTRE + '', db))?.simulation?.publiée).toBe(true)

    const jouée = await simulationDeLEspace(lecture, db)
    expect(jouée?.sorte).toBe('jouable')
    if (jouée?.sorte !== 'jouable') return
    expect(jouée.nonPublié).toBe(false)
    const { donnée } = jouée
    // L'état de départ vient des mesures publiées et des comptes de la veille, jamais de la table.
    expect(donnée.segments.map((s) => s.clé)).toEqual(['marche', 'colocation', 'souverain'])
    expect(donnée.segments.find((s) => s.clé === 'colocation')?.concurrents).toBe(1)
    expect(donnée.segments.find((s) => s.clé === 'colocation')?.verdict).not.toBeNull()
    expect(donnée.historique).toBe(13)
    expect(donnée.observations).toEqual([
      { clé: 'texte', semaines: 13, faits: 13, dernier: { date: '2026-11-16', source: 'https://journal.example/texte-0', édition: `e${'0'.repeat(31)}` } },
      { clé: 'rival', semaines: 7, faits: 7, dernier: { date: '2026-11-16', source: 'https://presse.example/rival-0', édition: `c${'0'.repeat(31)}` } },
      { clé: 'prix', semaines: 0, faits: 0, dernier: null },
      { clé: 'rupture', semaines: 1, faits: 1, dernier: { date: '2026-10-19', source: 'https://presse.example/rival-4', édition: `c${'4'.padStart(31, '0')}` } },
    ])
    // Une seule dimension PESTEL porte un fait fort ; aucune force publiée : départ neutre.
    expect(donnée.départ.valeurs.environnement).toBe(83)
    expect(donnée.départ.valeurs.concurrence).toBe(50)
    // La donnée se joue telle quelle, et deux lectures donnent la même partie.
    const partie = { graine: 20261116, tours: [['tester-souverain', 'allier-anssi'], [], [], []] }
    const autre = await simulationDeLEspace(lecture, db)
    expect(autre?.sorte === 'jouable' && JSON.stringify(jouerLaPartie(autre.donnée, partie))).toBe(JSON.stringify(jouerLaPartie(donnée, partie)))
    expect(jouerLaPartie(donnée, partie).état.alliances).toEqual(['ANSSI'])

    // Une nouvelle version reste proposée ; la publier retire la précédente.
    const v2: TableDEffets = { ...TABLE, actions: [TABLE.actions[0]!] }
    expect(await recevoirLaTableDEffets({ slug: 'infralliance', table: v2 }, db)).toMatchObject({ sorte: 'créée', version: 2 })
    expect(await simulationDeLEspace(lecture, db)).toMatchObject({ version: 1 })
    expect(await simulationDeLEspace({ ...lecture, aperçu: true }, db)).toMatchObject({ version: 2, nonPublié: true })
    expect(await tableauDesSimulations(db)).toMatchObject([{ slug: 'infralliance', versions: [{ version: 2, état: 'propose' }, { version: 1, état: 'publie' }] }])
    await publierLaTableDuPilote({ slug: 'infralliance', version: 2, état: 'publie' }, db)
    expect(await lireLaTableDuPilote({ slug: 'infralliance' }, db)).toMatchObject({ versions: [{ version: 2, état: 'publie' }, { version: 1, état: 'retire' }] })
    expect(await simulationDeLEspace(lecture, db)).toMatchObject({ version: 2, nonPublié: false })

    // Retirée : l'écran se ferme pour le client, et une version retirée ne revient pas par l'aperçu.
    await publierLaTableDuPilote({ slug: 'infralliance', version: 2, état: 'retire' }, db)
    expect(await simulationDeLEspace(lecture, db)).toBeNull()
    expect(await simulationDeLEspace({ ...lecture, aperçu: true }, db)).toBeNull()
    expect((await lireLaTableDuPilote({ slug: 'infralliance' }, db)).sorte).toBe('lue')

    // Rien hors de l'espace réorganisé, rien en mode notion.
    await publierLaTableDuPilote({ slug: 'infralliance', version: 2, état: 'publie' }, db)
    await réglerLEspace({ slug: 'infralliance', actif: false }, db)
    expect(await simulationDeLEspace(lecture, db)).toBeNull()
    await réglerLEspace({ slug: 'infralliance', actif: true }, db)
    vi.stubEnv('SOURCE_ACCES', 'notion')
    expect(await simulationDeLEspace(lecture, db)).toBeNull()
  })

  it('sous douze semaines d’historique, aucune carte n’entre dans le tirage', async () => {
    await ouvrir()
    await poserDesFaits(8)
    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)
    await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)
    await publierLaTableDuPilote({ slug: 'infralliance', version: 1, état: 'publie' }, db)
    const jouée = await simulationDeLEspace({ registre: REGISTRE, fin: '2026-11-16' }, db)
    expect(jouée?.sorte).toBe('jouable')
    if (jouée?.sorte !== 'jouable') return
    expect(jouée.donnée.historique).toBe(8)
    // Sans mesure publiée : aucun verdict, aucune concurrence, rien n'est deviné.
    expect(jouée.période).toBeNull()
    expect(jouée.donnée.segments.every((s) => s.verdict === null && s.concurrents === null)).toBe(true)
    expect(jouerLaPartie(jouée.donnée, { graine: 5, tours: [[], [], [], []] }).bilans.every((b) => b.cartes.length === 0)).toBe(true)
  })

  it('une table que l’arbre a dépassée n’est ni jouée ni publiée', async () => {
    await ouvrir()
    await poserDesFaits()
    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)
    await recevoirLaTableDEffets({ slug: 'infralliance', table: TABLE }, db)
    await publierLaTableDuPilote({ slug: 'infralliance', version: 1, état: 'publie' }, db)
    // La niche quitte l'arbre : la table la nomme encore.
    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS.slice(0, 2) }, db)
    const lue = await simulationDeLEspace({ registre: REGISTRE, fin: '2026-11-16' }, db)
    expect(lue).toMatchObject({ sorte: 'périmée', version: 1 })
    expect(lue?.sorte === 'périmée' && lue.refus.every((r) => r.code === 'segment-inconnu')).toBe(true)
    expect(await lireLaTableDuPilote({ slug: 'infralliance' }, db)).toMatchObject({ sorte: 'lue', refus: [{ code: 'segment-inconnu' }, { code: 'segment-inconnu' }] })
    await publierLaTableDuPilote({ slug: 'infralliance', version: 1, état: 'retire' }, db)
    expect(await publierLaTableDuPilote({ slug: 'infralliance', version: 1, état: 'publie' }, db)).toMatchObject({ sorte: 'refusée' })
  })

  it('le rail ne montre « Simulation » que si on le lui dit', () => {
    const comptes = { lettres: 1, recommandations: 1, archives: 1 }
    const sans = ongletsDe('client', comptes, 'complète', { réorganisé: true })
    const avec = ongletsDe('client', comptes, 'complète', { réorganisé: true, simulation: true })
    expect(sans.some((o) => o.href === '/client/simulation')).toBe(false)
    expect(avec.find((o) => o.href === '/client/simulation')).toMatchObject({ libellé: 'Simulation', rubrique: 'Stratégie' })
    expect(avec).toHaveLength(sans.length + 1)
    expect(ongletsDe('client', comptes, 'essentiel', { réorganisé: true, simulation: true })).toHaveLength(2)
  })
})
