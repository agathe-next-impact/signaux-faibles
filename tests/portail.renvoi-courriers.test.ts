import { beforeEach, describe, expect, it, vi } from 'vitest'

const organisationEtSesLecteurs = vi.fn()
const lireAbonnement = vi.fn()
const préparerPourLesLecteurs = vi.fn()

vi.mock('@/lib/base/courriers', () => ({ organisationEtSesLecteurs }))
vi.mock('@/lib/base/abonnements', () => ({ lireAbonnement }))
vi.mock('@/lib/email/gmail', () => ({ adressePostale: () => null }))
vi.mock('@/lib/portail/parcours-courriers', () => ({ préparerPourLesLecteurs }))

const { cléDeRenvoi, estRenvoyable, renvoyerUnCourrierCommercial, SORTES_RENVOYABLES } = await import('@/lib/portail/renvoi-courriers')

const ORG = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'hermitage',
  nom: 'L’Hermitage',
  registreNotion: 'a'.repeat(32),
  offre: 'standard' as const,
  parutionsDEssai: 2,
  lecteurs: [
    { id: '22222222-2222-4222-8222-222222222222', nom: 'Léa', email: 'lea@x.fr' },
    { id: '33333333-3333-4333-8333-333333333333', nom: 'Marc', email: 'marc@x.fr' },
  ],
}
const MAINTENANT = new Date('2026-11-12T05:03:41Z')

describe('renvoi d’un courrier commercial', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    organisationEtSesLecteurs.mockReset().mockResolvedValue(ORG)
    lireAbonnement.mockReset().mockResolvedValue(null)
    préparerPourLesLecteurs.mockReset().mockImplementation(async (e: { sorte: string; organisation: { slug: string; lecteurs: unknown[] } }) =>
      e.organisation.lecteurs.map(() => ({ slug: e.organisation.slug, sorte: e.sorte, destinataire: 'abcdef01', issue: 'brouillon' })),
    )
  })

  it('ne renvoie que les huit courriers commerciaux, ni le lien d’accès ni une lettre', () => {
    expect(SORTES_RENVOYABLES).toHaveLength(8)
    expect(estRenvoyable('essai_tronquee')).toBe(true)
    expect(estRenvoyable('abonnement_resilie')).toBe(true)
    for (const sorte of ['lien_acces', 'lettre', 'lettre_filiere', 'alerte_espaces', 'demande_demo']) expect(estRenvoyable(sorte)).toBe(false)
  })

  it('la clé est la minute de la demande', () => {
    expect(cléDeRenvoi(MAINTENANT)).toBe('renvoi:2026-11-12T05:03')
    expect(cléDeRenvoi(new Date('2026-11-12T05:03:59Z'))).toBe(cléDeRenvoi(MAINTENANT))
  })

  it('prépare un brouillon pour le seul lecteur choisi, déclencheur operatrice, clé de renvoi', async () => {
    const r = await renvoyerUnCourrierCommercial({
      organisationId: ORG.id,
      sorte: 'essai_derniere_parution',
      lecteurId: ORG.lecteurs[1]!.id,
      maintenant: MAINTENANT,
      portailUrl: 'https://signauxfaibles.io',
    })
    expect(r.sorte).toBe('préparé')
    const appel = préparerPourLesLecteurs.mock.calls[0]![0]
    expect(appel.organisation.lecteurs.map((l: { nom: string }) => l.nom)).toEqual(['Marc'])
    expect(appel).toMatchObject({ sorte: 'essai_derniere_parution', clé: 'renvoi:2026-11-12T05:03', déclencheur: 'operatrice' })
    const { sujet, texte } = appel.contenu('Marc', 'marc@x.fr')
    expect(sujet.length).toBeGreaterThan(0)
    expect(texte).toContain('Marc')
  })

  it('sans lecteur désigné, tous les lecteurs actifs', async () => {
    await renvoyerUnCourrierCommercial({ organisationId: ORG.id, sorte: 'essai_rappel_j7', lecteurId: null, maintenant: MAINTENANT, portailUrl: 'https://signauxfaibles.io' })
    expect(préparerPourLesLecteurs.mock.calls[0]![0].organisation.lecteurs).toHaveLength(2)
  })

  it('un lecteur qui n’est pas un lecteur actif de l’organisation ne reçoit rien', async () => {
    const r = await renvoyerUnCourrierCommercial({
      organisationId: ORG.id,
      sorte: 'essai_rappel_j7',
      lecteurId: '44444444-4444-4444-8444-444444444444',
      maintenant: MAINTENANT,
      portailUrl: 'https://signauxfaibles.io',
    })
    expect(r).toEqual({ sorte: 'lecteur-inconnu' })
    expect(préparerPourLesLecteurs).not.toHaveBeenCalled()
  })

  it('un courrier d’abonnement demande la copie Stripe, et écrit son échéance', async () => {
    const sansAbonnement = await renvoyerUnCourrierCommercial({ organisationId: ORG.id, sorte: 'abonnement_renouvellement', lecteurId: null, maintenant: MAINTENANT, portailUrl: 'https://signauxfaibles.io' })
    expect(sansAbonnement).toEqual({ sorte: 'sans-abonnement' })
    expect(préparerPourLesLecteurs).not.toHaveBeenCalled()

    lireAbonnement.mockResolvedValue({ formule: 'annuelle', périodeFin: new Date('2026-12-01T00:00:00Z'), état: 'active' })
    const r = await renvoyerUnCourrierCommercial({ organisationId: ORG.id, sorte: 'abonnement_renouvellement', lecteurId: null, maintenant: MAINTENANT, portailUrl: 'https://signauxfaibles.io' })
    expect(r.sorte).toBe('préparé')
    expect(préparerPourLesLecteurs.mock.calls[0]![0].contenu('Léa', 'lea@x.fr').texte).toContain('décembre 2026')
  })

  it('une organisation inconnue ou archivée ne prépare rien', async () => {
    organisationEtSesLecteurs.mockResolvedValue(null)
    expect(await renvoyerUnCourrierCommercial({ organisationId: ORG.id, sorte: 'essai_suspendu', lecteurId: null, maintenant: MAINTENANT, portailUrl: 'https://signauxfaibles.io' })).toEqual({ sorte: 'organisation-inconnue' })
  })
})
