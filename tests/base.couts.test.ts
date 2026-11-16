import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { coûtsEntre, enregistrerUnCoût, nomsDesOrganisations, type CoûtÀEnregistrer } from '@/lib/base/couts'
import { conclureUnRunDOnboarding, ouvrirUnRunDOnboarding } from '@/lib/base/onboardings'
import { coûtsDesRuns, organisations } from '@/lib/base/schema'
import { bornesDuMois } from '@/lib/domaine/couts'
import { baseEnMémoire } from './aide/base-en-memoire'

const coût = (plus: Partial<CoûtÀEnregistrer> = {}): CoûtÀEnregistrer => ({
  tâche: 'lettres',
  organisation: null,
  organisations: ['mastora', 'hermitage'],
  issue: 'success',
  coûtUsd: 18.4213,
  plafondUsd: 60,
  duréeMs: 1_820_000,
  tours: 212,
  parModèle: { 'claude-opus': { coûtUsd: 17.2 } },
  run: { id: 501, tentative: 1, lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/501' },
  mesuréLe: new Date('2026-11-16T05:00:02Z'),
  ...plus,
})

describe('le coût des runs en base', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  it('enregistre une mesure et la relit telle quelle', async () => {
    expect(await enregistrerUnCoût(coût(), db)).toEqual({ sorte: 'enregistré' })
    const { début, fin } = bornesDuMois('2026-11')
    const [lu] = await coûtsEntre(début, fin, db)
    expect(lu).toMatchObject({
      tâche: 'lettres',
      organisation: null,
      organisations: ['hermitage', 'mastora'],
      issue: 'success',
      coûtUsd: 18.4213,
      plafondUsd: 60,
      duréeMs: 1_820_000,
      tours: 212,
      runGithub: 501,
      origine: 'harnais',
    })
    expect(lu?.mesuréLe).toEqual(new Date('2026-11-16T05:00:02Z'))
  })

  it('n’enregistre qu’une fois un même run GitHub, tentative par tentative', async () => {
    await enregistrerUnCoût(coût(), db)
    expect(await enregistrerUnCoût(coût({ coûtUsd: 99 }), db)).toEqual({ sorte: 'déjà-enregistré' })
    // Une tentative absente vaut la première : sans cela, deux nuls ne se heurteraient pas.
    expect(await enregistrerUnCoût(coût({ run: { id: 501, tentative: null, lien: null } }), db)).toEqual({ sorte: 'déjà-enregistré' })
    // Une relance du job est un autre run : sa dépense s'ajoute.
    expect(await enregistrerUnCoût(coût({ run: { id: 501, tentative: 2, lien: null }, coûtUsd: 3 }), db)).toEqual({ sorte: 'enregistré' })
    const lignes = await db.select().from(coûtsDesRuns)
    expect(lignes.map((l) => l.coûtUsd).sort()).toEqual([18.4213, 3].sort())
  })

  it('garde chaque run lancé hors de GitHub : rien ne permet de les rapprocher', async () => {
    await enregistrerUnCoût(coût({ run: null }), db)
    await enregistrerUnCoût(coût({ run: null }), db)
    expect(await db.select().from(coûtsDesRuns)).toHaveLength(2)
  })

  it('ne lit que l’intervalle demandé, début inclus et fin exclue, du plus ancien au plus récent', async () => {
    const { début, fin } = bornesDuMois('2026-11')
    await enregistrerUnCoût(coût({ run: { id: 1, tentative: 1, lien: null }, mesuréLe: new Date(début.getTime() - 1) }), db)
    await enregistrerUnCoût(coût({ run: { id: 3, tentative: 1, lien: null }, mesuréLe: new Date(fin.getTime() - 1) }), db)
    await enregistrerUnCoût(coût({ run: { id: 2, tentative: 1, lien: null }, mesuréLe: début }), db)
    await enregistrerUnCoût(coût({ run: { id: 4, tentative: 1, lien: null }, mesuréLe: fin }), db)
    expect((await coûtsEntre(début, fin, db)).map((r) => r.runGithub)).toEqual([2, 3])
  })

  it('refuse un coût négatif, une tâche mal formée et un lien hors de GitHub', async () => {
    await expect(enregistrerUnCoût(coût({ coûtUsd: -1 }), db)).rejects.toThrow()
    await expect(enregistrerUnCoût(coût({ tâche: 'Lettres du jour' }), db)).rejects.toThrow()
    await expect(enregistrerUnCoût(coût({ run: { id: 9, tentative: 1, lien: 'https://exemple.example/run/9' } }), db)).rejects.toThrow()
    expect(await db.select().from(coûtsDesRuns)).toHaveLength(0)
  })

  it('rend le nom des organisations connues, et rien pour un slug inconnu', async () => {
    await db.insert(organisations).values({ slug: 'mastora', nom: 'Mastora', registreNotion: 'aaaabbbbccccddddeeeeffff00001111', état: 'abonnee' })
    expect(await nomsDesOrganisations(['mastora', 'inconnue'], db)).toEqual(new Map([['mastora', 'Mastora']]))
    expect(await nomsDesOrganisations([], db)).toEqual(new Map())
  })

  it('la reprise de la migration recopie les runs d’onboarding mesurés, une fois, sans les lancements à coût nul', async () => {
    const maintenant = new Date('2026-11-14T09:00:00Z')
    const ouvrir = (runGithub: number, tâche: 'balayage' | 'premiere_lettre') =>
      ouvrirUnRunDOnboarding(
        { slug: 'aquitaine-robotics', tâche, runGithub, tentative: null, lien: `https://github.com/agathe-next-impact/signaux-faibles/actions/runs/${runGithub}`, plafondUsd: 30, budgetUsd: null, débutDuMois: new Date('2026-10-31T23:00:00Z'), maintenant },
        db,
      )
    const mesuré = await ouvrir(701, 'premiere_lettre')
    const nul = await ouvrir(702, 'balayage')
    const enCours = await ouvrir(703, 'balayage')
    if (mesuré.sorte !== 'ouvert' || nul.sorte !== 'ouvert' || enCours.sorte !== 'ouvert') throw new Error('runs non ouverts')
    await conclureUnRunDOnboarding({ slug: 'aquitaine-robotics', runId: mesuré.runId, issue: 'reussi', coûtUsd: 15.172, maintenant: new Date('2026-11-14T09:33:00Z') }, db)
    await conclureUnRunDOnboarding({ slug: 'aquitaine-robotics', runId: nul.runId, issue: 'echec', coûtUsd: 0, maintenant }, db)

    const migration = readFileSync('drizzle/0027_couts_des_runs.sql', 'utf8')
    const reprise = migration.slice(migration.indexOf('INSERT INTO "couts_des_runs"'))
    expect(reprise.startsWith('INSERT INTO "couts_des_runs"')).toBe(true)
    await db.execute(sql.raw(reprise))
    // Rejouée, elle n'ajoute rien : le run GitHub est déjà là.
    await db.execute(sql.raw(reprise))

    const lignes = await db.select().from(coûtsDesRuns)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      tâche: 'premiere-lettre',
      organisation: 'aquitaine-robotics',
      organisations: ['aquitaine-robotics'],
      issue: 'success',
      coûtUsd: 15.172,
      plafondUsd: 30,
      duréeMs: 33 * 60_000,
      runGithub: 701,
      tentative: 1,
      origine: 'onboarding',
    })
    // Le même run, rapporté ensuite par le harnais, ne se compte pas deux fois.
    expect(await enregistrerUnCoût(coût({ tâche: 'premiere-lettre', run: { id: 701, tentative: 1, lien: null } }), db)).toEqual({ sorte: 'déjà-enregistré' })
  })
})
