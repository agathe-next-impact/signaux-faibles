import { describe, expect, it } from 'vitest'
import { collections } from '@/lib/payload/collections'
import { editions } from '@/lib/payload/collections/editions'
import { runs } from '@/lib/payload/collections/runs'
import { exactementUneDesDeux, identifiantDeRelation } from '@/lib/payload/relations'

/**
 * Les collections Payload, lues sans démarrer Payload : les objets de
 * configuration suffisent à vérifier le contrat de `docs/programme-lettre-unique.md`.
 */
const sansUtilisateur = { req: { user: null } } as never
const avecUtilisateur = { req: { user: { id: 'operatrice' } } } as never

describe('les collections Payload', () => {
  it('portent les sept slugs attendus, dans l’ordre de l’admin', () => {
    expect(collections.map((collection) => collection.slug)).toEqual([
      'utilisateurs',
      'organisations',
      'filieres',
      'referentiels',
      'editions',
      'prospects',
      'runs',
    ])
  })

  it('aucune ne s’appelle media : Payload n’héberge aucun fichier', () => {
    expect(collections.some((collection) => collection.slug === 'media')).toBe(false)
    expect(collections.some((collection) => collection.upload)).toBe(false)
  })

  it('refusent la lecture sans utilisateur, et l’accordent à un utilisateur', async () => {
    for (const collection of collections) {
      const lecture = collection.access?.read
      expect(typeof lecture, collection.slug).toBe('function')
      expect(await lecture?.(sansUtilisateur), collection.slug).toBe(false)
      expect(await lecture?.(avecUtilisateur), collection.slug).toBe(true)
    }
  })

  it('refusent toute écriture sans utilisateur', async () => {
    for (const collection of collections) {
      for (const geste of ['create', 'update', 'delete'] as const) {
        expect(await collection.access?.[geste]?.(sansUtilisateur), `${collection.slug}.${geste}`).toBe(false)
      }
    }
  })

  it('le journal des runs ne se modifie pas à la main, même authentifié', async () => {
    for (const geste of ['create', 'update', 'delete'] as const) {
      expect(await runs.access?.[geste]?.(avecUtilisateur), geste).toBe(false)
    }
  })

  it('seul utilisateurs porte une authentification', () => {
    expect(collections.filter((collection) => collection.auth).map((collection) => collection.slug)).toEqual([
      'utilisateurs',
    ])
  })
})

describe('la collection editions', () => {
  it('dérive blocs du Markdown en beforeChange, et écrase ce qui aurait été saisi', async () => {
    const crochet = editions.hooks?.beforeChange?.[0]
    expect(crochet).toBeDefined()

    const data: Record<string, unknown> = {
      markdown: ['# L’essentiel', '- Une ligne qui se lit seule.', '', '## Marché', 'Un fait daté.'].join('\n'),
      blocs: 'saisi à la main',
    }
    const résultat = (await crochet?.({ data, operation: 'create' } as never)) as Record<string, unknown>

    const blocs = résultat['blocs'] as Array<{ type: string }>
    expect(Array.isArray(blocs)).toBe(true)
    expect(blocs.map((bloc) => bloc.type)).toEqual(['heading_1', 'bulleted_list_item', 'heading_2', 'paragraph'])
  })

  it('blocs est en lecture seule dans l’admin', () => {
    const blocs = editions.fields.find((champ) => 'name' in champ && champ.name === 'blocs')
    expect(blocs?.type).toBe('json')
    expect((blocs?.admin as { readOnly?: boolean } | undefined)?.readOnly).toBe(true)
  })

  it('invalide le cache après écriture et après suppression', () => {
    expect(editions.hooks?.afterChange?.length).toBeGreaterThan(0)
    expect(editions.hooks?.afterDelete?.length).toBeGreaterThan(0)
  })

  it('porte l’index (organisation, statut, dateEdition) de la requête des écrans', () => {
    expect(editions.indexes).toEqual([{ fields: ['organisation', 'statut', 'dateEdition'] }])
  })

  it('ne demande que les statuts brouillon, publiee et retiree', () => {
    const statut = editions.fields.find((champ) => 'name' in champ && champ.name === 'statut')
    expect(statut?.type).toBe('select')
    const options = (statut as { options?: Array<{ value: string }> }).options ?? []
    expect(options.map((option) => option.value)).toEqual(['brouillon', 'publiee', 'retiree'])
  })
})

describe('les relations', () => {
  it('identifiantDeRelation lit un identifiant nu ou un document peuplé', () => {
    expect(identifiantDeRelation('abc')).toBe('abc')
    expect(identifiantDeRelation(7)).toBe('7')
    expect(identifiantDeRelation({ id: 'abc', nom: 'x' })).toBe('abc')
    expect(identifiantDeRelation({ relationTo: 'organisations', value: 'abc' })).toBe('abc')
    expect(identifiantDeRelation('')).toBeNull()
    expect(identifiantDeRelation(null)).toBeNull()
    expect(identifiantDeRelation(undefined)).toBeNull()
  })

  it('exactementUneDesDeux refuse aucune et refuse les deux', () => {
    const valider = exactementUneDesDeux('filiere', 'organisation ou filière')
    expect(valider('org', { siblingData: { filiere: null } })).toBe(true)
    expect(valider(null, { siblingData: { filiere: 'fil' } })).toBe(true)
    expect(valider(null, { siblingData: {} })).toMatch(/exactement une/)
    expect(valider('org', { siblingData: { filiere: 'fil' } })).toMatch(/exactement une/)
  })
})
