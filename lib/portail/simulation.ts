import type { Base } from '@/lib/base/client'
import {
  enregistrerLaTableDEffets,
  réglerLaTableDEffets,
  tableDEffetsDeLOrganisation,
  tablesDEffetsDuPilote,
  versionsDeLaTableDEffets,
  type ÉtatDeLaTable,
} from '@/lib/base/simulation'
import { matriceDeDécision } from '@/lib/domaine/marches-decision'
import {
  contrôlerLaTableDEffets,
  piliersDeDépart,
  type DonnéeDeSimulation,
  type SegmentDeJeu,
  type TableDEffets,
} from '@/lib/domaine/simulation'
import { dimensionsExposées, observationsDesCartes, semainesDHistorique } from '@/lib/domaine/simulation-veille'
import { empreinte, type Refus } from '@/lib/domaine/strategie'
import { marchésPourLaSimulation } from '@/lib/portail/marches'
import { bornée, grillePourLaSimulation, organisationDuRegistre, veilleDeLaSimulation } from '@/lib/portail/strategie'

/**
 * Simulation (16 novembre 2026, lot 3b des simulations de scénarios) : seule
 * orchestration de la table d'effets, seul appelant des écritures de
 * `lib/base/simulation.ts`.
 *
 *   · la table se poste (`POST /api/veille/simulation`), écrite par la revue
 *     trimestrielle, et passe la porte `contrôlerLaTableDEffets` contre l'arbre
 *     des marchés et la grille avant toute écriture ;
 *   · elle n'est **jamais publiée d'office**, publication automatique ou non :
 *     ses effets sont des hypothèses, que l'opératrice relit dans l'espace
 *     (`accès.aperçu`) avant de la publier ; publier est aussi ce qui ouvre
 *     l'écran au client, organisation par organisation ;
 *   · l'écran lit en une lecture bornée, Postgres seul : la table, les mesures
 *     publiées des marchés, les faits étiquetés et les forces ; aucune partie
 *     n'est stockée, aucun corps de lettre n'est relu.
 */

type Pilote = { readonly sorte: 'organisation-inconnue' | 'hors-pilote' | 'grille-absente' | 'arbre-absent' }

const versLaTable = (contenu: Record<string, unknown>): TableDEffets => {
  const t = contenu as Partial<TableDEffets>
  return { engagements: t.engagements ?? [], actions: t.actions ?? [], cartes: t.cartes ?? [] }
}

export function messageDeRepriseDeLaTable(refus: readonly Refus[]): string {
  return `La table d’effets est refusée (${refus.length} refus). ${refus
    .slice(0, 8)
    .map((r) => `${r.cible ? `${r.cible} : ` : ''}${r.message}`)
    .join(' ; ')}. Corriger ces lignes et reposter la table entière.`
}

export type RésultatDeLaTable =
  | { readonly sorte: 'créée' | 'inchangée'; readonly version: number; readonly actions: number; readonly cartes: number; readonly engagements: number }
  | { readonly sorte: 'refusée'; readonly refus: readonly Refus[]; readonly message: string }
  | Pilote

/** Reçoit la table d'effets : le pilote, la grille et l'arbre d'abord, la porte ensuite, l'écriture en dernier. */
export async function recevoirLaTableDEffets(entrée: { readonly slug: string; readonly table: TableDEffets }, db?: Base): Promise<RésultatDeLaTable> {
  const pilote = await grillePourLaSimulation({ slug: entrée.slug }, db)
  if (pilote.sorte !== 'lue') return pilote
  const marchés = await marchésPourLaSimulation({ organisationId: pilote.organisationId, aperçu: true }, db)
  if (marchés.segments.length === 0) return { sorte: 'arbre-absent' }
  const refus = contrôlerLaTableDEffets(entrée.table, { segments: marchés.segments.map((s) => s.clé), grille: pilote.grille })
  if (refus.length > 0) return { sorte: 'refusée', refus, message: messageDeRepriseDeLaTable(refus) }
  const table: TableDEffets = { engagements: entrée.table.engagements, actions: entrée.table.actions, cartes: entrée.table.cartes }
  const écrit = await enregistrerLaTableDEffets({ organisationId: pilote.organisationId, empreinte: empreinte(JSON.stringify(table)), contenu: table as unknown as Record<string, unknown> }, db)
  return { ...écrit, actions: table.actions.length, cartes: table.cartes.length, engagements: table.engagements.length }
}

export type LectureDeLaTable =
  | {
      readonly sorte: 'lue'
      readonly versions: readonly { readonly version: number; readonly état: ÉtatDeLaTable; readonly crééeLe: string }[]
      /** La dernière version, telle que postée. */
      readonly table: TableDEffets
      /** Ce que la porte dirait d'elle aujourd'hui : l'arbre ou la grille ont pu changer depuis. */
      readonly refus: readonly Refus[]
    }
  | { readonly sorte: 'aucune' }
  | Pilote

/** Les versions de la table d'une organisation et sa dernière version, pour la relecture. */
export async function lireLaTableDuPilote(entrée: { readonly slug: string }, db?: Base): Promise<LectureDeLaTable> {
  const pilote = await grillePourLaSimulation({ slug: entrée.slug }, db)
  if (pilote.sorte !== 'lue') return pilote
  const [versions, marchés] = await Promise.all([versionsDeLaTableDEffets(pilote.organisationId, db), marchésPourLaSimulation({ organisationId: pilote.organisationId, aperçu: true }, db)])
  const dernière = versions[0]
  if (!dernière) return { sorte: 'aucune' }
  const table = versLaTable(dernière.contenu)
  return {
    sorte: 'lue',
    versions: versions.map((v) => ({ version: v.version, état: v.état, crééeLe: v.crééeLe.toISOString() })),
    table,
    refus: contrôlerLaTableDEffets(table, { segments: marchés.segments.map((s) => s.clé), grille: pilote.grille }),
  }
}

export type PublicationDeLaTable =
  | { readonly sorte: 'réglée'; readonly version: number; readonly état: ÉtatDeLaTable }
  | { readonly sorte: 'refusée'; readonly refus: readonly Refus[]; readonly message: string }
  | { readonly sorte: 'aucune' }
  | Pilote

/**
 * Publie, retire ou remet en proposition une version. Une version ne se publie
 * que si elle passe encore la porte : un segment retiré de l'arbre depuis son
 * dépôt la rend injouable, et le refus le dit.
 */
export async function publierLaTableDuPilote(entrée: { readonly slug: string; readonly version: number; readonly état: ÉtatDeLaTable }, db?: Base): Promise<PublicationDeLaTable> {
  const pilote = await grillePourLaSimulation({ slug: entrée.slug }, db)
  if (pilote.sorte !== 'lue') return pilote
  const versions = await versionsDeLaTableDEffets(pilote.organisationId, db)
  const visée = versions.find((v) => v.version === entrée.version)
  if (!visée) return { sorte: 'aucune' }
  if (entrée.état === 'publie') {
    const marchés = await marchésPourLaSimulation({ organisationId: pilote.organisationId, aperçu: true }, db)
    const refus = contrôlerLaTableDEffets(versLaTable(visée.contenu), { segments: marchés.segments.map((s) => s.clé), grille: pilote.grille })
    if (refus.length > 0) return { sorte: 'refusée', refus, message: messageDeRepriseDeLaTable(refus) }
  }
  const réglée = await réglerLaTableDEffets({ organisationId: pilote.organisationId, version: entrée.version, état: entrée.état }, db)
  return réglée ? { sorte: 'réglée', version: entrée.version, état: entrée.état } : { sorte: 'aucune' }
}

export type SimulationsDUneOrganisation = {
  readonly slug: string
  readonly nom: string
  readonly versions: readonly { readonly version: number; readonly état: ÉtatDeLaTable; readonly crééeLe: string }[]
}

/**
 * Les tables d'effets de toutes les organisations du pilote, pour l'écran des
 * synthèses de l'opératrice : la dernière version et la version publiée.
 * Traverse les clients : sa garde est dans `listerLesSynthèses`
 * (`lib/auth/appartenance.ts`), son seul appelant.
 */
export async function tableauDesSimulations(db?: Base): Promise<SimulationsDUneOrganisation[]> {
  const parSlug = new Map<string, SimulationsDUneOrganisation>()
  for (const l of await tablesDEffetsDuPilote(db)) {
    const avant = parSlug.get(l.slug) ?? { slug: l.slug, nom: l.nom, versions: [] }
    // La plus récente d'abord ; au-delà, seule la version publiée intéresse encore.
    if (avant.versions.length > 0 && l.état !== 'publie') continue
    parSlug.set(l.slug, { ...avant, versions: [...avant.versions, { version: l.version, état: l.état, crééeLe: l.crééeLe.toISOString() }] })
  }
  return [...parSlug.values()]
}

// ── L'écran « Simulation » ──────────────────────────────────────────────────

export type SimulationDeLEspace =
  | {
      readonly sorte: 'jouable'
      readonly donnée: DonnéeDeSimulation
      readonly version: number
      /** La table montrée n'est pas publiée : seule l'opératrice la voit. */
      readonly nonPublié: boolean
      /** La période des mesures de marché lues, ou `null` sans mesure. */
      readonly période: string | null
    }
  | { readonly sorte: 'périmée'; readonly version: number; readonly refus: readonly Refus[] }

/**
 * La simulation de l'organisation de la session : sa table d'effets publiée et
 * l'état mesuré d'où part le jeu. `null` hors de l'espace réorganisé, sans
 * table publiée, ou dans le doute. Une table qui ne passe plus la porte (arbre
 * ou grille modifiés depuis) n'est pas jouée : `périmée`.
 *
 * `aperçu` : la session de l'opératrice (`accès.aperçu`) lit aussi la dernière
 * version proposée et les mesures proposées, pour relire avant de publier. Un
 * client ne passe jamais `aperçu`.
 */
export async function simulationDeLEspace(entrée: { readonly registre: string; readonly aperçu?: boolean; readonly fin: string }, db?: Base): Promise<SimulationDeLEspace | null> {
  return bornée('lecture de la simulation', async () => {
    const organisation = await organisationDuRegistre(entrée.registre, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const enregistrée = await tableDEffetsDeLOrganisation({ organisationId: organisation.id, aperçu: entrée.aperçu === true }, db)
    if (!enregistrée) return null
    const [marchés, veille] = await Promise.all([
      marchésPourLaSimulation({ organisationId: organisation.id, aperçu: entrée.aperçu === true }, db),
      veilleDeLaSimulation({ organisationId: organisation.id, fin: entrée.fin }, db),
    ])
    if (!veille.grille) return null
    const table = versLaTable(enregistrée.contenu)
    const refus = contrôlerLaTableDEffets(table, { segments: marchés.segments.map((s) => s.clé), grille: veille.grille })
    if (refus.length > 0) return { sorte: 'périmée', version: enregistrée.version, refus }

    const lignes = marchés.vue?.lignes ?? []
    const verdicts = new Map(matriceDeDécision(lignes).cases.flatMap((c) => c.segments.map((s) => [s.clé, c.verdict] as const)))
    const mesurées = new Map(lignes.map((l) => [l.clé, l]))
    const segments: SegmentDeJeu[] = marchés.segments.map((s) => {
      const ligne = mesurées.get(s.clé)
      return { clé: s.clé, libellé: s.libellé, verdict: verdicts.get(s.clé) ?? null, concurrents: ligne?.présents ? ligne.présents.length : null }
    })
    return {
      sorte: 'jouable',
      version: enregistrée.version,
      nonPublié: enregistrée.état !== 'publie',
      période: marchés.vue?.période ?? null,
      donnée: {
        segments,
        table,
        observations: observationsDesCartes(table.cartes, veille.faits, veille.grille),
        historique: semainesDHistorique(veille.faits),
        départ: piliersDeDépart({ segments, engagements: table.engagements, forces: veille.forces, dimensionsExposées: dimensionsExposées(veille.faits) }),
      },
    }
  })
}
