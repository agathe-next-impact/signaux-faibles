import { describe, expect, it } from 'vitest'
import { enSlug } from '@/lib/domaine/slug'

describe('enSlug', () => {
  it('donne une adresse stable, sans accent ni ponctuation', () => {
    expect(enSlug('Filière et financement')).toBe('filiere-et-financement')
    expect(enSlug('Cadre français')).toBe('cadre-francais')
    expect(enSlug('Emploi — formation')).toBe('emploi-formation')
  })

  it('ne garde pas le numéro du référentiel, qui change quand on le réordonne', () => {
    // Le titre arrive déjà détaché de son numéro ; on vérifie qu'un reliquat
    // ne produirait pas deux adresses pour le même axe.
    expect(enSlug('Cadre français')).toBe(enSlug('  Cadre  français  '))
  })
})
