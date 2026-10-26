import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { faitsÉtiquetés, grilles, organisations, positions, élémentsSynthèse } from '@/lib/base/schema'
import type { FaitÉtiqueté, Position, ÉlémentDeSynthèse } from '@/lib/base/schema'
import { empreinteDeLaGrille, type FaitConnu, type Grille, type ÉtiquetteValidée } from '@/lib/domaine/strategie'

/**
 * Les outils stratégiques en base (26 octobre 2026, lot 2 de
 * `docs/plan-outils-strategiques.md`) : les faits étiquetés, la grille de
 * l'organisation, les éléments de synthèse et les positions en crans.
 *
 * Ce fichier n'a qu'un appelant, l'orchestration `lib/portail/strategie.ts`
 * (`tests/architecture.test.ts`) : c'est elle qui lit l'édition, vérifie
 * l'organisation et passe la porte de `lib/domaine/strategie.ts` **avant**
 * d'écrire ici. Ce qui est écrit ici a donc déjà été contrôlé ; les contraintes
 * de la migration 0013 et les vérifications de transaction ci-dessous ne sont
 * qu'un second filet, pour ce qui peut changer entre la porte et l'écriture
 * (un drapeau retiré, une grille re-postée, une édition ré-étiquetée).
 *
 * Toute fonction prend l'identifiant de l'organisation et ne lit rien sans lui.
 * Rien n'est jamais supprimé : un remplacement archive (`archivée_le`).
 */

/** Ce que les routes savent de l'organisation : sa clé, et si elle est du pilote. */
export type OrganisationDesOutils = {
  readonly id: string
  readonly slug: string
  readonly registreNotion: string | null
  readonly outilsStratégiques: boolean
}

/**
 * L'organisation par son slug, ou par l'identifiant de registre que porte la
 * relation `Organisation` d'une édition (règle 2). Une organisation archivée
 * n'est pas rendue.
 */
export async function organisationPourLesOutils(
  désignation: { readonly slug: string } | { readonly registreNotion: string },
  db: Base = base(),
): Promise<OrganisationDesOutils | null> {
  return protéger('lecture d’une organisation pour les outils stratégiques', async () => {
    const critère =
      'slug' in désignation ? eq(organisations.slug, désignation.slug) : eq(organisations.registreNotion, désignation.registreNotion)
    const [ligne] = await db
      .select({
        id: organisations.id,
        slug: organisations.slug,
        registreNotion: organisations.registreNotion,
        outilsStratégiques: organisations.outilsStratégiques,
      })
      .from(organisations)
      .where(and(critère, isNull(organisations.archivéeLe)))
      .limit(1)
    return ligne ?? null
  })
}

/** Fait entrer une organisation dans le pilote, ou l'en fait sortir. Ses lignes restent. */
export async function réglerLesOutilsStratégiques(
  entrée: { readonly slug: string; readonly actif: boolean },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<'réglé' | 'organisation-inconnue'> {
  return protéger('réglage du pilote des outils stratégiques', async () => {
    const lignes = await db
      .update(organisations)
      .set({ outilsStratégiques: entrée.actif, modifiéeLe: maintenant })
      .where(and(eq(organisations.slug, entrée.slug), isNull(organisations.archivéeLe)))
      .returning({ id: organisations.id })
    return lignes.length > 0 ? 'réglé' : 'organisation-inconnue'
  })
}

/** Le drapeau relu dans la transaction : il a pu être retiré depuis la porte. */
async function estDuPilote(tx: Pick<Base, 'select'>, organisationId: string): Promise<boolean> {
  const [ligne] = await tx
    .select({ actif: organisations.outilsStratégiques })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), isNull(organisations.archivéeLe)))
    .limit(1)
  return ligne?.actif === true
}

/** Un identifiant mal formé ferait échouer la requête en 22P02 : il est traité comme inconnu. */
const estUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

// ── Faits étiquetés ──────────────────────────────────────────────────────────

export type RésultatDÉtiquetage =
  | { readonly sorte: 'enregistré'; readonly archivées: number; readonly insérées: number }
  | { readonly sorte: 'hors-pilote' | 'organisation-différente' }

/**
 * Remplace les étiquettes d'une édition par un lot validé : les anciennes sont
 * archivées et les nouvelles insérées, dans une transaction. Une édition remise
 * en Brouillon puis corrigée est simplement ré-étiquetée. Un lot vide (une
 * lettre dont tous les axes sont RAS) archive sans rien insérer.
 *
 * Une édition déjà étiquetée pour une **autre** organisation est refusée
 * (`organisation-différente`) : une édition qui changerait d'organisation est
 * une anomalie à remonter, jamais une donnée à réécrire (règle 2).
 */
export async function remplacerLesÉtiquettes(
  entrée: {
    readonly organisationId: string
    readonly édition: { readonly notion: string; readonly famille: string | null; readonly date: string }
    readonly étiquettes: readonly ÉtiquetteValidée[]
    readonly runId?: string | null
  },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<RésultatDÉtiquetage> {
  return protéger('remplacement des étiquettes d’une édition', () =>
    db.transaction(async (tx) => {
      if (!(await estDuPilote(tx, entrée.organisationId))) return { sorte: 'hors-pilote' } as const

      const vivantes = await tx
        .select({ id: faitsÉtiquetés.id, organisationId: faitsÉtiquetés.organisationId })
        .from(faitsÉtiquetés)
        .where(and(eq(faitsÉtiquetés.éditionNotion, entrée.édition.notion), isNull(faitsÉtiquetés.archivéeLe)))
      if (vivantes.some((v) => v.organisationId !== entrée.organisationId)) return { sorte: 'organisation-différente' } as const

      if (vivantes.length > 0) {
        await tx
          .update(faitsÉtiquetés)
          .set({ archivéeLe: maintenant })
          .where(inArray(faitsÉtiquetés.id, vivantes.map((v) => v.id)))
      }
      if (entrée.étiquettes.length > 0) {
        await tx.insert(faitsÉtiquetés).values(
          entrée.étiquettes.map((é) => ({
            organisationId: entrée.organisationId,
            éditionNotion: entrée.édition.notion,
            familleÉdition: entrée.édition.famille,
            dateÉdition: entrée.édition.date,
            section: é.section,
            numéroAxe: é.axe,
            rang: é.rang,
            empreinteTitre: é.empreinte,
            dateFait: é.date,
            sourceUrl: é.source,
            pestel: é.pestel,
            forcePorter: é.porter,
            ansoff: é.ansoff,
            entité: é.entite,
            rupture: é.rupture,
            impact: é.impact,
            nouveauté: é.nouveaute,
            runId: entrée.runId ?? null,
            crééLe: maintenant,
          })),
        )
      }
      return { sorte: 'enregistré', archivées: vivantes.length, insérées: entrée.étiquettes.length } as const
    }),
  )
}

/**
 * Les faits vivants des éditions parues dans la fenêtre (bornes comprises),
 * dans l'ordre de la lettre. La fenêtre se lit sur la date d'édition : ce que
 * les lettres de la période ont publié ; la porte de la synthèse juge ensuite
 * la date de chaque fait.
 */
export async function faitsDeLaFenêtre(
  entrée: { readonly organisationId: string; readonly début: string; readonly fin: string },
  db: Base = base(),
): Promise<FaitÉtiqueté[]> {
  return protéger('lecture des faits étiquetés d’une fenêtre', () =>
    db
      .select()
      .from(faitsÉtiquetés)
      .where(
        and(
          eq(faitsÉtiquetés.organisationId, entrée.organisationId),
          isNull(faitsÉtiquetés.archivéeLe),
          gte(faitsÉtiquetés.dateÉdition, entrée.début),
          lte(faitsÉtiquetés.dateÉdition, entrée.fin),
        ),
      )
      .orderBy(
        asc(faitsÉtiquetés.dateÉdition),
        asc(faitsÉtiquetés.éditionNotion),
        asc(faitsÉtiquetés.section),
        asc(faitsÉtiquetés.numéroAxe),
        asc(faitsÉtiquetés.rang),
      ),
  )
}

/**
 * Les faits vivants d'éditions désignées, pour l'écran : la vue d'ensemble les
 * demande pour les lettres qu'elle vient de lire. Toujours sous la clé de
 * l'organisation : une édition d'un autre client ne rend rien, même désignée.
 */
export async function faitsDesÉditions(
  entrée: { readonly organisationId: string; readonly éditions: readonly string[] },
  db: Base = base(),
): Promise<FaitÉtiqueté[]> {
  const éditions = [...new Set(entrée.éditions)].filter((e) => /^[0-9a-f]{32}$/.test(e))
  if (éditions.length === 0) return []
  return protéger('lecture des faits étiquetés d’éditions', () =>
    db
      .select()
      .from(faitsÉtiquetés)
      .where(
        and(
          eq(faitsÉtiquetés.organisationId, entrée.organisationId),
          isNull(faitsÉtiquetés.archivéeLe),
          inArray(faitsÉtiquetés.éditionNotion, éditions),
        ),
      )
      .orderBy(desc(faitsÉtiquetés.dateÉdition), asc(faitsÉtiquetés.section), asc(faitsÉtiquetés.numéroAxe), asc(faitsÉtiquetés.rang)),
  )
}

/**
 * Les faits cités par une synthèse, tels que la porte doit les connaître : un
 * identifiant d'une autre organisation, ou d'un fait archivé par un
 * ré-étiquetage, n'y figure pas et la porte le refuse (`fait-inconnu`).
 */
export async function faitsConnus(
  entrée: { readonly organisationId: string; readonly ids: readonly string[] },
  db: Base = base(),
): Promise<Map<string, FaitConnu>> {
  const ids = [...new Set(entrée.ids)].filter(estUuid)
  if (ids.length === 0) return new Map()
  return protéger('lecture des faits cités par une synthèse', async () => {
    const lignes = await db
      .select({ id: faitsÉtiquetés.id, date: faitsÉtiquetés.dateFait, entite: faitsÉtiquetés.entité })
      .from(faitsÉtiquetés)
      .where(
        and(
          eq(faitsÉtiquetés.organisationId, entrée.organisationId),
          isNull(faitsÉtiquetés.archivéeLe),
          inArray(faitsÉtiquetés.id, ids),
        ),
      )
    return new Map(lignes.map((l) => [l.id, { date: l.date, entite: l.entite }]))
  })
}

/** Ce que le contrôle du soir sait de l'étiquetage d'une organisation du pilote. */
export type ÉtiquetageDuPilote = {
  readonly slug: string
  readonly registreNotion: string | null
  /** Les éditions qui portent des étiquettes vivantes, 32 hexadécimaux. */
  readonly éditions: ReadonlySet<string>
  /** La date d'édition de la plus ancienne étiquetée ; nulle tant qu'aucune ne l'est. */
  readonly première: string | null
}

/** Les organisations du pilote, et les éditions qu'elles ont déjà fait étiqueter. */
export async function étatDeLÉtiquetage(db: Base = base()): Promise<ÉtiquetageDuPilote[]> {
  return protéger('lecture de l’état de l’étiquetage', async () => {
    const pilote = await db
      .select({ id: organisations.id, slug: organisations.slug, registreNotion: organisations.registreNotion })
      .from(organisations)
      .where(and(eq(organisations.outilsStratégiques, true), isNull(organisations.archivéeLe)))
      .orderBy(asc(organisations.slug))
    if (pilote.length === 0) return []
    const lignes = await db
      .selectDistinct({ organisationId: faitsÉtiquetés.organisationId, édition: faitsÉtiquetés.éditionNotion, date: faitsÉtiquetés.dateÉdition })
      .from(faitsÉtiquetés)
      .where(and(inArray(faitsÉtiquetés.organisationId, pilote.map((o) => o.id)), isNull(faitsÉtiquetés.archivéeLe)))
    return pilote.map((o) => {
      const siennes = lignes.filter((l) => l.organisationId === o.id)
      return {
        slug: o.slug,
        registreNotion: o.registreNotion,
        éditions: new Set(siennes.map((l) => l.édition)),
        première: siennes.map((l) => l.date).sort()[0] ?? null,
      }
    })
  })
}

// ── Grille ───────────────────────────────────────────────────────────────────

export type GrilleEnregistrée = {
  readonly version: number
  readonly empreinte: string
  readonly référentielNotion: string
  readonly grille: Grille
  readonly validéeLe: Date | null
}

/**
 * Enregistre la grille contrôlée par `contrôlerLaGrille`. La même grille
 * re-postée (même empreinte que la dernière version) ne crée pas de version :
 * `inchangée`. Une nouvelle version n'hérite pas de la validation de la
 * précédente, puisque ses axes ont pu changer.
 */
export async function posterLaGrille(
  entrée: { readonly organisationId: string; readonly référentielNotion: string; readonly grille: Grille },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<{ readonly sorte: 'créée' | 'inchangée'; readonly version: number } | { readonly sorte: 'hors-pilote' }> {
  const empreinte = empreinteDeLaGrille(entrée.grille)
  return protéger('enregistrement d’une grille', () =>
    db.transaction(async (tx) => {
      if (!(await estDuPilote(tx, entrée.organisationId))) return { sorte: 'hors-pilote' } as const
      const [dernière] = await tx
        .select({ version: grilles.version, empreinte: grilles.empreinte })
        .from(grilles)
        .where(eq(grilles.organisationId, entrée.organisationId))
        .orderBy(desc(grilles.version))
        .limit(1)
      if (dernière && dernière.empreinte === empreinte) return { sorte: 'inchangée', version: dernière.version } as const

      const version = (dernière?.version ?? 0) + 1
      await tx.insert(grilles).values({
        organisationId: entrée.organisationId,
        version,
        empreinte,
        référentielNotion: entrée.référentielNotion,
        axesGroupes: [...entrée.grille.axesGroupes],
        familles: [...entrée.grille.familles],
        entités: [...entrée.grille.entités],
        partiesPrenantes: [...entrée.grille.partiesPrenantes],
        offres: entrée.grille.offres ? [...entrée.grille.offres] : null,
        crééeLe: maintenant,
      })
      return { sorte: 'créée', version } as const
    }),
  )
}

/** La dernière version de la grille, ou rien tant qu'aucune n'a été postée. */
export async function lireLaGrille(organisationId: string, db: Base = base()): Promise<GrilleEnregistrée | null> {
  return protéger('lecture de la grille', async () => {
    const [ligne] = await db
      .select()
      .from(grilles)
      .where(and(eq(grilles.organisationId, organisationId), isNull(grilles.archivéeLe)))
      .orderBy(desc(grilles.version))
      .limit(1)
    if (!ligne) return null
    return {
      version: ligne.version,
      empreinte: ligne.empreinte,
      référentielNotion: ligne.référentielNotion,
      validéeLe: ligne.validéeLe,
      grille: {
        axesGroupes: ligne.axesGroupes as Grille['axesGroupes'],
        familles: ligne.familles as Grille['familles'],
        entités: ligne.entités as Grille['entités'],
        partiesPrenantes: ligne.partiesPrenantes as Grille['partiesPrenantes'],
        offres: (ligne.offres as Grille['offres']) ?? null,
      },
    }
  })
}

/** Pose la validation d'une version, une fois les points de validation de ses axes répondus. */
export async function validerLaGrille(
  entrée: { readonly organisationId: string; readonly version: number },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<'validée' | 'déjà-validée' | 'inconnue'> {
  return protéger('validation d’une grille', async () => {
    const [ligne] = await db
      .select({ id: grilles.id, validéeLe: grilles.validéeLe })
      .from(grilles)
      .where(and(eq(grilles.organisationId, entrée.organisationId), eq(grilles.version, entrée.version), isNull(grilles.archivéeLe)))
      .limit(1)
    if (!ligne) return 'inconnue'
    if (ligne.validéeLe) return 'déjà-validée'
    await db.update(grilles).set({ validéeLe: maintenant }).where(eq(grilles.id, ligne.id))
    return 'validée'
  })
}

// ── Synthèses ────────────────────────────────────────────────────────────────

/**
 * Un élément tel que l'orchestration le prépare depuis la synthèse contrôlée.
 * `idProvisoire` (« S1 », « O2 ») et `croise` (les identifiants provisoires des
 * éléments SWOT qu'une option TOWS croise) sont résolus ici en identifiants de
 * base, dans la transaction, et rangés sous `références.éléments`.
 */
export type ÉlémentÀEnregistrer = {
  readonly outil: ÉlémentDeSynthèse['outil']
  readonly clé: string
  readonly rang: number
  readonly énoncé: string | null
  readonly état?: ÉlémentDeSynthèse['état']
  readonly origine?: ÉlémentDeSynthèse['origine']
  readonly hypothèse?: boolean
  readonly filiation?: string | null
  readonly faits: readonly string[]
  readonly références?: Record<string, unknown>
  readonly valeur?: Record<string, unknown> | null
  readonly candidateRecommandation?: boolean
  readonly idProvisoire?: string
  readonly croise?: readonly string[]
}

export type PositionÀEnregistrer = {
  readonly outil: Position['outil']
  readonly sujet: string
  readonly axe: string
  readonly cran: number | null
  readonly nonSuivi?: boolean
  readonly tendance?: Position['tendance']
  readonly faits: readonly string[]
}

export type RésultatDeSynthèse =
  | { readonly sorte: 'enregistrée'; readonly éléments: number; readonly positions: number; readonly archivés: number }
  | { readonly sorte: 'hors-pilote' | 'grille-périmée' | 'fait-inconnu' | 'filiation-inconnue' }
  | { readonly sorte: 'référence-inconnue'; readonly référence: string }

/**
 * Enregistre la synthèse d'une période, contrôlée par `contrôlerLaSynthèse`, à
 * la place de la précédente de la même période (archivée). Revérifie dans la
 * transaction ce qui a pu changer depuis la porte : le pilote, la version de la
 * grille, les faits cités (un ré-étiquetage les archive), les filiations.
 */
export async function enregistrerLaSynthèse(
  entrée: {
    readonly organisationId: string
    readonly période: string
    readonly fenêtre: { readonly début: string; readonly fin: string }
    readonly grilleVersion: number
    readonly éléments: readonly ÉlémentÀEnregistrer[]
    readonly positions: readonly PositionÀEnregistrer[]
  },
  db: Base = base(),
  maintenant: Date = new Date(),
): Promise<RésultatDeSynthèse> {
  return protéger('enregistrement d’une synthèse', () =>
    db.transaction(async (tx) => {
      const org = entrée.organisationId
      if (!(await estDuPilote(tx, org))) return { sorte: 'hors-pilote' } as const

      const [grille] = await tx
        .select({ version: grilles.version })
        .from(grilles)
        .where(and(eq(grilles.organisationId, org), isNull(grilles.archivéeLe)))
        .orderBy(desc(grilles.version))
        .limit(1)
      if (!grille || grille.version !== entrée.grilleVersion) return { sorte: 'grille-périmée' } as const

      const cités = [...new Set([...entrée.éléments.flatMap((é) => é.faits), ...entrée.positions.flatMap((p) => p.faits)])]
      if (!cités.every(estUuid)) return { sorte: 'fait-inconnu' } as const
      if (cités.length > 0) {
        const [compte] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(faitsÉtiquetés)
          .where(and(eq(faitsÉtiquetés.organisationId, org), isNull(faitsÉtiquetés.archivéeLe), inArray(faitsÉtiquetés.id, cités)))
        if (compte?.n !== cités.length) return { sorte: 'fait-inconnu' } as const
      }

      const filiations = [...new Set(entrée.éléments.map((é) => é.filiation).filter((f): f is string => !!f))]
      if (!filiations.every(estUuid)) return { sorte: 'filiation-inconnue' } as const
      if (filiations.length > 0) {
        const [compte] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(élémentsSynthèse)
          .where(and(eq(élémentsSynthèse.organisationId, org), inArray(élémentsSynthèse.id, filiations)))
        if (compte?.n !== filiations.length) return { sorte: 'filiation-inconnue' } as const
      }

      const provisoires = new Set(entrée.éléments.map((é) => é.idProvisoire).filter((i): i is string => !!i))
      for (const é of entrée.éléments) {
        for (const r of é.croise ?? []) if (!provisoires.has(r)) return { sorte: 'référence-inconnue', référence: r } as const
      }

      const archivésÉléments = await tx
        .update(élémentsSynthèse)
        .set({ archivéeLe: maintenant })
        .where(and(eq(élémentsSynthèse.organisationId, org), eq(élémentsSynthèse.période, entrée.période), isNull(élémentsSynthèse.archivéeLe)))
        .returning({ id: élémentsSynthèse.id })
      const archivéesPositions = await tx
        .update(positions)
        .set({ archivéeLe: maintenant })
        .where(and(eq(positions.organisationId, org), eq(positions.période, entrée.période), isNull(positions.archivéeLe)))
        .returning({ id: positions.id })

      const parProvisoire = new Map<string, string>()
      if (entrée.éléments.length > 0) {
        const insérés = await tx
          .insert(élémentsSynthèse)
          .values(
            entrée.éléments.map((é) => ({
              organisationId: org,
              période: entrée.période,
              fenêtreDébut: entrée.fenêtre.début,
              fenêtreFin: entrée.fenêtre.fin,
              outil: é.outil,
              clé: é.clé,
              rang: é.rang,
              énoncé: é.énoncé,
              état: é.état ?? null,
              origine: é.origine ?? 'faits',
              hypothèse: é.hypothèse ?? false,
              filiation: é.filiation ?? null,
              faits: [...é.faits],
              références: é.références ?? {},
              valeur: é.valeur ?? null,
              candidateRecommandation: é.candidateRecommandation ?? false,
              grilleVersion: entrée.grilleVersion,
              crééLe: maintenant,
            })),
          )
          .returning({ id: élémentsSynthèse.id })
        entrée.éléments.forEach((é, i) => {
          if (é.idProvisoire) parProvisoire.set(é.idProvisoire, insérés[i]!.id)
        })
        for (const [i, é] of entrée.éléments.entries()) {
          if (!é.croise || é.croise.length === 0) continue
          await tx
            .update(élémentsSynthèse)
            .set({ références: { ...(é.références ?? {}), éléments: é.croise.map((r) => parProvisoire.get(r)!) } })
            .where(eq(élémentsSynthèse.id, insérés[i]!.id))
        }
      }
      if (entrée.positions.length > 0) {
        await tx.insert(positions).values(
          entrée.positions.map((p) => ({
            organisationId: org,
            période: entrée.période,
            outil: p.outil,
            sujet: p.sujet,
            axe: p.axe,
            cran: p.cran,
            nonSuivi: p.nonSuivi ?? false,
            tendance: p.tendance ?? null,
            faits: [...p.faits],
            grilleVersion: entrée.grilleVersion,
            crééLe: maintenant,
          })),
        )
      }
      return {
        sorte: 'enregistrée',
        éléments: entrée.éléments.length,
        positions: entrée.positions.length,
        archivés: archivésÉléments.length + archivéesPositions.length,
      } as const
    }),
  )
}

export type SynthèseEnregistrée = {
  readonly période: string
  readonly éléments: readonly ÉlémentDeSynthèse[]
  readonly positions: readonly Position[]
}

async function lireUnePériode(db: Base, organisationId: string, période: string): Promise<SynthèseEnregistrée> {
  const [éléments, lignesDePosition] = await Promise.all([
    db
      .select()
      .from(élémentsSynthèse)
      .where(and(eq(élémentsSynthèse.organisationId, organisationId), eq(élémentsSynthèse.période, période), isNull(élémentsSynthèse.archivéeLe)))
      .orderBy(asc(élémentsSynthèse.outil), asc(élémentsSynthèse.clé), asc(élémentsSynthèse.rang)),
    db
      .select()
      .from(positions)
      .where(and(eq(positions.organisationId, organisationId), eq(positions.période, période), isNull(positions.archivéeLe)))
      .orderBy(asc(positions.outil), asc(positions.sujet), asc(positions.axe)),
  ])
  return { période, éléments, positions: lignesDePosition }
}

/** La synthèse vivante d'une période ; vide si aucune n'a été enregistrée. */
export async function lireLaSynthèse(
  entrée: { readonly organisationId: string; readonly période: string },
  db: Base = base(),
): Promise<SynthèseEnregistrée> {
  return protéger('lecture d’une synthèse', () => lireUnePériode(db, entrée.organisationId, entrée.période))
}

/** Le motif SQL des périodes de même granularité : un mois suit un mois, un trimestre un trimestre. */
function granularité(période: string): string | null {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(période)) return '^[0-9]{4}-[0-9]{2}$'
  if (/^\d{4}-T[1-4]$/.test(période)) return '^[0-9]{4}-T[1-4]$'
  if (/^\d{4}$/.test(période)) return '^[0-9]{4}$'
  return null
}

/**
 * La dernière synthèse vivante de même granularité avant cette période, d'où
 * la porte tire les éléments SWOT et les crans précédents (filiations,
 * mouvements). Rien pour une première synthèse.
 */
export async function synthèsePrécédente(
  entrée: { readonly organisationId: string; readonly période: string },
  db: Base = base(),
): Promise<SynthèseEnregistrée | null> {
  const motif = granularité(entrée.période)
  if (!motif) return null
  return protéger('lecture de la synthèse précédente', async () => {
    const vivantes = (table: typeof élémentsSynthèse | typeof positions) =>
      db
        .select({ période: table.période })
        .from(table)
        .where(
          and(
            eq(table.organisationId, entrée.organisationId),
            isNull(table.archivéeLe),
            lt(table.période, entrée.période),
            sql`${table.période} ~ ${motif}`,
          ),
        )
        .orderBy(desc(table.période))
        .limit(1)
    const [[e], [p]] = await Promise.all([vivantes(élémentsSynthèse), vivantes(positions)])
    const période = [e?.période, p?.période].filter((x): x is string => !!x).sort().at(-1)
    return période ? lireUnePériode(db, entrée.organisationId, période) : null
  })
}
