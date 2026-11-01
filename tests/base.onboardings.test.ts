import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { courriers, lecteurs, onboardingRuns, onboardings, organisations } from '@/lib/base/schema'
import {
  conclureUnLancement,
  conclureUnRunDOnboarding,
  onboardingsPourLeContrôle,
  réserverUnLancement,
  onboardingDUnSlug,
  ouvrirUnRunDOnboarding,
  rapporterUnOnboarding,
  tableauDesOnboardings,
} from '@/lib/base/onboardings'
import { baseEnMémoire } from './aide/base-en-memoire'

const DÉBUT_DU_MOIS = new Date('2026-10-31T23:00:00Z')
const MAINTENANT = new Date('2026-11-01T10:00:00Z')
const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'

const ouvrir = (db: Base, plus: Partial<Parameters<typeof ouvrirUnRunDOnboarding>[0]> = {}) =>
  ouvrirUnRunDOnboarding(
    {
      slug: 'mastora',
      tâche: 'balayage',
      runGithub: 101,
      tentative: 1,
      lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/101',
      plafondUsd: 30,
      budgetUsd: null,
      débutDuMois: DÉBUT_DU_MOIS,
      maintenant: MAINTENANT,
      ...plus,
    },
    db,
  )

describe('le suivi des onboardings en base', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  it('le premier début crée l’onboarding du slug ; un rejeu du même run GitHub ne double rien', async () => {
    const premier = await ouvrir(db)
    expect(premier.sorte).toBe('ouvert')
    const rejeu = await ouvrir(db)
    expect(rejeu).toMatchObject({ sorte: 'déjà-ouvert', runId: premier.runId, onboardingId: premier.onboardingId })
    // Une nouvelle tentative du même run est un autre run.
    const tentative = await ouvrir(db, { tentative: 2 })
    expect(tentative.sorte).toBe('ouvert')
    expect(tentative.runId).not.toBe(premier.runId)
    expect(await db.select().from(onboardings)).toHaveLength(1)
    expect(await db.select().from(onboardingRuns)).toHaveLength(2)
    const [ligne] = await db.select().from(onboardings)
    expect(ligne).toMatchObject({ slug: 'mastora', crééPar: 'tache', exécuteur: 'api' })
  })

  it('refuse un run dont le plafond ne tient pas dans le budget, et le consigne sans le lancer', async () => {
    const premier = await ouvrir(db, { budgetUsd: 50 })
    expect(premier.sorte).toBe('ouvert')
    await conclureUnRunDOnboarding({ slug: 'mastora', runId: premier.runId, issue: 'reussi', coûtUsd: 4.82, maintenant: MAINTENANT }, db)
    // 4,82 $ dépensés + 40 $ de plafond tiennent dans 50 $.
    const second = await ouvrir(db, { tâche: 'premiere_lettre', runGithub: 102, plafondUsd: 40, budgetUsd: 50 })
    expect(second.sorte).toBe('ouvert')
    // Le second, encore en cours, compte pour son plafond : 44,82 + 30 > 50.
    const troisième = await ouvrir(db, { slug: 'heritech', runGithub: 103, budgetUsd: 50 })
    expect(troisième.sorte).toBe('refusé')
    expect(troisième.budget).toMatchObject({ sorte: 'refusé', dépenséUsd: 44.82, plafondUsd: 30, budgetUsd: 50 })
    const [refusé] = await db.select().from(onboardingRuns).where(eq(onboardingRuns.id, troisième.runId))
    expect(refusé).toMatchObject({ état: 'refuse', coûtUsd: 0 })
    expect(refusé!.fin).not.toBeNull()
    // Le rejeu d'un run refusé reste refusé, même si le budget a changé entre-temps.
    expect((await ouvrir(db, { slug: 'heritech', runGithub: 103, budgetUsd: 1000 })).sorte).toBe('refusé')
  })

  it('les runs d’un mois passé ne comptent pas', async () => {
    const ancien = await ouvrir(db, { runGithub: 90, maintenant: new Date('2026-10-20T10:00:00Z') })
    await db.update(onboardingRuns).set({ crééLe: new Date('2026-10-20T10:00:00Z') }).where(eq(onboardingRuns.id, ancien.runId))
    await conclureUnRunDOnboarding({ slug: 'mastora', runId: ancien.runId, issue: 'reussi', coûtUsd: 45, maintenant: MAINTENANT }, db)
    expect((await ouvrir(db, { budgetUsd: 50 })).sorte).toBe('ouvert')
  })

  it('la fin écrit l’issue et le coût, une seule fois, et garde un blocage rapporté', async () => {
    const run = await ouvrir(db)
    expect(await rapporterUnOnboarding({ slug: 'mastora', statut: null, registre: null, motif: 'Email du lecteur final manquant.', nom: null, site: null, maintenant: MAINTENANT }, db)).toBe('rapporté')
    expect(await conclureUnRunDOnboarding({ slug: 'mastora', runId: run.runId, issue: 'reussi', coûtUsd: 4.82, maintenant: MAINTENANT }, db)).toBe('conclu')
    expect(await conclureUnRunDOnboarding({ slug: 'mastora', runId: run.runId, issue: 'echec', coûtUsd: 9, maintenant: MAINTENANT }, db)).toBe('déjà-conclu')
    const [ligne] = await db.select().from(onboardingRuns).where(eq(onboardingRuns.id, run.runId))
    expect(ligne).toMatchObject({ état: 'bloque', coûtUsd: 4.82 })
  })

  it('la fin d’un run se refuse sur un autre slug', async () => {
    const run = await ouvrir(db)
    await ouvrir(db, { slug: 'heritech', runGithub: 200 })
    expect(await conclureUnRunDOnboarding({ slug: 'heritech', runId: run.runId, issue: 'reussi', coûtUsd: 1, maintenant: MAINTENANT }, db)).toBe('inconnu')
  })

  it('le rapport pose la ligne du registre et le statut, et un statut sans motif lève le blocage', async () => {
    expect(await rapporterUnOnboarding({ slug: 'inconnue', statut: 2, registre: null, motif: null, nom: null, site: null, maintenant: MAINTENANT }, db)).toBe('inconnu')
    await ouvrir(db)
    await rapporterUnOnboarding({ slug: 'mastora', statut: null, registre: null, motif: 'Garde 3.0', nom: null, site: null, maintenant: MAINTENANT }, db)
    await rapporterUnOnboarding({ slug: 'mastora', statut: 2, registre: REGISTRE, motif: null, nom: 'Mastora', site: 'https://mastora.example', maintenant: MAINTENANT }, db)
    const [ligne] = await db.select().from(onboardings)
    expect(ligne).toMatchObject({ statutRapporté: 2, registreNotion: REGISTRE, motifDeBlocage: null, nom: 'Mastora', site: 'https://mastora.example' })
  })

  it('le tableau raccorde l’organisation par le slug, compte les lecteurs actifs et lit le dernier lien parti', async () => {
    await ouvrir(db)
    await ouvrir(db, { slug: 'suneido', runGithub: 300 })
    const [org] = await db
      .insert(organisations)
      .values({ slug: 'mastora', nom: 'Mastora SAS', état: 'essai', activéeLe: new Date('2026-10-26T06:00:00Z') })
      .returning({ id: organisations.id })
    const [lecteur] = await db
      .insert(lecteurs)
      .values({ organisationId: org!.id, nom: 'Camille', email: 'camille@mastora.example', identifiantAcces: 'a'.repeat(32) })
      .returning({ id: lecteurs.id })
    await db.insert(lecteurs).values({ organisationId: org!.id, nom: 'Révoqué', email: 'r@mastora.example', identifiantAcces: 'b'.repeat(32), actif: false })
    await db.insert(courriers).values({
      sorte: 'lien_acces',
      organisationId: org!.id,
      lecteurId: lecteur!.id,
      destinataireEmpreinte: '0123abcd',
      déclencheur: 'activation',
      état: 'envoye',
      concluLe: new Date('2026-10-27T08:00:00Z'),
    })

    const { onboardings: liste, runsDuMois } = await tableauDesOnboardings(DÉBUT_DU_MOIS, db)
    expect(runsDuMois).toHaveLength(2)
    const mastora = liste.find((o) => o.slug === 'mastora')!
    expect(mastora.organisation).toMatchObject({ nom: 'Mastora SAS', état: 'essai' })
    expect(mastora.lecteursActifs).toBe(1)
    expect(mastora.dernierLienEnvoyéLe?.toISOString()).toBe('2026-10-27T08:00:00.000Z')
    expect(mastora.runs).toHaveLength(1)
    const suneido = liste.find((o) => o.slug === 'suneido')!
    expect(suneido.organisation).toBeNull()
    expect(suneido.lecteursActifs).toBe(0)
    expect(JSON.stringify(liste)).not.toContain('@')

    expect((await onboardingDUnSlug('suneido', db))?.slug).toBe('suneido')
    expect(await onboardingDUnSlug('inconnue', db)).toBeNull()
  })

  it('la base refuse un lien hors de GitHub et un statut hors de 1 à 6', async () => {
    await expect(ouvrir(db, { lien: 'https://exemple.example/run' })).rejects.toThrow()
    await ouvrir(db)
    await expect(db.update(onboardings).set({ statutRapporté: 7 })).rejects.toThrow()
  })

  describe('le lancement depuis le portail (lot 2)', () => {
    const réserver = (plus: Partial<Parameters<typeof réserverUnLancement>[0]> = {}) =>
      réserverUnLancement({ slug: 'mastora', tâche: 'premiere_lettre', plafondUsd: 40, budgetUsd: null, débutDuMois: DÉBUT_DU_MOIS, opératrice: 'Agathe', maintenant: MAINTENANT, ...plus }, db)

    it('réserve une ligne « demande », refuse un double clic, un inconnu et un Cowork', async () => {
      expect((await réserver()).sorte).toBe('inconnu')
      const premier = await ouvrir(db)
      await conclureUnRunDOnboarding({ slug: 'mastora', runId: premier.runId, issue: 'reussi', coûtUsd: 4.82, maintenant: MAINTENANT }, db)
      const r = await réserver()
      expect(r.sorte).toBe('réservé')
      expect((await réserver()).sorte).toBe('en-cours')
      const [ligne] = await db.select().from(onboardingRuns).where(eq(onboardingRuns.id, (r as { runId: string }).runId))
      expect(ligne).toMatchObject({ état: 'demande', tâche: 'premiere_lettre', plafondUsd: 40, lancéPar: 'Agathe', runGithub: null })
      await db.update(onboardings).set({ exécuteur: 'cowork' })
      expect((await réserver()).sorte).toBe('cowork')
    })

    it('refuse au clic un run dont le plafond dépasse le budget, sans rien réserver', async () => {
      const premier = await ouvrir(db)
      await conclureUnRunDOnboarding({ slug: 'mastora', runId: premier.runId, issue: 'reussi', coûtUsd: 20, maintenant: MAINTENANT }, db)
      const r = await réserver({ budgetUsd: 50 })
      expect(r).toMatchObject({ sorte: 'budget-atteint', budget: { dépenséUsd: 20, plafondUsd: 40 } })
      expect(await db.select().from(onboardingRuns)).toHaveLength(1)
    })

    it('le début du run reprend la réservation, sans compter son plafond deux fois', async () => {
      const premier = await ouvrir(db)
      await conclureUnRunDOnboarding({ slug: 'mastora', runId: premier.runId, issue: 'reussi', coûtUsd: 5, maintenant: MAINTENANT }, db)
      const r = await réserver({ budgetUsd: 50 })
      if (r.sorte !== 'réservé') throw new Error(r.sorte)
      await conclureUnLancement({ runId: r.runId, sorte: 'lancé', runGithub: 500, lien: 'https://github.com/a/b/actions/runs/500', maintenant: MAINTENANT }, db)
      // 5 $ + 40 $ tiennent dans 50 $ : compter la réservation en plus refuserait le run.
      const début = await ouvrir(db, { tâche: 'premiere_lettre', runGithub: 500, tentative: 1, plafondUsd: 40, budgetUsd: 50, lancement: r.runId })
      expect(début).toMatchObject({ sorte: 'ouvert', runId: r.runId })
      const [ligne] = await db.select().from(onboardingRuns).where(eq(onboardingRuns.id, r.runId))
      expect(ligne).toMatchObject({ état: 'en_cours', runGithub: 500, tentative: 1, lancéPar: 'Agathe' })
      expect(ligne!.début).not.toBeNull()
      expect(await db.select().from(onboardingRuns)).toHaveLength(2)
    })

    it('un lancement d’un autre slug n’est pas repris : le début crée sa propre ligne', async () => {
      await ouvrir(db, { runGithub: 1 })
      await conclureUnRunDOnboarding({ slug: 'mastora', runId: (await db.select().from(onboardingRuns))[0]!.id, issue: 'reussi', coûtUsd: 1, maintenant: MAINTENANT }, db)
      const r = await réserver()
      if (r.sorte !== 'réservé') throw new Error(r.sorte)
      const autre = await ouvrir(db, { slug: 'heritech', runGithub: 2, lancement: r.runId })
      expect(autre.runId).not.toBe(r.runId)
    })

    it('un échec de GitHub clôt la réservation à coût nul, avec le code', async () => {
      await ouvrir(db, { runGithub: 1 })
      await conclureUnRunDOnboarding({ slug: 'mastora', runId: (await db.select().from(onboardingRuns))[0]!.id, issue: 'echec', coûtUsd: 1, maintenant: MAINTENANT }, db)
      const r = await réserver()
      if (r.sorte !== 'réservé') throw new Error(r.sorte)
      await conclureUnLancement({ runId: r.runId, sorte: 'échec', codeHttp: 403, maintenant: MAINTENANT }, db)
      const [ligne] = await db.select().from(onboardingRuns).where(eq(onboardingRuns.id, r.runId))
      expect(ligne).toMatchObject({ état: 'echec', codeHttp: 403, coûtUsd: 0 })
      expect((await réserver()).sorte).toBe('réservé')
      expect((await onboardingsPourLeContrôle(db)).map((o) => o.slug)).toEqual(['mastora'])
    })
  })
})
