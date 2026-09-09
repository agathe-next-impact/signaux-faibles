import { describe, expect, it } from 'vitest'
import { tagsÀInvalider } from '@/lib/notion/webhook'

describe('tagsÀInvalider', () => {
  it('invalide la page et sa liste quand une propriété change', () => {
    expect(
      tagsÀInvalider({
        type: 'page.properties_updated',
        entity: { id: 'page-1', type: 'page' },
        data: { parent: { id: 'ds-1', type: 'data_source' } },
      }),
    ).toEqual(['page:page-1', 'liste:ds-1'])
  })

  it('invalide aussi la liste sur un changement de contenu, l’ordre n’étant pas garanti', () => {
    expect(
      tagsÀInvalider({
        type: 'page.content_updated',
        entity: { id: 'page-1', type: 'page' },
        data: { parent: { id: 'ds-1', type: 'data_source' } },
      }),
    ).toContain('liste:ds-1')
  })

  it('se contente de la page quand la charge ne dit pas le parent', () => {
    expect(
      tagsÀInvalider({ type: 'page.deleted', entity: { id: 'page-2', type: 'page' } }),
    ).toEqual(['page:page-2'])
  })

  it('refait passer la garde de schéma quand la source change de forme', () => {
    expect(
      tagsÀInvalider({
        type: 'data_source.schema_updated',
        entity: { id: 'ds-1', type: 'data_source' },
      }),
    ).toEqual(['liste:ds-1', 'schema:notion'])
  })

  it('ne touche pas au schéma pour un simple événement de source', () => {
    expect(
      tagsÀInvalider({
        type: 'data_source.content_updated',
        entity: { id: 'ds-1', type: 'data_source' },
      }),
    ).toEqual(['liste:ds-1'])
  })

  it('ne renvoie rien pour une charge qu’il ne sait pas lire', () => {
    expect(tagsÀInvalider({})).toEqual([])
    expect(tagsÀInvalider({ entity: { type: 'comment', id: 'c-1' } })).toEqual([])
  })
})

import { signWebhookPayload } from '@notionhq/client'
import { interpréterLivraison } from '@/lib/notion/webhook'

const SECRET = 'secret_jeton_de_verification_de_test'

const CHARGE = JSON.stringify({
  type: 'page.properties_updated',
  entity: { id: 'page-1', type: 'page' },
  data: { parent: { id: 'ds-1', type: 'data_source' } },
})

describe('interpréterLivraison', () => {
  it('accepte la poignée de main, que Notion n’envoie jamais signée', async () => {
    // C'est le cas qui rend l'abonnement possible : le secret de signature est
    // justement ce que cette livraison apporte, elle ne peut donc pas être
    // vérifiée avec lui.
    const décision = await interpréterLivraison({
      brut: JSON.stringify({ verification_token: 'secret_abc123' }),
      signature: null,
      secret: undefined,
    })
    expect(décision).toEqual({ sorte: 'poignée-de-main', jetonDeVérification: 'secret_abc123' })
  })

  it('n’invalide rien sur une poignée de main, même accompagnée d’une entité', async () => {
    const décision = await interpréterLivraison({
      brut: JSON.stringify({
        verification_token: 'secret_abc123',
        entity: { id: 'page-1', type: 'page' },
      }),
      signature: null,
      secret: SECRET,
    })
    expect(décision.sorte).toBe('poignée-de-main')
  })

  it('accepte une livraison correctement signée et rend ses tags', async () => {
    const signature = await signWebhookPayload({ body: CHARGE, verificationToken: SECRET })
    const décision = await interpréterLivraison({ brut: CHARGE, signature, secret: SECRET })
    expect(décision).toEqual({ sorte: 'invalider', tags: ['page:page-1', 'liste:ds-1'] })
  })

  it('refuse un corps modifié après signature', async () => {
    const signature = await signWebhookPayload({ body: CHARGE, verificationToken: SECRET })
    const altéré = CHARGE.replace('page-1', 'page-2')
    const décision = await interpréterLivraison({ brut: altéré, signature, secret: SECRET })
    expect(décision).toEqual({ sorte: 'refusée', raison: 'signature invalide' })
  })

  it('refuse une signature faite avec un autre jeton', async () => {
    const signature = await signWebhookPayload({ body: CHARGE, verificationToken: 'un-autre' })
    const décision = await interpréterLivraison({ brut: CHARGE, signature, secret: SECRET })
    expect(décision.sorte).toBe('refusée')
  })

  it('refuse une livraison sans signature', async () => {
    const décision = await interpréterLivraison({ brut: CHARGE, signature: null, secret: SECRET })
    expect(décision.sorte).toBe('refusée')
  })

  it('refuse plutôt que d’ouvrir quand le secret n’est pas configuré', async () => {
    const signature = await signWebhookPayload({ body: CHARGE, verificationToken: SECRET })
    const décision = await interpréterLivraison({ brut: CHARGE, signature, secret: undefined })
    expect(décision).toEqual({ sorte: 'refusée', raison: 'NOTION_WEBHOOK_SECRET absent' })
  })

  it('refuse un corps illisible', async () => {
    const décision = await interpréterLivraison({
      brut: 'pas du json',
      signature: 'sha256=peu importe',
      secret: SECRET,
    })
    expect(décision).toEqual({ sorte: 'refusée', raison: 'corps illisible' })
  })

  it('accuse réception sans rien invalider pour un événement qui ne nous concerne pas', async () => {
    const brut = JSON.stringify({ type: 'comment.created', entity: { id: 'c-1', type: 'comment' } })
    const signature = await signWebhookPayload({ body: brut, verificationToken: SECRET })
    const décision = await interpréterLivraison({ brut, signature, secret: SECRET })
    expect(décision).toEqual({ sorte: 'sans-effet' })
  })
})
