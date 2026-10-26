import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, isNull } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import {
  faitsÉtiquetés,
  forcePorter,
  grilles,
  impactDeFait,
  mouvementAnsoff,
  nouveautéDeFait,
  origineDÉlément,
  outilDePosition,
  pestelDeFait,
  positions,
  sectionDeFait,
  tendanceDeForce,
  étatDÉlément,
  élémentsSynthèse,
} from '@/lib/base/schema'
import {
  enregistrerLaSynthèse,
  faitsConnus,
  faitsDeLaFenêtre,
  lireLaGrille,
  lireLaSynthèse,
  organisationPourLesOutils,
  posterLaGrille,
  remplacerLesÉtiquettes,
  réglerLesOutilsStratégiques,
  synthèsePrécédente,
  validerLaGrille,
  type ÉlémentÀEnregistrer,
} from '@/lib/base/strategie'
import {
  ANSOFF,
  contrôlerLesÉtiquettes,
  FORCES_PORTER,
  IMPACTS_DE_FAIT,
  NOUVEAUTÉS,
  ORIGINES,
  OUTILS_DE_POSITION,
  PESTEL,
  SECTIONS,
  TENDANCES,
  ÉTATS_D_ÉLÉMENT,
  type Grille,
  type ÉtiquetteValidée,
} from '@/lib/domaine/strategie'
import { baseEnMémoire } from './aide/base-en-memoire'
import { ÉTIQUETTES_OCTOBRE } from './fixtures/etiquettes-octobre'
import { BLOCS_OCTOBRE, DATE_OCTOBRE, PAGE_OCTOBRE } from './fixtures/lettre-octobre'

/**
 * Les outils stratégiques en base (lot 2, `docs/plan-outils-strategiques.md`),
 * sur une vraie base Postgres en mémoire et les migrations du dépôt. Les
 * étiquettes enregistrées sont celles de la lettre d'octobre d'Infralliance,
 * passées par la porte comme le fera la route.
 */
const registre = (n: number) => `aaaabbbbccccddddeeeeffff${String(n).padStart(8, '0')}`
const RÉFÉRENTIEL = '3d2fe829ce71801eae49fa7fc4a0e76c'

const GRILLE: Grille = {
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
}

/** Le lot d'octobre, tel que la porte l'accepte. */
function lotDOctobre(): ÉtiquetteValidée[] {
  const r = contrôlerLesÉtiquettes({ blocs: BLOCS_OCTOBRE, dateÉdition: DATE_OCTOBRE, lot: ÉTIQUETTES_OCTOBRE })
  expect(r.refus).toEqual([])
  return [...r.acceptées]
}

const ÉDITION = { notion: PAGE_OCTOBRE, famille: 'ecosysteme', date: DATE_OCTOBRE }

describe('les listes fermées de la base sont celles du domaine', () => {
  it('chaque enum Postgres recopie la liste de lib/domaine/strategie.ts', () => {
    expect(pestelDeFait.enumValues).toEqual([...PESTEL])
    expect(forcePorter.enumValues).toEqual([...FORCES_PORTER])
    expect(mouvementAnsoff.enumValues).toEqual([...ANSOFF])
    expect(sectionDeFait.enumValues).toEqual([...SECTIONS])
    expect(impactDeFait.enumValues).toEqual([...IMPACTS_DE_FAIT])
    expect(nouveautéDeFait.enumValues).toEqual([...NOUVEAUTÉS])
    expect(étatDÉlément.enumValues).toEqual([...ÉTATS_D_ÉLÉMENT])
    expect(origineDÉlément.enumValues).toEqual([...ORIGINES])
    expect(tendanceDeForce.enumValues).toEqual([...TENDANCES])
    // La base porte déjà `ge` (lot 13) ; la porte le refuse tant qu'il n'est pas dans le domaine.
    expect(outilDePosition.enumValues).toEqual([...OUTILS_DE_POSITION, 'ge'])
  })
})

describe('outils stratégiques en base', () => {
  let db: Base
  let fermer: () => Promise<void>
  let infralliance: string
  let autre: string

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'infralliance', nom: 'Infralliance', registreNotion: registre(1) }, db)
    await ouvrirEnEssai({ slug: 'autre', nom: 'Autre', registreNotion: registre(2) }, db)
    infralliance = (await organisationPourLesOutils({ slug: 'infralliance' }, db))!.id
    autre = (await organisationPourLesOutils({ slug: 'autre' }, db))!.id
  })
  afterEach(async () => {
    await fermer()
  })

  describe('le drapeau du pilote', () => {
    it('est faux par défaut, se règle par slug, et se lit aussi par le registre des éditions', async () => {
      expect(await organisationPourLesOutils({ registreNotion: registre(1) }, db)).toEqual({
        id: infralliance,
        slug: 'infralliance',
        registreNotion: registre(1),
        outilsStratégiques: false,
      })
      expect(await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)).toBe('réglé')
      expect((await organisationPourLesOutils({ slug: 'infralliance' }, db))!.outilsStratégiques).toBe(true)
      expect(await réglerLesOutilsStratégiques({ slug: 'inconnue', actif: true }, db)).toBe('organisation-inconnue')
      expect(await organisationPourLesOutils({ registreNotion: registre(9) }, db)).toBeNull()
    })

    it('hors du pilote, rien ne s’écrit', async () => {
      expect(await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lotDOctobre() }, db)).toEqual({
        sorte: 'hors-pilote',
      })
      expect(await posterLaGrille({ organisationId: infralliance, référentielNotion: RÉFÉRENTIEL, grille: GRILLE }, db)).toEqual({
        sorte: 'hors-pilote',
      })
      expect(await db.select().from(faitsÉtiquetés)).toHaveLength(0)
      expect(await db.select().from(grilles)).toHaveLength(0)
    })
  })

  describe('les faits étiquetés', () => {
    beforeEach(async () => {
      await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    })

    it('enregistrent le lot d’octobre sans recopier le texte des faits', async () => {
      const lot = lotDOctobre()
      expect(await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lot }, db)).toEqual({
        sorte: 'enregistré',
        archivées: 0,
        insérées: 11,
      })
      const faits = await faitsDeLaFenêtre({ organisationId: infralliance, début: '2026-10-19', fin: '2026-10-25' }, db)
      expect(faits).toHaveLength(11)
      expect(faits.map((f) => `${f.numéroAxe}.${f.rang}`)).toEqual(['1.1', '1.2', '1.3', '2.1', '2.2', '3.1', '4.1', '4.2', '4.3', '5.1', '5.2'])
      const telehouse = faits.find((f) => f.numéroAxe === 4 && f.rang === 1)!
      expect(telehouse).toMatchObject({ pestel: 'economique', forcePorter: null, rupture: true, impact: 'FORT', dateFait: '2026-10-20' })
      expect(telehouse.empreinteTitre).toMatch(/^[0-9a-f]{8}$/)
      const cispe = faits.find((f) => f.numéroAxe === 1 && f.rang === 3)!
      expect(cispe).toMatchObject({ forcePorter: 'rivalite', ansoff: 'penetration', entité: 'CISPE' })
      // Aucune colonne ne porte la phrase-titre.
      const ligne = JSON.stringify(faits)
      expect(ligne).not.toContain('Telehouse a annoncé')
    })

    it('un nouveau lot de la même édition archive le précédent, dans une transaction', async () => {
      const lot = lotDOctobre()
      await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lot }, db)
      const corrigé = lot.map((é) => (é.axe === 4 && é.rang === 2 ? { ...é, impact: 'FORT' as const } : é))
      expect(await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: corrigé }, db)).toEqual({
        sorte: 'enregistré',
        archivées: 11,
        insérées: 11,
      })
      expect(await db.select().from(faitsÉtiquetés)).toHaveLength(22)
      const vivants = await faitsDeLaFenêtre({ organisationId: infralliance, début: DATE_OCTOBRE, fin: DATE_OCTOBRE }, db)
      expect(vivants).toHaveLength(11)
      expect(vivants.find((f) => f.numéroAxe === 4 && f.rang === 2)!.impact).toBe('FORT')
    })

    it('un lot qui viole une contrainte n’archive rien', async () => {
      const lot = lotDOctobre()
      await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lot }, db)
      // Deux fois la même place : l'unicité refuse, et la transaction défait l'archivage.
      const doublé = [...lot, lot[0]!]
      await expect(remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: doublé }, db)).rejects.toThrow(
        /SQLSTATE 23505/,
      )
      const vivants = await db
        .select()
        .from(faitsÉtiquetés)
        .where(and(eq(faitsÉtiquetés.éditionNotion, PAGE_OCTOBRE), isNull(faitsÉtiquetés.archivéeLe)))
      expect(vivants).toHaveLength(11)
    })

    it('les contraintes de la migration tiennent ce que la porte vérifie', async () => {
      const [é] = lotDOctobre()
      const essayer = (modif: Partial<ÉtiquetteValidée>) =>
        remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: [{ ...é!, ...modif }] }, db)
      // Ni les deux cadres, ni aucun.
      await expect(essayer({ porter: 'rivalite' })).rejects.toThrow(/SQLSTATE 23514/)
      await expect(essayer({ pestel: null })).rejects.toThrow(/SQLSTATE 23514/)
      // Ansoff hors concurrent nommé.
      await expect(essayer({ ansoff: 'penetration' })).rejects.toThrow(/SQLSTATE 23514/)
      // Un fait daté après son édition.
      await expect(essayer({ date: '2026-10-22' })).rejects.toThrow(/SQLSTATE 23514/)
      // Une empreinte qui n'en est pas une.
      await expect(essayer({ empreinte: 'Telehouse' })).rejects.toThrow(/SQLSTATE 23514/)
      // Un fait d'axe sans axe.
      await expect(essayer({ axe: null })).rejects.toThrow(/SQLSTATE 23514/)
    })

    it('une édition déjà étiquetée pour une autre organisation est refusée', async () => {
      await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lotDOctobre() }, db)
      await réglerLesOutilsStratégiques({ slug: 'autre', actif: true }, db)
      expect(await remplacerLesÉtiquettes({ organisationId: autre, édition: ÉDITION, étiquettes: lotDOctobre() }, db)).toEqual({
        sorte: 'organisation-différente',
      })
    })

    it('aucune lecture ne traverse les organisations', async () => {
      await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lotDOctobre() }, db)
      expect(await faitsDeLaFenêtre({ organisationId: autre, début: '2026-01-01', fin: '2026-12-31' }, db)).toEqual([])
      const ids = (await faitsDeLaFenêtre({ organisationId: infralliance, début: '2026-01-01', fin: '2026-12-31' }, db)).map((f) => f.id)
      expect((await faitsConnus({ organisationId: infralliance, ids }, db)).size).toBe(11)
      expect((await faitsConnus({ organisationId: autre, ids }, db)).size).toBe(0)
      // Un identifiant mal formé est inconnu, et ne fait pas échouer la lecture.
      expect((await faitsConnus({ organisationId: infralliance, ids: ['S1', ids[0]!] }, db)).size).toBe(1)
    })

    it('un fait archivé par un ré-étiquetage n’est plus connu de la porte', async () => {
      await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lotDOctobre() }, db)
      const anciens = (await faitsDeLaFenêtre({ organisationId: infralliance, début: DATE_OCTOBRE, fin: DATE_OCTOBRE }, db)).map((f) => f.id)
      await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lotDOctobre() }, db)
      expect((await faitsConnus({ organisationId: infralliance, ids: anciens }, db)).size).toBe(0)
    })
  })

  describe('la grille', () => {
    beforeEach(async () => {
      await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
    })

    it('se versionne, et un re-post identique, même dans un autre ordre, ne crée rien', async () => {
      expect(await lireLaGrille(infralliance, db)).toBeNull()
      expect(await posterLaGrille({ organisationId: infralliance, référentielNotion: RÉFÉRENTIEL, grille: GRILLE }, db)).toEqual({
        sorte: 'créée',
        version: 1,
      })
      const réordonnée: Grille = { ...GRILLE, entités: [...GRILLE.entités].reverse(), familles: [...GRILLE.familles].reverse() }
      expect(await posterLaGrille({ organisationId: infralliance, référentielNotion: RÉFÉRENTIEL, grille: réordonnée }, db)).toEqual({
        sorte: 'inchangée',
        version: 1,
      })
      expect(await validerLaGrille({ organisationId: infralliance, version: 1 }, db)).toBe('validée')
      expect(await validerLaGrille({ organisationId: infralliance, version: 1 }, db)).toBe('déjà-validée')

      const élargie: Grille = { ...GRILLE, entités: [...GRILLE.entités, { nom: 'Hexatrust', veille: 'concurrentiel', siren: '810490052' }] }
      expect(await posterLaGrille({ organisationId: infralliance, référentielNotion: RÉFÉRENTIEL, grille: élargie }, db)).toEqual({
        sorte: 'créée',
        version: 2,
      })
      const lue = (await lireLaGrille(infralliance, db))!
      expect(lue.version).toBe(2)
      expect(lue.validéeLe).toBeNull()
      expect(lue.grille.entités).toHaveLength(3)
      expect(lue.grille.axesGroupes[0]!.crans).toEqual(GRILLE.axesGroupes[0]!.crans)
      expect(await lireLaGrille(autre, db)).toBeNull()
      expect(await validerLaGrille({ organisationId: autre, version: 1 }, db)).toBe('inconnue')
    })
  })

  describe('les synthèses', () => {
    let faits: string[]
    const FENÊTRE = { début: '2026-10-05', fin: '2026-11-01' }

    beforeEach(async () => {
      await réglerLesOutilsStratégiques({ slug: 'infralliance', actif: true }, db)
      await posterLaGrille({ organisationId: infralliance, référentielNotion: RÉFÉRENTIEL, grille: GRILLE }, db)
      await remplacerLesÉtiquettes({ organisationId: infralliance, édition: ÉDITION, étiquettes: lotDOctobre() }, db)
      faits = (await faitsDeLaFenêtre({ organisationId: infralliance, ...FENÊTRE }, db)).map((f) => f.id)
    })

    const swot = (rang: number, clé: string, idProvisoire: string, fait: string): ÉlémentÀEnregistrer => ({
      outil: 'swot',
      clé,
      rang,
      énoncé: `Élément ${idProvisoire} daté d’octobre 2026`,
      état: 'nouveau',
      faits: [fait],
      idProvisoire,
    })

    const octobre = (): ÉlémentÀEnregistrer[] => [
      { outil: 'pestel', clé: 'pestel:legal', rang: 1, énoncé: 'Trois textes européens avancent en octobre 2026.', faits: [faits[0]!, faits[3]!] },
      { outil: 'pestel', clé: 'pestel:socioculturel', rang: 1, énoncé: null, faits: [] },
      swot(1, 'opportunites', 'O1', faits[0]!),
      swot(1, 'menaces', 'T1', faits[6]!),
      {
        outil: 'swot',
        clé: 'forces',
        rang: 1,
        énoncé: 'La fédération réunit trois couches du numérique (fiche, à confirmer).',
        état: 'nouveau',
        origine: 'declaratif',
        hypothèse: true,
        faits: [],
        références: { fiche: 'fiche v1.1, §7' },
        idProvisoire: 'S1',
      },
      { outil: 'tows', clé: 'ST', rang: 1, énoncé: 'Répondre au module de Telehouse par une parole commune.', faits: [], croise: ['S1', 'T1'], candidateRecommandation: true },
    ]

    it('s’enregistre, résout les croisements TOWS et se relit par période', async () => {
      const r = await enregistrerLaSynthèse(
        {
          organisationId: infralliance,
          période: '2026-10',
          fenêtre: FENÊTRE,
          grilleVersion: 1,
          éléments: octobre(),
          positions: [
            { outil: 'groupes', sujet: 'CISPE', axe: 'couches', cran: 2, faits: [faits[2]!] },
            { outil: 'forces', sujet: 'substituts', axe: 'intensite', cran: null, nonSuivi: true, faits: [] },
            { outil: 'forces', sujet: 'rivalite', axe: 'intensite', cran: 2, tendance: 'hausse', faits: [faits[2]!] },
          ],
        },
        db,
      )
      expect(r).toEqual({ sorte: 'enregistrée', éléments: 6, positions: 3, archivés: 0 })

      const lue = await lireLaSynthèse({ organisationId: infralliance, période: '2026-10' }, db)
      expect(lue.éléments).toHaveLength(6)
      expect(lue.positions).toHaveLength(3)
      const s1 = lue.éléments.find((é) => é.clé === 'forces')!
      const t1 = lue.éléments.find((é) => é.clé === 'menaces')!
      const st = lue.éléments.find((é) => é.outil === 'tows')!
      expect(st.références).toEqual({ éléments: [s1.id, t1.id] })
      expect(st.candidateRecommandation).toBe(true)
      expect(s1).toMatchObject({ origine: 'declaratif', hypothèse: true, références: { fiche: 'fiche v1.1, §7' } })
      expect(lue.éléments.every((é) => é.étatPublication === 'propose')).toBe(true)
      expect((await lireLaSynthèse({ organisationId: autre, période: '2026-10' }, db)).éléments).toEqual([])
    })

    it('remplace la synthèse de la même période et garde la précédente pour les filiations', async () => {
      await enregistrerLaSynthèse(
        { organisationId: infralliance, période: '2026-10', fenêtre: FENÊTRE, grilleVersion: 1, éléments: octobre(), positions: [] },
        db,
      )
      const deuxième = await enregistrerLaSynthèse(
        { organisationId: infralliance, période: '2026-10', fenêtre: FENÊTRE, grilleVersion: 1, éléments: octobre(), positions: [] },
        db,
      )
      expect(deuxième).toMatchObject({ sorte: 'enregistrée', archivés: 6 })
      expect(await db.select().from(élémentsSynthèse)).toHaveLength(12)

      const précédente = (await synthèsePrécédente({ organisationId: infralliance, période: '2026-11' }, db))!
      expect(précédente.période).toBe('2026-10')
      expect(précédente.éléments).toHaveLength(6)
      const menace = précédente.éléments.find((é) => é.clé === 'menaces')!
      const novembre = await enregistrerLaSynthèse(
        {
          organisationId: infralliance,
          période: '2026-11',
          fenêtre: { début: '2026-11-02', fin: '2026-12-06' },
          grilleVersion: 1,
          éléments: [{ ...swot(1, 'menaces', 'T1', faits[6]!), état: 'renforce', filiation: menace.id }],
          positions: [],
        },
        db,
      )
      expect(novembre).toMatchObject({ sorte: 'enregistrée' })
      // Un trimestre ne suit pas un mois.
      expect(await synthèsePrécédente({ organisationId: infralliance, période: '2026-T4' }, db)).toBeNull()
      expect(await synthèsePrécédente({ organisationId: infralliance, période: '2026-10' }, db)).toBeNull()
      expect(await synthèsePrécédente({ organisationId: autre, période: '2026-12' }, db)).toBeNull()
    })

    it('revérifie dans la transaction ce qui a pu changer depuis la porte', async () => {
      const base_ = { organisationId: infralliance, période: '2026-10', fenêtre: FENÊTRE, positions: [] }
      expect(await enregistrerLaSynthèse({ ...base_, grilleVersion: 2, éléments: octobre() }, db)).toEqual({ sorte: 'grille-périmée' })
      expect(
        await enregistrerLaSynthèse({ ...base_, grilleVersion: 1, éléments: [swot(1, 'menaces', 'T1', '00000000-0000-4000-8000-000000000000')] }, db),
      ).toEqual({ sorte: 'fait-inconnu' })
      expect(await enregistrerLaSynthèse({ ...base_, grilleVersion: 1, éléments: [swot(1, 'menaces', 'T1', 'S1')] }, db)).toEqual({
        sorte: 'fait-inconnu',
      })
      expect(
        await enregistrerLaSynthèse(
          { ...base_, grilleVersion: 1, éléments: [{ ...swot(1, 'menaces', 'T1', faits[0]!), filiation: '00000000-0000-4000-8000-000000000000' }] },
          db,
        ),
      ).toEqual({ sorte: 'filiation-inconnue' })
      expect(
        await enregistrerLaSynthèse(
          { ...base_, grilleVersion: 1, éléments: [{ outil: 'tows', clé: 'SO', rang: 1, énoncé: 'x', faits: [], croise: ['S9'] }] },
          db,
        ),
      ).toEqual({ sorte: 'référence-inconnue', référence: 'S9' })
      // Les faits d'une autre organisation ne sont pas cités par celle-ci.
      await réglerLesOutilsStratégiques({ slug: 'autre', actif: true }, db)
      await posterLaGrille({ organisationId: autre, référentielNotion: RÉFÉRENTIEL, grille: GRILLE }, db)
      expect(
        await enregistrerLaSynthèse({ ...base_, organisationId: autre, grilleVersion: 1, éléments: [swot(1, 'menaces', 'T1', faits[0]!)] }, db),
      ).toEqual({ sorte: 'fait-inconnu' })
      expect(await db.select().from(élémentsSynthèse)).toHaveLength(0)
    })

    it('les contraintes tiennent la candidate unique, le déclaratif et les crans', async () => {
      const base_ = { organisationId: infralliance, période: '2026-10', fenêtre: FENÊTRE, grilleVersion: 1 }
      const tows = (rang: number): ÉlémentÀEnregistrer => ({ outil: 'tows', clé: 'SO', rang, énoncé: 'x', faits: [], candidateRecommandation: true })
      await expect(enregistrerLaSynthèse({ ...base_, éléments: [tows(1), tows(2)], positions: [] }, db)).rejects.toThrow(/SQLSTATE 23505/)
      await expect(
        enregistrerLaSynthèse({ ...base_, éléments: [{ ...swot(1, 'menaces', 'T1', faits[0]!), origine: 'declaratif' }], positions: [] }, db),
      ).rejects.toThrow(/SQLSTATE 23514/)
      await expect(
        enregistrerLaSynthèse({ ...base_, éléments: [], positions: [{ outil: 'mendelow', sujet: 'DGE', axe: 'pouvoir', cran: 6, faits: [] }] }, db),
      ).rejects.toThrow(/SQLSTATE 23514/)
      await expect(
        enregistrerLaSynthèse({ ...base_, éléments: [], positions: [{ outil: 'mendelow', sujet: 'DGE', axe: 'pouvoir', cran: 2, tendance: 'hausse', faits: [] }] }, db),
      ).rejects.toThrow(/SQLSTATE 23514/)
      await expect(
        enregistrerLaSynthèse({ ...base_, période: '2026-13', éléments: [], positions: [{ outil: 'mendelow', sujet: 'DGE', axe: 'pouvoir', cran: 2, faits: [] }] }, db),
      ).rejects.toThrow(/SQLSTATE 23514/)
      expect(await db.select().from(positions)).toHaveLength(0)
    })
  })
})
