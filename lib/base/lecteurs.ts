import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { lecteurs, organisations } from '@/lib/base/schema'
import type { Accès, Espace } from '@/lib/notion/acces'

/**
 * Les lectures d'appartenance dans Postgres, équivalentes une à une à celles de
 * la base Notion « Accès » (`lib/notion/acces.ts`).
 *
 * Elles rendent **le même type `Accès`**, et c'est voulu : `exigerAccès` et les
 * routes n'ont pas à savoir d'où vient la ligne. Le choix de la source est fait
 * à un seul endroit, `lib/auth/source-acces.ts`, et ces fonctions ne sont
 * appelées que de là (`tests/architecture.test.ts`).
 *
 * **La clé de cloisonnement ne change pas.** `organisationId` reste l'identifiant
 * de la ligne du registre, celui que portent les éditions Notion : il vient de
 * `organisations.registre_notion`. Une organisation qui n'en a pas ne peut pas
 * filtrer « Éditions », et l'accès est refusé — exactement comme une ligne Notion
 * dont « Identifiant Notion de l'organisation » était vide.
 *
 * Ces lectures ne sont pas cachées : Postgres n'a pas la limite de trois
 * requêtes par seconde de Notion, et une révocation doit valoir à la requête
 * suivante sans webhook. Elles ne portent sur aucun contenu de veille.
 *
 * Le dernier paramètre (`db`) n'existe que pour les tests, qui passent une base
 * PGlite en mémoire.
 */

const colonnes = {
  nom: lecteurs.nom,
  email: lecteurs.email,
  actif: lecteurs.actif,
  tousLesEspaces: lecteurs.tousLesEspaces,
  identifiant: lecteurs.identifiantAcces,
  slug: organisations.slug,
  organisationLibellé: organisations.nom,
  registreNotion: organisations.registreNotion,
}

type LigneLue = {
  nom: string
  email: string | null
  actif: boolean
  tousLesEspaces: boolean
  identifiant: string
  slug: string
  organisationLibellé: string
  registreNotion: string | null
}

/** Normalise un identifiant Notion comme le fait la lecture Notion : sans tirets, en minuscules. */
function clé(identifiantNotion: string | null): string {
  return (identifiantNotion ?? '').replaceAll('-', '').trim().toLowerCase()
}

function enAccès(ligne: LigneLue): Accès | null {
  const organisationId = clé(ligne.registreNotion)
  if (organisationId.length === 0) {
    console.warn(
      '[accès:base] lecteur trouvé mais son organisation n’a pas de « registre_notion » : accès refusé.',
    )
    return null
  }
  return {
    nom: ligne.nom,
    email: ligne.email,
    organisationLibellé: ligne.organisationLibellé,
    organisationId,
    slug: ligne.slug,
    actif: ligne.actif,
    tousLesEspaces: ligne.tousLesEspaces,
  }
}

/**
 * Retrouve un lecteur par son identifiant d'accès, comparé **exactement**.
 *
 * L'unicité de `identifiant_acces` est une contrainte de la base : le cas
 * « deux lignes pour un même identifiant » que la lecture Notion devait refuser
 * ne peut plus se produire. Une organisation archivée ferme l'accès.
 */
export async function lireLecteurParIdentifiant(
  identifiant: string,
  db: Base = base(),
): Promise<Accès | null> {
  const [ligne] = await db
    .select(colonnes)
    .from(lecteurs)
    .innerJoin(organisations, eq(lecteurs.organisationId, organisations.id))
    .where(and(eq(lecteurs.identifiantAcces, identifiant), isNull(organisations.archivéeLe)))
    .limit(1)

  return ligne ? enAccès(ligne) : null
}

/**
 * Retrouve un lecteur actif par email, pour « recevoir mon lien » et
 * `/api/acces/ouvrir`. L'adresse est comparée en minuscules, des deux côtés.
 *
 * Comme la lecture Notion, rend `null` quand il n'y a pas **exactement une**
 * ligne active : une même adresse inscrite chez deux clients ne doit pas
 * recevoir un lien choisi au hasard.
 */
export async function lireLecteurActifParEmail(
  email: string,
  db: Base = base(),
): Promise<(Accès & { readonly identifiant: string }) | null> {
  const lignes = await db
    .select(colonnes)
    .from(lecteurs)
    .innerJoin(organisations, eq(lecteurs.organisationId, organisations.id))
    .where(
      and(
        sql`lower(${lecteurs.email}) = ${email.trim().toLowerCase()}`,
        eq(lecteurs.actif, true),
        isNull(organisations.archivéeLe),
      ),
    )
    .limit(2)

  if (lignes.length !== 1) return null
  const [ligne] = lignes
  if (!ligne) return null

  const accès = enAccès(ligne)
  return accès ? { ...accès, identifiant: ligne.identifiant } : null
}

/**
 * L'organisation que désigne un slug **exact**, pour l'accès opérateur.
 *
 * Même contrat que la lecture Notion par slug : réservée à `exigerAccès` (par
 * la façade), elle ne rend un identifiant que si au moins un lecteur actif est
 * rattaché à cette organisation. Un espace dont tous les accès sont révoqués
 * reste `notFound`, comme il l'était avec Notion.
 */
export async function organisationParSlug(
  slug: string,
  db: Base = base(),
): Promise<{ readonly organisationId: string; readonly organisationLibellé: string } | null> {
  const [ligne] = await db
    .select({ registreNotion: organisations.registreNotion, nom: organisations.nom })
    .from(organisations)
    .innerJoin(lecteurs, eq(lecteurs.organisationId, organisations.id))
    .where(and(eq(organisations.slug, slug), eq(lecteurs.actif, true), isNull(organisations.archivéeLe)))
    .limit(1)

  if (!ligne) return null
  const organisationId = clé(ligne.registreNotion)
  if (organisationId.length === 0) return null
  return { organisationId, organisationLibellé: ligne.nom }
}

/**
 * Les espaces ouverts, pour le sélecteur de l'opérateur : les organisations qui
 * ont au moins un lecteur actif, avec leur nombre de lecteurs actifs. Seule
 * lecture Postgres qui traverse les clients ; elle n'expose qu'un slug et un
 * libellé, comme le sélecteur Notion qu'elle remplace.
 */
export async function espacesAvecLecteurs(db: Base = base()): Promise<Espace[]> {
  const lignes = await db
    .select({
      slug: organisations.slug,
      organisationLibellé: organisations.nom,
      lecteurs: sql<number>`count(*)::int`,
    })
    .from(organisations)
    .innerJoin(lecteurs, eq(lecteurs.organisationId, organisations.id))
    .where(and(eq(lecteurs.actif, true), isNull(organisations.archivéeLe)))
    .groupBy(organisations.slug, organisations.nom)
    .orderBy(asc(organisations.nom))

  return lignes
    .map((ligne) => ({ ...ligne, lecteurs: Number(ligne.lecteurs) }))
    .sort((a, b) => (a.organisationLibellé || a.slug).localeCompare(b.organisationLibellé || b.slug, 'fr'))
}
