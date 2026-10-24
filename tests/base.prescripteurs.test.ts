import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import {
  créerPrescripteur,
  lireLEspacePrescripteur,
  listeDExclusion,
  réglerLePartage,
  tableauDesPrescripteurs,
} from '@/lib/base/prescripteurs'
import { abonnements, organisations } from '@/lib/base/schema'
import { PARUTIONS_D_ESSAI, PARUTIONS_D_ESSAI_RECOMMANDÉE } from '@/lib/domaine/parcours'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * Les prescripteurs (24 octobre 2026, `docs/prescripteurs.md`) : ils
 * recommandent des clients, et ni eux ni leurs recommandations n'entrent en
 * prospection.
 */
const registre = (n: number) => `aaaabbbbccccddddeeeeffff${String(n).padStart(8, '0')}`

describe('prescripteurs', () => {
  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'cabinet', nom: 'Cabinet Durand', registreNotion: registre(1) }, db)
  })
  afterEach(async () => {
    await fermer()
  })
  const lire = async (slug: string) => (await db.select().from(organisations).where(eq(organisations.slug, slug)))[0]!

  it('fait d’une organisation un prescripteur, de façon rejouable, et refuse un code déjà pris', async () => {
    expect(await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)).toEqual({ sorte: 'créé', code: 'durand' })
    expect(await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)).toEqual({
      sorte: 'déjà-prescripteur',
      code: 'durand',
    })
    expect((await créerPrescripteur({ slug: 'cabinet', code: 'autre', type: 'conseil' }, db)).sorte).toBe('code-pris')
    await ouvrirEnEssai({ slug: 'chambre', nom: 'Chambre', registreNotion: registre(2) }, db)
    expect((await créerPrescripteur({ slug: 'chambre', code: 'durand', type: 'chambre_consulaire' }, db)).sorte).toBe('code-pris')
    expect((await créerPrescripteur({ slug: 'inconnue', code: 'x-y-z', type: 'autre' }, db)).sorte).toBe('organisation-inconnue')
  })

  it('refuse de faire un prescripteur d’une organisation entrée par prospection', async () => {
    await ouvrirEnEssai({ slug: 'prospect', nom: 'Prospect', registreNotion: registre(3), prospection: true }, db)
    expect((await créerPrescripteur({ slug: 'prospect', code: 'prospect', type: 'conseil' }, db)).sorte).toBe('en-prospection')
  })

  it('rattache une organisation recommandée à son prescripteur, avec un essai plus long', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    const r = await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    expect(r.sorte).toBe('créée')
    const o = await lire('client')
    expect(o.recommandéePar).not.toBeNull()
    expect(o.recommandéeLe).not.toBeNull()
    expect(o.entréeParProspection).toBe(false)
    expect(o.parutionsDEssai).toBe(PARUTIONS_D_ESSAI_RECOMMANDÉE)
    // Sans prescripteur, le défaut.
    await ouvrirEnEssai({ slug: 'direct', nom: 'Direct', registreNotion: registre(5) }, db)
    expect((await lire('direct')).parutionsDEssai).toBe(PARUTIONS_D_ESSAI)
  })

  it('le premier prescripteur garde l’organisation', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    await ouvrirEnEssai({ slug: 'chambre', nom: 'Chambre', registreNotion: registre(2) }, db)
    await créerPrescripteur({ slug: 'chambre', code: 'chambre', type: 'chambre_consulaire' }, db)
    await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    const premier = (await lire('client')).recommandéePar
    expect((await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'chambre' }, db)).sorte).toBe(
      'déjà-en-essai',
    )
    expect((await lire('client')).recommandéePar).toBe(premier)
  })

  it('refuse un code inconnu ou inactif, et la recommandation de soi-même', async () => {
    expect((await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'inconnu' }, db)).sorte).toBe(
      'prescripteur-inconnu',
    )
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    expect((await ouvrirEnEssai({ slug: 'cabinet', nom: 'Cabinet Durand', registreNotion: registre(1), prescripteur: 'durand' }, db)).sorte).toBe(
      'recommandée-par-elle-même',
    )
  })

  it('ni un prescripteur ni une organisation recommandée n’entrent en prospection', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    expect((await ouvrirEnEssai({ slug: 'cabinet', nom: 'Cabinet Durand', registreNotion: registre(1), prospection: true }, db)).sorte).toBe(
      'hors-prospection',
    )
    await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    expect((await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prospection: true }, db)).sorte).toBe(
      'hors-prospection',
    )
    expect((await lire('client')).entréeParProspection).toBe(false)
  })

  it('une organisation déjà prospectée n’est pas attribuée', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    await ouvrirEnEssai({ slug: 'prospect', nom: 'Prospect', registreNotion: registre(3), prospection: true }, db)
    expect((await ouvrirEnEssai({ slug: 'prospect', nom: 'Prospect', registreNotion: registre(3), prescripteur: 'durand' }, db)).sorte).toBe(
      'déjà-prospectée',
    )
    expect((await lire('prospect')).recommandéePar).toBeNull()
  })

  it('la base refuse une organisation à la fois prospectée et recommandée', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    await expect(db.update(organisations).set({ entréeParProspection: true }).where(eq(organisations.slug, 'client'))).rejects.toThrow()
  })

  it('la liste d’exclusion porte les prescripteurs et leurs recommandations', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    await ouvrirEnEssai({ slug: 'direct', nom: 'Direct', registreNotion: registre(5) }, db)
    expect(await listeDExclusion(db)).toEqual([
      { slug: 'cabinet', nom: 'Cabinet Durand', registreNotion: registre(1), rôle: 'prescripteur' },
      { slug: 'client', nom: 'Client', registreNotion: registre(4), rôle: 'recommandée' },
    ])
  })

  it('le tableau rend chaque prescripteur et ses organisations, avec l’état Stripe qui fait foi', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    const client = await lire('client')
    await db.insert(abonnements).values({
      organisationId: client.id,
      clientStripe: 'cus_1',
      abonnementStripe: 'sub_1',
      état: 'active',
      dernierÉvénement: 'e1',
      événementLe: new Date('2026-10-24T08:00:00Z'),
      dernierType: 'customer.subscription.created',
    })
    const lignes = await tableauDesPrescripteurs(db)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ slug: 'cabinet', code: 'durand', type: 'conseil', actif: true })
    expect(lignes[0]!.recommandées).toEqual([
      expect.objectContaining({ slug: 'client', état: 'essai', parutionsDEssai: 4, abonnement: { état: 'active' } }),
    ])
    expect(JSON.stringify(lignes)).not.toContain('sub_1')
  })

  it('l’accord de partage ne se pose que sur une organisation recommandée', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    await ouvrirEnEssai({ slug: 'direct', nom: 'Direct', registreNotion: registre(5) }, db)
    expect((await lire('client')).partageAvecPrescripteur).toBe(false)
    expect(await réglerLePartage('client', true, db)).toEqual({ sorte: 'partage-réglé', partage: true })
    expect((await lire('client')).partageAvecPrescripteur).toBe(true)
    expect(await réglerLePartage('direct', true, db)).toEqual({ sorte: 'non-recommandée' })
    expect(await réglerLePartage('absente', true, db)).toEqual({ sorte: 'inconnue' })
  })

  it('l’espace du prescripteur ne montre que ses recommandations qui ont accepté le partage', async () => {
    await créerPrescripteur({ slug: 'cabinet', code: 'durand', type: 'conseil' }, db)
    await ouvrirEnEssai({ slug: 'chambre', nom: 'Chambre', registreNotion: registre(2) }, db)
    await créerPrescripteur({ slug: 'chambre', code: 'chambre', type: 'chambre_consulaire' }, db)
    await ouvrirEnEssai({ slug: 'client', nom: 'Client', registreNotion: registre(4), prescripteur: 'durand' }, db)
    await ouvrirEnEssai({ slug: 'discret', nom: 'Discret', registreNotion: registre(5), prescripteur: 'durand' }, db)
    await ouvrirEnEssai({ slug: 'autre', nom: 'Autre', registreNotion: registre(6), prescripteur: 'chambre' }, db)
    await réglerLePartage('client', true, db)
    await réglerLePartage('autre', true, db)

    const espace = await lireLEspacePrescripteur(registre(1), db)
    expect(espace).toMatchObject({ code: 'durand', actif: true })
    expect(espace!.partagées.map((r) => r.nom)).toEqual(['Client'])
    expect(espace!.partagées[0]).toMatchObject({ état: 'essai', parutionsDEssai: 4, abonnement: null })
    // Rien ne sort qui ne serve à l'étape : ni slug, ni identifiant.
    expect(Object.keys(espace!.partagées[0]!).sort()).toEqual(
      ['abonnement', 'activéeLe', 'nom', 'offre', 'parutionsDEssai', 'recommandéeLe', 'état'].sort(),
    )
    // Un autre prescripteur ne voit que les siennes ; une organisation qui n'est
    // pas prescripteur n'a pas d'espace.
    expect((await lireLEspacePrescripteur(registre(2), db))!.partagées.map((r) => r.nom)).toEqual(['Autre'])
    expect(await lireLEspacePrescripteur(registre(4), db)).toBeNull()
  })
})
