import { describe, expect, it } from 'vitest'
import { décrireLaSonde, lireLeRefusDeNotion, SERVEUR_NOTION, sonderLeServeurNotion } from '@/scripts/taches/notion-mcp'

const JETON = 'ntn_secret_a_ne_jamais_montrer'

/** Les réponses observées sur le serveur hébergé, les 23 et 25 octobre 2026. */
const RESTREINT = JSON.stringify({
  object: 'error',
  status: 403,
  code: 'restricted_resource',
  message: 'This token cannot access Notion MCP.',
  request_id: 'b6617140-4046-48b5-b41d-4b8fe52636f7',
})
const INVALIDE = JSON.stringify({
  object: 'error',
  status: 401,
  code: 'unauthorized',
  message: 'API token is invalid.',
  additional_data: { reason: 'token_invalid' },
  request_id: '5ccb3b01-14bf-47f6-b909-5919869fbba5',
})

function serveur(statut: number, corps: string, relevé?: { url?: string; init?: RequestInit }): typeof fetch {
  return (async (url, init) => {
    if (relevé) {
      relevé.url = String(url)
      relevé.init = init
    }
    return new Response(corps, { status: statut, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

describe('lireLeRefusDeNotion', () => {
  it('distingue un jeton reconnu mais sans accès MCP (403 restricted_resource) : ce n’est pas le bon type de jeton', () => {
    const r = lireLeRefusDeNotion(403, RESTREINT)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('restricted_resource')
    expect(r.message).toBe('This token cannot access Notion MCP.')
    expect(r.requestId).toBe('b6617140-4046-48b5-b41d-4b8fe52636f7')
    expect(r.remède).toMatch(/New MCP token/)
    expect(r.remède).toMatch(/ntn_/)
    expect(r.remède).toMatch(/propriétaire de l’espace/)
  })

  it('distingue un jeton que Notion ne reconnaît pas (401 token_invalid) : la valeur du secret est fausse', () => {
    const r = lireLeRefusDeNotion(401, INVALIDE)
    expect(r.code).toBe('unauthorized')
    expect(r.remède).toMatch(/pas un jeton Notion valide/)
    expect(r.remède).not.toMatch(/New MCP token/)
  })

  it('un 401 sans corps est l’absence de jeton ; un autre refus reste non qualifié mais garde le message', () => {
    expect(lireLeRefusDeNotion(401, '').remède).toMatch(/aucun jeton/)
    const r = lireLeRefusDeNotion(503, JSON.stringify({ object: 'error', code: 'service_unavailable', message: 'Endpoint unavailable.' }))
    expect(r.remède).toMatch(/^refus 503 service_unavailable/)
    expect(r.message).toBe('Endpoint unavailable.')
    expect(lireLeRefusDeNotion(500, 'pas du json').code).toBeNull()
  })
})

describe('sonderLeServeurNotion', () => {
  it('fait au serveur la même requête initialize que le SDK, jeton en Bearer', async () => {
    const relevé: { url?: string; init?: RequestInit } = {}
    const sonde = await sonderLeServeurNotion(JETON, serveur(200, JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', serverInfo: { name: 'Notion', version: '1.2.3' } } }), relevé))
    expect(relevé.url).toBe(SERVEUR_NOTION)
    expect(relevé.init?.method).toBe('POST')
    expect((relevé.init?.headers as Record<string, string>)['authorization']).toBe(`Bearer ${JETON}`)
    expect(JSON.parse(String(relevé.init?.body)).method).toBe('initialize')
    expect(sonde).toEqual({ ok: true, détail: 'session ouverte, serveur Notion 1.2.3' })
  })

  it('lit aussi une réponse en flux d’événements', async () => {
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","serverInfo":{"name":"Notion MCP"}}}\n\n'
    const sonde = await sonderLeServeurNotion(JETON, serveur(200, sse))
    expect(sonde.ok && sonde.détail).toBe('session ouverte, serveur Notion MCP')
  })

  it('rend le refus qualifié, et jamais le jeton', async () => {
    const sonde = await sonderLeServeurNotion(JETON, serveur(403, RESTREINT))
    expect(sonde.ok).toBe(false)
    const ligne = décrireLaSonde(sonde)
    expect(ligne).toContain('HTTP 403 restricted_resource « This token cannot access Notion MCP. »')
    expect(ligne).toContain('request_id b6617140-4046-48b5-b41d-4b8fe52636f7')
    expect(ligne).toMatch(/New MCP token/)
    expect(JSON.stringify(sonde)).not.toContain(JETON)
    expect(ligne).not.toContain(JETON)
  })

  it('un serveur injoignable est un échec nommé, pas une exception', async () => {
    const injoignable = (async () => {
      throw new Error('fetch failed')
    }) as unknown as typeof fetch
    const sonde = await sonderLeServeurNotion(JETON, injoignable)
    expect(sonde.ok).toBe(false)
    expect(décrireLaSonde(sonde)).toMatch(/n’a pas répondu/)
    expect(décrireLaSonde(sonde)).toContain('fetch failed')
  })
})
