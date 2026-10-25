import { describe, expect, it } from 'vitest'
import { lireLeRefusDeGoogle, lireLaRéponseNotion } from '@/scripts/taches/controle'
import { environnementDeLaSession, lireLaCommande } from '@/scripts/taches/executer'
import { lireLaMesure, résuméDeLaMesure } from '@/scripts/taches/mesure'

const RÉSULTAT = {
  subtype: 'success',
  duration_ms: 1_800_000,
  num_turns: 120,
  total_cost_usd: 6.42,
  modelUsage: {
    'claude-opus-5-5': { inputTokens: 1200, outputTokens: 30_000, cacheReadInputTokens: 2_000_000, cacheCreationInputTokens: 150_000, webSearchRequests: 25, costUSD: 5.1 },
    'claude-haiku-5-5': { inputTokens: 900, outputTokens: 12_000, cacheReadInputTokens: 400_000, cacheCreationInputTokens: 80_000, webSearchRequests: 0, costUSD: 1.32 },
  },
}

describe('lireLaMesure', () => {
  it('reprend le coût et les jetons du message result, modèle par modèle, sans rien recalculer', () => {
    const m = lireLaMesure(RÉSULTAT, {
      tâche: 'lettres',
      organisation: 'konica',
      date: new Date('2026-10-23T04:00:00Z'),
      plafondUsd: 60,
      organisationsTraitées: ['konica', 'konica'],
      pagesNotionCréées: 1,
    })
    expect(m.coûtTotalUsd).toBe(6.42)
    expect(m.tours).toBe(120)
    expect(m.issue).toBe('success')
    expect(m.parModèle['claude-opus-5-5']).toEqual({ jetonsEntrée: 1200, jetonsSortie: 30_000, cacheLu: 2_000_000, cacheÉcrit: 150_000, recherchesWeb: 25, coûtUsd: 5.1 })
    expect(m.parModèle['claude-haiku-5-5']?.coûtUsd).toBe(1.32)
    expect(m.organisationsTraitées).toEqual(['konica'])
    expect(m.pagesNotionCréées).toBe(1)
  })

  it('tient sur un résultat vide (échec avant toute réponse)', () => {
    const m = lireLaMesure({}, { tâche: 'revue', organisation: null, date: new Date(), plafondUsd: 10, organisationsTraitées: [], pagesNotionCréées: 0 })
    expect(m.coûtTotalUsd).toBe(0)
    expect(m.issue).toBe('inconnue')
    expect(m.parModèle).toEqual({})
  })

  it('le résumé du job sépare les deux modèles et donne le coût total', () => {
    const r = résuméDeLaMesure(
      lireLaMesure(RÉSULTAT, { tâche: 'lettres', organisation: null, date: new Date(), plafondUsd: 60, organisationsTraitées: [], pagesNotionCréées: 2 }),
    )
    expect(r).toContain('**6,42 $**')
    expect(r).toContain('| claude-opus-5-5 |')
    expect(r).toContain('| claude-haiku-5-5 |')
    expect(r).toContain('Pages Notion créées : 2')
  })
})

describe('ligne de commande', () => {
  it('admet les cinq tâches et le contrôle, et un slug propre', () => {
    expect(lireLaCommande(['lettres', '--organisation', 'next-impact'])).toEqual({ tâche: 'lettres', organisation: 'next-impact' })
    expect(lireLaCommande(['controle'])).toEqual({ tâche: 'controle', organisation: null })
    expect(lireLaCommande(['revue', '--organisation', ''])).toEqual({ tâche: 'revue', organisation: null })
  })

  it('refuse une tâche inconnue, un slug douteux ou un argument de trop', () => {
    expect(() => lireLaCommande(['envoyer'])).toThrow()
    expect(() => lireLaCommande(['lettres', '--organisation', 'a b'])).toThrow()
    expect(() => lireLaCommande(['lettres', '--organisation', '$(id)'])).toThrow()
    expect(() => lireLaCommande(['lettres', '--force'])).toThrow()
    expect(() => lireLaCommande(['controle', '--organisation', 'konica'])).toThrow()
  })
})

describe('environnement de la session enfant', () => {
  it('ne transmet aucun secret, sauf la clé API qui l’authentifie', () => {
    const avant = { ...process.env }
    Object.assign(process.env, {
      NOTION_MCP_TOKEN: 'n',
      ACTIVATION_SECRET: 'a',
      GOOGLE_COMPTE_SERVICE_JSON: '{}',
      GMAIL_BOITE_OPERATRICE: 'b',
      EVALUATION_API_KEY: 'e',
      ANTHROPIC_BASE_URL: 'https://ailleurs',
      PATH: '/usr/bin',
    })
    try {
      const env = environnementDeLaSession('cle-api')
      expect(env['ANTHROPIC_API_KEY']).toBe('cle-api')
      for (const nom of ['NOTION_MCP_TOKEN', 'ACTIVATION_SECRET', 'GOOGLE_COMPTE_SERVICE_JSON', 'GMAIL_BOITE_OPERATRICE', 'EVALUATION_API_KEY', 'ANTHROPIC_BASE_URL']) {
        expect(env[nom], nom).toBeUndefined()
      }
      expect(env['PATH']).toBe('/usr/bin')
      // Une page Notion de 65 000 caractères est rendue à l'agent, pas rangée hors de son dossier.
      expect(Number(env['MAX_MCP_OUTPUT_TOKENS'])).toBeGreaterThanOrEqual(80_000)
    } finally {
      for (const clé of Object.keys(process.env)) if (!(clé in avant)) delete process.env[clé]
      Object.assign(process.env, avant)
    }
  })
})

describe('contrôle', () => {
  it('qualifie un refus de Google par son seul code', () => {
    expect(lireLeRefusDeGoogle('Google a refusé le jeton du compte de service (401) : {"error":"unauthorized_client"}')).toMatch(/^unauthorized_client/)
    expect(lireLeRefusDeGoogle('(400) : {"error":"invalid_grant"}')).toMatch(/^invalid_grant/)
    expect(lireLeRefusDeGoogle('Gmail a répondu 403 : x')).toBe('refus 403')
  })

  it('lit le bloc JSON rendu par la session Notion', () => {
    expect(lireLaRéponseNotion('Voici :\n{"vue":{"ok":true,"lignes":4}}')?.vue?.lignes).toBe(4)
    expect(lireLaRéponseNotion('rien')).toBeNull()
  })
})
