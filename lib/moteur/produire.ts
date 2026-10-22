/**
 * Une parution, de bout en bout, sans modèle sauf à la rédaction (programme du
 * 22 octobre 2026, §3) : collecte en code, requêtes types, un appel de
 * rédaction, portes mécaniques, reprises bornées. Cette fonction n'écrit nulle
 * part : elle rend une production, que la tâche Trigger.dev remet au portail
 * et que le script d'évaluation écrit sur disque.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { assemblerLaLettre, type LettreAssemblée } from '@/lib/moteur/assemblage'
import { collecterLesSources, couvertureDe, gelDe, suivreLesArticles, type Couverture, type Gel, type Lecture, type Navigateur } from '@/lib/moteur/collecte'
import { coûtDe, type Tarif } from '@/lib/moteur/cout'
import { contrôlerLaProduction, type ContrôleDeProduction } from '@/lib/moteur/portes'
import { lancerLesRequêtes, normaliserUrl, type Recherche } from '@/lib/moteur/recherche'
import { rédacteurAnthropic, type Rédacteur, type SortieRédigée, type Sélection, type Usage } from '@/lib/moteur/redaction'
import type { RéférentielUnique } from '@/lib/moteur/referentiel'

export type Production = {
  readonly lettre: LettreAssemblée
  readonly sortie: SortieRédigée
  readonly contrôle: ContrôleDeProduction
  /** `true` si les portes sont franchies ; sinon la lettre est rendue telle quelle, à signaler. */
  readonly acceptée: boolean
  readonly mesures: {
    readonly couverture: Couverture
    readonly faits: number
    readonly reprises: number
    readonly recherches: number
    readonly usage: Usage
    readonly coût: number
    readonly duréeMs: number
    readonly modèle: string
  }
  readonly collecte: {
    readonly lectures: ReadonlyArray<Pick<Lecture, 'url' | 'état' | 'changée'> & { nouveautés: number }>
    readonly résultats: Recherche['résultats']
    /** Les articles suivis depuis les pages d'index, datés par leurs métadonnées. */
    readonly articles: ReadonlyArray<{ source: string; url: string; titre: string; date: string }>
    /** Les résultats que le modèle de recherche a rendus, avant le tri des URL ouvertes. */
    readonly résultatsRendus: number
    /** Le gel à garder pour la prochaine parution. */
    readonly gelSuivant: ReadonlyMap<string, Gel>
  }
}

export type Dépendances = {
  readonly anthropic: Anthropic
  /** Remplace le rédacteur de production (tests, évaluation d'un autre modèle). */
  readonly rédacteur?: Rédacteur
  /** Remplace la recherche (tests) ; `null` pour ne pas lancer les requêtes types. */
  readonly rechercher?: ((référentiel: RéférentielUnique, période: Sélection['période']) => Promise<Recherche>) | null
  readonly gel?: ReadonlyMap<string, Gel>
  readonly ouvrirNavigateur?: () => Promise<Navigateur | null>
  readonly fetch?: typeof fetch
  /** `false` pour ne pas suivre les pages d'index jusqu'à leurs articles (tests). */
  readonly suivreLesArticles?: boolean
  readonly modèle?: string
  readonly effort?: 'low' | 'medium' | 'high' | 'xhigh'
  readonly reprisesMax?: number
  readonly tarif?: Tarif
  readonly journal?: (ligne: string) => void
}

export const REPRISES_MAX = 2

export async function produireLaLettre(
  entrée: { référentiel: RéférentielUnique; sélection: Sélection },
  dépendances: Dépendances,
): Promise<Production> {
  const début = Date.now()
  const journal = dépendances.journal ?? (() => {})
  const { référentiel, sélection } = entrée

  // 1. Collecte en code.
  const lectures = await collecterLesSources(référentiel, {
    gel: dépendances.gel,
    ouvrirNavigateur: dépendances.ouvrirNavigateur,
    fetch: dépendances.fetch,
  })
  const couverture = couvertureDe(lectures)
  journal(`collecte : ${couverture.ouvertes}/${couverture.nommées} sources ouvertes, ${lectures.filter((l) => l.changée).length} changées`)

  // 1bis. Les articles que les pages d'index mènent à lire, datés par leurs métadonnées.
  const articles = dépendances.suivreLesArticles === false ? [] : await suivreLesArticles(lectures, sélection.période, { fetch: dépendances.fetch })
  journal(`articles : ${articles.length} lus dans la période, depuis ${new Set(articles.map((a) => a.source)).size} sources`)

  // 2. Requêtes types.
  const rechercher =
    dépendances.rechercher === undefined
      ? (r: RéférentielUnique, p: Sélection['période']) => lancerLesRequêtes(dépendances.anthropic, r, p, { modèle: dépendances.modèle })
      : dépendances.rechercher
  const recherche: Recherche = rechercher ? await rechercher(référentiel, sélection.période) : { résultats: [], urlsOuvertes: [], recherches: 0, usage: null, modèle: '' }
  journal(`recherche : ${recherche.résultats.length} résultats retenus sur ${recherche.rendus ?? recherche.résultats.length} rendus, ${recherche.recherches} recherches, arrêt ${recherche.arrêt ?? 'n.d.'}`)

  const urlsAdmises = new Set<string>([
    ...lectures.filter((l) => l.état.startsWith('ouverte')).map((l) => l.url),
    ...recherche.urlsOuvertes,
    ...recherche.résultats.map((r) => r.url),
    ...articles.map((a) => a.url),
  ])
  // Ce que chaque URL dit, pour que la porte des dates lise la source du fait.
  const textes = new Map<string, string>()
  const ajouter = (url: string, texte: string) => textes.set(normaliserUrl(url), `${textes.get(normaliserUrl(url)) ?? ''}\n${texte}`)
  for (const l of lectures) if (l.état.startsWith('ouverte')) ajouter(l.url, l.texte)
  for (const a of articles) ajouter(a.url, `${a.date} ${a.titre} ${a.extrait}`)
  for (const r of recherche.résultats) ajouter(r.url, `${r.date ?? ''} ${r.titre} ${r.extrait}`)

  // Les sources que le code n'a pas pu lire : une liste de liens dans la lettre, aucune rédaction.
  const libellés = new Map(référentiel.axes.flatMap((axe) => axe.sources.map((source) => [source.url, source.libellé] as const)))
  const sourcesIgnorées = lectures
    .filter((l) => !l.état.startsWith('ouverte'))
    .map((l) => ({ libellé: libellés.get(l.url) ?? '', url: l.url }))

  // 3. Rédaction, 4. portes, reprises.
  const rédacteur = dépendances.rédacteur ?? rédacteurAnthropic(dépendances.anthropic, { modèle: dépendances.modèle, effort: dépendances.effort })
  const dossier = { lectures, résultats: recherche.résultats, articles }
  let sortie = await rédacteur.rédiger(référentiel, sélection, dossier)
  let lettre = assemblerLaLettre(sortie, référentiel, sélection, sourcesIgnorées)
  let contrôle = contrôlerLaProduction({ lettre, sortie, sélection, urlsAdmises, textes })
  let reprises = 0
  const reprisesMax = dépendances.reprisesMax ?? REPRISES_MAX
  while (!contrôle.franchies && reprises < reprisesMax) {
    reprises += 1
    journal(`reprise ${reprises} : ${contrôle.manquements.map((m) => m.code).join(', ')}`)
    sortie = await rédacteur.reprendre(contrôle.messageDeReprise ?? '')
    lettre = assemblerLaLettre(sortie, référentiel, sélection, sourcesIgnorées)
    contrôle = contrôlerLaProduction({ lettre, sortie, sélection, urlsAdmises, textes })
  }

  const usage: Usage = { ...rédacteur.usage }
  for (const u of Array.isArray(recherche.usage) ? recherche.usage : [recherche.usage]) {
    const r = (u ?? {}) as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }
    usage.entrée += r.input_tokens ?? 0
    usage.sortie += r.output_tokens ?? 0
    usage.cacheLecture += r.cache_read_input_tokens ?? 0
    usage.cacheÉcriture += r.cache_creation_input_tokens ?? 0
  }
  const gelSuivant = new Map<string, Gel>(dépendances.gel ?? [])
  for (const l of lectures) if (l.état.startsWith('ouverte')) gelSuivant.set(l.url, gelDe(l))

  return {
    lettre,
    sortie,
    contrôle,
    acceptée: contrôle.franchies,
    mesures: {
      couverture,
      faits: contrôle.faits,
      reprises,
      recherches: recherche.recherches,
      usage,
      coût: coûtDe(rédacteur.modèle, usage, recherche.recherches, dépendances.tarif),
      duréeMs: Date.now() - début,
      modèle: rédacteur.modèle,
    },
    collecte: {
      lectures: lectures.map((l) => ({ url: l.url, état: l.état, changée: l.changée, nouveautés: l.nouveautés.length })),
      résultats: recherche.résultats,
      articles: articles.map((a) => ({ source: a.source, url: a.url, titre: a.titre, date: a.date })),
      résultatsRendus: recherche.rendus ?? recherche.résultats.length,
      gelSuivant,
    },
  }
}
