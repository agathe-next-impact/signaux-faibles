import { eq, inArray, not, sql } from 'drizzle-orm'
import type { Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { lecteurs, organisations } from '@/lib/base/schema'
import { empreinte } from '@/lib/portail/debit'

/**
 * L'import de la base Notion « Accès — portail » dans Postgres.
 *
 * C'est l'étape 2 de la migration du palier 1 (`docs/schema-donnees.md`) :
 * **rejouable**, et rejouée tant que dure la double lecture, parce que la tâche
 * Cowork continue d'écrire dans Notion jusqu'à la bascule. Chaque passage
 * aligne Postgres sur Notion, y compris dans le sens qui ferme : un lecteur qui
 * n'est plus dans Notion est désactivé, jamais supprimé.
 *
 * Le module est en deux temps. `planifierImport` est une fonction pure : elle
 * décide de ce qui sera écrit et de ce qui est écarté, et c'est elle que les
 * tests mesurent. `appliquerImport` écrit le plan dans une seule transaction :
 * un import interrompu ne laisse pas une base à moitié alignée.
 *
 * Ce qui est écarté l'est pour les mêmes raisons que la lecture Notion
 * refusait la ligne : un import ne doit pas ouvrir un accès que le portail
 * refuse aujourd'hui. Le rapport ne porte ni adresse ni identifiant d'accès en
 * clair, seulement des empreintes.
 */

/** Une ligne de la base Notion « Accès », telle que le script l'a lue. */
export type LigneAccèsNotion = {
  readonly nom: string
  readonly email: string | null
  readonly organisationLibellé: string
  /** « Identifiant Notion de l'organisation » : la ligne du registre. */
  readonly organisationId: string
  readonly slug: string
  readonly identifiant: string
  readonly actif: boolean
  readonly tousLesEspaces: boolean
}

export type Écart = { readonly raison: string; readonly ligne: string }

export type PlanDImport = {
  readonly organisations: ReadonlyArray<{ slug: string; nom: string; registreNotion: string }>
  readonly lecteurs: ReadonlyArray<{
    slug: string
    nom: string
    email: string | null
    identifiant: string
    actif: boolean
    tousLesEspaces: boolean
  }>
  /**
   * Les opérateurs (case « Tous les espaces » cochée), importés **sans client**
   * : leur privilège est global, il ne dépend d'aucun espace (décision du
   * 16 octobre 2026). Dans Notion, la ligne porte un slug parce que le modèle
   * l'exige ; ce slug n'est pas repris, et la ligne ne compte pas parmi les
   * lecteurs de ce client.
   */
  readonly opérateurs: ReadonlyArray<{
    nom: string
    email: string | null
    identifiant: string
    actif: boolean
  }>
  readonly écartés: ReadonlyArray<Écart>
  /**
   * Identifiants des lignes écartées pour une anomalie que la lecture Notion
   * **tolère** : Notion sert ces liens un par un, l'import ne sait pas les
   * ranger. Ils ne sont jamais désactivés par l'import ; s'ils étaient déjà en
   * base, ils y restent tels quels jusqu'à ce que l'anomalie soit corrigée dans
   * Notion. Un import ne ferme jamais un accès que Notion accorde.
   */
  readonly préservés: ReadonlyArray<string>
}

const normaliser = (identifiantNotion: string): string =>
  identifiantNotion.replaceAll('-', '').trim().toLowerCase()

/** Ce qui désigne une ligne dans le rapport, sans rien en divulguer. */
const désigner = (ligne: LigneAccèsNotion): string =>
  `${ligne.slug || '(sans slug)'} · ${ligne.email ? empreinte(ligne.email) : '(sans email)'}`

export function planifierImport(lignes: readonly LigneAccèsNotion[]): PlanDImport {
  const écartés: Écart[] = []

  // Un identifiant porté par deux lignes : Notion refuse les deux liens. On
  // n'importe ni l'une ni l'autre, sans quoi la contrainte d'unicité choisirait
  // à notre place laquelle des deux personnes garde l'accès.
  const occurrences = new Map<string, number>()
  for (const ligne of lignes) {
    const identifiant = ligne.identifiant.trim()
    if (identifiant) occurrences.set(identifiant, (occurrences.get(identifiant) ?? 0) + 1)
  }

  const retenues: LigneAccèsNotion[] = []
  const opérateurs: Array<PlanDImport['opérateurs'][number]> = []
  for (const ligne of lignes) {
    const identifiant = ligne.identifiant.trim()
    if (!identifiant) écartés.push({ raison: 'identifiant d’accès vide', ligne: désigner(ligne) })
    else if ((occurrences.get(identifiant) ?? 0) > 1)
      écartés.push({ raison: 'identifiant d’accès partagé avec une autre ligne', ligne: désigner(ligne) })
    // L'opérateur n'a besoin ni de slug ni d'organisation : il est global.
    else if (ligne.tousLesEspaces)
      opérateurs.push({
        nom: ligne.nom.trim() || '(sans nom)',
        email: ligne.email?.trim() || null,
        identifiant,
        actif: ligne.actif,
      })
    else if (!ligne.slug.trim()) écartés.push({ raison: 'slug vide', ligne: désigner(ligne) })
    else if (!normaliser(ligne.organisationId))
      écartés.push({ raison: 'identifiant Notion de l’organisation vide', ligne: désigner(ligne) })
    else retenues.push(ligne)
  }

  // Une organisation par slug, et un slug par organisation. Deux identifiants
  // pour un même slug, c'est le piège de la page organisation collée à la place
  // de la ligne du registre (10 septembre 2026) ; un même registre sous deux
  // slugs ferait échouer l'index unique et toute la transaction. Dans les deux
  // cas on écarte le slug entier plutôt que de deviner, et on **préserve** ses
  // lecteurs : Notion les sert un par un, l'import n'a pas à les fermer.
  const parSlug = new Map<string, LigneAccèsNotion[]>()
  const slugsParRegistre = new Map<string, Set<string>>()
  for (const ligne of retenues) {
    const slug = ligne.slug.trim()
    parSlug.set(slug, [...(parSlug.get(slug) ?? []), ligne])
    const registre = normaliser(ligne.organisationId)
    slugsParRegistre.set(registre, (slugsParRegistre.get(registre) ?? new Set()).add(slug))
  }

  const organisationsPlan: Array<{ slug: string; nom: string; registreNotion: string }> = []
  const lecteursPlan: Array<PlanDImport['lecteurs'][number]> = []
  const préservés: string[] = []

  const écarterLeSlug = (lignesDuSlug: LigneAccèsNotion[], raison: string) => {
    for (const ligne of lignesDuSlug) {
      écartés.push({ raison, ligne: désigner(ligne) })
      if (ligne.actif) préservés.push(ligne.identifiant.trim())
    }
  }

  for (const [slug, lignesDuSlug] of parSlug) {
    const registres = new Set(lignesDuSlug.map((ligne) => normaliser(ligne.organisationId)))
    if (registres.size > 1) {
      écarterLeSlug(lignesDuSlug, 'le slug porte plusieurs identifiants d’organisation différents')
      continue
    }
    const [registreUnique] = [...registres]
    if (registreUnique && (slugsParRegistre.get(registreUnique)?.size ?? 0) > 1) {
      écarterLeSlug(lignesDuSlug, 'la même organisation est portée par plusieurs slugs')
      continue
    }

    const [registreNotion] = [...registres]
    if (!registreNotion) continue
    const nom = lignesDuSlug.map((ligne) => ligne.organisationLibellé.trim()).find(Boolean) ?? slug
    organisationsPlan.push({ slug, nom, registreNotion })

    // Une adresse par organisation, comparée en minuscules : la base le
    // garantit par un index unique, le plan l'écarte avant pour le dire.
    // La ligne active passe avant l'inactive : garder la révoquée et écarter la
    // vivante fermerait un lien que Notion sert. Le tri est stable.
    const adresses = new Set<string>()
    const ordonnées = [...lignesDuSlug].sort((a, b) => Number(b.actif) - Number(a.actif))
    for (const ligne of ordonnées) {
      const adresse = ligne.email?.trim().toLowerCase() ?? null
      if (adresse && adresses.has(adresse)) {
        écartés.push({ raison: 'adresse déjà portée par une autre ligne de ce client', ligne: désigner(ligne) })
        if (ligne.actif) préservés.push(ligne.identifiant.trim())
        continue
      }
      if (adresse) adresses.add(adresse)
      lecteursPlan.push({
        slug,
        nom: ligne.nom.trim() || '(sans nom)',
        email: ligne.email?.trim() || null,
        identifiant: ligne.identifiant.trim(),
        actif: ligne.actif,
        tousLesEspaces: ligne.tousLesEspaces,
      })
    }
  }

  return { organisations: organisationsPlan, lecteurs: lecteursPlan, opérateurs, écartés, préservés }
}

export type RapportDImport = {
  /** Organisations écrites (créées ou réalignées), hors celles écartées en base. */
  readonly organisations: number
  readonly organisationsCréées: number
  /** Lecteurs et opérateurs écrits, créés ou réalignés. */
  readonly lecteurs: number
  readonly lecteursCréés: number
  /** Lecteurs déjà en base, réalignés sur Notion (y compris ceux qui n'ont pas changé). */
  readonly lecteursMisÀJour: number
  readonly lecteursDésactivés: number
  readonly écartés: ReadonlyArray<Écart>
}

export type OptionsDImport = {
  /**
   * À blanc : la transaction est jouée entièrement, puis annulée. Le rapport
   * porte donc les comptes exacts de ce qu'un import écrirait **maintenant**,
   * désactivations comprises, sans rien laisser en base (13 novembre 2026,
   * aperçu du bouton de synchronisation de l'opératrice).
   */
  readonly àBlanc?: boolean
  /**
   * Le nombre de désactivations que l'opératrice a vues à l'aperçu. Si
   * l'import en ferait davantage, la transaction est annulée et
   * `appliquerImport` lève `DésactivationsAuDelàDeLAperçu` : un lecteur ne perd
   * pas son accès parce que Notion a changé entre l'aperçu et la confirmation.
   */
  readonly désactivationsAuPlus?: number
}

/** L'import ferait plus de désactivations que l'aperçu ne l'annonçait : rien n'est écrit. */
export class DésactivationsAuDelàDeLAperçu extends Error {
  override readonly name = 'DésactivationsAuDelàDeLAperçu'
  constructor(
    readonly attendues: number,
    readonly constatées: number,
  ) {
    super(`[base] import refusé : ${constatées} désactivation(s) au lieu de ${attendues} au plus.`)
  }
}

/** Le signal qui annule la transaction d'un import à blanc, rapport en main. */
class AnnulationÀBlanc extends Error {
  constructor(readonly rapport: RapportDImport) {
    super('import à blanc')
  }
}

/**
 * Écrit le plan dans Postgres, en une transaction.
 *
 * - organisations : créées par slug, ou mises à jour (libellé, registre). Une
 *   organisation créée par l'import est `abonnee` et `relecture_requise` :
 *   ce sont les clients historiques, qui reçoivent leurs lettres hors Stripe.
 *   Le parcours d'essai (palier 1c) ne s'applique pas à eux tant qu'aucune
 *   ligne `abonnements` ne les y fait entrer ;
 * - lecteurs : créés par identifiant d'accès, ou mis à jour ;
 * - un lecteur préservé (voir `PlanDImport.préservés`) n'est pas touché ;
 * - un lecteur dont l'identifiant n'est plus dans Notion est **désactivé**,
 *   jamais supprimé — y compris quand Notion est vide, ce qui désactive tout :
 *   c'est le comportement de Notion lui-même, et le script refuse d'importer
 *   une base vide pour cette raison (voir `scripts/importer-acces.ts`).
 *
 * L'import n'envoie rien : ni lien d'accès, ni courrier. Il n'écrit que les
 * tables `organisations` et `lecteurs`.
 */
export async function appliquerImport(db: Base, plan: PlanDImport, options: OptionsDImport = {}): Promise<RapportDImport> {
  // Les deux signaux sont rattrapés **dans** `protéger`, qui ne laisserait
  // sortir qu'une erreur réduite à son code SQLSTATE. La transaction est déjà
  // annulée quand ils arrivent ici : Drizzle relance l'erreur du rappel telle
  // quelle après le `rollback`.
  const issue = await protéger('import de la base Accès', async () => {
    try {
      return { rapport: await écrire(db, plan, options) }
    } catch (erreur) {
      if (erreur instanceof AnnulationÀBlanc) return { rapport: erreur.rapport }
      if (erreur instanceof DésactivationsAuDelàDeLAperçu) return { refus: erreur }
      throw erreur
    }
  })
  if ('refus' in issue) throw issue.refus
  return issue.rapport
}

async function écrire(db: Base, plan: PlanDImport, options: OptionsDImport): Promise<RapportDImport> {
  return db.transaction(async (tx) => {
    const idParSlug = new Map<string, string>()
    const écartés: Écart[] = [...plan.écartés]
    let organisationsCréées = 0
    let lecteursCréés = 0
    let lecteursMisÀJour = 0

    // Depuis le 18/10/2026, l'onboarding crée aussi des organisations
    // (`POST /api/veille/organisations`) : un registre peut donc déjà porter un
    // autre slug en base. L'écrire ferait échouer toute la transaction, pour
    // tous les clients ; l'organisation est écartée et ses lecteurs préservés.
    const existants = await tx
      .select({ slug: organisations.slug, registreNotion: organisations.registreNotion })
      .from(organisations)
    const slugParRegistre = new Map(existants.flatMap((o) => (o.registreNotion ? [[o.registreNotion, o.slug] as const] : [])))

    // `xmax = 0` : la ligne rendue vient d'être insérée, et non mise à jour par
    // le `on conflict`. C'est la façon Postgres de distinguer les deux dans un
    // même `insert … returning`, sans relire la table avant.
    const créée = sql<boolean>`(xmax = 0)`

    for (const organisation of plan.organisations) {
      const porteur = slugParRegistre.get(organisation.registreNotion)
      if (porteur && porteur !== organisation.slug) {
        écartés.push({ raison: `registre déjà porté par le slug « ${porteur} » en base`, ligne: organisation.slug })
        continue
      }
      const [ligne] = await tx
        .insert(organisations)
        .values({
          slug: organisation.slug,
          nom: organisation.nom,
          registreNotion: organisation.registreNotion,
          état: 'abonnee',
          relectureRequise: true,
        })
        .onConflictDoUpdate({
          target: organisations.slug,
          set: {
            nom: organisation.nom,
            registreNotion: organisation.registreNotion,
            modifiéeLe: sql`now()`,
          },
        })
        .returning({ id: organisations.id, créée })
      if (ligne) {
        idParSlug.set(organisation.slug, ligne.id)
        if (ligne.créée) organisationsCréées++
      }
    }

    const compter = (ligne: { créée: boolean } | undefined) => {
      if (!ligne) return
      if (ligne.créée) lecteursCréés++
      else lecteursMisÀJour++
    }

    for (const lecteur of plan.lecteurs) {
      const organisationId = idParSlug.get(lecteur.slug)
      if (!organisationId) continue
      const [écrit] = await tx
        .insert(lecteurs)
        .values({
          organisationId,
          nom: lecteur.nom,
          email: lecteur.email,
          identifiantAcces: lecteur.identifiant,
          actif: lecteur.actif,
          tousLesEspaces: lecteur.tousLesEspaces,
          rôle: lecteur.tousLesEspaces ? 'operateur' : 'lecteur',
        })
        .onConflictDoUpdate({
          target: lecteurs.identifiantAcces,
          set: {
            organisationId,
            nom: lecteur.nom,
            email: lecteur.email,
            actif: lecteur.actif,
            tousLesEspaces: lecteur.tousLesEspaces,
            rôle: lecteur.tousLesEspaces ? 'operateur' : 'lecteur',
          },
        })
        .returning({ créée })
      compter(écrit)
    }

    for (const opérateur of plan.opérateurs) {
      const valeurs = {
        organisationId: null,
        nom: opérateur.nom,
        email: opérateur.email,
        actif: opérateur.actif,
        tousLesEspaces: true,
        rôle: 'operateur' as const,
      }
      const [écrit] = await tx
        .insert(lecteurs)
        .values({ ...valeurs, identifiantAcces: opérateur.identifiant })
        .onConflictDoUpdate({ target: lecteurs.identifiantAcces, set: valeurs })
        .returning({ créée })
      compter(écrit)
    }

    const connus = [
      ...plan.lecteurs.map((lecteur) => lecteur.identifiant),
      ...plan.opérateurs.map((opérateur) => opérateur.identifiant),
      ...plan.préservés,
    ]
    const désactivés = await tx
      .update(lecteurs)
      .set({ actif: false })
      .where(
        connus.length > 0
          ? sql`${lecteurs.actif} = true and ${not(inArray(lecteurs.identifiantAcces, connus))}`
          : eq(lecteurs.actif, true),
      )
      .returning({ id: lecteurs.id })

    const rapport: RapportDImport = {
      organisations: idParSlug.size,
      organisationsCréées,
      lecteurs: lecteursCréés + lecteursMisÀJour,
      lecteursCréés,
      lecteursMisÀJour,
      lecteursDésactivés: désactivés.length,
      écartés,
    }

    // Lever dans le rappel de la transaction l'annule : rien de ce qui précède
    // n'est gardé, ni pour l'aperçu, ni pour un plan qui a changé depuis.
    if (options.désactivationsAuPlus !== undefined && désactivés.length > options.désactivationsAuPlus) {
      throw new DésactivationsAuDelàDeLAperçu(options.désactivationsAuPlus, désactivés.length)
    }
    if (options.àBlanc) throw new AnnulationÀBlanc(rapport)
    return rapport
  })
}
