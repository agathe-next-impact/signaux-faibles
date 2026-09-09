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
