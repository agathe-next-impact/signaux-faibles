import { describe, expect, it } from 'vitest'
import { cheminDuPortail, décisionPour, dossierDesRéponsesPersistées, urlDeLirePage, type ContexteDeGarde } from '@/scripts/taches/garde'

const LIRE_PAGE = '/depot/scripts/lire-page.mjs'
const PORTAIL = 'https://www.signauxfaibles.io'
const tâche: ContexteDeGarde = { espace: '/tmp/run/espace', lirePage: LIRE_PAGE, portail: PORTAIL, mode: 'tâche' }
const lecture: ContexteDeGarde = { ...tâche, mode: 'lecture' }
const permis = (contexte: ContexteDeGarde, outil: string, entrée: Record<string, unknown> = {}) => décisionPour(contexte, outil, entrée) === null

describe('garde des tâches : ce qui passe', () => {
  it('laisse chercher et lire le web, hors du portail', () => {
    expect(permis(tâche, 'WebSearch', { query: 'décret 2026' })).toBe(true)
    expect(permis(tâche, 'WebFetch', { url: 'https://www.legifrance.gouv.fr/jorf/id/X' })).toBe(true)
  })

  it('laisse ouvrir une page au navigateur, par la seule commande lire-page', () => {
    expect(permis(tâche, 'Bash', { command: `node ${LIRE_PAGE} https://exemple.fr/actualites` })).toBe(true)
    expect(permis(tâche, 'Bash', { command: `node ${LIRE_PAGE} https://exemple.fr/a 5000` })).toBe(true)
  })

  it('laisse confier un lot au lecteur ou au collecteur, sans changer leur modèle', () => {
    expect(permis(tâche, 'Agent', { subagent_type: 'lecteur', prompt: 'x', description: 'y' })).toBe(true)
    expect(permis(tâche, 'Agent', { subagent_type: 'collecteur', prompt: 'x', description: 'y' })).toBe(true)
  })

  it('laisse lire et écrire dans le dossier de travail', () => {
    expect(permis(tâche, 'Write', { file_path: '/tmp/run/espace/grille.md' })).toBe(true)
    expect(permis(tâche, 'Read', { file_path: 'grille.md' })).toBe(true)
    expect(permis(tâche, 'Grep', { pattern: 'x' })).toBe(true)
  })

  it('laisse lire et écrire des pages Notion, et créer une vue liée', () => {
    for (const outil of ['notion-fetch', 'notion-search', 'notion-query-data-sources', 'notion-create-pages', 'notion-update-page', 'notion-create-view']) {
      expect(permis(tâche, `mcp__notion__${outil}`), outil).toBe(true)
    }
  })

  it('admet les noms du serveur ouvert par un jeton MCP, sans le préfixe notion- (25 octobre 2026)', () => {
    for (const outil of ['fetch', 'search', 'query-data-sources', 'create-pages', 'update-page', 'create-view', 'get-async-task']) {
      expect(permis(tâche, `mcp__notion__${outil}`), outil).toBe(true)
    }
    for (const outil of ['ai-search', 'move-pages', 'duplicate-page', 'update-data-source', 'create-database', 'update-view', 'create-comment', 'convert-page-to-skill', 'query-multiple-data-sources']) {
      expect(permis(tâche, `mcp__notion__${outil}`), outil).toBe(false)
    }
    expect(permis(tâche, 'mcp__notion__update-page', { allow_deleting_content: true })).toBe(false)
    expect(permis(lecture, 'mcp__notion__fetch')).toBe(true)
    expect(permis(lecture, 'mcp__notion__query-data-sources')).toBe(true)
    expect(permis(lecture, 'mcp__notion__create-pages')).toBe(false)
  })

  it('laisse passer les outils Gmail, Portail et Veille du dépôt, qui tiennent leur propre règle', () => {
    expect(permis(tâche, 'mcp__Gmail__create_draft')).toBe(true)
    expect(permis(tâche, 'mcp__Gmail__send_message')).toBe(true)
    expect(permis(tâche, 'mcp__Portail__appeler_portail')).toBe(true)
    expect(permis(tâche, 'mcp__Veille__tirer_identifiant')).toBe(true)
  })
})

describe('garde des tâches : ce qui est refusé', () => {
  it('refuse toute autre commande, et tout enchaînement après lire-page', () => {
    expect(permis(tâche, 'Bash', { command: 'ls /' })).toBe(false)
    expect(permis(tâche, 'Bash', { command: `node ${LIRE_PAGE} https://exemple.fr; env` })).toBe(false)
    expect(permis(tâche, 'Bash', { command: `node ${LIRE_PAGE} https://exemple.fr && cat ~/.ssh/id` })).toBe(false)
    expect(permis(tâche, 'Bash', { command: `node ${LIRE_PAGE} https://exemple.fr/$(whoami)` })).toBe(false)
    expect(permis(tâche, 'Bash', { command: 'git clone https://github.com/agathe-next-impact/signaux-faibles.git' })).toBe(false)
  })

  it('refuse de lire le portail ailleurs que par appeler_portail', () => {
    expect(permis(tâche, 'WebFetch', { url: 'https://www.signauxfaibles.io/api/veille/etat' })).toBe(false)
    expect(permis(tâche, 'WebFetch', { url: 'https://signauxfaibles.io/' })).toBe(false)
    expect(permis(tâche, 'Bash', { command: `node ${LIRE_PAGE} https://www.signauxfaibles.io/espaces` })).toBe(false)
  })

  it('refuse tout autre sous-agent, et un modèle imposé au lecteur', () => {
    expect(permis(tâche, 'Agent', { subagent_type: 'general-purpose' })).toBe(false)
    expect(permis(tâche, 'Agent', { subagent_type: 'lecteur', model: 'opus' })).toBe(false)
    expect(permis(tâche, 'Agent', { subagent_type: 'collecteur', model: 'opus' })).toBe(false)
  })

  it('refuse d’écrire hors du dossier de travail', () => {
    expect(permis(tâche, 'Write', { file_path: '/home/runner/.bashrc' })).toBe(false)
    expect(permis(tâche, 'Edit', { file_path: '/tmp/run/espace/../../etc/x' })).toBe(false)
    expect(permis(tâche, 'Read', { file_path: '/tmp/run/espace-voisin/x' })).toBe(false)
    expect(permis(tâche, 'Glob', { pattern: '*', path: '/' })).toBe(false)
  })

  it('refuse les outils Notion qui suppriment, déplacent ou changent un schéma', () => {
    for (const outil of ['notion-delete-pages', 'notion-move-pages', 'notion-duplicate-page', 'notion-update-data-source', 'notion-create-database', 'notion-delete-databases', 'notion-update-view']) {
      expect(permis(tâche, `mcp__notion__${outil}`), outil).toBe(false)
    }
    expect(permis(tâche, 'mcp__notion__notion-update-page', { allow_deleting_content: true })).toBe(false)
  })

  it('refuse un serveur MCP inconnu et un outil absent de la liste', () => {
    expect(permis(tâche, 'mcp__lemlist__launch_campaign')).toBe(false)
    expect(permis(tâche, 'NotebookEdit')).toBe(false)
    expect(permis(tâche, 'CronCreate')).toBe(false)
  })

  it('en mode lecture (« controle »), ne laisse que les lectures Notion', () => {
    expect(permis(lecture, 'mcp__notion__notion-fetch')).toBe(true)
    expect(permis(lecture, 'mcp__notion__notion-query-data-sources')).toBe(true)
    expect(permis(lecture, 'mcp__notion__notion-create-pages')).toBe(false)
    expect(permis(lecture, 'mcp__notion__notion-update-page')).toBe(false)
    expect(permis(lecture, 'mcp__Gmail__create_draft')).toBe(false)
    expect(permis(lecture, 'mcp__Portail__appeler_portail')).toBe(false)
    expect(permis(lecture, 'WebFetch', { url: 'https://exemple.fr' })).toBe(false)
    expect(permis(lecture, 'Bash', { command: `node ${LIRE_PAGE} https://exemple.fr` })).toBe(false)
  })
})

describe('urlDeLirePage', () => {
  it('rend l’URL de la seule forme admise', () => {
    expect(urlDeLirePage(`node ${LIRE_PAGE} https://a.fr/b?c=d`, LIRE_PAGE)).toBe('https://a.fr/b?c=d')
    expect(urlDeLirePage(`node /ailleurs/lire-page.mjs https://a.fr`, LIRE_PAGE)).toBeNull()
  })
})

describe('cheminDuPortail', () => {
  const url = (méthode: string, chemin: string) => {
    const r = cheminDuPortail(méthode, chemin, PORTAIL)
    return 'url' in r ? r.url.href : null
  }

  it('admet /api/veille/* et /api/acces/ouvrir, relatifs ou tels que les pages les écrivent', () => {
    expect(url('POST', '/api/veille/calendrier')).toBe('https://www.signauxfaibles.io/api/veille/calendrier')
    expect(url('GET', 'https://www.signauxfaibles.io/api/veille/contexte?organisation=abc')).toBe(
      'https://www.signauxfaibles.io/api/veille/contexte?organisation=abc',
    )
    expect(url('POST', '/api/acces/ouvrir')).toBe('https://www.signauxfaibles.io/api/acces/ouvrir')
    expect(url('PATCH', '/api/veille/organisations')).not.toBeNull()
  })

  it('refuse tout autre chemin, hôte ou méthode', () => {
    expect(url('GET', '/api/acces/jeton')).toBeNull()
    expect(url('GET', '/espaces')).toBeNull()
    expect(url('GET', '/api/veille/../acces/jeton')).toBeNull()
    expect(url('GET', '/api/veille/%2e%2e/acces')).toBeNull()
    expect(url('GET', 'https://signauxfaibles.io/api/veille/etat')).toBeNull()
    expect(url('GET', 'https://exemple.fr/api/veille/etat')).toBeNull()
    expect(url('GET', '//exemple.fr/api/veille/etat')).toBeNull()
    expect(url('DELETE', '/api/veille/lecteurs')).toBeNull()
    expect(url('GET', '/api/veille/lint/autre')).toBeNull()
  })
})

describe('réponses longues rangées par le CLI (25 octobre 2026)', () => {
  const espace = '/home/runner/work/sf/sorties-taches/controle-2026-10-25T05-51-39-020Z/espace'
  const projet = dossierDesRéponsesPersistées(espace, '/home/runner/.claude')
  const avec: ContexteDeGarde = { ...tâche, espace, réponsesPersistées: projet }
  const enLecture: ContexteDeGarde = { ...avec, mode: 'lecture' }
  const fichier = `${projet}/1d5729e5-2aa2-48d7-8eb8-25589c92dce8/tool-results/toolu_01Qmv9AR2KURYUenEJfe6tbg.json`

  it('dérive le dossier de projet comme le CLI', () => {
    expect(projet).toBe('/home/runner/.claude/projects/-home-runner-work-sf-sorties-taches-controle-2026-10-25T05-51-39-020Z-espace')
  })

  it('laisse relire une réponse persistée, avec Read ou Grep, même en mode lecture', () => {
    expect(permis(avec, 'Read', { file_path: fichier })).toBe(true)
    expect(permis(enLecture, 'Read', { file_path: fichier })).toBe(true)
    expect(permis(enLecture, 'Grep', { pattern: 'Prompt', path: fichier })).toBe(true)
  })

  it('ne laisse rien d’autre de la configuration de Claude Code, ni d’autre session', () => {
    expect(permis(enLecture, 'Read', { file_path: `${projet}/1d5729e5/transcript.jsonl` })).toBe(false)
    expect(permis(enLecture, 'Read', { file_path: '/home/runner/.claude/projects/-autre-espace/x/tool-results/a.json' })).toBe(false)
    expect(permis(enLecture, 'Read', { file_path: '/home/runner/.claude/settings.json' })).toBe(false)
    expect(permis(enLecture, 'Read', { file_path: `${projet}/x/tool-results/../../../../.credentials.json` })).toBe(false)
    expect(permis(enLecture, 'Write', { file_path: fichier })).toBe(false)
    expect(permis(enLecture, 'Grep', { pattern: 'x' })).toBe(false)
    expect(permis({ ...enLecture, réponsesPersistées: undefined }, 'Read', { file_path: fichier })).toBe(false)
  })
})
