/**
 * Les registres publics des entreprises, interrogés en code (scénario C de la
 * réorientation stratégique, 26 octobre 2026).
 *
 * Deux familles de la veille stratégique se collectent mieux par une requête
 * structurée que par un agent qui ouvre des pages :
 *
 *   · « Capital et santé financière » : les annonces du BODACC (procédures
 *     collectives, ventes et cessions, dépôts des comptes, radiations,
 *     modifications) des SIREN du corpus, et la fiche de chaque entité dans
 *     l'API Recherche d'entreprises (état, effectif, dirigeants, finances).
 *   · « Nouveaux entrants » : les créations et immatriculations publiées au
 *     BODACC dans les départements du client, filtrées par un texte d'activité.
 *
 * Les deux sources sont publiques, gratuites et sans clé. Le code rend des
 * lignes courtes : le modèle ne lit que ce qui a changé, au lieu de vérifier
 * quarante entités page par page. Rien n'est jugé ici : le code dit ce qui est
 * publié, pas ce qui compte pour le client.
 */

export const API_BODACC =
  'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records'
export const API_ENTREPRISES = 'https://recherche-entreprises.api.gouv.fr/search'

/** Les familles d'avis du BODACC, telles que le jeu de données les code. */
export const FAMILLES_BODACC = [
  'collective',
  'vente',
  'dpc',
  'radiation',
  'modification',
  'creation',
  'immatriculation',
  'conciliation',
  'retablissement_professionnel',
] as const
export type FamilleBodacc = (typeof FAMILLES_BODACC)[number]

/** Ce que suit la famille « Capital et santé financière », par défaut. */
export const FAMILLES_SANTÉ: readonly FamilleBodacc[] = ['collective', 'conciliation', 'vente', 'dpc', 'radiation', 'modification']
/** Ce que suit la famille « Nouveaux entrants », par défaut. */
export const FAMILLES_ENTRANTS: readonly FamilleBodacc[] = ['creation', 'immatriculation']

export type DemandeBodacc = {
  readonly depuis: string
  readonly sirens?: readonly string[]
  readonly familles?: readonly FamilleBodacc[]
  readonly departements?: readonly string[]
  readonly texte?: string
  readonly limite?: number
}

const SIREN = /^\d{9}$/
const DÉPARTEMENT = /^(\d{2}|2A|2B|97\d)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Un SIREN tel qu'on le recopie d'un registre : espaces retirés, neuf chiffres. */
export function sirenNormalisé(valeur: string): string | null {
  const brut = valeur.replace(/\s+/g, '')
  return SIREN.test(brut) ? brut : null
}

/**
 * La clause `where` de la requête, construite à partir de valeurs contrôlées
 * une à une : aucune valeur reçue n'y entre sans passer par une expression
 * régulière, et le texte libre perd ses guillemets.
 */
export function clauseBodacc(demande: DemandeBodacc): string {
  if (!DATE.test(demande.depuis)) throw new Error(`date « ${demande.depuis} » : attendu AAAA-MM-JJ`)
  const sirens = (demande.sirens ?? []).map((s) => {
    const n = sirenNormalisé(s)
    if (!n) throw new Error(`SIREN « ${s} » : neuf chiffres attendus`)
    return n
  })
  const départements = (demande.departements ?? []).map((d) => {
    const n = d.trim().toUpperCase()
    if (!DÉPARTEMENT.test(n)) throw new Error(`département « ${d} » : deux chiffres, 2A, 2B ou 97x attendus`)
    return n
  })
  const familles = demande.familles ?? []
  for (const f of familles) if (!FAMILLES_BODACC.includes(f)) throw new Error(`famille d'avis « ${f} » inconnue`)
  if (!sirens.length && !départements.length) throw new Error('il faut des SIREN ou des départements : une requête nationale sans filtre est refusée')

  const parties = [`dateparution >= date'${demande.depuis}'`]
  if (familles.length) parties.push(`familleavis in (${familles.map((f) => `"${f}"`).join(', ')})`)
  if (sirens.length) parties.push(`(${sirens.map((s) => `registre = "${s}"`).join(' or ')})`)
  if (départements.length) parties.push(`numerodepartement in (${départements.map((d) => `"${d}"`).join(', ')})`)
  const texte = (demande.texte ?? '').replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (texte) parties.push(`"${texte}"`)
  return parties.join(' and ')
}

/** Un champ du BODACC est tantôt un objet, tantôt le même objet sérialisé. */
function objet(valeur: unknown): Record<string, unknown> | null {
  if (valeur && typeof valeur === 'object') return valeur as Record<string, unknown>
  if (typeof valeur === 'string' && valeur.trim().startsWith('{')) {
    try {
      return JSON.parse(valeur) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

/** La première valeur d'une clé, cherchée en profondeur (les établissements sont imbriqués). */
function chercher(valeur: unknown, clé: string): string | null {
  const racine = objet(valeur) ?? (Array.isArray(valeur) ? valeur : null)
  if (!racine) return null
  for (const [k, v] of Object.entries(racine)) {
    if (k === clé && (typeof v === 'string' || typeof v === 'number')) return String(v)
    const dedans = chercher(v, clé)
    if (dedans) return dedans
  }
  return null
}

const court = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Une annonce en une ligne : date, famille, entité, SIREN, lieu, nature, lien. */
export function ligneDAnnonce(r: Record<string, unknown>): string {
  const registre = Array.isArray(r['registre']) ? String((r['registre'] as unknown[])[0] ?? '') : String(r['registre'] ?? '')
  const jugement = objet(r['jugement'])
  const nature =
    (jugement ? [jugement['nature'], jugement['date'] ? `jugement du ${String(jugement['date'])}` : null].filter(Boolean).join(', ') : '') ||
    chercher(r['acte'], 'categorieCreation') ||
    chercher(r['acte'], 'categorieImmatriculation') ||
    chercher(r['depot'], 'typeDepot') ||
    chercher(r['modificationsgenerales'], 'descriptif') ||
    String(r['typeavis_lib'] ?? r['typeavis'] ?? '')
  const activité = chercher(r['listeetablissements'], 'activite')
  const lieu = [r['ville'], r['numerodepartement'] ? `(${String(r['numerodepartement'])})` : null].filter(Boolean).join(' ')
  return [
    String(r['dateparution'] ?? ''),
    String(r['familleavis_lib'] ?? r['familleavis'] ?? ''),
    String(r['commercant'] ?? 'sans nom'),
    registre ? `SIREN ${registre}` : null,
    lieu || null,
    nature ? court(String(nature), 160) : null,
    activité ? `activité : ${court(activité, 160)}` : null,
    String(r['url_complete'] ?? ''),
  ]
    .filter(Boolean)
    .join(' · ')
}

export async function annoncesBodacc(demande: DemandeBodacc, f: typeof fetch = fetch): Promise<string> {
  const limite = Math.min(Math.max(demande.limite ?? 50, 1), 100)
  const url = new URL(API_BODACC)
  url.searchParams.set('where', clauseBodacc(demande))
  url.searchParams.set('order_by', 'dateparution desc')
  url.searchParams.set('limit', String(limite))
  const réponse = await f(url.toString(), { headers: { accept: 'application/json' } })
  if (!réponse.ok) throw new Error(`BODACC : HTTP ${réponse.status} ${court(await réponse.text(), 300)}`)
  const données = (await réponse.json()) as { total_count?: number; results?: Record<string, unknown>[] }
  const annonces = données.results ?? []
  const total = données.total_count ?? annonces.length
  const entête = `BODACC depuis le ${demande.depuis} : ${total} annonce(s)${total > annonces.length ? `, les ${annonces.length} plus récentes ci-dessous` : ''}.`
  return annonces.length ? [entête, ...annonces.map((a) => `- ${ligneDAnnonce(a)}`)].join('\n') : `${entête} Aucune annonce : constat à porter tel quel, avec la date.`
}

// ── API Recherche d'entreprises ──────────────────────────────────────────────

type Entreprise = Record<string, unknown>

/** La fiche d'une entité en quelques lignes : ce qui bouge d'une semaine à l'autre. */
export function ficheEnLignes(e: Entreprise): string {
  const siège = objet(e['siege']) ?? {}
  const finances = objet(e['finances'])
  const années = finances ? Object.keys(finances).sort().reverse().slice(0, 2) : []
  const comptes = années.map((a) => {
    const c = objet(finances![a]) ?? {}
    const ca = typeof c['ca'] === 'number' ? `CA ${c['ca'].toLocaleString('fr-FR')} €` : 'CA n.d.'
    const rn = typeof c['resultat_net'] === 'number' ? `résultat ${c['resultat_net'].toLocaleString('fr-FR')} €` : 'résultat n.d.'
    return `${a} : ${ca}, ${rn}`
  })
  const dirigeants = Array.isArray(e['dirigeants'])
    ? (e['dirigeants'] as Entreprise[]).slice(0, 6).map((d) =>
        d['type_dirigeant'] === 'personne morale'
          ? `${String(d['qualite'] ?? 'dirigeant')} : ${String(d['denomination'] ?? 'personne morale')}`
          : `${String(d['qualite'] ?? 'dirigeant')} : ${[d['prenoms'], d['nom']].filter(Boolean).join(' ')}`,
      )
    : []
  const compléments = objet(e['complements']) ?? {}
  const marqueurs = Object.entries(compléments)
    .filter(([k, v]) => v === true && /^est_(ess|qualiopi|organisme_formation|societe_mission|siae|rge|patrimoine_vivant)$/.test(k))
    .map(([k]) => k.replace(/^est_/, '').replace(/_/g, ' '))
  const état = e['etat_administratif'] === 'A' ? 'active' : e['etat_administratif'] === 'C' ? `cessée${e['date_fermeture'] ? ` le ${String(e['date_fermeture'])}` : ''}` : String(e['etat_administratif'] ?? 'n.d.')
  return [
    `${String(e['nom_complet'] ?? 'sans nom')} (SIREN ${String(e['siren'] ?? '')}) : ${état}, créée le ${String(e['date_creation'] ?? 'n.d.')}, NAF ${String(e['activite_principale'] ?? 'n.d.')}, ${String(e['categorie_entreprise'] ?? 'catégorie n.d.')}, effectif (code INSEE) ${String(e['tranche_effectif_salarie'] ?? 'n.d.')}, ${String(e['nombre_etablissements_ouverts'] ?? '?')} établissement(s) ouvert(s), siège ${String(siège['libelle_commune'] ?? 'n.d.')}`,
    `  comptes : ${comptes.length ? comptes.join(' ; ') : 'non publiés'}`,
    `  dirigeants : ${dirigeants.length ? dirigeants.join(' ; ') : 'n.d.'}`,
    marqueurs.length ? `  marqueurs : ${marqueurs.join(', ')}` : null,
    `  registre mis à jour le ${String(e['date_mise_a_jour_rne'] ?? e['date_mise_a_jour'] ?? 'n.d.')} · https://annuaire-entreprises.data.gouv.fr/entreprise/${String(e['siren'] ?? '')}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Une pause entre deux appels : l'API publique limite le débit par adresse. */
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fichesEntreprises(
  sirens: readonly string[],
  f: typeof fetch = fetch,
  attente: (ms: number) => Promise<unknown> = pause,
): Promise<string> {
  const lignes: string[] = []
  for (const [i, brut] of sirens.entries()) {
    const siren = sirenNormalisé(brut)
    if (!siren) {
      lignes.push(`${brut} : SIREN invalide, neuf chiffres attendus`)
      continue
    }
    if (i > 0) await attente(250)
    const url = new URL(API_ENTREPRISES)
    url.searchParams.set('q', siren)
    url.searchParams.set('per_page', '1')
    try {
      const réponse = await f(url.toString(), { headers: { accept: 'application/json' } })
      if (!réponse.ok) {
        lignes.push(`${siren} : NON OUVERTE, HTTP ${réponse.status}`)
        continue
      }
      const données = (await réponse.json()) as { results?: Entreprise[] }
      const fiche = (données.results ?? []).find((r) => r['siren'] === siren)
      lignes.push(fiche ? ficheEnLignes(fiche) : `${siren} : introuvable dans le registre`)
    } catch (e) {
      lignes.push(`${siren} : NON OUVERTE, ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return lignes.join('\n')
}
