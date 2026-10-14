import { beforeEach, describe, expect, it } from 'vitest'
import {
  autoriserLEnvoi,
  avecDuréeMinimale,
  empreinte,
  origineDe,
  réinitialiserLesCompteurs,
} from '@/lib/portail/debit'

const T0 = 1_700_000_000_000
const DIX_MINUTES = 10 * 60 * 1000

describe('autoriserLEnvoi', () => {
  beforeEach(() => réinitialiserLesCompteurs())

  it('laisse passer le premier envoi vers une adresse', () => {
    expect(autoriserLEnvoi('jean@exemple.test', '203.0.113.1', T0)).toEqual({ autorisé: true })
  })

  it('refuse un second envoi vers la même adresse dans la fenêtre', () => {
    autoriserLEnvoi('jean@exemple.test', '203.0.113.1', T0)
    expect(autoriserLEnvoi('jean@exemple.test', '203.0.113.2', T0 + 1000)).toEqual({
      autorisé: false,
      motif: 'email',
    })
  })

  it('accepte de nouveau une fois la fenêtre écoulée', () => {
    autoriserLEnvoi('jean@exemple.test', null, T0)
    expect(autoriserLEnvoi('jean@exemple.test', null, T0 + DIX_MINUTES)).toEqual({ autorisé: true })
  })

  it('ignore la casse et les espaces de l’adresse', () => {
    autoriserLEnvoi('Jean@Exemple.test ', null, T0)
    expect(autoriserLEnvoi('jean@exemple.test', null, T0 + 1).autorisé).toBe(false)
  })

  it('plafonne les envois d’une même origine, toutes adresses confondues', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(autoriserLEnvoi(`lecteur${i}@exemple.test`, '203.0.113.9', T0 + i).autorisé).toBe(true)
    }
    expect(autoriserLEnvoi('lecteur9@exemple.test', '203.0.113.9', T0 + 9)).toEqual({
      autorisé: false,
      motif: 'origine',
    })
  })

  it('ne compte pas d’origine quand elle est inconnue', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(autoriserLEnvoi(`lecteur${i}@exemple.test`, null, T0 + i).autorisé).toBe(true)
    }
  })
})

describe('empreinte', () => {
  it('est courte, stable et ne contient pas l’adresse', () => {
    const marque = empreinte('jean@exemple.test')
    expect(marque).toHaveLength(8)
    expect(marque).toBe(empreinte(' JEAN@exemple.test'))
    expect(marque).not.toContain('@')
    expect(marque).not.toBe(empreinte('jeanne@exemple.test'))
  })
})

describe('origineDe', () => {
  const entêtes = (valeurs: Record<string, string>) => ({
    get: (nom: string) => valeurs[nom.toLowerCase()] ?? null,
  })

  it('prend la première adresse de x-forwarded-for', () => {
    expect(origineDe(entêtes({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }))).toBe('203.0.113.1')
  })

  it('rend null sans en-tête', () => {
    expect(origineDe(entêtes({}))).toBeNull()
    expect(origineDe(entêtes({ 'x-forwarded-for': ' ' }))).toBeNull()
  })
})

describe('avecDuréeMinimale', () => {
  it('ne rend pas la main avant le plancher, même sur un travail immédiat', async () => {
    const début = Date.now()
    const résultat = await avecDuréeMinimale(60, async () => 'fait')
    expect(résultat).toBe('fait')
    expect(Date.now() - début).toBeGreaterThanOrEqual(55)
  })

  it('tient le plancher même quand le travail lève', async () => {
    const début = Date.now()
    await expect(
      avecDuréeMinimale(60, async () => {
        throw new Error('panne')
      }),
    ).rejects.toThrow('panne')
    expect(Date.now() - début).toBeGreaterThanOrEqual(55)
  })
})
