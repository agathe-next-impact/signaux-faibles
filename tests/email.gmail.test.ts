import { describe, expect, it } from 'vitest'
import {
  composerCourrierDAccès,
  composerMessage,
  composerRevendications,
} from '@/lib/email/gmail'

describe('composerRevendications', () => {
  it('emprunte la boîte dédiée et ne demande que gmail.send', () => {
    const r = composerRevendications('sa@projet.iam.gserviceaccount.com', 'acces@signal-faible.fr', 1_000_000)
    expect(r.iss).toBe('sa@projet.iam.gserviceaccount.com')
    expect(r.sub).toBe('acces@signal-faible.fr')
    expect(r.scope).toBe('https://www.googleapis.com/auth/gmail.send')
    expect(r.exp - r.iat).toBeLessThanOrEqual(3600)
  })
})

describe('composerMessage', () => {
  it('produit des fins de ligne CRLF, comme l’exige la RFC 2822', () => {
    const brut = composerMessage(
      { destinataire: 'jean@exemple.test', sujet: 'Sujet', texte: 'Corps' },
      'acces@signal-faible.fr',
      'signauxfaibles',
    )
    expect(brut).toContain('\r\n')
    expect(brut).not.toMatch(/[^\r]\n/)
  })

  it('encode un sujet accentué plutôt que de l’écrire brut', () => {
    const brut = composerMessage(
      { destinataire: 'j@e.test', sujet: 'Votre accès à la veille', texte: 'x' },
      'acces@signal-faible.fr',
      'signauxfaibles',
    )
    expect(brut).toContain('Subject: =?UTF-8?B?')
    expect(brut).not.toContain('Subject: Votre accès')
  })

  it('laisse un sujet ASCII lisible', () => {
    const brut = composerMessage(
      { destinataire: 'j@e.test', sujet: 'Your link', texte: 'x' },
      'a@b.test',
      'signauxfaibles',
    )
    expect(brut).toContain('Subject: Your link')
  })

  it('encode le corps en base64, en préservant les accents', () => {
    const brut = composerMessage(
      { destinataire: 'j@e.test', sujet: 's', texte: 'Voici votre lien personnel.' },
      'a@b.test',
      'signauxfaibles',
    )
    const corps = brut.split('\r\n\r\n')[1] ?? ''
    expect(Buffer.from(corps, 'base64').toString('utf8')).toBe('Voici votre lien personnel.')
  })
})

describe('composerCourrierDAccès', () => {
  it('porte le lien et avertit contre le transfert', () => {
    const message = composerCourrierDAccès('Jean', 'https://signal-faible.fr/acces/abc.def')
    expect(message.texte).toContain('https://signal-faible.fr/acces/abc.def')
    expect(message.texte).toContain('Bonjour Jean,')
    expect(message.texte).toContain('Ne le transférez pas')
  })

  it('reste correct sans nom connu', () => {
    expect(composerCourrierDAccès('  ', 'https://x.test/acces/a.b').texte).toContain('Bonjour,')
  })
})
