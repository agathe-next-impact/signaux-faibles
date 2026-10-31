import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { fixerJ0, ouvrirEnEssai, réglerLeParcours, slugsHorsService } from '@/lib/base/organisations'
import { abonnements, lecteurs, organisations, travaux } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

const REGISTRE = 'aaaabbbbccccddddeeeeffff00005555'
const AUTRE = 'aaaabbbbccccddddeeeeffff00006666'

describe('ouverture d’une organisation en essai', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  const lire = async (slug: string) => (await db.select().from(organisations).where(eq(organisations.slug, slug)))[0]!

  it('crée en essai, sans J0, sans relecture, et reste rejouable', async () => {
    const r = await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    expect(r.sorte).toBe('créée')
    const o = await lire('acme')
    expect(o).toMatchObject({ état: 'essai', activéeLe: null, relectureRequise: false, registreNotion: REGISTRE })
    expect((await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)).sorte).toBe('déjà-en-essai')
  })

  it('entrée par prospection : essai créé sans date d’ouverture, qui attend la première visite', async () => {
    const r = await ouvrirEnEssai({ slug: 'prospect', nom: 'Prospect', registreNotion: REGISTRE, prospection: true }, db)
    expect(r.sorte).toBe('créée')
    expect(await lire('prospect')).toMatchObject({ état: 'essai', activéeLe: null, essaiOuvertLe: null, entréeParProspection: true })
    const classique = await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: 'b'.repeat(32) }, db)
    expect(classique.sorte).toBe('créée')
    const o = await lire('acme')
    expect(o.entréeParProspection).toBe(false)
    expect(o.essaiOuvertLe).not.toBeNull()
  })

  it('fait passer demande et génération en essai', async () => {
    await db.insert(organisations).values({ slug: 'gen', nom: 'Gen', état: 'generation' })
    expect((await ouvrirEnEssai({ slug: 'gen', nom: 'Gen SA', registreNotion: REGISTRE }, db)).sorte).toBe('passée-en-essai')
    expect(await lire('gen')).toMatchObject({ état: 'essai', nom: 'Gen SA', registreNotion: REGISTRE })
  })

  it('ne rétrograde jamais un client historique : abonnée avec un lecteur actif, ou suspendue', async () => {
    const [h] = await db.insert(organisations).values({ slug: 'hist', nom: 'Hist', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-16T09:00:00Z') }).returning()
    await db.insert(lecteurs).values({ organisationId: h!.id, nom: 'Léa', email: 'lea@h.fr', identifiantAcces: 'a'.repeat(32) })
    expect(await ouvrirEnEssai({ slug: 'hist', nom: 'Hist', registreNotion: REGISTRE }, db)).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
    await db.insert(organisations).values({ slug: 'susp', nom: 'Susp', état: 'suspendue' })
    expect((await ouvrirEnEssai({ slug: 'susp', nom: 'Susp', registreNotion: AUTRE }, db)).sorte).toBe('état-incompatible')
    expect((await lire('hist')).état).toBe('abonnee')
  })

  it('reprend une abonnée née de l’import pendant l’onboarding : récente, après la mise en service, sans J0 ni abonnement', async () => {
    const maintenant = new Date('2026-10-25T08:00:00Z')
    const [o] = await db.insert(organisations).values({ slug: 'neuve', nom: 'Neuve', état: 'abonnee', relectureRequise: true, registreNotion: REGISTRE, crééeLe: new Date('2026-10-20T08:00:00Z') }).returning()
    // Un lecteur actif ne l'empêche pas : l'import a pu suivre la case Actif.
    await db.insert(lecteurs).values({ organisationId: o!.id, nom: 'Léa', email: 'lea@n.fr', identifiantAcces: 'b'.repeat(32) })
    expect((await ouvrirEnEssai({ slug: 'neuve', nom: 'Neuve', registreNotion: REGISTRE }, db, maintenant)).sorte).toBe('passée-en-essai')
    const lue = await lire('neuve')
    expect(lue).toMatchObject({ état: 'essai', relectureRequise: false })
    expect(lue.essaiOuvertLe?.toISOString()).toBe(maintenant.toISOString())
  })

  it('ne reprend jamais un client historique sans lecteur actif : importé avant la mise en service', async () => {
    await db.insert(organisations).values({ slug: 'vieux', nom: 'Vieux', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-16T09:00:00Z') })
    expect(await ouvrirEnEssai({ slug: 'vieux', nom: 'Vieux', registreNotion: REGISTRE }, db, new Date('2026-10-20T08:00:00Z'))).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
  })

  it('ne reprend pas une abonnée créée il y a plus de quatorze jours', async () => {
    await db.insert(organisations).values({ slug: 'lente', nom: 'Lente', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-19T09:00:00Z') })
    expect((await ouvrirEnEssai({ slug: 'lente', nom: 'Lente', registreNotion: REGISTRE }, db, new Date('2026-11-10T08:00:00Z'))).sorte).toBe('état-incompatible')
  })

  it('un rejeu corrige le registre tant que J0 n’est pas posé, puis le refuse', async () => {
    const r = await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: AUTRE }, db)
    if (r.sorte !== 'créée') throw new Error(r.sorte)
    expect((await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)).sorte).toBe('déjà-en-essai')
    expect((await lire('acme')).registreNotion).toBe(REGISTRE)
    await fixerJ0(r.organisationId, new Date('2026-10-19T12:00:00Z'), db)
    expect(await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: AUTRE }, db)).toEqual({ sorte: 'registre-différent', registreActuel: REGISTRE })
  })

  it('normalise le registre : tirets et majuscules', async () => {
    const avecTirets = `${REGISTRE.slice(0, 8)}-${REGISTRE.slice(8, 12)}-${REGISTRE.slice(12, 16)}-${REGISTRE.slice(16, 20)}-${REGISTRE.slice(20)}`.toUpperCase()
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: avecTirets }, db)
    expect((await lire('acme')).registreNotion).toBe(REGISTRE)
  })

  it('une abonnée récente mais avec un abonnement Stripe reste abonnée', async () => {
    const [o] = await db.insert(organisations).values({ slug: 'payee', nom: 'Payée', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-20T08:00:00Z') }).returning()
    await db.insert(abonnements).values({
      organisationId: o!.id, clientStripe: 'cus_1', abonnementStripe: 'sub_1', état: 'active',
      dernierÉvénement: 'evt_1', événementLe: new Date(), dernierType: 'customer.subscription.created',
    })
    expect(await ouvrirEnEssai({ slug: 'payee', nom: 'Payée', registreNotion: REGISTRE }, db, new Date('2026-10-22T08:00:00Z'))).toEqual({ sorte: 'état-incompatible', état: 'abonnee' })
  })

  it('refuse un registre déjà porté par un autre slug', async () => {
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    expect(await ouvrirEnEssai({ slug: 'acme-bis', nom: 'Acme', registreNotion: REGISTRE }, db)).toEqual({ sorte: 'registre-pris', slug: 'acme' })
  })

  it('fixe J0 une seule fois, et seulement en essai', async () => {
    const r = await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    if (r.sorte !== 'créée') throw new Error(r.sorte)
    const j0 = new Date('2026-10-19T12:00:00Z')
    expect(await fixerJ0(r.organisationId, j0, db)).toBe(true)
    expect(await fixerJ0(r.organisationId, new Date('2026-10-26T12:00:00Z'), db)).toBe(false)
    expect((await lire('acme')).activéeLe?.toISOString()).toBe(j0.toISOString())
    const [h] = await db.insert(organisations).values({ slug: 'hist', nom: 'Hist', état: 'abonnee' }).returning()
    expect(await fixerJ0(h!.id, j0, db)).toBe(false)
  })
})

describe('réglages du parcours par l’opératrice', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  const lire = async (slug: string) => (await db.select().from(organisations).where(eq(organisations.slug, slug)))[0]!
  // J0 posé comme le fait le passage quotidien : à midi UTC, le lundi 28 septembre.
  const J0 = new Date('2026-09-28T12:00:00Z')
  const enEssai = async (activéeLe: Date | null = J0) => {
    await db.insert(organisations).values({ slug: 'acme', nom: 'Acme', état: 'essai', registreNotion: REGISTRE, relectureRequise: false, activéeLe })
  }

  it('décale J0 de semaines entières, à la même heure', async () => {
    await enEssai()
    const r = await réglerLeParcours('acme', { sorte: 'prolonger', semaines: 2 }, db, new Date('2026-10-18T09:00:00Z'))
    expect(r).toEqual({ sorte: 'prolongé', ancienJ0: '2026-09-28', nouveauJ0: '2026-10-12' })
    expect((await lire('acme')).activéeLe?.toISOString()).toBe('2026-10-12T12:00:00.000Z')
  })

  it('accepte un J0 qui tombe aujourd’hui, même avant l’heure de l’ancien', async () => {
    await enEssai()
    // Lundi 19 octobre à 9 h UTC : le J0 décalé de trois semaines tombe le jour même, à midi.
    const r = await réglerLeParcours('acme', { sorte: 'prolonger', semaines: 3 }, db, new Date('2026-10-19T09:00:00Z'))
    expect(r).toEqual({ sorte: 'prolongé', ancienJ0: '2026-09-28', nouveauJ0: '2026-10-19' })
  })

  it('ne pose jamais J0 après aujourd’hui, et dit jusqu’où il peut aller', async () => {
    await enEssai()
    const r = await réglerLeParcours('acme', { sorte: 'prolonger', semaines: 3 }, db, new Date('2026-10-14T09:00:00Z'))
    expect(r).toEqual({ sorte: 'au-delà-d-aujourdhui', j0Maximal: '2026-10-12' })
    expect((await lire('acme')).activéeLe?.toISOString()).toBe(J0.toISOString())
  })

  it('refuse sans J0, hors essai, ou sur un slug inconnu, sans rien écrire', async () => {
    await enEssai(null)
    expect(await réglerLeParcours('acme', { sorte: 'prolonger', semaines: 1 }, db)).toEqual({ sorte: 'sans-j0' })
    await db.insert(organisations).values({ slug: 'hist', nom: 'Hist', état: 'abonnee', activéeLe: J0 })
    expect(await réglerLeParcours('hist', { sorte: 'prolonger', semaines: 1 }, db)).toEqual({ sorte: 'pas-en-essai', état: 'abonnee' })
    expect((await lire('hist')).activéeLe?.toISOString()).toBe(J0.toISOString())
    expect(await réglerLeParcours('personne', { sorte: 'prolonger', semaines: 1 }, db)).toEqual({ sorte: 'inconnue' })
  })

  it('règle la relecture des courriers sans toucher au calendrier', async () => {
    await enEssai()
    expect(await réglerLeParcours('acme', { sorte: 'relecture', requise: true }, db)).toEqual({ sorte: 'relecture-réglée', requise: true })
    expect(await lire('acme')).toMatchObject({ relectureRequise: true, état: 'essai' })
    expect((await lire('acme')).activéeLe?.toISOString()).toBe(J0.toISOString())
    await réglerLeParcours('acme', { sorte: 'relecture', requise: false }, db)
    expect((await lire('acme')).relectureRequise).toBe(false)
  })
})

describe('offre, parutions et mise en parcours (19 octobre 2026)', () => {
  let db: Base
  let fermer: () => Promise<void>
  const MAINTENANT = new Date('2026-10-19T10:00:00Z')
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    await db.insert(organisations).values([
      { slug: 'hist', nom: 'Hist', état: 'abonnee', registreNotion: REGISTRE, crééeLe: new Date('2026-10-16T09:00:00Z') },
      { slug: 'ess', nom: 'Ess', état: 'essai', registreNotion: AUTRE, activéeLe: new Date('2026-10-12T06:00:00Z') },
    ])
  })
  afterEach(async () => {
    await fermer()
  })
  const lire = async (slug: string) => (await db.select().from(organisations).where(eq(organisations.slug, slug)))[0]!

  it('pose l’offre, et un accès offert sur un essai passe en abonnée', async () => {
    expect(await réglerLeParcours('hist', { sorte: 'offre', offre: 'fondateur' }, db, MAINTENANT)).toEqual({ sorte: 'offre-posée', offre: 'fondateur', état: 'abonnee' })
    expect((await lire('hist')).offre).toBe('fondateur')
    expect(await réglerLeParcours('ess', { sorte: 'offre', offre: 'gratuite' }, db, MAINTENANT)).toEqual({ sorte: 'offre-posée', offre: 'gratuite', état: 'abonnee' })
    expect(await lire('ess')).toMatchObject({ offre: 'gratuite', état: 'abonnee' })
  })

  it('règle les parutions complètes, dans les bornes', async () => {
    expect(await réglerLeParcours('ess', { sorte: 'parutions', parutions: 4 }, db, MAINTENANT)).toEqual({ sorte: 'parutions-réglées', parutions: 4 })
    expect((await lire('ess')).parutionsDEssai).toBe(4)
    expect(await réglerLeParcours('ess', { sorte: 'parutions', parutions: 9 }, db, MAINTENANT)).toEqual({ sorte: 'parutions-invalides', parutions: 4 })
  })

  it('fait entrer un client historique dans le parcours : J0 déduit de la prochaine lettre et des parutions restantes', async () => {
    // Prochaine lettre le jeudi 22 octobre, une seule parution complète restante
    // sur deux (le défaut) : J0 tombe le lundi 12 octobre, une semaine avant le
    // lundi 19.
    const r = await réglerLeParcours('hist', { sorte: 'parcours', prochaineLettre: '2026-10-22', restantes: 1 }, db, MAINTENANT)
    expect(r).toEqual({ sorte: 'mis-en-parcours', j0: '2026-10-12', parutions: 2, restantes: 1 })
    const o = await lire('hist')
    expect(o).toMatchObject({ état: 'essai', essaiOuvertLe: MAINTENANT })
    expect(o.activéeLe?.toISOString()).toBe('2026-10-12T06:00:00.000Z')
    // Deux restantes : J0 la semaine même de la prochaine lettre.
    const r2 = await réglerLeParcours('hist', { sorte: 'parcours', prochaineLettre: '2026-10-22', restantes: 2 }, db, MAINTENANT)
    expect(r2).toMatchObject({ sorte: 'mis-en-parcours', j0: '2026-10-19' })
    // Trois parutions réglées, une restante : J0 deux semaines avant.
    await réglerLeParcours('hist', { sorte: 'parutions', parutions: 3 }, db, MAINTENANT)
    const r3 = await réglerLeParcours('hist', { sorte: 'parcours', prochaineLettre: '2026-10-22', restantes: 1 }, db, MAINTENANT)
    expect(r3).toEqual({ sorte: 'mis-en-parcours', j0: '2026-10-05', parutions: 3, restantes: 1 })
  })

  it('refuse la mise en parcours d’un abonné Stripe, d’un état hors parcours, ou de restantes hors bornes', async () => {
    const [o] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.slug, 'hist'))
    await db.insert(abonnements).values({
      organisationId: o!.id,
      clientStripe: 'cus_1',
      abonnementStripe: 'sub_1',
      état: 'active',
      dernierÉvénement: 'e1',
      événementLe: MAINTENANT,
      dernierType: 'customer.subscription.updated',
    })
    expect(await réglerLeParcours('hist', { sorte: 'parcours', prochaineLettre: '2026-10-22', restantes: 1 }, db, MAINTENANT)).toEqual({ sorte: 'abonnée-stripe' })
    expect(await réglerLeParcours('ess', { sorte: 'parcours', prochaineLettre: '2026-10-22', restantes: 3 }, db, MAINTENANT)).toEqual({ sorte: 'parutions-invalides', parutions: 2 })
    expect(await réglerLeParcours('ess', { sorte: 'parcours', prochaineLettre: '22/10/2026', restantes: 1 }, db, MAINTENANT)).toEqual({ sorte: 'date-invalide' })
    await db.update(organisations).set({ état: 'ecartee' }).where(eq(organisations.slug, 'ess'))
    expect(await réglerLeParcours('ess', { sorte: 'parcours', prochaineLettre: '2026-10-22', restantes: 1 }, db, MAINTENANT)).toEqual({ sorte: 'pas-en-essai', état: 'ecartee' })
  })
})

describe('décisions de l’opératrice : suspendre, écarter, réactiver', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  const lire = async (slug: string) => (await db.select().from(organisations).where(eq(organisations.slug, slug)))[0]!
  const LE_31 = new Date('2026-10-31T09:00:00Z')

  it('suspendre garde l’état d’avant, abandonne les travaux non pris, et réactiver le rend', async () => {
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    const o = await lire('acme')
    const contexte = {}
    await db.insert(travaux).values([
      { type: 'lettre', organisationId: o.id, échéance: LE_31, état: 'a_faire', contexte },
      { type: 'revue', organisationId: o.id, échéance: LE_31, état: 'refuse', contexte },
      { type: 'referentiel', organisationId: o.id, échéance: LE_31, état: 'pris', contexte },
    ])

    const r = await réglerLeParcours('acme', { sorte: 'décision', décision: 'suspendre' }, db, LE_31)
    expect(r).toEqual({ sorte: 'décision-appliquée', décision: 'suspendre', état: 'suspendue', travauxAbandonnés: 2 })
    expect(await lire('acme')).toMatchObject({ état: 'suspendue', étatAvantDécision: 'essai', suspendueLe: LE_31 })
    // Le travail déjà pris finit sa course.
    const états = (await db.select({ état: travaux.état }).from(travaux)).map((t) => t.état).sort()
    expect(états).toEqual(['abandonne', 'abandonne', 'pris'])
    // Une organisation suspendue ne se suspend ni ne s'écarte une seconde fois.
    expect((await réglerLeParcours('acme', { sorte: 'décision', décision: 'ecarter' }, db, LE_31)).sorte).toBe('décision-impossible')

    const retour = await réglerLeParcours('acme', { sorte: 'décision', décision: 'reactiver' }, db, LE_31)
    expect(retour).toEqual({ sorte: 'décision-appliquée', décision: 'reactiver', état: 'essai', travauxAbandonnés: 0 })
    expect(await lire('acme')).toMatchObject({ état: 'essai', étatAvantDécision: null, suspendueLe: null })
    expect((await réglerLeParcours('acme', { sorte: 'décision', décision: 'reactiver' }, db, LE_31)).sorte).toBe('décision-impossible')
  })

  it('écarter une abonnée, jamais une organisation de test ; le calendrier sort les deux décisions', async () => {
    await ouvrirEnEssai({ slug: 'acme', nom: 'Acme', registreNotion: REGISTRE }, db)
    await ouvrirEnEssai({ slug: 'autre', nom: 'Autre', registreNotion: AUTRE }, db)
    await db.update(organisations).set({ état: 'abonnee' }).where(eq(organisations.slug, 'acme'))
    expect((await réglerLeParcours('acme', { sorte: 'décision', décision: 'ecarter' }, db, LE_31)).sorte).toBe('décision-appliquée')
    expect(await lire('acme')).toMatchObject({ état: 'ecartee', étatAvantDécision: 'abonnee' })
    expect(await slugsHorsService(['acme', 'autre', 'inconnue'], db)).toEqual(['acme'])
    expect(await slugsHorsService([], db)).toEqual([])

    await db.update(organisations).set({ état: 'test' }).where(eq(organisations.slug, 'autre'))
    expect(await réglerLeParcours('autre', { sorte: 'décision', décision: 'suspendre' }, db, LE_31)).toEqual({
      sorte: 'décision-impossible',
      décision: 'suspendre',
      état: 'test',
    })
    expect((await réglerLeParcours('nulle-part', { sorte: 'décision', décision: 'suspendre' }, db, LE_31)).sorte).toBe('inconnue')
  })
})
