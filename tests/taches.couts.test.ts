import { describe, expect, it } from 'vitest'
import { corpsDuCoût, rapporterLeCoût } from '@/scripts/taches/couts'
import { SERVEURS } from '@/scripts/taches/garde'
import { lireLaMesure } from '@/scripts/taches/mesure'
import { serveursDesOutils, visLesCoûts, type ConfigurationDesOutils } from '@/scripts/taches/outils'

function configuration(réponse: () => Response | Promise<Response>, plus: Partial<ConfigurationDesOutils> = {}) {
  const appels: Array<{ url: string; méthode: string; corps: Record<string, unknown> }> = []
  const journal: string[] = []
  const conf: ConfigurationDesOutils = {
    portail: 'https://www.signauxfaibles.io',
    jetonPortail: 'jeton-du-portail',
    compteGoogle: null,
    boîte: null,
    nomExpéditeur: 'Signaux faibles',
    journal: (l) => journal.push(l),
    relevé: { organisations: new Set() },
    fetch: (async (url: string | URL, init?: RequestInit) => {
      appels.push({ url: String(url), méthode: String(init?.method), corps: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> })
      return réponse()
    }) as typeof fetch,
    ...plus,
  }
  return { conf, appels, journal }
}

const json = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut })

const MESURE = lireLaMesure(
  { subtype: 'success', duration_ms: 1_820_000.4, num_turns: 212, total_cost_usd: 18.42, modelUsage: { 'claude-opus': { inputTokens: 10, outputTokens: 20, costUSD: 17.2 } } },
  { tâche: 'lettres', organisation: null, date: new Date('2026-11-16T05:00:02Z'), plafondUsd: 60, organisationsTraitées: ['mastora', 'hermitage'], pagesNotionCréées: 4 },
)
const RUN = { id: 501, tentative: 1, lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/501' }

describe('le coût d’un run rapporté par le harnais', () => {
  it('poste la mesure et le run GitHub, sans le détail des étapes', async () => {
    const { conf, appels, journal } = configuration(() => json({ état: 'enregistré' }, 201))
    expect(await rapporterLeCoût(conf, MESURE, RUN)).toBe('enregistré')
    expect(appels).toHaveLength(1)
    expect(appels[0]).toMatchObject({ url: 'https://www.signauxfaibles.io/api/veille/couts', méthode: 'POST' })
    expect(appels[0]?.corps).toEqual({
      mesure: {
        tâche: 'lettres',
        organisation: null,
        date: '2026-11-16T05:00:02.000Z',
        issue: 'success',
        duréeMs: 1_820_000,
        tours: 212,
        coûtTotalUsd: 18.42,
        plafondUsd: 60,
        parModèle: MESURE.parModèle,
        organisationsTraitées: ['hermitage', 'mastora'],
      },
      run: RUN,
    })
    // Rapporter ne relève aucune organisation de plus, et ne dit rien au journal quand tout va bien.
    expect([...conf.relevé.organisations]).toEqual([])
    expect(journal.filter((l) => l.startsWith('coût du run'))).toEqual([])
  })

  it('un run déjà rapporté n’est pas une erreur', async () => {
    const { conf } = configuration(() => json({ état: 'déjà-enregistré' }, 200))
    expect(await rapporterLeCoût(conf, MESURE, RUN)).toBe('déjà-enregistré')
  })

  it('hors de GitHub, le run est rapporté sans identifiant', async () => {
    const { conf, appels } = configuration(() => json({ état: 'enregistré' }, 201))
    await rapporterLeCoût(conf, MESURE, null)
    expect(corpsDuCoût(MESURE, null).run).toBeNull()
    expect(appels[0]?.corps['run']).toBeNull()
  })

  it('ne fait jamais échouer le run : refus, réponse inattendue et panne s’écrivent au journal', async () => {
    const refusé = configuration(() => json({ état: 'refusée' }, 401))
    expect(await rapporterLeCoût(refusé.conf, MESURE, RUN)).toBe('non-rapporté')
    expect(refusé.journal.at(-1)).toBe('coût du run : non rapporté, réponse 401 du portail')

    const sansJeton = configuration(() => json({}), { jetonPortail: null })
    expect(await rapporterLeCoût(sansJeton.conf, MESURE, RUN)).toBe('non-rapporté')
    expect(sansJeton.appels).toHaveLength(0)
    expect(sansJeton.journal.at(-1)).toContain('ACTIVATION_SECRET absent')

    const panne = configuration(() => Promise.reject(new Error('fetch failed')))
    expect(await rapporterLeCoût(panne.conf, MESURE, RUN)).toBe('non-rapporté')
    expect(panne.journal.at(-1)).toBe('coût du run : non rapporté (fetch failed)')
  })

  it('le jeton ne figure ni dans le corps ni au journal', async () => {
    const { conf, appels, journal } = configuration(() => json({ état: 'refusée' }, 401))
    await rapporterLeCoût(conf, MESURE, RUN)
    expect(JSON.stringify(appels[0]?.corps)).not.toContain('jeton-du-portail')
    expect(journal.join('\n')).not.toContain('jeton-du-portail')
  })
})

describe('la tâche n’écrit pas son propre coût', () => {
  it('reconnaît la route des coûts, en relatif comme en adresse complète', () => {
    expect(visLesCoûts('/api/veille/couts')).toBe(true)
    expect(visLesCoûts('https://www.signauxfaibles.io/api/veille/couts?mois=2026-11')).toBe(true)
    expect(visLesCoûts('/api/veille/couts/')).toBe(true)
    expect(visLesCoûts('/api/veille/courriers')).toBe(false)
  })

  it('appeler_portail refuse la route, sans appel au portail', async () => {
    const { conf, appels } = configuration(() => json({ état: 'enregistré' }, 201))
    type Rendu = { isError?: boolean; content: Array<{ text?: string }> }
    type Outil = { handler?: (a: unknown, extra: unknown) => Promise<Rendu>; callback?: (a: unknown, extra: unknown) => Promise<Rendu> }
    const serveur = serveursDesOutils(conf)[SERVEURS.portail] as unknown as { instance: { _registeredTools: Record<string, Outil> } }
    const outil = serveur.instance._registeredTools['appeler_portail']
    const appeler = outil?.handler ?? outil?.callback
    if (!appeler) throw new Error('outil appeler_portail introuvable')
    const rendu = await appeler({ methode: 'POST', chemin: '/api/veille/couts', corps: { mesure: { coûtTotalUsd: 0 } } }, {})
    expect(rendu.isError).toBe(true)
    expect(rendu.content[0]?.text).toContain('rapporté par le harnais')
    expect(appels).toHaveLength(0)
  })
})
