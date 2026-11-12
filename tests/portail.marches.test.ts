import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import { faitsÉtiquetés, organisations } from '@/lib/base/schema'
import type { SegmentDeMarché } from '@/lib/domaine/marches'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * Marchés et niches, sur une vraie base en mémoire : le pilote et la grille
 * avant la porte, la porte avant l'écriture, des mesures calculées par le
 * portail sur des registres simulés, rien de montré avant la publication, rien
 * d'un autre registre.
 */
const { lireLesMarchésDuPilote, marchésDeLEspace, mesurerLesMarchésDuPilote, mesurerÀLaSuite, publierLesMarchésDuPilote, recevoirLesSegments, tableauDesMarchés } = await import('@/lib/portail/marches')
const { recevoirLaGrille, réglerLEspace } = await import('@/lib/portail/strategie')
const { réglerLesOutilsStratégiques } = await import('@/lib/base/strategie')

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
  ],
  entités: [
    { nom: 'CISPE', veille: 'concurrentiel', siren: null },
    { nom: 'Cigref', veille: 'concurrentiel', siren: '310785985' },
  ],
  partiesPrenantes: ['DGE', 'Commission européenne', 'Assemblée nationale', 'Sénat', 'ANSSI', 'RTE', 'Cnam', 'France-IX'].map((nom) => ({ nom })),
} as const
const SOURCE = 'https://exemple.example/etude'
const SEGMENTS: SegmentDeMarché[] = [
  { clé: 'marche', libellé: 'Hébergement de données', parent: null },
  {
    clé: 'colocation',
    libellé: 'Colocation',
    parent: 'marche',
    cibles: { sorte: 'registre', naf: ['63.11Z'], départements: ['75'] },
    offre: { naf: ['63.11Z'], départements: ['75'], texte: 'hébergement' },
    dépense: { basse: 10_000, haute: 20_000, source: SOURCE },
    entités: ['Cigref'],
    présents: ['Cigref'],
    familles: [{ veille: 'concurrentiel', numéro: 1 }],
  },
  { clé: 'souverain', libellé: 'Cloud qualifié', parent: 'colocation', présents: [], familles: [{ veille: 'ecosysteme', numéro: 1 }] },
]

/** Les deux registres, simulés : le nombre rendu dépend de la requête, et chaque appel est noté. */
function registres(cibles: number) {
  const appels: string[] = []
  const f = (async (entrée: string | URL | Request) => {
    const url = String(entrée)
    appels.push(url)
    if (url.includes('recherche-entreprises')) return Response.json({ total_results: cibles })
    return Response.json({ total_count: url.includes('collective') ? 2 : 9 })
  }) as typeof fetch
  return { f, appels }
}
const sansAttente = { attente: () => Promise.resolve() }

describe('marchés et niches', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'infralliance', nom: 'Infralliance', registreNotion: REGISTRE }, db)
    await ouvrirEnEssai({ slug: 'autre', nom: 'Autre', registreNotion: AUTRE_REGISTRE }, db)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await fermer()
  })

  async function ouvrirLePilote() {
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    expect(await recevoirLaGrille({ slug: 'infralliance', référentiel: '3d2fe829ce71801eae49fa7fc4a0e76c', grille: GRILLE }, db)).toMatchObject({ sorte: 'créée' })
  }

  async function poserDesFaits() {
    const [organisation] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.slug, 'infralliance'))
    const fait = (rang: number, plus: Partial<typeof faitsÉtiquetés.$inferInsert>) => ({
      organisationId: organisation!.id,
      éditionNotion: 'a'.repeat(32),
      familleÉdition: 'concurrentiel',
      dateÉdition: '2026-10-21',
      section: 'axe' as const,
      numéroAxe: 1,
      rang,
      empreinteTitre: '0123abcd',
      dateFait: '2026-10-20',
      sourceUrl: 'https://exemple.example/fait',
      forcePorter: 'rivalite' as const,
      rupture: false,
      impact: 'MOYEN' as const,
      nouveauté: 'nouveau' as const,
      ...plus,
    })
    await db.insert(faitsÉtiquetés).values([
      fait(1, { impact: 'FORT' }),
      fait(2, {}),
      // Hors du trimestre : ne compte pas.
      fait(3, { éditionNotion: 'b'.repeat(32), dateÉdition: '2026-09-23', dateFait: '2026-09-22' }),
      // L'autre veille, même numéro d'axe : compte pour la niche, pas pour l'offre.
      fait(4, { éditionNotion: 'c'.repeat(32), familleÉdition: 'ecosysteme', forcePorter: null, pestel: 'legal' }),
    ])
  }

  it('hors du pilote ou sans grille : rien d’écrit, rien de compté', async () => {
    const { f, appels } = registres(100)
    expect(await recevoirLesSegments({ slug: 'inconnue', segments: SEGMENTS }, db)).toEqual({ sorte: 'organisation-inconnue' })
    expect(await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)).toEqual({ sorte: 'hors-pilote' })
    expect(await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f })).toEqual({ sorte: 'hors-pilote' })
    await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    expect(await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)).toEqual({ sorte: 'grille-absente' })
    expect(await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f })).toEqual({ sorte: 'segments-absents' })
    expect(await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-11' }, db, { f })).toEqual({ sorte: 'période-invalide' })
    expect(await lireLesMarchésDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucun' })
    expect(appels).toEqual([])
  })

  it('la porte avant l’écriture ; la même liste ne crée pas de version', async () => {
    await ouvrirLePilote()
    const refusée = await recevoirLesSegments({ slug: 'infralliance', segments: [...SEGMENTS, { clé: 'x', libellé: 'X', parent: 'marche', entités: ['Inconnue'] }] }, db)
    expect(refusée).toMatchObject({ sorte: 'refusée', refus: [{ code: 'entité-hors-grille' }] })
    if (refusée.sorte === 'refusée') expect(refusée.message).toContain('[entité-hors-grille]')
    expect(await lireLesMarchésDuPilote({ slug: 'infralliance' }, db)).toEqual({ sorte: 'aucun' })

    expect(await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)).toEqual({ sorte: 'créée', version: 1, segments: 3 })
    expect(await recevoirLesSegments({ slug: 'infralliance', segments: [...SEGMENTS].reverse() }, db)).toEqual({ sorte: 'inchangée', version: 1, segments: 3 })
    expect(await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS.slice(0, 2) }, db)).toEqual({ sorte: 'créée', version: 2, segments: 2 })
    expect(await lireLesMarchésDuPilote({ slug: 'infralliance' }, db)).toMatchObject({ sorte: 'lus', version: 2, grilleVersion: 1, périodes: [], vue: null })
  })

  it('mesure un trimestre sur les registres, propose, puis publie ; l’écran ne lit que le publié', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://base-en-memoire')
    vi.stubEnv('SOURCE_ACCES', 'double')
    await ouvrirLePilote()
    await poserDesFaits()
    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)
    await réglerLEspace({ slug: 'infralliance', actif: true }, db)

    const { f, appels } = registres(120)
    const maintenant = () => Date.parse('2026-11-12T08:00:00Z')
    const mesuré = await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f, maintenant, ...sansAttente })
    expect(mesuré).toMatchObject({ sorte: 'enregistrées', période: '2026-T4', version: 1, mesures: 3, archivées: 0 })
    if (mesuré.sorte !== 'enregistrées') return
    // Cibles et offreurs partagent ici leur périmètre : un seul compte au registre ; deux au BODACC (entrées, procédures).
    expect(appels.filter((u) => u.includes('recherche-entreprises'))).toHaveLength(1)
    expect(appels.filter((u) => u.includes('bodacc'))).toHaveLength(2)
    expect(appels[0]).toContain('activite_principale=63.11Z')
    expect(appels[0]).toContain('etat_administratif=A')
    // Le trimestre est en cours : les douze mois du BODACC finissent aujourd'hui, pas le 31 décembre.
    expect(decodeURIComponent(appels[2]!).replaceAll('+', ' ')).toContain("dateparution < date'2026-11-13'")

    const [marché, colocation, souverain] = mesuré.vue!.lignes
    expect(colocation).toMatchObject({
      clé: 'colocation',
      cibles: 120,
      potentiel: { bas: 1_200_000, haut: 2_400_000, origine: 'calcul' },
      offreurs: 120,
      entrées: 9,
      sorties: 2,
      présents: ['Cigref'],
      faits: 2,
      faitsForts: 1,
      état: 'apparu',
      ouverte: false,
    })
    expect(marché).toMatchObject({ niveau: 'marche', potentiel: { bas: 1_200_000, haut: 2_400_000, origine: 'somme' } })
    expect(souverain).toMatchObject({ niveau: 'niche', cibles: null, potentiel: null, faits: 1, ouverte: true })

    // Proposées : la relecture les voit, l'écran non.
    expect(await lireLesMarchésDuPilote({ slug: 'infralliance' }, db)).toMatchObject({ sorte: 'lus', périodes: [{ période: '2026-T4', état: 'propose', mesures: 3 }] })
    expect(await marchésDeLEspace({ registre: REGISTRE }, db)).toBeNull()
    // L'aperçu de l'opératrice les lit, et dit qu'elles ne sont pas publiées.
    expect(await marchésDeLEspace({ registre: REGISTRE, aperçu: true }, db)).toMatchObject({ période: '2026-T4', nonPublié: true })
    expect(await marchésDeLEspace({ registre: AUTRE_REGISTRE, aperçu: true }, db)).toBeNull()

    // Un recalcul archive et remplace, tant que rien n'est publié.
    expect(await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f, maintenant, ...sansAttente })).toMatchObject({ sorte: 'enregistrées', mesures: 3, archivées: 3 })

    expect(await publierLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T3', état: 'publie' }, db)).toEqual({ sorte: 'aucune' })
    expect(await publierLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4', état: 'publie' }, db)).toEqual({ sorte: 'réglée', période: '2026-T4', état: 'publie', mesures: 3 })
    const vue = await marchésDeLEspace({ registre: REGISTRE }, db)
    expect(vue?.lignes.map((l) => l.clé)).toEqual(['marche', 'colocation', 'souverain'])
    expect(vue?.comptes).toEqual({ segments: 3, chiffrés: 2, ouverts: 1 })
    expect(vue?.nonPublié).toBe(false)
    expect(await marchésDeLEspace({ registre: REGISTRE, aperçu: true }, db)).toMatchObject({ période: '2026-T4', nonPublié: false })

    // Publiée : un recalcul est refusé, ce que le client lit ne change pas sous ses yeux.
    expect(await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f, maintenant, ...sansAttente })).toEqual({ sorte: 'période-publiée' })

    // Le trimestre suivant, les cibles ont grandi : l'état se déduit de la suite, sur les seules mesures publiées.
    const suite = registres(150)
    const après = () => Date.parse('2027-02-10T08:00:00Z')
    expect(await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2027-T1' }, db, { f: suite.f, maintenant: après, ...sansAttente })).toMatchObject({ sorte: 'enregistrées' })
    expect((await marchésDeLEspace({ registre: REGISTRE }, db))?.période).toBe('2026-T4')
    await publierLesMarchésDuPilote({ slug: 'infralliance', période: '2027-T1', état: 'publie' }, db)
    const suivante = await marchésDeLEspace({ registre: REGISTRE }, db)
    expect(suivante?.période).toBe('2027-T1')
    expect(suivante?.lignes.find((l) => l.clé === 'colocation')).toMatchObject({ cibles: 150, état: 'en_croissance', tendance: 'hausse' })

    // Retirée : l'écran revient au dernier trimestre publié.
    await publierLesMarchésDuPilote({ slug: 'infralliance', période: '2027-T1', état: 'retire' }, db)
    expect((await marchésDeLEspace({ registre: REGISTRE }, db))?.période).toBe('2026-T4')
    // Une période retirée ne revient pas par l'aperçu.
    expect((await marchésDeLEspace({ registre: REGISTRE, aperçu: true }, db))?.période).toBe('2026-T4')

    // Rien pour un autre registre, rien hors de l'espace réorganisé, rien en mode notion.
    expect(await marchésDeLEspace({ registre: AUTRE_REGISTRE }, db)).toBeNull()
    await réglerLEspace({ slug: 'infralliance', actif: false }, db)
    expect(await marchésDeLEspace({ registre: REGISTRE }, db)).toBeNull()
    await réglerLEspace({ slug: 'infralliance', actif: true }, db)
    vi.stubEnv('SOURCE_ACCES', 'notion')
    expect(await marchésDeLEspace({ registre: REGISTRE }, db)).toBeNull()
  })

  it('mesure à la suite d’un dépôt le trimestre en cours, sans jamais lever ; le tableau de l’opératrice compte par période', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { f } = registres(120)
    const maintenant = () => Date.parse('2026-11-12T08:00:00Z')
    // Sans pilote ni arbre : rien de mesuré, rien de levé.
    expect(await mesurerÀLaSuite({ slug: 'infralliance' }, db, { f, maintenant, ...sansAttente })).toBe('hors-pilote')
    await ouvrirLePilote()
    expect(await mesurerÀLaSuite({ slug: 'infralliance' }, db, { f, maintenant, ...sansAttente })).toBe('segments-absents')
    expect(await tableauDesMarchés(db)).toEqual([])

    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)
    // Le trimestre est celui du jour de Paris ; une période donnée (la synthèse d'un trimestre) passe telle quelle.
    expect(await mesurerÀLaSuite({ slug: 'infralliance' }, db, { f, maintenant, ...sansAttente })).toBe('enregistrées')
    expect(await mesurerÀLaSuite({ slug: 'infralliance', période: '2026-T3' }, db, { f, maintenant, ...sansAttente })).toBe('enregistrées')
    await publierLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T3', état: 'publie' }, db)
    expect(await tableauDesMarchés(db)).toEqual([
      { slug: 'infralliance', nom: 'Infralliance', périodes: [{ période: '2026-T4', mesures: 3, état: 'proposée' }, { période: '2026-T3', mesures: 3, état: 'publiée' }] },
    ])
    // Une période publiée n'est pas remesurée ; un registre qui tombe ne lève pas.
    expect(await mesurerÀLaSuite({ slug: 'infralliance', période: '2026-T3' }, db, { f, maintenant, ...sansAttente })).toBe('période-publiée')
    expect(await mesurerÀLaSuite({ slug: 'infralliance' }, { transaction: () => Promise.reject(new Error('base')) } as unknown as Base, { f, maintenant, ...sansAttente })).toBe('échec')
  })

  it('au plafond du registre, découpe par tranche puis par section, et ne compte un même périmètre qu’une fois', async () => {
    await ouvrirLePilote()
    const cibles = { sorte: 'registre' as const, tranches: ['21', '22'] }
    await recevoirLesSegments({ slug: 'infralliance', segments: [SEGMENTS[0]!, { clé: 'pme', libellé: 'PME', parent: 'marche', cibles }, { clé: 'jumeau', libellé: 'Même périmètre', parent: 'marche', cibles }] }, db)
    const appels: string[] = []
    const f = (async (entrée: string | URL | Request) => {
      const url = new URL(String(entrée))
      appels.push(url.search)
      const tranche = url.searchParams.get('tranche_effectif_salarie')
      const section = url.searchParams.get('section_activite_principale')
      // Les deux tranches ensemble et la tranche 21 seule dépassent le plafond ; la 22 non ; chaque section de la 21 en compte 1 000.
      const total = section ? 1_000 : tranche === '22' ? 4_000 : 10_000
      return Response.json({ total_results: total })
    }) as typeof fetch
    const mesuré = await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f, maintenant: () => Date.parse('2026-11-12T08:00:00Z'), ...sansAttente })
    expect(mesuré).toMatchObject({ sorte: 'enregistrées' })
    if (mesuré.sorte !== 'enregistrées') return
    const pme = mesuré.vue!.lignes.find((l) => l.clé === 'pme')!
    expect(pme).toMatchObject({ cibles: 21 * 1_000 + 4_000, ciblesPlafonnées: false })
    expect(pme.limites.join(' ')).toContain('tranche d’effectif par tranche')
    expect(mesuré.vue!.lignes.find((l) => l.clé === 'jumeau')).toMatchObject({ cibles: 25_000 })
    // Le tout, deux tranches, vingt et une sections : vingt-quatre appels, pas le double.
    expect(appels).toHaveLength(24)
  })

  it('lit les marchés publics du segment une fois par jeu de codes, et reconnaît un concurrent titulaire par son SIREN', async () => {
    await ouvrirLePilote()
    const marchésPublics = { cpv: ['7231', '72317'] }
    await recevoirLesSegments(
      {
        slug: 'infralliance',
        segments: [SEGMENTS[0]!, { clé: 'public', libellé: 'Hébergement public', parent: 'marche', marchésPublics }, { clé: 'jumeau', libellé: 'Mêmes codes', parent: 'marche', marchésPublics: { cpv: ['72317', '7231'] } }],
      },
      db,
    )
    const appels: URL[] = []
    let coupure = true
    const f = (async (entrée: string | URL | Request) => {
      const url = new URL(String(entrée))
      appels.push(url)
      expect(url.hostname).toBe('data.economie.gouv.fr')
      // La première connexion est coupée : la lecture réessaie.
      if (coupure) {
        coupure = false
        throw new Error('connexion coupée')
      }
      const où = url.searchParams.get('where') ?? ''
      if (url.searchParams.get('group_by')) {
        return Response.json({ results: [{ titulaire_id_1: '31078598500012', n: 2, total: 100_000 }, { titulaire_id_1: '31078598500038', n: 1, total: 50_000.4 }] })
      }
      if (où.includes('montant >=')) return Response.json({ results: [{ n: 0 }] })
      return Response.json({ results: [{ n: 40, total: 2_000_000.6, titulaires: 12 }] })
    }) as typeof fetch
    const mesuré = await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f, maintenant: () => Date.parse('2026-11-12T08:00:00Z'), ...sansAttente })
    expect(mesuré).toMatchObject({ sorte: 'enregistrées' })
    if (mesuré.sorte !== 'enregistrées') return
    const attendu = { montant: 2_000_001, marchés: 40, titulaires: 12, du: '2025-11-13', au: '2026-11-13', concurrents: [{ nom: 'Cigref', marchés: 3, montant: 150_000.4 }], organisation: null }
    expect(mesuré.vue!.lignes.find((l) => l.clé === 'public')).toMatchObject({ achatPublic: attendu, présents: ['Cigref'], présentsOrigine: 'marches' })
    expect(mesuré.vue!.lignes.find((l) => l.clé === 'jumeau')).toMatchObject({ achatPublic: attendu })
    // Une coupure, puis trois agrégats : le jumeau ne paie rien.
    expect(appels).toHaveLength(4)
    const où = appels[1]!.searchParams.get('where')!
    expect(où).toContain("startswith(codecpv,'7231') or startswith(codecpv,'72317')")
    expect(où).toContain("datenotification >= date'2025-11-13' and datenotification < date'2026-11-13'")
    expect(où).toContain('montant < 100000000')
    // Seul le concurrent de la grille qui porte un SIREN est cherché parmi les titulaires.
    expect(appels[2]!.searchParams.get('where')).toContain("(startswith(titulaire_id_1,'310785985'))")
  })

  it('la requête des marchés publics ne reçoit que des codes et des dates contrôlés', async () => {
    const { clauseDesAchatsPublics } = await import('@/lib/registres')
    const demande = { cpv: ['3012'], depuis: '2025-11-13', jusqua: '2026-11-13', montantMax: 100_000_000 }
    expect(clauseDesAchatsPublics(demande)).toBe("(startswith(codecpv,'3012')) and datenotification >= date'2025-11-13' and datenotification < date'2026-11-13'")
    expect(() => clauseDesAchatsPublics({ ...demande, cpv: [] })).toThrow()
    expect(() => clauseDesAchatsPublics({ ...demande, cpv: ["3012') or 1=1"] })).toThrow()
    expect(() => clauseDesAchatsPublics({ ...demande, depuis: 'hier' })).toThrow()
  })

  it('un registre qui ne répond pas donne n.d., jamais une erreur ni un chiffre', async () => {
    await ouvrirLePilote()
    await recevoirLesSegments({ slug: 'infralliance', segments: SEGMENTS }, db)
    const f = (async () => {
      throw new Error('réseau')
    }) as unknown as typeof fetch
    const mesuré = await mesurerLesMarchésDuPilote({ slug: 'infralliance', période: '2026-T4' }, db, { f, maintenant: () => Date.parse('2026-11-12T08:00:00Z'), ...sansAttente })
    expect(mesuré).toMatchObject({ sorte: 'enregistrées', mesures: 3 })
    if (mesuré.sorte !== 'enregistrées') return
    const colocation = mesuré.vue!.lignes.find((l) => l.clé === 'colocation')!
    expect(colocation).toMatchObject({ cibles: null, potentiel: null, offreurs: null, entrées: null, sorties: null })
    expect(colocation.limites.join(' ')).toContain('n’a pas répondu')
    expect(mesuré.vue!.lignes[0]!.potentiel).toBeNull()
  })
})
