import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Base } from '@/lib/base/client'
import {
  enregistrerVisite,
  journaliserÉvénement,
  noterLaSynchro,
  ouvrirLEssaiÀLaVisite,
  passerAuStatut,
  prospectionDuLecteur,
  prospectionsEnCours,
  prospectionsRécentes,
  prospectionsÀSynchroniser,
  rattacherLead,
} from '@/lib/base/prospection'
import { abonnements, lecteurs, organisations, prospections } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

describe('prospection (Postgres)', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  async function organisation(état: 'essai' | 'abonnee' | 'demande' = 'essai', activéeLe: Date | null = null) {
    const [o] = await db
      .insert(organisations)
      .values({ slug: `o-${Math.random().toString(36).slice(2, 8)}`, nom: 'Org', état, activéeLe })
      .returning({ id: organisations.id })
    return o!.id
  }
  async function lecteur(organisationId: string | null, email: string, identifiant = Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)) {
    const [l] = await db
      .insert(lecteurs)
      .values({ organisationId, nom: 'Lecteur', email, identifiantAcces: identifiant })
      .returning({ id: lecteurs.id })
    return l!.id
  }

  const reçu = (extras: Partial<Parameters<typeof rattacherLead>[0]> = {}) => ({
    email: 'Serge@Suneido.fr',
    empreinte: 'abcdef01',
    campagne: 'cam_1',
    lead: 'lea_1',
    contact: 'con_1',
    ...extras,
  })

  it('rattache un lead au lecteur qui porte son adresse, en minuscules, en préférant une organisation en prospection', async () => {
    const ancienne = await organisation('abonnee')
    await lecteur(ancienne, 'serge@suneido.fr')
    const enEssai = await organisation('essai')
    const lecteurEnEssai = await lecteur(enEssai, 'serge@suneido.fr')

    const premier = await rattacherLead(reçu(), db)
    expect(premier).toMatchObject({ créée: true, rattachée: true, statut: 'envoye' })
    const [ligne] = await db.select().from(prospections)
    expect(ligne?.lecteurId).toBe(lecteurEnEssai)
    expect(ligne?.organisationId).toBe(enEssai)
    expect(ligne?.leadLemlist).toBe('lea_1')

    const second = await rattacherLead(reçu(), db)
    expect(second).toMatchObject({ id: premier.id, créée: false })
    expect(await db.select().from(prospections)).toHaveLength(1)
  })

  it('crée la ligne même sans lecteur, et la rattache plus tard par l’empreinte', async () => {
    const seule = await rattacherLead(reçu({ lead: null }), db)
    expect(seule).toMatchObject({ créée: true, rattachée: false })

    const org = await organisation()
    const id = await lecteur(org, 'serge@suneido.fr')
    const trouvée = await prospectionDuLecteur({ id, organisationId: org, empreinte: 'abcdef01' }, db)
    expect(trouvée?.id).toBe(seule.id)
    expect(trouvée?.lecteurId).toBe(id)
    expect(trouvée?.organisationId).toBe(org)

    // Les identifiants lemlist arrivent avec le webhook suivant : la ligne les prend, sans doublon.
    const complétée = await rattacherLead(reçu(), db)
    expect(complétée.id).toBe(seule.id)
    expect((await db.select().from(prospections))[0]?.leadLemlist).toBe('lea_1')
  })

  it('journalise chaque événement une fois, et applique son effet au statut', async () => {
    const { id } = await rattacherLead(reçu(), db)
    const base = { survenuLe: new Date('2026-10-19T07:00:00Z'), étape: 1 }

    expect(await journaliserÉvénement(id, { ...base, activité: 'act_1', type: 'emailsSent' }, db)).toEqual({ sorte: 'enregistré', statut: 'envoye' })
    expect(await journaliserÉvénement(id, { ...base, activité: 'act_1', type: 'emailsSent' }, db)).toEqual({ sorte: 'déjà-reçu' })
    expect(await journaliserÉvénement(id, { ...base, activité: 'act_2', type: 'emailsOpened' }, db)).toEqual({ sorte: 'enregistré', statut: 'envoye' })
    expect(await journaliserÉvénement(id, { ...base, activité: 'act_3', type: 'emailsBounced' }, db)).toEqual({ sorte: 'enregistré', statut: 'rebondi' })
    expect(await journaliserÉvénement(id, { ...base, activité: 'act_4', type: 'emailsUnsubscribed' }, db)).toEqual({ sorte: 'enregistré', statut: 'desinscrit' })

    // Désinscrit est final : ni un événement ni un passage de statut ne l'écrase.
    expect(await journaliserÉvénement(id, { ...base, activité: 'act_5', type: 'emailsClicked' }, db)).toEqual({ sorte: 'enregistré', statut: 'desinscrit' })
    expect(await passerAuStatut(id, 'actif', db)).toBe(false)

    const [lue] = await prospectionsRécentes(new Date(0), db)
    expect(lue?.statut).toBe('desinscrit')
    expect(lue?.événements).toEqual({ emailsSent: 1, emailsOpened: 1, emailsBounced: 1, emailsUnsubscribed: 1, emailsClicked: 1 })
  })

  it('la désinscription d’une seule adresse est finale, comme celle du contact', async () => {
    const { id } = await rattacherLead(reçu(), db)
    const base = { survenuLe: new Date('2026-10-19T07:00:00Z'), étape: 1 }
    expect(await journaliserÉvénement(id, { ...base, activité: 'act_v', type: 'variableUnsubscribed' }, db)).toEqual({
      sorte: 'enregistré',
      statut: 'desinscrit',
    })
  })

  it('la première visite d’un lecteur est reconnue une seule fois', async () => {
    const org = await organisation()
    const id = await lecteur(org, 'serge@suneido.fr', 'a'.repeat(32))
    expect(await enregistrerVisite('b'.repeat(32), new Date(), db)).toBeNull()
    const première = await enregistrerVisite('a'.repeat(32), new Date('2026-10-20T08:00:00Z'), db)
    expect(première).toMatchObject({ première: true, lecteurId: id, organisationId: org, email: 'serge@suneido.fr' })
    const seconde = await enregistrerVisite('a'.repeat(32), new Date('2026-10-21T08:00:00Z'), db)
    expect(seconde?.première).toBe(false)
    const [l] = await db.select({ visite: lecteurs.dernièreVisiteLe }).from(lecteurs)
    expect(l?.visite?.toISOString()).toBe('2026-10-21T08:00:00.000Z')
  })

  it('tient la file de ce que lemlist ne sait pas encore', async () => {
    const org = await organisation()
    await lecteur(org, 'serge@suneido.fr')
    const { id } = await rattacherLead(reçu(), db)

    // Nouvelle ligne : son statut n'a jamais été écrit chez lemlist.
    expect((await prospectionsÀSynchroniser(db)).map((p) => p.id)).toEqual([id])
    await noterLaSynchro(id, { statut: 'envoye' }, db)
    expect(await prospectionsÀSynchroniser(db)).toEqual([])

    // Activée : statut à écrire et séquence à arrêter, avec l'adresse pour le faire.
    expect(await passerAuStatut(id, 'actif', db)).toBe(true)
    const [àFaire] = await prospectionsÀSynchroniser(db)
    expect(àFaire).toMatchObject({ statut: 'actif', synchroniséStatut: 'envoye', séquenceArrêtéeLe: null, email: 'serge@suneido.fr', campagneLemlist: 'cam_1' })

    // Un échec se note par son code et laisse la ligne dans la file.
    await noterLaSynchro(id, { erreur: 'lemlist-503' }, db)
    expect((await prospectionsRécentes(new Date(0), db))[0]?.erreurSynchro).toBe('lemlist-503')
    expect(await prospectionsÀSynchroniser(db)).toHaveLength(1)

    await noterLaSynchro(id, { statut: 'actif', séquenceArrêtée: true }, db)
    expect(await prospectionsÀSynchroniser(db)).toEqual([])
    const [lue] = await prospectionsRécentes(new Date(0), db)
    expect(lue?.erreurSynchro).toBeNull()
    expect(lue?.séquenceArrêtéeLe).not.toBeNull()
  })

  it('l’essai d’une organisation entrée par prospection n’ouvre qu’à la première visite, une seule fois', async () => {
    const [o] = await db
      .insert(organisations)
      .values({ slug: 'prospect', nom: 'Prospect', état: 'essai', entréeParProspection: true, essaiOuvertLe: null })
      .returning({ id: organisations.id })
    const visite = new Date('2026-10-20T09:00:00Z')
    expect(await ouvrirLEssaiÀLaVisite(o!.id, visite, db)).toBe(true)
    expect(await ouvrirLEssaiÀLaVisite(o!.id, new Date('2026-10-21T09:00:00Z'), db)).toBe(false)
    const [lue] = await db.select({ essaiOuvertLe: organisations.essaiOuvertLe }).from(organisations)
    expect(lue?.essaiOuvertLe?.toISOString()).toBe(visite.toISOString())

    // Une organisation entrée par une demande a déjà son essai ouvert : rien ne bouge.
    const classique = await organisation('essai')
    expect(await ouvrirLEssaiÀLaVisite(classique, visite, db)).toBe(false)
  })

  it('donne aux prospections en cours ce qu’il faut pour calculer l’étape du parcours', async () => {
    const org = await organisation('essai', new Date('2026-10-05T08:00:00Z'))
    await lecteur(org, 'serge@suneido.fr')
    await rattacherLead(reçu(), db)
    await db.insert(abonnements).values({
      organisationId: org,
      clientStripe: 'cus_1',
      abonnementStripe: 'sub_1',
      état: 'active',
      dernierÉvénement: 'evt_1',
      événementLe: new Date(),
      dernierType: 'customer.subscription.created',
    })
    const [enCours] = await prospectionsEnCours(db)
    expect(enCours).toMatchObject({ statut: 'envoye', organisation: { état: 'essai', activéeLe: new Date('2026-10-05T08:00:00Z') }, abonnement: { état: 'active' } })
  })
})
