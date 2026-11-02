import { describe, expect, it } from 'vitest'
import { adresseVérifiée } from '@/lib/base/adresse'

const base = 'postgresql://u:p@ep-exemple.eu-central-1.aws.neon.tech/neondb'

describe('adresseVérifiée', () => {
  it.each(['require', 'prefer', 'verify-ca'])('écrit verify-full à la place de %s', (mode) => {
    const url = new URL(adresseVérifiée(`${base}?sslmode=${mode}&channel_binding=require`))
    expect(url.searchParams.get('sslmode')).toBe('verify-full')
    expect(url.searchParams.get('channel_binding')).toBe('require')
    expect(url.username).toBe('u')
    expect(url.password).toBe('p')
    expect(url.pathname).toBe('/neondb')
  })

  it.each([
    `${base}?sslmode=verify-full`,
    `${base}?sslmode=disable`,
    `${base}?uselibpqcompat=true&sslmode=require`,
    base,
    '',
    'pas une adresse',
  ])('laisse %s inchangée', (adresse) => {
    expect(adresseVérifiée(adresse)).toBe(adresse)
  })
})
