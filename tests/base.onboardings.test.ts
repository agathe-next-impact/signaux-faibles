import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { courriers, lecteurs, onboardingRuns, onboardings, organisations } from '@/lib/base/schema'
import {
  conclureUnLancement,
  créneauxCoworkPris,
  demandeÀTransmettre,
  effacerLesDemandesAnciennes,
  enregistrerUneDemande,
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

  describe('la demande du formulaire (lot 3)', () => {
    const demande = (plus: Record<string, unknown> = {}) => ({
      slug: 'mastora',
      nom: 'Mastora',
      site: 'https://mastora.example/',
      exécuteur: 'api' as const,
      intake: { objectifs: 'Suivre les appels d’offres.', lecteurFinal: 'Camille', emailDuLecteurFinal: 'camille@mastora.example' },
      ...plus,
    })
    const enregistrer = (plus: Record<string, unknown> = {}, maintenant = MAINTENANT) => enregistrerUneDemande({ demande: demande(plus), opératrice: 'Agathe', maintenant }, db)

    it('enregistre sans rien lancer, et transmet la demande jusqu’à la ligne du registre', async () => {
      expect((await enregistrer()).sorte).toBe('enregistrée')
      expect(await db.select().from(onboardingRuns)).toHaveLength(0)
      const [ligne] = await db.select().from(onboardings)
      expect(ligne).toMatchObject({ slug: 'mastora', crééPar: 'Agathe', exécuteur: 'api', registreNotion: null })
      expect(await demandeÀTransmettre('mastora', db)).toEqual({ nom: 'Mastora', site: 'https://mastora.example/', objectifs: 'Suivre les appels d’offres.', lecteurFinal: 'Camille', emailDuLecteurFinal: 'camille@mastora.example' })
      // La liste ne montre jamais l'adresse.
      const lu = await onboardingDUnSlug('mastora', db)
      expect(lu?.demande).toEqual({ objectifs: 'Suivre les appels d’offres.', lecteurFinal: 'Camille', avecAdresse: true })
      expect(JSON.stringify(lu)).not.toContain('@')
      // Le premier run reprend la ligne du formulaire, puis la tâche rapporte la ligne du registre : l'intake est effacé.
      await ouvrir(db)
      await rapporterUnOnboarding({ slug: 'mastora', statut: 1, registre: REGISTRE, motif: null, nom: null, site: null, maintenant: MAINTENANT }, db)
      expect(await demandeÀTransmettre('mastora', db)).toBeNull()
      expect((await db.select().from(onboardings))[0]!.intake).toBeNull()
    })

    it('refuse un doublon par slug, par nom ou par domaine, contre les onboardings et les organisations', async () => {
      await enregistrer()
      expect(await enregistrer({ nom: 'Autre' })).toMatchObject({ sorte: 'doublon', par: 'slug', où: 'onboarding' })
      expect(await enregistrer({ slug: 'mastora-2', nom: 'MASTORA' , site: 'https://autre.example' })).toMatchObject({ sorte: 'doublon', par: 'nom' })
      expect(await enregistrer({ slug: 'mastora-2', nom: 'Autre', site: 'https://www.mastora.example/contact' })).toMatchObject({ sorte: 'doublon', par: 'site' })
      await db.insert(organisations).values({ slug: 'heritech', nom: 'Héritech', état: 'abonnee' })
      expect(await enregistrer({ slug: 'heritech-bis', nom: 'Heritech', site: 'https://heritech.example' })).toMatchObject({ sorte: 'doublon', par: 'nom', où: 'organisation', slug: 'heritech' })
    })

    it('deux créneaux Cowork par semaine de Paris, pas trois', async () => {
      const cowork = (n: number) => ({ slug: `c-${n}`, nom: `Cowork ${n}`, site: `https://c${n}.example/`, exécuteur: 'cowork' })
      expect((await enregistrer(cowork(1))).sorte).toBe('enregistrée')
      expect((await enregistrer(cowork(2))).sorte).toBe('enregistrée')
      expect(await créneauxCoworkPris(MAINTENANT, db)).toBe(2)
      expect(await enregistrer(cowork(3))).toEqual({ sorte: 'créneaux-cowork', pris: 2 })
      // La semaine suivante, les créneaux se libèrent.
      expect((await enregistrer(cowork(3), new Date('2026-11-09T10:00:00Z'))).sorte).toBe('enregistrée')
    })

    it('efface l’intake au-delà de trente jours, et seulement lui', async () => {
      await enregistrer({}, new Date('2026-09-20T10:00:00Z'))
      await enregistrer({ slug: 'recent', nom: 'Récent', site: 'https://recent.example/' })
      expect(await effacerLesDemandesAnciennes(MAINTENANT, db)).toBe(1)
      const lignes = await db.select().from(onboardings)
      expect(lignes.find((l) => l.slug === 'mastora')).toMatchObject({ intake: null, nom: 'Mastora' })
      expect(lignes.find((l) => l.slug === 'recent')!.intake).not.toBeNull()
    })
  })

  describe('le rapport des commandes Cowork (lot 4)', () => {
    const rapport = (plus: Partial<Parameters<typeof rapporterUnOnboarding>[0]> = {}) =>
      rapporterUnOnboarding({ slug: 'suneido', statut: 2, registre: REGISTRE, motif: null, nom: 'Suneido', site: 'https://suneido.example/', maintenant: MAINTENANT, exécuteur: 'cowork', ...plus }, db)

    it('crée l’onboarding Cowork qui manque ; sans « cowork », le rapport reste refusé', async () => {
      expect(await rapport({ exécuteur: null })).toBe('inconnu')
      expect(await rapport()).toBe('créé')
      const [ligne] = await db.select().from(onboardings)
      expect(ligne).toMatchObject({ slug: 'suneido', exécuteur: 'cowork', crééPar: 'cowork', statutRapporté: 2, registreNotion: REGISTRE, nom: 'Suneido' })
      expect(await rapport({ statut: 4 })).toBe('rapporté')
      expect(await db.select().from(onboardings)).toHaveLength(1)
    })

    it('rattache la demande Cowork du formulaire de même nom, et prend le slug du registre', async () => {
      await enregistrerUneDemande(
        { demande: { slug: 'suneido-sas', nom: 'Suneido SAS', site: 'https://suneido.example/', exécuteur: 'cowork', intake: { objectifs: null, lecteurFinal: null, emailDuLecteurFinal: null } }, opératrice: 'Agathe', maintenant: MAINTENANT },
        db,
      )
      expect(await rapport({ nom: 'SUNEIDO sas' })).toBe('rattaché')
      const lignes = await db.select().from(onboardings)
      expect(lignes).toHaveLength(1)
      expect(lignes[0]).toMatchObject({ slug: 'suneido', crééPar: 'Agathe', registreNotion: REGISTRE, intake: null })
    })

    it('un onboarding de l’API garde son exécuteur quand une commande Cowork rapporte dessus', async () => {
      await ouvrir(db, { slug: 'suneido' })
      expect(await rapport({ statut: 6 })).toBe('rapporté')
      expect((await db.select().from(onboardings))[0]).toMatchObject({ exécuteur: 'api', statutRapporté: 6 })
    })
  })
})

