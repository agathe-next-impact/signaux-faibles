import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { prospectionsRécentes } from '@/lib/base/prospection'
import { abonnements, lecteurs, organisations } from '@/lib/base/schema'
import { clientLemlist, type ClientLemlist, type RésultatLemlist } from '@/lib/lemlist/client'
import { signalerVisite, synchroniserLaProspection, traiterÉvénementLemlist } from '@/lib/portail/prospection'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * Ce que le portail dit à lemlist, et quand. Le faux client note chaque appel ;
 * la base est une vraie base Postgres en mémoire.
 */
function fauxLemlist(réponses: { arrêter?: RésultatLemlist; écrire?: RésultatLemlist } = {}) {
  const appels: string[] = []
  const client: ClientLemlist = {
    arrêterLaSéquence: async (campagne, email) => {
      appels.push(`arrêter ${campagne} ${email}`)
      return réponses.arrêter ?? { ok: true }
    },
    écrireVariables: async (lead, variables) => {
      appels.push(`écrire ${lead} ${JSON.stringify(variables)}`)
      return réponses.écrire ?? { ok: true }
    },
  }
  return { client, appels }
}

const événement = (extras: Partial<Parameters<typeof traiterÉvénementLemlist>[0]> = {}) => ({
  activité: 'act_1',
  type: 'emailsSent' as const,
  survenuLe: new Date('2026-10-19T07:00:00Z'),
  campagne: 'cam_1',
  lead: 'lea_1',
  contact: 'con_1',
  email: 'serge@suneido.fr',
  étape: 1,
  ...extras,
})

describe('prospection (portail)', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
    vi.restoreAllMocks()
  })

  async function organisationEnEssai(activéeLe: Date | null = null) {
    const [o] = await db.insert(organisations).values({ slug: 'suneido', nom: 'Suneido', état: 'essai', activéeLe }).returning({ id: organisations.id })
    await db.insert(lecteurs).values({ organisationId: o!.id, nom: 'Serge', email: 'serge@suneido.fr', identifiantAcces: 'a'.repeat(32) })
    return o!.id
  }

  it('la première visite ouvre l’essai d’une organisation entrée par prospection', async () => {
    const [o] = await db
      .insert(organisations)
      .values({ slug: 'prospect', nom: 'Prospect', état: 'essai', entréeParProspection: true, essaiOuvertLe: null })
      .returning({ id: organisations.id })
    await db.insert(lecteurs).values({ organisationId: o!.id, nom: 'Serge', email: 'serge@suneido.fr', identifiantAcces: 'b'.repeat(32) })
    await signalerVisite('b'.repeat(32), { db, lemlist: null })
    const [lue] = await db.select({ essaiOuvertLe: organisations.essaiOuvertLe }).from(organisations)
    expect(lue?.essaiOuvertLe).not.toBeNull()
  })

  it('sans lemlist, la première visite crée la prospection, déjà active, une seule fois', async () => {
    const [o] = await db
      .insert(organisations)
      .values({ slug: 'pilote', nom: 'Pilote', état: 'essai', entréeParProspection: true, essaiOuvertLe: null })
      .returning({ id: organisations.id })
    await db.insert(lecteurs).values({ organisationId: o!.id, nom: 'Serge', email: 'Serge@Pilote.fr', identifiantAcces: 'c'.repeat(32) })

    await signalerVisite('c'.repeat(32), { db, lemlist: null })
    const lignes = await prospectionsRécentes(new Date(0), db)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ slug: 'pilote', statut: 'actif' })

    await signalerVisite('c'.repeat(32), { db, lemlist: null })
    expect(await prospectionsRécentes(new Date(0), db)).toHaveLength(1)

    // Si lemlist arrive ensuite, son premier webhook complète la même ligne.
    await traiterÉvénementLemlist(événement({ email: 'serge@pilote.fr' }), { db })
    const après = await prospectionsRécentes(new Date(0), db)
    expect(après).toHaveLength(1)
    expect(après[0]).toMatchObject({ statut: 'actif' })
  })

  it('une organisation entrée par une demande n’a pas de prospection à sa première visite', async () => {
    await organisationEnEssai()
    await signalerVisite('a'.repeat(32), { db, lemlist: null })
    expect(await prospectionsRécentes(new Date(0), db)).toEqual([])
  })

  it('l’activation arrête la séquence et écrit le statut, une seule fois', async () => {
    await organisationEnEssai()
    await traiterÉvénementLemlist(événement(), { db })
    const { client, appels } = fauxLemlist()

    await signalerVisite('a'.repeat(32), { db, lemlist: client })
    expect(appels).toEqual(['arrêter cam_1 serge@suneido.fr', 'écrire lea_1 {"sfStatut":"actif"}'])
    const [ligne] = await prospectionsRécentes(new Date(0), db)
    expect(ligne).toMatchObject({ statut: 'actif', synchroniséStatut: 'actif', erreurSynchro: null })
    expect(ligne?.séquenceArrêtéeLe).not.toBeNull()

    // Une seconde visite ne redit rien.
    await signalerVisite('a'.repeat(32), { db, lemlist: client })
    expect(appels).toHaveLength(2)
  })

  it('une activation avant le premier webhook reste en attente, puis se rattrape à la synchronisation', async () => {
    await organisationEnEssai()
    const { client, appels } = fauxLemlist()

    // Visite sans aucune ligne de prospection : rien à signaler, et rien ne casse.
    await signalerVisite('a'.repeat(32), { db, lemlist: client })
    expect(appels).toEqual([])

    // Le webhook arrive ensuite, et la synchronisation quotidienne n'a rien à dire :
    // la ligne naît `envoye`, sans activation connue de son côté.
    await traiterÉvénementLemlist(événement(), { db })
    const rapport = await synchroniserLaProspection({ aujourdHui: '2026-10-20', db, lemlist: client })
    expect(rapport).toMatchObject({ état: 'passée', synchronisées: 1 })
    expect(appels).toEqual(['écrire lea_1 {"sfStatut":"envoye"}'])
  })

  it('un refus de lemlist est noté par son code et retenté le lendemain', async () => {
    await organisationEnEssai()
    await traiterÉvénementLemlist(événement(), { db })
    const enPanne = fauxLemlist({ arrêter: { ok: false, code: 'lemlist-503' } })
    await signalerVisite('a'.repeat(32), { db, lemlist: enPanne.client })
    expect((await prospectionsRécentes(new Date(0), db))[0]).toMatchObject({ statut: 'actif', erreurSynchro: 'lemlist-503', synchroniséStatut: null })

    const rétabli = fauxLemlist()
    const rapport = await synchroniserLaProspection({ aujourdHui: '2026-10-20', db, lemlist: rétabli.client })
    expect(rapport).toMatchObject({ synchronisées: 1, échecs: 0 })
    expect(rétabli.appels).toEqual(['arrêter cam_1 serge@suneido.fr', 'écrire lea_1 {"sfStatut":"actif"}'])
    expect((await prospectionsRécentes(new Date(0), db))[0]).toMatchObject({ synchroniséStatut: 'actif', erreurSynchro: null })
  })

  it('sans clé lemlist, tout est tenu dans Postgres et rien ne part', async () => {
    await organisationEnEssai()
    await traiterÉvénementLemlist(événement(), { db })
    await signalerVisite('a'.repeat(32), { db, lemlist: null })
    const rapport = await synchroniserLaProspection({ aujourdHui: '2026-10-20', db, lemlist: null })
    expect(rapport).toMatchObject({ enAttente: 1, synchronisées: 0 })
    expect((await prospectionsRécentes(new Date(0), db))[0]).toMatchObject({ statut: 'actif', synchroniséStatut: null })
  })

  it('la synchronisation déduit abonné puis résilié de l’étape du parcours, et expiré d’un essai fini', async () => {
    const org = await organisationEnEssai(new Date('2026-09-07T08:00:00Z'))
    await traiterÉvénementLemlist(événement(), { db })
    const { client, appels } = fauxLemlist()

    // J0 le 7 septembre : le 20 octobre, l'essai est fini depuis longtemps.
    await synchroniserLaProspection({ aujourdHui: '2026-10-20', db, lemlist: client })
    expect((await prospectionsRécentes(new Date(0), db))[0]?.statut).toBe('expire')

    // Puis un abonnement Stripe ouvert : abonné, et la séquence arrêtée si elle ne l'était pas.
    await db.insert(abonnements).values({
      organisationId: org,
      clientStripe: 'cus_1',
      abonnementStripe: 'sub_1',
      état: 'active',
      dernierÉvénement: 'evt_1',
      événementLe: new Date(),
      dernierType: 'customer.subscription.created',
    })
    const rapport = await synchroniserLaProspection({ aujourdHui: '2026-10-21', db, lemlist: client })
    expect(rapport.passées).toEqual({ abonne: 1, expire: 0, resilie: 0 })
    expect(appels.at(-2)).toBe('arrêter cam_1 serge@suneido.fr')
    expect(appels.at(-1)).toBe('écrire lea_1 {"sfStatut":"abonne"}')

    // Résilié chez Stripe : résilié ici.
    await db.update(abonnements).set({ état: 'canceled' })
    const après = await synchroniserLaProspection({ aujourdHui: '2026-10-22', db, lemlist: client })
    expect(après.passées).toEqual({ abonne: 0, expire: 0, resilie: 1 })
    expect(appels.at(-1)).toBe('écrire lea_1 {"sfStatut":"resilie"}')
  })

  it('un lead disparu chez lemlist (404) n’est pas retenté indéfiniment', async () => {
    await organisationEnEssai()
    await traiterÉvénementLemlist(événement(), { db })
    const parti = fauxLemlist({ écrire: { ok: false, code: 'lemlist-404' } })
    const rapport = await synchroniserLaProspection({ aujourdHui: '2026-10-20', db, lemlist: parti.client })
    expect(rapport).toMatchObject({ synchronisées: 1, échecs: 0 })
    expect(await synchroniserLaProspection({ aujourdHui: '2026-10-21', db, lemlist: parti.client })).toMatchObject({ synchronisées: 0, enAttente: 0 })
  })

  it('un événement pour une adresse que personne ne porte est journalisé sans rattachement', async () => {
    const issue = await traiterÉvénementLemlist(événement({ email: 'inconnu@exemple.fr' }), { db })
    expect(issue).toMatchObject({ sorte: 'enregistré', rattaché: false })
    expect((await prospectionsRécentes(new Date(0), db))[0]?.slug).toBeNull()
  })
})

describe('client lemlist', () => {
  it('appelle les deux routes documentées, en Basic avec la clé en mot de passe, et ne rend que des codes', async () => {
    const appels: Array<{ url: string; init: RequestInit | undefined }> = []
    const appeler = (async (url: string | URL | Request, init?: RequestInit) => {
      appels.push({ url: String(url), init })
      return new Response('{}', { status: appels.length === 1 ? 200 : 404 })
    }) as unknown as typeof fetch
    const client = clientLemlist('clé-de-test', appeler)

    expect(await client.arrêterLaSéquence('cam_1', 'serge@suneido.fr')).toEqual({ ok: true })
    expect(await client.écrireVariables('lea_1', { sfStatut: 'actif' })).toEqual({ ok: false, code: 'lemlist-404' })

    expect(appels[0]?.url).toBe('https://api.lemlist.com/api/campaigns/cam_1/leads/serge%40suneido.fr/interested')
    expect(appels[0]?.init?.method).toBe('POST')
    expect(appels[1]?.url).toBe('https://api.lemlist.com/api/leads/lea_1/variables?sfStatut=actif')
    expect(appels[1]?.init?.method).toBe('PATCH')
    const autorisation = (appels[0]?.init?.headers as Record<string, string>)['authorization']
    expect(autorisation).toBe(`Basic ${Buffer.from(':clé-de-test').toString('base64')}`)
  })

  it('une panne réseau devient un code, jamais une exception', async () => {
    const client = clientLemlist('clé', (async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch)
    expect(await client.arrêterLaSéquence('cam_1', 'x@y.fr')).toEqual({ ok: false, code: 'lemlist-réseau' })
  })
})
