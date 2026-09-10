import { describe, expect, it } from 'vitest'
import {
  composerLienDAccès,
  signerJeton,
  vérifierJeton,
} from '@/lib/auth/jeton'

const SECRET = 'un-secret-de-test-suffisamment-long-pour-etre-realiste'

describe('signerJeton / vérifierJeton', () => {
  it('rend l’identifiant d’origine', () => {
    const jeton = signerJeton('acc_7f3a91', SECRET)
    expect(vérifierJeton(jeton, SECRET)).toBe('acc_7f3a91')
  })

  it('rejette un jeton signé avec un autre secret', () => {
    const jeton = signerJeton('acc_7f3a91', SECRET)
    expect(vérifierJeton(jeton, 'un-autre-secret')).toBeNull()
  })

  it('rejette une signature falsifiée', () => {
    const jeton = signerJeton('acc_7f3a91', SECRET)
    const falsifié = `${jeton.split('.')[0]}.${Buffer.from('faux').toString('base64url')}`
    expect(vérifierJeton(falsifié, SECRET)).toBeNull()
  })

  it('rejette un identifiant modifié dont la signature n’a pas suivi', () => {
    const jeton = signerJeton('acc_victime', SECRET)
    const signature = jeton.split('.')[1]
    const corps = Buffer.from('acc_attaquant').toString('base64url')
    expect(vérifierJeton(`${corps}.${signature}`, SECRET)).toBeNull()
  })

  it('rejette les formes invalides sans distinguer les causes', () => {
    for (const invalide of ['', '.', 'sans-point', 'a.b.c', '.signature', 'corps.']) {
      expect(vérifierJeton(invalide, SECRET)).toBeNull()
    }
  })

  it('refuse de signer un identifiant vide', () => {
    expect(() => signerJeton('', SECRET)).toThrow()
  })

  it('produit un jeton sûr en URL', () => {
    const jeton = signerJeton('accès/avec+caractères=gênants', SECRET)
    expect(jeton).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(vérifierJeton(jeton, SECRET)).toBe('accès/avec+caractères=gênants')
  })

  it('compose un lien vers la route qui redirige immédiatement', () => {
    const lien = composerLienDAccès('acc_7f3a91', SECRET, 'https://signauxfaibles.io')
    expect(lien.startsWith('https://signauxfaibles.io/acces/')).toBe(true)
  })

  it('donne deux jetons différents pour deux identifiants différents', () => {
    expect(signerJeton('a', SECRET)).not.toBe(signerJeton('b', SECRET))
  })
})
