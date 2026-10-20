import { describe, expect, it } from 'vitest'
import { interpréterLivraisonLemlist } from '@/lib/lemlist/webhook'

/**
 * Le webhook lemlist n'est pas signé : c'est le secret renvoyé dans le corps
 * qui authentifie la livraison. Rien n'est lu avant qu'il soit vérifié.
 */
const SECRET = 'un-secret-de-webhook-lemlist-suffisant'

const livraison = (corps: Record<string, unknown>) => interpréterLivraisonLemlist({ corps: { secret: SECRET, ...corps }, secret: SECRET })

const envoi = {
  _id: 'act_1',
  type: 'emailsSent',
  createdAt: '2026-10-19T07:00:00.000Z',
  campaignId: 'cam_1',
  leadId: 'lea_1',
  contactId: 'con_1',
  leadEmail: 'Serge@Suneido.fr',
  sequenceStep: 1,
}

describe('interpréterLivraisonLemlist', () => {
  it('refuse sans secret configuré, sans secret reçu, ou avec un secret différent', () => {
    expect(interpréterLivraisonLemlist({ corps: { secret: SECRET, ...envoi }, secret: undefined })).toMatchObject({ sorte: 'refusée' })
    expect(interpréterLivraisonLemlist({ corps: envoi, secret: SECRET })).toMatchObject({ sorte: 'refusée' })
    expect(interpréterLivraisonLemlist({ corps: { ...envoi, secret: 'autre' }, secret: SECRET })).toMatchObject({ sorte: 'refusée' })
    expect(interpréterLivraisonLemlist({ corps: null, secret: SECRET })).toMatchObject({ sorte: 'refusée' })
  })

  it('lit un événement de campagne avec ses identifiants', () => {
    const décision = livraison(envoi)
    expect(décision).toEqual({
      sorte: 'événement',
      événement: {
        activité: 'act_1',
        type: 'emailsSent',
        survenuLe: new Date('2026-10-19T07:00:00.000Z'),
        campagne: 'cam_1',
        lead: 'lea_1',
        contact: 'con_1',
        email: 'Serge@Suneido.fr',
        étape: 1,
      },
    })
  })

  it('ignore les événements qui ne concernent pas la prospection, et les réponses de tiers', () => {
    expect(livraison({ ...envoi, type: 'linkedinVisitDone' })).toEqual({ sorte: 'sans-effet', type: 'linkedinVisitDone' })
    expect(livraison({ ...envoi, type: 'emailsReplied', isThirdPartyReply: true })).toEqual({ sorte: 'sans-effet', type: 'emailsReplied' })
    expect(livraison({})).toEqual({ sorte: 'sans-effet', type: 'inconnu' })
  })

  it('dit ce qui manque quand un événement est inexploitable', () => {
    expect(livraison({ ...envoi, _id: undefined })).toMatchObject({ sorte: 'inexploitable', raison: '_id absent' })
    expect(livraison({ ...envoi, leadEmail: undefined })).toMatchObject({ sorte: 'inexploitable', raison: 'adresse du lead absente' })
  })

  it('tolère une date absente ou illisible, et une étape absente', () => {
    const décision = livraison({ ...envoi, createdAt: 'hier', sequenceStep: undefined })
    expect(décision.sorte).toBe('événement')
    if (décision.sorte === 'événement') {
      expect(Number.isNaN(décision.événement.survenuLe.getTime())).toBe(false)
      expect(décision.événement.étape).toBeNull()
    }
  })

  it('retombe sur l’adresse du contact pour un événement hors campagne', () => {
    const décision = livraison({ _id: 'act_2', type: 'entityUnsubscribed', email: 'serge@suneido.fr' })
    expect(décision).toMatchObject({ sorte: 'événement', événement: { email: 'serge@suneido.fr', campagne: null, lead: null } })
  })

  it('retient la désinscription d’une seule adresse, émise depuis le 30 mars 2026', () => {
    const décision = livraison({ _id: 'act_3', type: 'variableUnsubscribed', email: 'serge@suneido.fr' })
    expect(décision).toMatchObject({ sorte: 'événement', événement: { type: 'variableUnsubscribed' } })
  })
})
