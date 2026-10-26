import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { définitionDuCollecteur, définitionDuLecteur, consignesDuHarnais } from '@/scripts/taches/executer'
import {
  appelerLePortail,
  créerBrouillon,
  déposerUnCourriel,
  DESTINATAIRE_OPÉRATRICE,
  envoyerÀLOpératrice,
  listerEnvoyés,
  masquer,
  refusDEnvoi,
  type ConfigurationDesOutils,
} from '@/scripts/taches/outils'
import { promptDeLaTâche, POINTEURS, TÂCHES } from '@/scripts/taches/pointeurs'

const JETON = 'jeton-du-portail-0123456789abcdef'

type Appel = { url: string; init: RequestInit }

function configuration(réponses: (url: string, init: RequestInit) => Response, journal: string[] = []) {
  const appels: Appel[] = []
  const portées: string[] = []
  const conf: ConfigurationDesOutils = {
    portail: 'https://www.signauxfaibles.io',
    jetonPortail: JETON,
    compteGoogle: null,
    boîte: 'agathe@next-impact.digital',
    nomExpéditeur: 'Signaux faibles',
    journal: (l) => journal.push(l),
    relevé: { organisations: new Set() },
    fetch: (async (url: string | URL, init?: RequestInit) => {
      appels.push({ url: String(url), init: init ?? {} })
      return réponses(String(url), init ?? {})
    }) as typeof fetch,
    jetonGoogle: async (portée) => {
      portées.push(portée)
      return 'jeton-google'
    },
  }
  return { conf, appels, portées }
}

const json = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut })

describe('appeler_portail', () => {
  it('ajoute lui-même le jeton, ne suit pas une redirection, et ne le rend jamais au modèle', async () => {
    const { conf, appels } = configuration(() => new Response(`{"écho":"Bearer ${JETON}"}`, { status: 200 }))
    const r = await appelerLePortail(conf, 'POST', 'https://www.signauxfaibles.io/api/veille/lint', { page: 'abc' })
    expect(appels).toHaveLength(1)
    const entêtes = appels[0]!.init.headers as Record<string, string>
    expect(entêtes['authorization']).toBe(`Bearer ${JETON}`)
    expect(appels[0]!.init.redirect).toBe('manual')
    expect('corps' in r && r.corps).not.toContain(JETON)
    expect('corps' in r && r.corps).toContain('[secret masqué]')
  })

  it('refuse un chemin hors des deux familles sans rien appeler', async () => {
    const { conf, appels } = configuration(() => json({}))
    const r = await appelerLePortail(conf, 'GET', '/api/acces/jeton', undefined)
    expect('refus' in r).toBe(true)
    expect(appels).toHaveLength(0)
  })

  it('relève les organisations nommées : le slug envoyé et la sélection du calendrier', async () => {
    const { conf } = configuration((url) => (url.endsWith('/calendrier') ? json({ parutions: ['konica', 'dalious'] }) : json({ état: 'ok' })))
    await appelerLePortail(conf, 'POST', '/api/veille/calendrier', { organisations: [] })
    await appelerLePortail(conf, 'POST', '/api/veille/courriel', { sorte: 'lettre', slug: 'hermitage' })
    expect([...conf.relevé.organisations].sort()).toEqual(['dalious', 'hermitage', 'konica'])
  })
})

describe('Gmail : aucun outil n’envoie à un client', () => {
  it('un brouillon se dépose sans jamais appeler un envoi', async () => {
    const { conf, appels, portées } = configuration(() => json({ id: 'r-1' }))
    const r = await créerBrouillon(conf, { to: ['client@exemple.fr'], subject: 'Veille X', body: 'texte', htmlBody: '<p>x</p>' })
    expect(r.id).toBe('r-1')
    expect(appels.map((a) => a.url)).toEqual(['https://gmail.googleapis.com/gmail/v1/users/me/drafts'])
    expect(appels.some((a) => a.url.includes('send'))).toBe(false)
    expect(portées).toEqual(['https://www.googleapis.com/auth/gmail.compose'])
    const brut = Buffer.from(JSON.parse(String(appels[0]!.init.body)).message.raw, 'base64url').toString('utf8')
    expect(brut).toContain('To: client@exemple.fr')
    expect(brut).toContain('<agathe@next-impact.digital>')
    expect(brut).not.toMatch(/^(Cc|Bcc):/m)
  })

  it('refuse une adresse illisible ou un objet sur deux lignes', async () => {
    const { conf, appels } = configuration(() => json({}))
    await expect(créerBrouillon(conf, { to: ['x@y.fr\r\nBcc: z@w.fr'], subject: 's', body: 'b' })).rejects.toThrow()
    await expect(créerBrouillon(conf, { to: ['x@y.fr'], subject: 's\r\nBcc: z@w.fr', body: 'b' })).rejects.toThrow()
    expect(appels).toHaveLength(0)
  })

  it('l’envoi réel ne va qu’à l’opératrice', async () => {
    expect(refusDEnvoi(undefined)).toBeNull()
    expect(refusDEnvoi(DESTINATAIRE_OPÉRATRICE)).toBeNull()
    expect(refusDEnvoi([' Agathe@SignauxFaibles.io '])).toBeNull()
    expect(refusDEnvoi('client@exemple.fr')).not.toBeNull()
    expect(refusDEnvoi([DESTINATAIRE_OPÉRATRICE, 'client@exemple.fr'])).not.toBeNull()

    const { conf, appels, portées } = configuration(() => json({ id: 'm-1' }))
    await envoyerÀLOpératrice(conf, '[Relecture] Lettres du jour', 'corps')
    expect(appels.map((a) => a.url)).toEqual(['https://gmail.googleapis.com/gmail/v1/users/me/messages/send'])
    expect(portées).toEqual(['https://www.googleapis.com/auth/gmail.send'])
    const brut = Buffer.from(JSON.parse(String(appels[0]!.init.body)).raw, 'base64url').toString('utf8')
    expect(brut).toContain(`To: ${DESTINATAIRE_OPÉRATRICE}`)
  })

  it('un seul chemin d’envoi dans le code des outils, et aucun envoi de brouillon', () => {
    const source = readFileSync(join(process.cwd(), 'scripts/taches/outils.ts'), 'utf8')
    expect(source.match(/'messages\/send'/g)).toHaveLength(1)
    expect(source).not.toMatch(/drafts\/send/)
    expect(source.indexOf("'messages/send'")).toBeGreaterThan(source.indexOf('export async function envoyerÀLOpératrice'))
  })

  it('les messages envoyés se lisent en en-têtes, sans requête q, jusqu’à la date demandée', async () => {
    const dates: Record<string, number> = { a: Date.parse('2026-10-22T10:00:00Z'), b: Date.parse('2026-10-20T10:00:00Z'), c: Date.parse('2026-10-01T10:00:00Z') }
    const { conf, appels, portées } = configuration((url) => {
      if (url.includes('messages?')) return json({ messages: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], nextPageToken: 'suite' })
      const id = /messages\/(\w)\?/.exec(url)?.[1] ?? ''
      return json({ internalDate: String(dates[id]), payload: { headers: [{ name: 'To', value: 'client@exemple.fr' }, { name: 'Subject', value: `Objet ${id}` }] } })
    })
    const r = await listerEnvoyés(conf, '2026-10-15')
    expect(r.messages.map((m) => m.subject)).toEqual(['Objet a', 'Objet b'])
    expect(appels.some((a) => /[?&]q=/.test(a.url))).toBe(false)
    expect(appels.every((a) => !a.url.includes('format=full') && !a.url.includes('format=raw'))).toBe(true)
    expect(new Set(portées)).toEqual(new Set(['https://www.googleapis.com/auth/gmail.metadata']))
  })
})

describe('masquer et pointeurs', () => {
  it('masque un secret, et ignore une valeur trop courte pour en être un', () => {
    expect(masquer(`a ${JETON} b`, [JETON, null])).toBe('a [secret masqué] b')
    expect(masquer('abc', ['abc'])).toBe('abc')
  })

  it('chaque pointeur ouvre une page Notion, et --organisation n’ajoute qu’une phrase', () => {
    for (const tâche of TÂCHES) expect(POINTEURS[tâche].texte).toMatch(/Ouvre dans Notion la page/)
    expect(promptDeLaTâche('lettres', null)).toBe(POINTEURS.lettres.texte)
    expect(promptDeLaTâche('lettres', 'konica')).toBe(`${POINTEURS.lettres.texte}\n\nLimite-toi à l'organisation konica.`)
  })

  it('le pointeur d’étiquetage n’applique que l’étape 4ter, aux éditions publiées, sans rien écrire dans Notion', () => {
    const texte = POINTEURS.etiquetage.texte
    expect(texte).toContain('3d5fe829ce718107af65f4fccf8089ab')
    expect(texte).toContain('« 4ter ÉTIQUETTES »')
    expect(texte).toContain('N\'exécute que cette étape')
    expect(texte).toContain('tu ne modifies aucune page Notion')
    expect(texte).toContain('« hors-pilote », arrête-toi')
    // Les brouillons seulement à défaut d'édition publiée, et jamais en changeant leur statut.
    expect(texte).toContain('Si elle n\'a aucune édition publiée')
    expect(texte).toContain('sans en changer le statut')
    expect(texte).toContain('aucun fait ne cite d\'URL n\'est pas étiquetable')
    // La reprise n'ajoute qu'une phrase, et seulement à l'étiquetage.
    expect(promptDeLaTâche('etiquetage', 'infralliance', true)).toBe(
      `${texte}\n\nLimite-toi à l'organisation infralliance.\n\nReprends aussi les éditions qui ont déjà des faits : un nouveau lot remplace l'ancien.`,
    )
    expect(promptDeLaTâche('lettres', 'konica', true)).toBe(promptDeLaTâche('lettres', 'konica'))
  })
})

describe('Gmail : deposer_courriel, le HTML ne passe pas par le modèle', () => {
  const HTML = `<html><body>${'<p>Une lettre longue.</p>'.repeat(5000)}</body></html>`

  it('compose par le portail sans lui demander de brouillon, dépose le brouillon et ne rend pas le HTML', async () => {
    const { conf, appels } = configuration((url) =>
      url.endsWith('/api/veille/courriel')
        ? json({ état: 'composé', objet: 'Veille Heritech : Concurrentiel', html: HTML, texte: 'texte de la lettre', octets: HTML.length })
        : json({ id: 'r-9' }),
    )
    const r = await déposerUnCourriel(conf, { sorte: 'lettre', page: 'p', slug: 'heritech', brouillon: { à: ['x@y.fr'] } }, ['eric@heritech.fr'])
    expect(r).toMatchObject({ brouillon: 'déposé', id: 'r-9', destinataires: 1, objet: 'Veille Heritech : Concurrentiel' })
    expect(JSON.stringify(r)).not.toContain('Une lettre longue')
    // Le portail compose seulement : la demande lui arrive sans « brouillon ».
    expect(JSON.parse(String(appels[0]!.init.body))).toEqual({ sorte: 'lettre', page: 'p', slug: 'heritech' })
    // Le HTML entier, plus long que la réponse rendue au modèle, arrive au brouillon.
    const brut = Buffer.from(JSON.parse(String(appels[1]!.init.body)).message.raw, 'base64url').toString('utf8')
    expect(brut).toContain('To: eric@heritech.fr')
    expect(HTML.length).toBeGreaterThan(100_000)
    expect(appels[1]!.url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/drafts')
  })

  it('ne dépose rien pour une lettre non conforme, et rend la réponse du portail', async () => {
    const { conf, appels } = configuration(() => json({ état: 'non-conforme', ruptures: [{ code: 'axe-sans-niveau' }] }, 422))
    const r = await déposerUnCourriel(conf, { sorte: 'lettre', page: 'p', slug: 'heritech' }, [])
    expect(r).toMatchObject({ brouillon: 'non déposé', statut: 422, réponse: { état: 'non-conforme' } })
    expect(appels).toHaveLength(1)
  })
})

describe('sous-agents et consignes du harnais', () => {
  it('le collecteur est sur Sonnet, le lecteur sur Haiku, et le collecteur n’a pas d’outil d’écriture Notion ni Gmail', () => {
    expect(définitionDuCollecteur().model).toBe('claude-sonnet-5-5')
    expect(définitionDuLecteur().model).toBe('claude-haiku-5-5')
    const outils = définitionDuCollecteur().tools ?? []
    expect(outils).toContain('mcp__Veille__lire_sources')
    // Capital et santé financière, nouveaux entrants : par les registres publics, en code (26 octobre 2026).
    expect(outils).toContain('mcp__Veille__annonces_bodacc')
    expect(outils).toContain('mcp__Veille__fiches_entreprises')
    expect(outils.some((o) => /notion-(create|update)|Gmail/.test(o))).toBe(false)
  })

  it('les consignes nomment le dépôt sans HTML, la collecte par le collecteur et la borne de quatre minutes', () => {
    const consignes = consignesDuHarnais(new Date('2026-10-23T08:00:00Z'), 'https://www.signauxfaibles.io')
    expect(consignes).toContain('mcp__Gmail__deposer_courriel')
    expect(consignes).toContain('subagent_type « collecteur »')
    expect(consignes).toContain('synthese_de_collecte')
    expect(consignes).toContain('plus de quatre minutes')
    // La page d'onboarding reconnaît l'exécuteur API à cette mention exacte (25 octobre 2026).
    expect(consignes).toContain('EXÉCUTEUR : API')
    expect(consignes).toContain('mcp__Veille__annonces_bodacc')
    expect(consignes).toContain('mcp__Veille__fiches_entreprises')
  })
})
