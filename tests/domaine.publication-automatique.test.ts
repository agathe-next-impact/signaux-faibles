import { describe, expect, it } from 'vitest'
import { attendUnePublication, lireLaPublicationAutomatique, étatÀLaProduction } from '@/lib/domaine/publication-automatique'

describe('publication automatique des synthèses et des marchés', () => {
  it('ne se coupe que par « non »', () => {
    expect(lireLaPublicationAutomatique(undefined)).toBe(true)
    expect(lireLaPublicationAutomatique('')).toBe(true)
    expect(lireLaPublicationAutomatique('oui')).toBe(true)
    expect(lireLaPublicationAutomatique('non')).toBe(false)
    expect(lireLaPublicationAutomatique(' NON ')).toBe(false)
  })

  it('publie à la production, garde un retrait, propose sans publication automatique', () => {
    expect(étatÀLaProduction({ automatique: true, étatsRemplacés: [] })).toBe('publie')
    expect(étatÀLaProduction({ automatique: true, étatsRemplacés: ['publie', 'propose'] })).toBe('publie')
    expect(étatÀLaProduction({ automatique: true, étatsRemplacés: ['publie', 'retire'] })).toBe('retire')
    expect(étatÀLaProduction({ automatique: false, étatsRemplacés: ['publie'] })).toBe('propose')
    expect(étatÀLaProduction({ automatique: false, étatsRemplacés: ['retire'] })).toBe('propose')
  })

  it('une période attend une publication si elle a une ligne proposée et aucune retirée', () => {
    expect(attendUnePublication(['propose'])).toBe(true)
    expect(attendUnePublication(['publie', 'propose'])).toBe(true)
    expect(attendUnePublication(['publie'])).toBe(false)
    expect(attendUnePublication(['propose', 'retire'])).toBe(false)
  })
})
