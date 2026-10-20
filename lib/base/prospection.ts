import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { lireAbonnement } from '@/lib/base/abonnements'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { lecteurs, organisations, prospections, événementsProspection, type Prospection } from '@/lib/base/schema'

/**
 * La prospection par lemlist dans Postgres (tables `prospections` et
 * `événements_prospection`).
 *
 * Seul `lib/portail/prospection.ts` appelle ces fonctions ;
 * `tests/architecture.test.ts` le vérifie. Le dernier paramètre (`db`) n'existe
 * que pour les tests, qui passent une base PGlite en mémoire.
 *
 * **Le rattachement d'un lead à un lecteur se fait par l'adresse, une fois.**
 * lemlist ne connaît pas les identifiants du portail ; le portail ne tient pas
 * les adresses hors de `lecteurs`. Le premier événement reçu pour un lead
 * cherche donc un lecteur actif qui porte son adresse, en minuscules, dans une
 * organisation encore en prospection (`demande`, `generation`, `essai`) de
 * préférence, la plus récente sinon. L'adresse sert à chercher et n'est pas
 * écrite ; c'est l'empreinte qui l'est.
 */

export type StatutProspection = (typeof prospections.statut.enumValues)[number]

/** Les statuts qu'aucun événement ni aucune synchronisation ne remplace. */
const FINAUX = new Set<StatutProspection>(['desinscrit'])
const EN_PROSPECTION = new Set(['demande', 'generation', 'essai'])

export type LeadReçu = {
  readonly email: string
  readonly empreinte: string
  readonly campagne: string | null
  readonly lead: string | null
  readonly contact: string | null
}

/**
 * Trouve la ligne de prospection d'un lead, ou la crée en rattachant le lecteur
 * qui porte son adresse. Complète les identifiants lemlist quand ils arrivent.
 */
export async function rattacherLead(
  reçu: LeadReçu,
  db: Base = base(),
): Promise<{ readonly id: string; readonly statut: StatutProspection; readonly créée: boolean; readonly rattachée: boolean }> {
  return protéger('rattachement d’un lead', async () => {
    const existante = await trouver(reçu, db)
    if (existante) {
      const complément: Partial<typeof prospections.$inferInsert> = {}
      if (!existante.leadLemlist && reçu.lead) complément.leadLemlist = reçu.lead
      if (!existante.campagneLemlist && reçu.campagne) complément.campagneLemlist = reçu.campagne
      if (!existante.contactLemlist && reçu.contact) complément.contactLemlist = reçu.contact
      if (Object.keys(complément).length > 0) {
        await db.update(prospections).set({ ...complément, modifiéeLe: new Date() }).where(eq(prospections.id, existante.id))
      }
      return { id: existante.id, statut: existante.statut, créée: false, rattachée: existante.lecteurId !== null }
    }

    const lecteur = await lecteurPourAdresse(reçu.email, db)
    const [ligne] = await db
      .insert(prospections)
      .values({
        organisationId: lecteur?.organisationId ?? null,
        lecteurId: lecteur?.id ?? null,
        destinataireEmpreinte: reçu.empreinte,
        campagneLemlist: reçu.campagne,
        leadLemlist: reçu.lead,
        contactLemlist: reçu.contact,
      })
      .returning({ id: prospections.id, statut: prospections.statut })
    if (!ligne) throw new Error('insertion sans ligne rendue')
    return { id: ligne.id, statut: ligne.statut, créée: true, rattachée: lecteur !== null }
  })
}

async function trouver(reçu: LeadReçu, db: Base): Promise<Prospection | null> {
  if (reçu.lead) {
    const [parLead] = await db.select().from(prospections).where(eq(prospections.leadLemlist, reçu.lead)).limit(1)
    if (parLead) return parLead
  }
  // Sans identifiant de lead (événement hors campagne, ou ligne née d'une
  // activation avant le premier webhook) : la même adresse dans la même campagne,
  // ou, à défaut, la ligne la plus récente de cette adresse encore sans lead.
  const conditions = [eq(prospections.destinataireEmpreinte, reçu.empreinte)]
  if (reçu.campagne) conditions.push(or(eq(prospections.campagneLemlist, reçu.campagne), isNull(prospections.campagneLemlist))!)
  const [parEmpreinte] = await db
    .select()
    .from(prospections)
    .where(and(...conditions, isNull(prospections.leadLemlist)))
    .orderBy(desc(prospections.crééeLe))
    .limit(1)
  return parEmpreinte ?? null
}

async function lecteurPourAdresse(
  email: string,
  db: Base,
): Promise<{ readonly id: string; readonly organisationId: string } | null> {
  const candidats = await db
    .select({ id: lecteurs.id, organisationId: lecteurs.organisationId, état: organisations.état, crééeLe: organisations.crééeLe })
    .from(lecteurs)
    .innerJoin(organisations, eq(lecteurs.organisationId, organisations.id))
    .where(
      and(
        sql`lower(${lecteurs.email}) = ${email.trim().toLowerCase()}`,
        eq(lecteurs.actif, true),
        eq(lecteurs.tousLesEspaces, false),
        isNull(organisations.archivéeLe),
      ),
    )
  const trié = candidats
    .filter((c): c is typeof c & { organisationId: string } => c.organisationId !== null)
    .sort((a, b) => {
      const pa = EN_PROSPECTION.has(a.état) ? 0 : 1
      const pb = EN_PROSPECTION.has(b.état) ? 0 : 1
      return pa - pb || b.crééeLe.getTime() - a.crééeLe.getTime()
    })
  const choisi = trié[0]
  return choisi ? { id: choisi.id, organisationId: choisi.organisationId } : null
}

export type ÉvénementÀJournaliser = {
  readonly activité: string
  readonly type: string
  readonly survenuLe: Date
  readonly étape: number | null
}

/** Ce qu'un type d'événement lemlist fait au statut, quand il fait quelque chose. */
function statutInduit(type: string, courant: StatutProspection): StatutProspection | null {
  if (FINAUX.has(courant)) return null
  switch (type) {
    case 'emailsUnsubscribed':
    case 'entityUnsubscribed':
    case 'emailsNotInterested':
      return 'desinscrit'
    case 'emailsBounced':
      return courant === 'envoye' ? 'rebondi' : null
    default:
      return null
  }
}

/**
 * Écrit un événement au journal et applique son effet sur le statut. Un
 * événement déjà reçu (même identifiant d'activité) est ignoré.
 */
export async function journaliserÉvénement(
  prospectionId: string,
  événement: ÉvénementÀJournaliser,
  db: Base = base(),
): Promise<{ readonly sorte: 'enregistré'; readonly statut: StatutProspection } | { readonly sorte: 'déjà-reçu' }> {
  return protéger('journalisation d’un événement de prospection', async () => {
    const [écrit] = await db
      .insert(événementsProspection)
      .values({
        prospectionId,
        activitéLemlist: événement.activité,
        type: événement.type,
        étape: événement.étape,
        survenuLe: événement.survenuLe,
      })
      .onConflictDoNothing()
      .returning({ id: événementsProspection.id })
    if (!écrit) return { sorte: 'déjà-reçu' }

    const [ligne] = await db.select({ statut: prospections.statut }).from(prospections).where(eq(prospections.id, prospectionId)).limit(1)
    if (!ligne) throw new Error('prospection absente')
    const nouveau = statutInduit(événement.type, ligne.statut)
    await db
      .update(prospections)
      .set({
        dernierÉvénementLe: événement.survenuLe,
        modifiéeLe: new Date(),
        ...(nouveau && nouveau !== ligne.statut ? { statut: nouveau, statutLe: new Date() } : {}),
      })
      .where(eq(prospections.id, prospectionId))
    return { sorte: 'enregistré', statut: nouveau ?? ligne.statut }
  })
}

/**
 * Enregistre la visite d'un lecteur par son identifiant d'accès, et dit si
 * c'était la première. La première visite est **l'activation** au sens de la
 * prospection : le prospect a ouvert son espace.
 */
export async function enregistrerVisite(
  identifiantAcces: string,
  maintenant: Date = new Date(),
  db: Base = base(),
): Promise<{ readonly première: boolean; readonly lecteurId: string; readonly organisationId: string | null; readonly email: string | null } | null> {
  return protéger('enregistrement d’une visite', async () => {
    const [avant] = await db
      .select({ id: lecteurs.id, organisationId: lecteurs.organisationId, email: lecteurs.email, dernièreVisiteLe: lecteurs.dernièreVisiteLe })
      .from(lecteurs)
      .where(eq(lecteurs.identifiantAcces, identifiantAcces))
      .limit(1)
    if (!avant) return null
    await db.update(lecteurs).set({ dernièreVisiteLe: maintenant }).where(eq(lecteurs.id, avant.id))
    return { première: avant.dernièreVisiteLe === null, lecteurId: avant.id, organisationId: avant.organisationId, email: avant.email }
  })
}

/**
 * Ouvre l'essai d'une organisation entrée par prospection, à la première visite
 * de son lecteur : `essai_ouvert_le` reçoit la date de la visite, et J0 sera la
 * première lettre publiée à partir de cette semaine (`j0DesÉditions`). Sans
 * effet sur une organisation déjà ouverte ou entrée par une demande. Rend
 * `true` quand l'essai vient d'ouvrir.
 */
export async function ouvrirLEssaiÀLaVisite(organisationId: string, maintenant: Date = new Date(), db: Base = base()): Promise<boolean> {
  return protéger('ouverture de l’essai à la visite', async () => {
    const lignes = await db
      .update(organisations)
      .set({ essaiOuvertLe: maintenant, modifiéeLe: maintenant })
      .where(
        and(
          eq(organisations.id, organisationId),
          eq(organisations.entréeParProspection, true),
          eq(organisations.état, 'essai'),
          isNull(organisations.essaiOuvertLe),
        ),
      )
      .returning({ id: organisations.id })
    return lignes.length > 0
  })
}

/** La prospection d'un lecteur, ou celle de son adresse si le rattachement avait échoué. */
export async function prospectionDuLecteur(
  lecteur: { readonly id: string; readonly organisationId: string | null; readonly empreinte: string | null },
  db: Base = base(),
): Promise<Prospection | null> {
  return protéger('lecture de la prospection d’un lecteur', async () => {
    const [parLecteur] = await db.select().from(prospections).where(eq(prospections.lecteurId, lecteur.id)).orderBy(desc(prospections.crééeLe)).limit(1)
    if (parLecteur) return parLecteur
    if (!lecteur.empreinte) return null
    const [parEmpreinte] = await db
      .select()
      .from(prospections)
      .where(and(eq(prospections.destinataireEmpreinte, lecteur.empreinte), isNull(prospections.lecteurId)))
      .orderBy(desc(prospections.crééeLe))
      .limit(1)
    if (!parEmpreinte) return null
    // Le rattachement a échoué au premier webhook (lecteur créé après) : il se fait ici.
    await db
      .update(prospections)
      .set({ lecteurId: lecteur.id, organisationId: parEmpreinte.organisationId ?? lecteur.organisationId, modifiéeLe: new Date() })
      .where(eq(prospections.id, parEmpreinte.id))
    return { ...parEmpreinte, lecteurId: lecteur.id, organisationId: parEmpreinte.organisationId ?? lecteur.organisationId }
  })
}

/**
 * Fait passer une prospection à un statut. Rend `false` si le statut courant
 * est final ou déjà celui-là. Le statut est posé avant l'appel à lemlist : si
 * lemlist échoue, `synchronisé_statut` reste en retard et la synchronisation
 * quotidienne retente.
 */
export async function passerAuStatut(prospectionId: string, statut: StatutProspection, db: Base = base()): Promise<boolean> {
  return protéger('changement de statut de prospection', async () => {
    const [ligne] = await db.select({ statut: prospections.statut }).from(prospections).where(eq(prospections.id, prospectionId)).limit(1)
    if (!ligne || FINAUX.has(ligne.statut) || ligne.statut === statut) return false
    await db.update(prospections).set({ statut, statutLe: new Date(), modifiéeLe: new Date() }).where(eq(prospections.id, prospectionId))
    return true
  })
}

export type IssueDeSynchro =
  /** Ce que lemlist a accepté : le statut écrit dans ses variables, la séquence arrêtée, ou les deux. */
  | { readonly statut?: StatutProspection; readonly séquenceArrêtée?: boolean }
  | { readonly erreur: string }

/** Note ce que lemlist a accepté, ou le code de l'échec. */
export async function noterLaSynchro(prospectionId: string, issue: IssueDeSynchro, db: Base = base()): Promise<void> {
  await protéger('notation d’une synchronisation lemlist', async () => {
    const maintenant = new Date()
    await db
      .update(prospections)
      .set(
        'erreur' in issue
          ? { erreurSynchro: issue.erreur, modifiéeLe: maintenant }
          : {
              erreurSynchro: null,
              modifiéeLe: maintenant,
              ...(issue.statut ? { synchroniséStatut: issue.statut, synchroniséLe: maintenant } : {}),
              ...(issue.séquenceArrêtée ? { séquenceArrêtéeLe: maintenant } : {}),
            },
      )
      .where(eq(prospections.id, prospectionId))
  })
}

export type ProspectionÀSynchroniser = {
  readonly id: string
  readonly statut: StatutProspection
  readonly campagneLemlist: string | null
  readonly leadLemlist: string | null
  readonly séquenceArrêtéeLe: Date | null
  readonly synchroniséStatut: StatutProspection | null
  /** L'adresse du lecteur, pour arrêter la séquence ; jamais journalisée. */
  readonly email: string | null
}

/**
 * Les prospections dont lemlist n'a pas le dernier mot : statut non écrit, ou
 * séquence à arrêter. Une ligne sans identifiant lemlist y figure aussi : elle
 * attend que le webhook les apporte.
 */
export async function prospectionsÀSynchroniser(db: Base = base()): Promise<ProspectionÀSynchroniser[]> {
  return protéger('lecture des prospections à synchroniser', () =>
    db
      .select({
        id: prospections.id,
        statut: prospections.statut,
        campagneLemlist: prospections.campagneLemlist,
        leadLemlist: prospections.leadLemlist,
        séquenceArrêtéeLe: prospections.séquenceArrêtéeLe,
        synchroniséStatut: prospections.synchroniséStatut,
        email: lecteurs.email,
      })
      .from(prospections)
      .leftJoin(lecteurs, eq(prospections.lecteurId, lecteurs.id))
      .where(
        or(
          isNull(prospections.synchroniséStatut),
          ne(prospections.synchroniséStatut, prospections.statut),
          and(inArray(prospections.statut, ['actif', 'abonne']), isNull(prospections.séquenceArrêtéeLe)),
        ),
      )
      .orderBy(desc(prospections.modifiéeLe))
      .limit(200),
  )
}

export type ProspectionEnCours = {
  readonly id: string
  readonly statut: StatutProspection
  readonly organisation: {
    readonly état: (typeof organisations.état.enumValues)[number]
    readonly activéeLe: Date | null
    readonly offre: (typeof organisations.offre.enumValues)[number]
    readonly parutionsDEssai: number
  }
  readonly abonnement: { readonly état: string } | null
}

/**
 * Les prospections encore en vie, avec ce qu'il faut pour calculer l'étape du
 * parcours de leur organisation : c'est de là que viennent `abonne` et `expire`.
 */
export async function prospectionsEnCours(db: Base = base()): Promise<ProspectionEnCours[]> {
  return protéger('lecture des prospections en cours', async () => {
    const lignes = await db
      .select({
        id: prospections.id,
        statut: prospections.statut,
        organisationId: organisations.id,
        état: organisations.état,
        activéeLe: organisations.activéeLe,
        offre: organisations.offre,
        parutionsDEssai: organisations.parutionsDEssai,
      })
      .from(prospections)
      .innerJoin(organisations, eq(prospections.organisationId, organisations.id))
      // Tout sauf le statut final : un essai expiré ou un abonnement résilié
      // peut redevenir abonné, et lemlist doit l'apprendre.
      .where(ne(prospections.statut, 'desinscrit'))
    const résultat: ProspectionEnCours[] = []
    for (const ligne of lignes) {
      const abonnement = await lireAbonnement(ligne.organisationId, db)
      résultat.push({
        id: ligne.id,
        statut: ligne.statut,
        organisation: { état: ligne.état, activéeLe: ligne.activéeLe, offre: ligne.offre, parutionsDEssai: ligne.parutionsDEssai },
        abonnement: abonnement ? { état: abonnement.état } : null,
      })
    }
    return résultat
  })
}

export type LigneDeProspection = {
  readonly id: string
  readonly slug: string | null
  readonly destinataireEmpreinte: string
  readonly campagneLemlist: string | null
  readonly leadLemlist: string | null
  readonly statut: StatutProspection
  readonly statutLe: Date
  readonly séquenceArrêtéeLe: Date | null
  readonly synchroniséStatut: StatutProspection | null
  readonly erreurSynchro: string | null
  readonly dernierÉvénementLe: Date | null
  readonly crééeLe: Date
  readonly événements: Readonly<Record<string, number>>
}

/**
 * Les prospections modifiées depuis une date, avec le compte de leurs
 * événements par type, pour la tâche de prospection. Aucune adresse.
 */
export async function prospectionsRécentes(depuis: Date, db: Base = base()): Promise<LigneDeProspection[]> {
  return protéger('lecture des prospections récentes', async () => {
    const lignes = await db
      .select({
        id: prospections.id,
        slug: organisations.slug,
        destinataireEmpreinte: prospections.destinataireEmpreinte,
        campagneLemlist: prospections.campagneLemlist,
        leadLemlist: prospections.leadLemlist,
        statut: prospections.statut,
        statutLe: prospections.statutLe,
        séquenceArrêtéeLe: prospections.séquenceArrêtéeLe,
        synchroniséStatut: prospections.synchroniséStatut,
        erreurSynchro: prospections.erreurSynchro,
        dernierÉvénementLe: prospections.dernierÉvénementLe,
        crééeLe: prospections.crééeLe,
      })
      .from(prospections)
      .leftJoin(organisations, eq(prospections.organisationId, organisations.id))
      .where(gte(prospections.modifiéeLe, depuis))
      .orderBy(desc(prospections.modifiéeLe))
      .limit(500)
    if (lignes.length === 0) return []

    const comptes = await db
      .select({ prospectionId: événementsProspection.prospectionId, type: événementsProspection.type, nombre: sql<number>`count(*)::int` })
      .from(événementsProspection)
      .where(inArray(événementsProspection.prospectionId, lignes.map((l) => l.id)))
      .groupBy(événementsProspection.prospectionId, événementsProspection.type)
    const parProspection = new Map<string, Record<string, number>>()
    for (const compte of comptes) {
      const existant = parProspection.get(compte.prospectionId) ?? {}
      existant[compte.type] = compte.nombre
      parProspection.set(compte.prospectionId, existant)
    }
    return lignes.map((ligne) => ({ ...ligne, événements: parProspection.get(ligne.id) ?? {} }))
  })
}
