import { describe, expect, it } from 'vitest'
import { lireLeRefusDeGoogle, lireLaRéponseNotion } from '@/scripts/taches/controle'
import { environnementDeLaSession, lireLaCommande } from '@/scripts/taches/executer'
import { lireLaMesure, mesurerLesÉtapes, résuméDeLaMesure, type RéponseDuModèle } from '@/scripts/taches/mesure'

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
    expect(lireLaCommande(['lettres', '--organisation', 'next-impact'])).toEqual({ tâche: 'lettres', organisation: 'next-impact', reprendre: false, périodes: [] })
    expect(lireLaCommande(['controle'])).toEqual({ tâche: 'controle', organisation: null, reprendre: false, périodes: [] })
    expect(lireLaCommande(['revue', '--organisation', ''])).toEqual({ tâche: 'revue', organisation: null, reprendre: false, périodes: [] })
  })

  it('etiquetage ne se lance que pour une organisation', () => {
    expect(lireLaCommande(['etiquetage', '--organisation', 'infralliance'])).toEqual({ tâche: 'etiquetage', organisation: 'infralliance', reprendre: false, périodes: [] })
    expect(() => lireLaCommande(['etiquetage'])).toThrow(/exige --organisation/)
    expect(() => lireLaCommande(['etiquetage', '--organisation', ''])).toThrow(/exige --organisation/)
    expect(lireLaCommande(['etiquetage', '--organisation', 'infralliance', '--reprendre'])).toEqual({ tâche: 'etiquetage', organisation: 'infralliance', reprendre: true, périodes: [] })
    expect(() => lireLaCommande(['lettres', '--reprendre'])).toThrow(/ne vaut que pour la tâche « etiquetage »/)
  })

  it('retrospective ne se lance que pour une organisation et des périodes passées', () => {
    const le31 = new Date('2026-10-31T08:00:00Z')
    expect(lireLaCommande(['retrospective', '--organisation', 'konica-minolta-france', '--periodes', '2026-09, 2026-T3'], le31)).toEqual({
      tâche: 'retrospective',
      organisation: 'konica-minolta-france',
      reprendre: false,
      périodes: ['2026-09', '2026-T3'],
    })
    expect(() => lireLaCommande(['retrospective', '--periodes', '2026-09'], le31)).toThrow(/exige --organisation/)
    expect(() => lireLaCommande(['retrospective', '--organisation', 'heritech'], le31)).toThrow(/exige --periodes/)
    expect(() => lireLaCommande(['retrospective', '--organisation', 'heritech', '--periodes', ''], le31)).toThrow(/exige --periodes/)
    // Le mois et le trimestre en cours sont ceux de la revue ; un format libre est refusé.
    expect(() => lireLaCommande(['retrospective', '--organisation', 'heritech', '--periodes', '2026-10'], le31)).toThrow(/période refusée : 2026-10/)
    expect(() => lireLaCommande(['retrospective', '--organisation', 'heritech', '--periodes', '2026-T4'], le31)).toThrow(/période refusée/)
    expect(() => lireLaCommande(['retrospective', '--organisation', 'heritech', '--periodes', 'septembre'], le31)).toThrow(/période refusée/)
    expect(() => lireLaCommande(['retrospective', '--organisation', 'heritech', '--periodes', '2026-09,2026-09'], le31)).toThrow(/deux fois/)
    expect(() => lireLaCommande(['retrospective', '--organisation', 'heritech', '--periodes', '2026-05,2026-06,2026-07,2026-08,2026-09'], le31)).toThrow(/4 périodes au plus/)
    expect(() => lireLaCommande(['revue', '--periodes', '2026-09'], le31)).toThrow(/ne vaut que pour la tâche « retrospective »/)
    // Le premier novembre à Paris, octobre est passé.
    expect(lireLaCommande(['retrospective', '--organisation', 'heritech', '--periodes', '2026-10'], new Date('2026-10-31T23:30:00Z')).périodes).toEqual(['2026-10'])
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

describe('mesurerLesÉtapes (outils stratégiques, lot 9)', () => {
  const usage = (entrée: number, sortie: number, lu = 0, écrit = 0) => ({ input_tokens: entrée, output_tokens: sortie, cache_read_input_tokens: lu, cache_creation_input_tokens: écrit })
  const réponse = (id: string, appels: string[] = [], modèle = 'claude-opus-5-5', u = usage(1_000, 1_000)): RéponseDuModèle => ({ id, modèle, usage: u, appelsAuPortail: appels })

  it('somme l’usage à partir de la première réponse qui appelle la route de l’étape, une fois par réponse', () => {
    const étapes = mesurerLesÉtapes([
      réponse('a', ['/api/veille/lint']),
      réponse('b', ['https://www.signauxfaibles.io/api/veille/faits?slug=infralliance&debut=2026-10-28&fin=2026-10-28']),
      // Même réponse, second bloc : usage recopié, à ne pas compter deux fois.
      réponse('b', ['/api/veille/faits']),
      réponse('c', [], 'claude-opus-5-5', usage(0, 2_000, 1_000_000, 0)),
    ])
    expect(étapes.synthese).toBeUndefined()
    expect(étapes.etiquetage).toMatchObject({ ouverteÀLaRéponse: 2, réponses: 2, appels: 2 })
    expect(étapes.etiquetage!.parModèle['claude-opus-5-5']).toMatchObject({ jetonsEntrée: 1_000, jetonsSortie: 3_000, cacheLu: 1_000_000 })
    // 1 000 × 4 + 3 000 × 20 + 1 000 000 × 0,2, par million de jetons.
    expect(étapes.etiquetage!.coûtUsd).toBeCloseTo(0.264, 6)
  })

  it('la synthèse s’ouvre à la grille, au calcul ou à la synthèse ; un modèle sans tarif rend un coût n.d.', () => {
    const étapes = mesurerLesÉtapes([réponse('a', ['/api/veille/grille?slug=mastora']), réponse('b', [], 'claude-haiku-5-5')])
    expect(étapes.synthese).toMatchObject({ ouverteÀLaRéponse: 1, réponses: 2, coûtUsd: null })
    expect(étapes.synthese!.parModèle['claude-haiku-5-5']!.coûtUsd).toBeNull()
    expect(étapes.synthese!.parModèle['claude-opus-5-5']!.coûtUsd).toBeCloseTo(0.024, 6)
  })

  it('la mesure et son résumé portent les étapes', () => {
    const m = lireLaMesure(RÉSULTAT, {
      tâche: 'revue',
      organisation: 'mastora',
      date: new Date('2026-11-02T16:10:00Z'),
      plafondUsd: 30,
      organisationsTraitées: ['mastora'],
      pagesNotionCréées: 0,
      réponses: [réponse('a'), réponse('b', ['/api/veille/syntheses'])],
    })
    expect(Object.keys(m.étapes)).toEqual(['synthese'])
    expect(résuméDeLaMesure(m)).toContain('Étape « synthese » : **0,02 $**, 1 réponse(s) à partir de la 2e, 1 appel(s)')
  })
})

