import { generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const CLÉ = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

vi.mock('@/lib/env', () => ({
  env: () => ({
    GOOGLE_COMPTE_SERVICE_JSON: JSON.stringify({ client_email: 'sa@projet.iam.gserviceaccount.com', private_key: CLÉ }),
    GMAIL_EXPEDITEUR: 'acces@signauxfaibles.io',
    GMAIL_EXPEDITEUR_NOM: 'signauxfaibles',
  }),
}))

const { boîteOpératrice, composerMessage, déposerChezLOpératrice, ErreurDEnvoi } = await import('@/lib/email/gmail')

/** Décode le message brut déposé, pour lire ses en-têtes. */
function messageDéposé(appel: unknown[]): string {
  const corps = JSON.parse(String((appel[1] as RequestInit).body)) as { message: { raw: string } }
  return Buffer.from(corps.message.raw, 'base64url').toString('utf8')
}

beforeEach(() => {
  vi.stubEnv('GMAIL_BOITE_OPERATRICE', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('boîteOpératrice', () => {
  it('vaut null quand la variable est absente ou vide', () => {
    expect(boîteOpératrice()).toBeNull()
  })

  it('rend l’adresse posée, et refuse une valeur qui casserait un en-tête', () => {
    vi.stubEnv('GMAIL_BOITE_OPERATRICE', ' agathe@next-impact.digital ')
    expect(boîteOpératrice()).toBe('agathe@next-impact.digital')
    vi.stubEnv('GMAIL_BOITE_OPERATRICE', 'agathe@next-impact.digital\r\nBcc: x@y.fr')
    expect(boîteOpératrice()).toBeNull()
  })
})

describe('composerMessage sans destinataire', () => {
  it('omet l’en-tête To au lieu de le poser vide', () => {
    const brut = composerMessage({ destinataire: '', sujet: 'Veille', texte: 'corps' }, 'agathe@next-impact.digital', 'signauxfaibles')
    expect(brut).not.toMatch(/^To:/m)
    expect(brut).toMatch(/^From: signauxfaibles <agathe@next-impact.digital>/m)
  })
})

describe('déposerChezLOpératrice', () => {
  it('emprunte la boîte de l’opératrice en gmail.compose et dépose un brouillon, sans rien envoyer', async () => {
    const fetchSimulé = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'jeton-google' }), { status: 200 })
      }
      return new Response(JSON.stringify({ id: 'r-123', message: { id: 'm-456' } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchSimulé)

    const r = await déposerChezLOpératrice(
      { destinataire: 'eric@heritech.fr, serge@heritech.fr', sujet: 'Veille Heritech : Concurrentiel', texte: 'texte', html: '<p>html</p>' },
      'agathe@next-impact.digital',
      'signauxfaibles',
    )

    expect(r).toEqual({ idBrouillon: 'r-123', idMessage: 'm-456' })
    const [jeton, dépôt] = fetchSimulé.mock.calls
    // Le JWT demande gmail.compose au nom de la boîte de l'opératrice.
    const assertion = new URLSearchParams(String(jeton![1]?.body)).get('assertion')!
    const revendications = JSON.parse(Buffer.from(assertion.split('.')[1]!, 'base64url').toString('utf8'))
    expect(revendications).toMatchObject({ sub: 'agathe@next-impact.digital', scope: 'https://www.googleapis.com/auth/gmail.compose' })
    // Un brouillon, jamais l'envoi.
    expect(dépôt![0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/drafts')
    const brut = messageDéposé(dépôt!)
    expect(brut).toMatch(/^From: signauxfaibles <agathe@next-impact.digital>/m)
    expect(brut).toMatch(/^To: eric@heritech.fr, serge@heritech.fr/m)
    expect(brut).toContain('multipart/alternative')
  })

  it('rend le refus de Gmail avec son statut', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('https://oauth2.googleapis.com/token')
          ? new Response(JSON.stringify({ access_token: 'jeton-google' }), { status: 200 })
          : new Response('forbidden', { status: 403 }),
      ),
    )
    const promesse = déposerChezLOpératrice({ destinataire: '', sujet: 's', texte: 't' }, 'agathe@next-impact.digital', 'n')
    await expect(promesse).rejects.toBeInstanceOf(ErreurDEnvoi)
    await expect(promesse).rejects.toMatchObject({ statut: 403 })
  })
})
