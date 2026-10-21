import { describe, expect, it } from 'vitest'
import { cléDeCloisonnement, identifiantPayload } from '@/lib/payload/portail'

/**
 * La clé de cloisonnement des éditions Payload est l'identifiant Payload de
 * l'organisation, gardé sans tirets dans `registre_notion` (contrainte de forme
 * de la base : 32 hexadécimaux). Les deux sens doivent se correspondre
 * exactement : une clé qui ne retrouverait pas son identifiant filtrerait une
 * liste vide, en silence.
 */
describe('la clé de cloisonnement d’une organisation Payload', () => {
  it('retire les tirets et met en minuscules', () => {
    expect(cléDeCloisonnement('3D8FE829-CE71-8129-A9E6-D073DE3F78C0')).toBe('3d8fe829ce718129a9e6d073de3f78c0')
  })

  it('retrouve l’identifiant Payload depuis la clé, et laisse passer ce qui n’en est pas une', () => {
    expect(identifiantPayload('3d8fe829ce718129a9e6d073de3f78c0')).toBe('3d8fe829-ce71-8129-a9e6-d073de3f78c0')
    expect(identifiantPayload(cléDeCloisonnement('3d8fe829-ce71-8129-a9e6-d073de3f78c0'))).toBe('3d8fe829-ce71-8129-a9e6-d073de3f78c0')
    expect(identifiantPayload('42')).toBe('42')
  })
})
