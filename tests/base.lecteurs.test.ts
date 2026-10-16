import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { appliquerImport, planifierImport, type LigneAccèsNotion } from '@/lib/base/import-acces'
import {
  espacesAvecLecteurs,
  lireLecteurActifParEmail,
  lireLecteurParIdentifiant,
  organisationParSlug,
} from '@/lib/base/lecteurs'
import { lecteurs, organisations } from '@/lib/base/schema'
import { baseEnMémoire } from './aide/base-en-memoire'

const REGISTRE_HERMITAGE = '3d5fe829ce71810da651f3783a725bd8'
const REGISTRE_KONICA = '3d8fe829ce7181368bd3e1b0d109b9fe'

const ligne = (surcharge: Partial<LigneAccèsNotion> = {}): LigneAccèsNotion => ({
  nom: 'Claire Martin',
  email: 'claire@hermitage.fr',
  organisationLibellé: 'L’Hermitage',
  organisationId: REGISTRE_HERMITAGE,
  slug: 'hermitage',
  identifiant: 'a'.repeat(32),
  actif: true,
  tousLesEspaces: false,
  ...surcharge,
})

describe('planifierImport, sans base', () => {
  it('normalise l’identifiant du registre comme la lecture Notion', () => {
    const plan = planifierImport([
      ligne({ organisationId: '3D5FE829-CE71-810D-A651-F3783A725BD8' }),
    ])
    expect(plan.organisations).toEqual([
      { slug: 'hermitage', nom: 'L’Hermitage', registreNotion: REGISTRE_HERMITAGE },
    ])
    expect(plan.écartés).toEqual([])
  })

  it('écarte les deux lignes d’un identifiant partagé, comme Notion refuse les deux liens', () => {
    const plan = planifierImport([
      ligne({ email: 'claire@hermitage.fr' }),
      ligne({ email: 'paul@hermitage.fr', nom: 'Paul' }),
    ])
    expect(plan.lecteurs).toEqual([])
    expect(plan.écartés.map((écart) => écart.raison)).toEqual([
      'identifiant d’accès partagé avec une autre ligne',
      'identifiant d’accès partagé avec une autre ligne',
    ])
  })

  it('écarte une ligne sans identifiant, sans slug ou sans organisation', () => {
    const plan = planifierImport([
      ligne({ identifiant: '' }),
      ligne({ identifiant: 'b'.repeat(32), slug: '' }),
      ligne({ identifiant: 'c'.repeat(32), organisationId: '' }),
    ])
    expect(plan.lecteurs).toEqual([])
    expect(plan.écartés.map((écart) => écart.raison)).toEqual([
      'identifiant d’accès vide',
      'slug vide',
      'identifiant Notion de l’organisation vide',
    ])
  })

  it('écarte un slug qui porte deux organisations : le piège de la page organisation', () => {
    const plan = planifierImport([
      ligne(),
      ligne({ identifiant: 'b'.repeat(32), email: 'paul@hermitage.fr', organisationId: REGISTRE_KONICA }),
    ])
    expect(plan.organisations).toEqual([])
    expect(plan.lecteurs).toEqual([])
    expect(plan.écartés).toHaveLength(2)
  })

  it('écarte la seconde adresse identique d’un même client, casse ignorée', () => {
    const plan = planifierImport([ligne(), ligne({ identifiant: 'b'.repeat(32), email: 'Claire@Hermitage.fr' })])
    expect(plan.lecteurs).toHaveLength(1)
    expect(plan.écartés.map((écart) => écart.raison)).toEqual([
      'adresse déjà portée par une autre ligne de ce client',
    ])
  })

  it('ne met jamais d’adresse ni d’identifiant en clair dans le rapport', () => {
    const plan = planifierImport([ligne(), ligne({ email: 'paul@hermitage.fr' })])
    const rapport = JSON.stringify(plan.écartés)
    expect(rapport).not.toContain('claire@hermitage.fr')
    expect(rapport).not.toContain('a'.repeat(32))
  })
})

describe('import et lectures sur une vraie base', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  const importer = (lignes: LigneAccèsNotion[]) => appliquerImport(db, planifierImport(lignes))

  const deuxClients = [
    ligne(),
    ligne({ nom: 'Paul', email: 'paul@hermitage.fr', identifiant: 'b'.repeat(32), actif: false }),
    ligne({
      nom: 'Opératrice',
      email: 'agathe@signauxfaibles.io',
      identifiant: 'c'.repeat(32),
      tousLesEspaces: true,
    }),
    ligne({
      nom: 'Jeanne',
      email: 'jeanne@konica.fr',
      identifiant: 'd'.repeat(32),
      slug: 'konica-minolta-france',
      organisationLibellé: 'Konica Minolta',
      organisationId: REGISTRE_KONICA,
    }),
  ]

  it('rend le même accès que la lecture Notion, clé de cloisonnement comprise', async () => {
    await importer(deuxClients)
    expect(await lireLecteurParIdentifiant('a'.repeat(32), db)).toEqual({
      nom: 'Claire Martin',
      email: 'claire@hermitage.fr',
      organisationLibellé: 'L’Hermitage',
      organisationId: REGISTRE_HERMITAGE,
      slug: 'hermitage',
      actif: true,
      tousLesEspaces: false,
    })
  })

  it('rend un accès révoqué tel quel, c’est l’appelant qui refuse', async () => {
    await importer(deuxClients)
    expect((await lireLecteurParIdentifiant('b'.repeat(32), db))?.actif).toBe(false)
    expect(await lireLecteurParIdentifiant('e'.repeat(32), db)).toBeNull()
  })

  it('trouve un lecteur actif par email, casse ignorée, et pas un révoqué', async () => {
    await importer(deuxClients)
    expect((await lireLecteurActifParEmail('CLAIRE@hermitage.fr ', db))?.identifiant).toBe('a'.repeat(32))
    expect(await lireLecteurActifParEmail('paul@hermitage.fr', db)).toBeNull()
  })

  it('refuse une adresse inscrite chez deux clients plutôt que d’en choisir un', async () => {
    await importer([
      ...deuxClients,
      ligne({
        nom: 'Claire chez Konica',
        identifiant: 'f'.repeat(32),
        slug: 'konica-minolta-france',
        organisationLibellé: 'Konica Minolta',
        organisationId: REGISTRE_KONICA,
      }),
    ])
    expect(await lireLecteurActifParEmail('claire@hermitage.fr', db)).toBeNull()
  })

  it('l’accès opérateur ne trouve qu’un espace qui a un lecteur actif', async () => {
    await importer(deuxClients)
    expect(await organisationParSlug('konica-minolta-france', db)).toEqual({
      organisationId: REGISTRE_KONICA,
      organisationLibellé: 'Konica Minolta',
    })
    await db.update(lecteurs).set({ actif: false }).where(eq(lecteurs.identifiantAcces, 'd'.repeat(32)))
    expect(await organisationParSlug('konica-minolta-france', db)).toBeNull()
    expect(await organisationParSlug('inconnu', db)).toBeNull()
  })

  it('liste les espaces avec leurs lecteurs actifs, sans compter l’opérateur global', async () => {
    await importer(deuxClients)
    expect(await espacesAvecLecteurs(db)).toEqual([
      { slug: 'konica-minolta-france', organisationLibellé: 'Konica Minolta', lecteurs: 1 },
      { slug: 'hermitage', organisationLibellé: 'L’Hermitage', lecteurs: 1 },
    ])
  })

  it('importe l’opérateur sans client : son privilège est global', async () => {
    const plan = planifierImport(deuxClients)
    expect(plan.opérateurs.map((o) => o.identifiant)).toEqual(['c'.repeat(32)])
    expect(plan.lecteurs.map((l) => l.identifiant)).not.toContain('c'.repeat(32))

    await appliquerImport(db, plan)
    const [ligne] = await db.select().from(lecteurs).where(eq(lecteurs.identifiantAcces, 'c'.repeat(32)))
    expect(ligne?.organisationId).toBeNull()
    expect(ligne?.rôle).toBe('operateur')

    expect(await lireLecteurParIdentifiant('c'.repeat(32), db)).toEqual({
      nom: 'Opératrice',
      email: 'agathe@signauxfaibles.io',
      organisationLibellé: '',
      organisationId: '',
      slug: '',
      actif: true,
      tousLesEspaces: true,
    })
    expect((await lireLecteurActifParEmail('agathe@signauxfaibles.io', db))?.identifiant).toBe('c'.repeat(32))
  })

  it('un opérateur importé n’est pas désactivé au passage suivant', async () => {
    await importer(deuxClients)
    const second = await importer(deuxClients)
    expect(second.lecteursDésactivés).toBe(0)
    expect((await lireLecteurParIdentifiant('c'.repeat(32), db))?.actif).toBe(true)
  })

  it('refuse un lecteur sans client qui n’a pas le privilège opérateur', async () => {
    await db.insert(lecteurs).values({ nom: 'Orphelin', identifiantAcces: 'e'.repeat(32), tousLesEspaces: false })
    expect(await lireLecteurParIdentifiant('e'.repeat(32), db)).toBeNull()
  })

  it('est rejouable, et désactive sans supprimer qui a quitté Notion', async () => {
    await importer(deuxClients)
    const rapport = await importer(deuxClients.filter((l) => l.identifiant !== 'd'.repeat(32)))
    expect(rapport.lecteursDésactivés).toBe(1)
    expect((await lireLecteurParIdentifiant('d'.repeat(32), db))?.actif).toBe(false)
    expect(await db.select().from(lecteurs)).toHaveLength(4)

    // Rejouer à l'identique ne change plus rien.
    const second = await importer(deuxClients.filter((l) => l.identifiant !== 'd'.repeat(32)))
    expect(second.lecteursDésactivés).toBe(0)
  })

  it('crée les clients historiques abonnés et sous relecture', async () => {
    await importer(deuxClients)
    const [hermitage] = await db.select().from(organisations).where(eq(organisations.slug, 'hermitage'))
    expect(hermitage?.état).toBe('abonnee')
    expect(hermitage?.relectureRequise).toBe(true)
  })

  it('refuse l’accès d’une organisation sans ligne de registre ou archivée', async () => {
    await importer(deuxClients)
    await db.update(organisations).set({ registreNotion: null }).where(eq(organisations.slug, 'hermitage'))
    expect(await lireLecteurParIdentifiant('a'.repeat(32), db)).toBeNull()

    await db
      .update(organisations)
      .set({ archivéeLe: new Date() })
      .where(eq(organisations.slug, 'konica-minolta-france'))
    expect(await lireLecteurParIdentifiant('d'.repeat(32), db)).toBeNull()
  })

  it('la base refuse un identifiant d’accès en double, la panne du 11 septembre', async () => {
    await importer(deuxClients)
    const [organisation] = await db.select().from(organisations).limit(1)
    await expect(
      db.insert(lecteurs).values({
        organisationId: organisation!.id,
        nom: 'Copie',
        identifiantAcces: 'a'.repeat(32),
      }),
    ).rejects.toThrow()
  })

  it('la base refuse une même adresse deux fois chez un client, casse ignorée', async () => {
    await importer(deuxClients)
    const [hermitage] = await db.select().from(organisations).where(eq(organisations.slug, 'hermitage'))
    await expect(
      db.insert(lecteurs).values({
        organisationId: hermitage!.id,
        nom: 'Doublon',
        email: 'CLAIRE@HERMITAGE.FR',
        identifiantAcces: 'e'.repeat(32),
      }),
    ).rejects.toThrow()
  })
})

describe('défauts relevés par la relecture du 16 octobre 2026', () => {
  let db: Base
  let fermer: () => Promise<void>

  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fermer()
  })

  it('une erreur de base ne porte ni l’identifiant ni l’adresse demandés', async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const client = new PGlite()
    const sansMigration = drizzle({ client }) as unknown as Base
    try {
      const identifiant = '0123456789abcdef0123456789abcdef'
      const erreur = await lireLecteurParIdentifiant(identifiant, sansMigration).catch((e: unknown) => e)
      expect(erreur).toBeInstanceOf(Error)
      expect((erreur as Error).message).not.toContain(identifiant)
      expect((erreur as Error).message).toContain('42P01')

      const parEmail = await lireLecteurActifParEmail('secret@client.fr', sansMigration).catch((e: unknown) => e)
      expect((parEmail as Error).message).not.toContain('secret@client.fr')
    } finally {
      await client.close()
    }
  })

  it('un slug devenu ambigu ne ferme pas les accès déjà importés', async () => {
    await appliquerImport(db, planifierImport([ligne()]))
    // Une seconde ligne arrive avec l'identifiant de la page organisation.
    const plan = planifierImport([
      ligne(),
      ligne({ identifiant: 'b'.repeat(32), email: 'paul@hermitage.fr', organisationId: REGISTRE_KONICA }),
    ])
    expect(plan.préservés).toContain('a'.repeat(32))
    const rapport = await appliquerImport(db, plan)
    expect(rapport.lecteursDésactivés).toBe(0)
    expect((await lireLecteurParIdentifiant('a'.repeat(32), db))?.actif).toBe(true)
  })

  it('entre deux lignes de même adresse, la ligne active est gardée', () => {
    const plan = planifierImport([
      ligne({ identifiant: 'b'.repeat(32), actif: false }),
      ligne({ identifiant: 'a'.repeat(32), actif: true }),
    ])
    expect(plan.lecteurs.map((l) => l.identifiant)).toEqual(['a'.repeat(32)])
  })

  it('une organisation portée par deux slugs est écartée sans faire échouer l’import', async () => {
    const plan = planifierImport([
      ligne(),
      ligne({ identifiant: 'b'.repeat(32), email: 'jeanne@ailleurs.fr', slug: 'hermitage-bis' }),
      ligne({
        identifiant: 'd'.repeat(32),
        email: 'jeanne@konica.fr',
        slug: 'konica-minolta-france',
        organisationId: REGISTRE_KONICA,
      }),
    ])
    expect(plan.organisations.map((o) => o.slug)).toEqual(['konica-minolta-france'])
    expect([...plan.préservés].sort()).toEqual(['a'.repeat(32), 'b'.repeat(32)])
    await expect(appliquerImport(db, plan)).resolves.toMatchObject({ organisations: 1 })
  })

  it('la base refuse un identifiant vide et un registre mal formé', async () => {
    await expect(
      db.insert(organisations).values({ slug: 'x', nom: 'X', état: 'test', registreNotion: 'page-organisation' }),
    ).rejects.toThrow()
    const [créée] = await db
      .insert(organisations)
      .values({ slug: 'y', nom: 'Y', état: 'test' })
      .returning({ id: organisations.id })
    await expect(
      db.insert(lecteurs).values({ organisationId: créée!.id, nom: 'Vide', identifiantAcces: '  ' }),
    ).rejects.toThrow()
  })
})
