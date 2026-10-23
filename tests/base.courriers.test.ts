import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Base } from '@/lib/base/client'
import { enregistrerÉvénementDAbonnement } from '@/lib/base/abonnements'
import {
  abonnementsAnnuelsÀÉchéance,
  conclureCourrier,
  courriersDeParcoursEnSouffrance,
  courriersRécents,
  organisationEtSesLecteurs,
  organisationsEnEssai,
  prévoirCourrier,
} from '@/lib/base/courriers'
import { abonnements, lecteurs, organisations } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

describe('journal des courriers', () => {
  let db: Base
  let fermer: () => Promise<void>
  const REGISTRE = 'aaaabbbbccccddddeeeeffff00003333'

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
  })
  afterEach(async () => {
    await fermer()
  })

  async function organisation(état: 'essai' | 'abonnee' = 'essai', activéeLe: Date | null = new Date('2026-10-05T08:00:00Z')) {
    const [o] = await db
      .insert(organisations)
      .values({ slug: `o-${Math.random().toString(36).slice(2, 8)}`, nom: 'Org', état, activéeLe, registreNotion: état === 'essai' ? REGISTRE : null })
      .returning({ id: organisations.id })
    return o!.id
  }

  it('écrit les liens d’accès sans limite, et retrouve l’organisation par sa clé de registre, tirets compris', async () => {
    const id = await organisation()
    const avecTirets = `${REGISTRE.slice(0, 8)}-${REGISTRE.slice(8, 12)}-${REGISTRE.slice(12, 16)}-${REGISTRE.slice(16, 20)}-${REGISTRE.slice(20)}`
    const a = await prévoirCourrier({ sorte: 'lien_acces', organisation: { registreNotion: avecTirets.toUpperCase() }, lecteurId: null, destinataireEmpreinte: 'abcdef01', déclencheur: 'recevoir-mon-lien' }, db)
    const b = await prévoirCourrier({ sorte: 'lien_acces', organisation: { registreNotion: REGISTRE }, lecteurId: null, destinataireEmpreinte: 'abcdef01', déclencheur: 'activation' }, db)
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    await conclureCourrier(a!, { état: 'envoye', messageGmail: 'm1' }, db)
    await conclureCourrier(b!, { état: 'echec', erreur: 'gmail-403' }, db)

    const journal = await courriersRécents(new Date(0), db)
    expect(journal).toHaveLength(2)
    expect(journal.map((l) => l.état).sort()).toEqual(['echec', 'envoye'])
    expect(new Set(journal.map((l) => l.slug)).size).toBe(1)
    expect(journal.find((l) => l.état === 'envoye')?.messageGmail).toBe('m1')
    expect(journal.find((l) => l.état === 'echec')?.erreur).toBe('gmail-403')
    expect(id).toBeTruthy()
  })

  it('une organisation inconnue n’empêche pas la ligne', async () => {
    const id = await prévoirCourrier({ sorte: 'lien_acces', organisation: { registreNotion: 'pas-une-cle' }, lecteurId: null, destinataireEmpreinte: 'abcdef02', déclencheur: 'activation' }, db)
    expect(id).not.toBeNull()
    expect((await courriersRécents(new Date(0), db))[0]?.slug).toBeNull()
  })

  it('un courrier de parcours ne se réserve qu’une fois par lecteur, et une fois pour la relecture', async () => {
    const org = await organisation()
    const [l] = await db.insert(lecteurs).values({ organisationId: org, nom: 'Léa', email: 'lea@x.fr', identifiantAcces: 'a'.repeat(32) }).returning({ id: lecteurs.id })
    const commun = { organisation: { id: org }, destinataireEmpreinte: '12345678', déclencheur: 'cron' }

    expect(await prévoirCourrier({ ...commun, sorte: 'essai_derniere_parution', lecteurId: l!.id }, db)).not.toBeNull()
    expect(await prévoirCourrier({ ...commun, sorte: 'essai_derniere_parution', lecteurId: l!.id }, db)).toBeNull()
    // Une autre sorte, pour le même lecteur, reste permise.
    expect(await prévoirCourrier({ ...commun, sorte: 'essai_tronquee', lecteurId: l!.id }, db)).not.toBeNull()
    // Relecture : pas de lecteur, et pourtant un seul envoi.
    expect(await prévoirCourrier({ ...commun, sorte: 'essai_tronquee', lecteurId: null }, db)).not.toBeNull()
    expect(await prévoirCourrier({ ...commun, sorte: 'essai_tronquee', lecteurId: null }, db)).toBeNull()
  })

  it('un courrier commercial se réserve une fois par clé ; un brouillon tient la place, un échec la libère', async () => {
    const org = await organisation()
    const [l] = await db.insert(lecteurs).values({ organisationId: org, nom: 'Léa', email: 'lea@x.fr', identifiantAcces: 'b'.repeat(32) }).returning({ id: lecteurs.id })
    const commun = { organisation: { id: org }, destinataireEmpreinte: '12345678', déclencheur: 'stripe', lecteurId: l!.id }

    const a = await prévoirCourrier({ ...commun, sorte: 'paiement_echec', clé: 'sub_1:2026-11-01' }, db)
    expect(a).not.toBeNull()
    await conclureCourrier(a!, { état: 'brouillon', messageGmail: 'gb1' }, db)
    expect(await prévoirCourrier({ ...commun, sorte: 'paiement_echec', clé: 'sub_1:2026-11-01' }, db)).toBeNull()
    // L'échéance suivante est un autre courrier.
    const b = await prévoirCourrier({ ...commun, sorte: 'paiement_echec', clé: 'sub_1:2026-12-01' }, db)
    expect(b).not.toBeNull()
    await conclureCourrier(b!, { état: 'echec', erreur: 'gmail-403' }, db)
    expect(await prévoirCourrier({ ...commun, sorte: 'paiement_echec', clé: 'sub_1:2026-12-01' }, db)).not.toBeNull()

    const journal = await courriersRécents(new Date(0), db)
    expect(journal.find((c) => c.état === 'brouillon')?.messageGmail).toBe('gb1')
    const souffrance = await courriersDeParcoursEnSouffrance(new Date(), db)
    expect(souffrance.map((c) => [c.sorte, c.état])).toEqual([['paiement_echec', 'echec']])
  })

  it('les abonnements annuels actifs à échéance, avec leurs lecteurs, et eux seuls', async () => {
    const org = await organisation('abonnee')
    await db.insert(lecteurs).values({ organisationId: org, nom: 'Léa', email: 'lea@x.fr', identifiantAcces: 'c'.repeat(32) })
    const commun = { organisationId: org, clientStripe: 'cus_1', dernierÉvénement: 'evt', événementLe: new Date(), dernierType: 'customer.subscription.updated' }
    await db.insert(abonnements).values([
      { ...commun, abonnementStripe: 'sub_an', état: 'active', formule: 'annuelle', périodeFin: new Date('2026-11-10T00:00:00Z') },
      { ...commun, abonnementStripe: 'sub_mois', état: 'active', formule: 'mensuelle', périodeFin: new Date('2026-11-10T00:00:00Z') },
      { ...commun, abonnementStripe: 'sub_loin', état: 'active', formule: 'annuelle', périodeFin: new Date('2027-06-10T00:00:00Z') },
      { ...commun, abonnementStripe: 'sub_fini', état: 'canceled', formule: 'annuelle', périodeFin: new Date('2026-11-10T00:00:00Z') },
    ])
    const àÉchéance = await abonnementsAnnuelsÀÉchéance(
      { depuis: new Date('2026-10-23T00:00:00Z'), jusquÀ: new Date('2026-11-22T00:00:00Z') },
      db,
    )
    expect(àÉchéance.map((a) => a.abonnementStripe)).toEqual(['sub_an'])
    expect(àÉchéance[0]!.organisation.lecteurs.map((l) => l.nom)).toEqual(['Léa'])
    expect((await organisationEtSesLecteurs(org, db))?.lecteurs).toHaveLength(1)
  })

  it('un courrier de parcours en échec se retente ; un courrier resté sans issue, non, et le contrôle du soir les voit', async () => {
    const org = await organisation()
    const [l] = await db.insert(lecteurs).values({ organisationId: org, nom: 'Léa', email: 'lea@x.fr', identifiantAcces: 'f'.repeat(32) }).returning({ id: lecteurs.id })
    const commun = { organisation: { id: org }, destinataireEmpreinte: '12345678', déclencheur: 'cron', lecteurId: l!.id }

    const premier = await prévoirCourrier({ ...commun, sorte: 'essai_derniere_parution' }, db)
    await conclureCourrier(premier!, { état: 'echec', erreur: 'gmail-500' }, db)
    const second = await prévoirCourrier({ ...commun, sorte: 'essai_derniere_parution' }, db)
    expect(second).not.toBeNull()
    // Le second reste « prevu » (fonction interrompue) : il bloque le suivant.
    expect(await prévoirCourrier({ ...commun, sorte: 'essai_derniere_parution' }, db)).toBeNull()

    const dansUneHeure = new Date(Date.now() + 60 * 60 * 1000)
    const souffrance = await courriersDeParcoursEnSouffrance(dansUneHeure, db)
    expect(souffrance.map((c) => c.état).sort()).toEqual(['echec', 'prevu'])
    expect(await courriersDeParcoursEnSouffrance(new Date(), db)).toHaveLength(1)
  })

  it('refuse une empreinte mal formée', async () => {
    await expect(
      prévoirCourrier({ sorte: 'lien_acces', organisation: null, lecteurId: null, destinataireEmpreinte: 'lea@x.fr', déclencheur: 'x' }, db),
    ).rejects.toThrow()
  })

  it('organisationsEnEssai ne rend que les essais datés, leurs lecteurs actifs avec adresse, et l’abonnement qui fait foi', async () => {
    const essai = await organisation('essai')
    await organisation('abonnee', null)
    await db.insert(lecteurs).values([
      { organisationId: essai, nom: 'Actif', email: 'actif@x.fr', identifiantAcces: 'b'.repeat(32) },
      { organisationId: essai, nom: 'Inactif', email: 'inactif@x.fr', identifiantAcces: 'c'.repeat(32), actif: false },
      { organisationId: essai, nom: 'Sans adresse', email: null, identifiantAcces: 'd'.repeat(32) },
    ])
    await enregistrerÉvénementDAbonnement(
      { organisationId: essai, clientStripe: 'cus_1', abonnementStripe: 'sub_1', état: 'active', formule: 'mensuelle', périodeFin: null, événementId: 'e1', événementLe: new Date(), type: 'customer.subscription.created' },
      db,
    )

    const liste = await organisationsEnEssai(db)
    expect(liste).toHaveLength(1)
    expect(liste[0]!.lecteurs.map((l) => l.nom)).toEqual(['Actif'])
    expect(liste[0]!.abonnement).toEqual({ état: 'active' })
    expect(liste[0]!.relectureRequise).toBe(true)
  })
})
