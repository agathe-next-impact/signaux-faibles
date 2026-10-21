import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { organisations, runs, travaux, veilles } from '@/lib/base/schema'
import {
  conclureLeTravail,
  lireLeTravail,
  planifierLesLettres,
  poserUnTravailDeLettre,
  prendreLeProchainTravail,
  étatDeLaFile,
  REPRISE_APRÈS_MS,
} from '@/lib/base/travaux'
import { baseEnMémoire } from './aide/base-en-memoire'

const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'
const PAGE = '11112222333344445555666677778888'

describe('la file de travaux', () => {
  let db: Base
  let fermer: () => Promise<void>
  let acmeId: string
  let ecoId: string

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    const [acme] = await db
      .insert(organisations)
      .values({ slug: 'acme', nom: 'Acme', état: 'essai', registreNotion: REGISTRE })
      .returning({ id: organisations.id })
    acmeId = acme!.id
    const [eco] = await db
      .insert(veilles)
      .values({
        organisationId: acmeId,
        type: 'ecosysteme',
        libellé: 'Écosystème',
        jourParution: 5,
        heureParution: '06:30',
        cadence: 'hebdomadaire',
        numéroCourant: 12,
      })
      .returning({ id: veilles.id })
    ecoId = eco!.id
    await db.insert(veilles).values({
      organisationId: acmeId,
      type: 'concurrentielle',
      libellé: 'Concurrentiel',
      jourParution: 5,
      heureParution: '07:00',
      cadence: 'hebdomadaire',
      numéroCourant: 3,
    })
  })
  afterEach(async () => {
    await fermer()
  })

  describe('planifierLesLettres', () => {
    it('pose un travail par parution de la semaine qui vient, avec le contexte assemblé, et reste rejouable', async () => {
      // Mercredi 21 octobre 2026 : les deux veilles paraissent le vendredi 23.
      const premier = await planifierLesLettres({ aujourdHui: '2026-10-21' }, db)
      expect(premier).toMatchObject({ planifiés: 2, déjàEnFile: 0 })
      expect(premier.parutions.map((p) => p.veille).sort()).toEqual(['concurrentielle', 'ecosysteme'])

      const second = await planifierLesLettres({ aujourdHui: '2026-10-22' }, db)
      expect(second).toMatchObject({ planifiés: 0, déjàEnFile: 2 })

      const [eco] = await db.select().from(travaux).where(eq(travaux.veilleId, ecoId))
      expect(eco).toMatchObject({ type: 'lettre', état: 'a_faire', tentatives: 0 })
      // 06:30 à Paris le 23 octobre, heure d'été : 04:30 UTC.
      expect(eco!.échéance.toISOString()).toBe('2026-10-23T04:30:00.000Z')
      expect(eco!.contexte).toMatchObject({
        organisation: { slug: 'acme', nom: 'Acme', registreNotion: REGISTRE },
        veille: { id: ecoId, type: 'ecosysteme', famille: 'Écosystème' },
        numéro: 13,
        parution: { date: '2026-10-23', semaine: '2026-10-19' },
        prompt: { page: 'Tâche — Lettres de veille' },
      })
    })

    it('ignore les veilles suspendues et les organisations hors essai ou abonnement', async () => {
      await db.update(veilles).set({ état: 'suspendue' }).where(eq(veilles.id, ecoId))
      const [autre] = await db.insert(organisations).values({ slug: 'demande', nom: 'D', état: 'demande' }).returning()
      await db.insert(veilles).values({
        organisationId: autre!.id,
        type: 'ecosysteme',
        libellé: 'E',
        jourParution: 5,
        heureParution: '06:30',
        cadence: 'hebdomadaire',
      })
      const rapport = await planifierLesLettres({ aujourdHui: '2026-10-21' }, db)
      expect(rapport.planifiés).toBe(1)
      expect(rapport.parutions[0]).toMatchObject({ slug: 'acme', veille: 'concurrentielle' })
    })
  })

  describe('prendreLeProchainTravail', () => {
    it('ne donne un travail qu’une fois son échéance passée, le plus ancien d’abord, et le réserve', async () => {
      await planifierLesLettres({ aujourdHui: '2026-10-21' }, db)
      expect(await prendreLeProchainTravail({ session: 's1', maintenant: new Date('2026-10-23T04:00:00Z') }, db)).toBeNull()

      const premier = await prendreLeProchainTravail({ session: 's1', maintenant: new Date('2026-10-23T05:30:00Z') }, db)
      expect(premier).toMatchObject({ type: 'lettre', état: 'pris', tentatives: 1, prisPar: 's1', veille: { type: 'ecosysteme', numéroCourant: 12 } })
      expect(premier!.organisation).toEqual({ id: acmeId, slug: 'acme', registreNotion: REGISTRE })

      const second = await prendreLeProchainTravail({ session: 's2', maintenant: new Date('2026-10-23T05:30:00Z') }, db)
      expect(second?.veille?.type).toBe('concurrentielle')
      expect(await prendreLeProchainTravail({ session: 's3', maintenant: new Date('2026-10-23T05:30:00Z') }, db)).toBeNull()
    })

    it('rend à la file un travail pris depuis plus de trois heures, et l’abandonne à la troisième tentative', async () => {
      await planifierLesLettres({ aujourdHui: '2026-10-23' }, db)
      const t0 = new Date('2026-10-23T06:00:00Z')
      const pris = await prendreLeProchainTravail({ session: 'morte', maintenant: t0 }, db)
      expect(pris?.tentatives).toBe(1)

      // Trop tôt pour reprendre : la file ne rend que l'autre travail.
      const plusTard = new Date(t0.getTime() + REPRISE_APRÈS_MS - 1)
      expect((await prendreLeProchainTravail({ session: 's2', maintenant: plusTard }, db))?.id).not.toBe(pris!.id)

      const reprise = new Date(t0.getTime() + REPRISE_APRÈS_MS + 1)
      const repris = await prendreLeProchainTravail({ session: 's3', maintenant: reprise }, db)
      expect(repris).toMatchObject({ id: pris!.id, tentatives: 2, prisPar: 's3' })

      const troisième = new Date(reprise.getTime() + REPRISE_APRÈS_MS + 1)
      expect((await prendreLeProchainTravail({ session: 's4', maintenant: troisième }, db))).toMatchObject({ id: pris!.id, tentatives: 3 })

      // Tentatives épuisées : la reprise suivante l'abandonne ; la file ne rend
      // plus que l'autre travail, lui aussi resté pris trop longtemps.
      const quatrième = new Date(troisième.getTime() + REPRISE_APRÈS_MS + 1)
      expect((await prendreLeProchainTravail({ session: 's5', maintenant: quatrième }, db))?.id).not.toBe(pris!.id)
      expect((await lireLeTravail(pris!.id, db))?.état).toBe('abandonne')
    })
  })

  describe('conclureLeTravail', () => {
    const prendre = async () => {
      await planifierLesLettres({ aujourdHui: '2026-10-23' }, db)
      return (await prendreLeProchainTravail({ session: 's1', maintenant: new Date('2026-10-23T06:00:00Z') }, db))!
    }

    it('accepté : écrit le run, conclut le travail et attribue le numéro dans la même transaction', async () => {
      const travail = await prendre()
      const résultat = await conclureLeTravail(
        {
          travailId: travail.id,
          session: 's1',
          accepté: true,
          résultat: { méthode: 'x' },
          portes: { ruptures: [] },
          pageNotion: PAGE,
          exécuteur: 'cowork:s1',
          coût: { tokens: 1 },
        },
        db,
      )
      expect(résultat).toMatchObject({ sorte: 'accepté', numéro: 13 })
      const relu = await lireLeTravail(travail.id, db)
      expect(relu?.état).toBe('accepte')
      const [veille] = await db.select().from(veilles).where(eq(veilles.id, ecoId))
      expect(veille?.numéroCourant).toBe(13)
      const [run] = await db.select().from(runs).where(eq(runs.travailId, travail.id))
      expect(run).toMatchObject({ accepté: true, pageNotion: PAGE, exécuteur: 'cowork:s1', coût: { tokens: 1 } })
      expect(run?.fin).not.toBeNull()
      const [ligne] = await db.select({ run: travaux.résultatRunId }).from(travaux).where(eq(travaux.id, travail.id))
      expect(ligne?.run).toBe(run!.id)
    })

    it('refusé : le run est écrit, le travail redevient prenable, et la troisième fois il est abandonné', async () => {
      const travail = await prendre()
      const refus = (session: string) =>
        conclureLeTravail(
          { travailId: travail.id, session, accepté: false, résultat: {}, portes: { ruptures: ['x'] }, pageNotion: PAGE, exécuteur: 'cowork' },
          db,
        )
      expect(await refus('s1')).toMatchObject({ sorte: 'refusé', tentatives: 1 })
      expect((await lireLeTravail(travail.id, db))?.état).toBe('refuse')
      // Pas de numéro attribué.
      expect((await db.select().from(veilles).where(eq(veilles.id, ecoId)))[0]?.numéroCourant).toBe(12)

      const deuxième = await prendreLeProchainTravail({ session: 's2', maintenant: new Date('2026-10-23T06:10:00Z') }, db)
      expect(deuxième?.id).toBe(travail.id)
      expect(await refus('s2')).toMatchObject({ sorte: 'refusé', tentatives: 2 })
      await prendreLeProchainTravail({ session: 's3', maintenant: new Date('2026-10-23T06:20:00Z') }, db)
      expect(await refus('s3')).toMatchObject({ sorte: 'abandonné', tentatives: 3 })
      expect((await lireLeTravail(travail.id, db))?.état).toBe('abandonne')
      expect(await db.select().from(runs).where(eq(runs.travailId, travail.id))).toHaveLength(3)

      // Abandonné, un nouveau travail peut être posé pour la même veille.
      expect((await poserUnTravailDeLettre({ slug: 'acme', veille: 'ecosysteme', type: 'lettre', dateDeParution: '2026-10-30' }, db)).sorte).toBe('créé')
    })

    it('refuse de conclure un travail inconnu, non pris, ou pris par une autre session', async () => {
      const travail = await prendre()
      const base = { accepté: true, résultat: {}, portes: {}, pageNotion: null, exécuteur: 'x' }
      expect(await conclureLeTravail({ ...base, travailId: '00000000-0000-0000-0000-000000000000', session: 's1' }, db)).toEqual({ sorte: 'inconnu' })
      expect(await conclureLeTravail({ ...base, travailId: travail.id, session: 'autre' }, db)).toEqual({ sorte: 'autre-session' })
      await conclureLeTravail({ ...base, travailId: travail.id, session: 's1' }, db)
      expect(await conclureLeTravail({ ...base, travailId: travail.id, session: 's1' }, db)).toEqual({ sorte: 'pas-pris', état: 'accepte' })
    })
  })

  describe('poserUnTravailDeLettre et étatDeLaFile', () => {
    it('pose à la main, refuse l’inconnu, et ne double pas un travail ouvert', async () => {
      expect(await poserUnTravailDeLettre({ slug: 'nul', veille: 'ecosysteme', type: 'lettre', dateDeParution: '2026-10-23' }, db)).toEqual({ sorte: 'organisation-inconnue' })
      expect(await poserUnTravailDeLettre({ slug: 'acme', veille: 'reglementaire', type: 'lettre', dateDeParution: '2026-10-23' }, db)).toEqual({ sorte: 'veille-inconnue' })
      const posé = await poserUnTravailDeLettre({ slug: 'acme', veille: 'ecosysteme', type: 'premiere_lettre', dateDeParution: '2026-10-23' }, db)
      expect(posé.sorte).toBe('créé')
      const doublon = await poserUnTravailDeLettre({ slug: 'acme', veille: 'ecosysteme', type: 'premiere_lettre', dateDeParution: '2026-10-30' }, db)
      expect(doublon).toEqual({ sorte: 'déjà-en-file', travailId: (posé as { travailId: string }).travailId })

      const file = await étatDeLaFile(new Date('2026-10-23T06:00:00Z'), db)
      expect(file.comptes).toEqual({ a_faire: 1, pris: 0, accepte: 0, refuse: 0, abandonne: 0 })
      expect(file.travaux[0]).toMatchObject({ slug: 'acme', veille: 'ecosysteme', type: 'premiere_lettre', état: 'a_faire' })
    })
  })
})
