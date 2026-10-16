import { randomBytes } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { lecteurs, organisations } from '@/lib/base/schema'

/**
 * Les écritures des lecteurs, palier 1a-bis : créer, révoquer, réactiver.
 *
 * C'est le préalable à la bascule `SOURCE_ACCES=postgres`. Tant que la base
 * Accès Notion était la source, la tâche Cowork y créait et y révoquait les
 * lignes ; après la bascule, ces gestes passent par `POST /api/veille/lecteurs`,
 * qui appelle ce module, sans quoi une révocation écrite dans Notion n'aurait
 * plus d'effet.
 *
 * L'identifiant d'accès est **tiré ici**, par le portail, et ne sort jamais :
 * ni dans la réponse de la route, ni dans un journal. Le lien part ensuite par
 * `POST /api/acces/ouvrir`, comme aujourd'hui. Les deux pannes de septembre que
 * la saisie à la main provoquait (identifiant recopié d'une ligne dupliquée,
 * identifiant d'organisation pris sur la mauvaise page) ne peuvent donc plus se
 * produire : personne ne saisit ni l'un ni l'autre.
 */

export type RésultatÉcriture =
  | { readonly sorte: 'créé' | 'révoqué' | 'réactivé' | 'inchangé' }
  | { readonly sorte: 'organisation-inconnue' | 'lecteur-inconnu' | 'déjà-inscrit' }

const adresse = (email: string) => email.trim().toLowerCase()

/** 32 hexadécimaux, la forme de `openssl rand -hex 16`. */
export function tirerIdentifiantDAccès(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Crée un lecteur actif dans l'organisation désignée par son slug exact.
 * Une adresse déjà inscrite chez ce client n'est pas recréée : `déjà-inscrit`,
 * et c'est à l'appelant de réactiver s'il le faut.
 */
export async function créerLecteur(
  demande: { readonly slug: string; readonly nom: string; readonly email: string },
  db: Base = base(),
): Promise<RésultatÉcriture> {
  return protéger('création d’un lecteur', async () => {
    const [organisation] = await db
      .select({ id: organisations.id })
      .from(organisations)
      .where(and(eq(organisations.slug, demande.slug), isNull(organisations.archivéeLe)))
      .limit(1)
    if (!organisation) return { sorte: 'organisation-inconnue' }

    const [existant] = await db
      .select({ id: lecteurs.id })
      .from(lecteurs)
      .where(
        and(
          eq(lecteurs.organisationId, organisation.id),
          sql`lower(${lecteurs.email}) = ${adresse(demande.email)}`,
        ),
      )
      .limit(1)
    if (existant) return { sorte: 'déjà-inscrit' }

    await db.insert(lecteurs).values({
      organisationId: organisation.id,
      nom: demande.nom.trim(),
      email: demande.email.trim(),
      identifiantAcces: tirerIdentifiantDAccès(),
      actif: true,
      rôle: 'lecteur',
    })
    return { sorte: 'créé' }
  })
}

/**
 * Révoque ou réactive un lecteur, désigné par le slug de son client et son
 * adresse. La révocation vaut à la requête suivante : les lectures
 * d'appartenance Postgres ne sont pas cachées.
 */
export async function changerActivation(
  demande: { readonly slug: string; readonly email: string; readonly actif: boolean },
  db: Base = base(),
): Promise<RésultatÉcriture> {
  return protéger('changement d’activation d’un lecteur', async () => {
    const [ligne] = await db
      .select({ id: lecteurs.id, actif: lecteurs.actif })
      .from(lecteurs)
      .innerJoin(organisations, eq(lecteurs.organisationId, organisations.id))
      .where(
        and(eq(organisations.slug, demande.slug), sql`lower(${lecteurs.email}) = ${adresse(demande.email)}`),
      )
      .limit(1)
    if (!ligne) return { sorte: 'lecteur-inconnu' }
    if (ligne.actif === demande.actif) return { sorte: 'inchangé' }

    await db.update(lecteurs).set({ actif: demande.actif }).where(eq(lecteurs.id, ligne.id))
    return { sorte: demande.actif ? 'réactivé' : 'révoqué' }
  })
}

/**
 * Sonde la base pour le contrôle du soir : joignable ou non, et combien de
 * lecteurs actifs. Ne lève jamais : une base injoignable est un constat.
 */
export async function sonderLaBase(
  db?: Base,
): Promise<{ readonly joignable: boolean; readonly lecteursActifs: number | null; readonly code: string | null }> {
  try {
    const cible = db ?? base()
    const [ligne] = await protéger('sonde de la base', () =>
      cible
        .select({ n: sql<number>`count(*)::int` })
        .from(lecteurs)
        .where(eq(lecteurs.actif, true)),
    )
    return { joignable: true, lecteursActifs: Number(ligne?.n ?? 0), code: null }
  } catch (erreur) {
    const code = (erreur as { code?: unknown }).code
    return { joignable: false, lecteursActifs: null, code: typeof code === 'string' ? code : null }
  }
}
