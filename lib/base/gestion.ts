import { and, asc, eq } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { lecteurs, organisations } from '@/lib/base/schema'
import type { ÉtatOrganisation } from '@/lib/domaine/parcours'

/**
 * Les lectures de la page de gestion d'une organisation, pour l'opératrice
 * (31 octobre 2026, `/espaces/abonnements/[slug]`). Elles ne servent qu'à elle :
 * la garde est dans `lireLaGestionDUneOrganisation` (`lib/auth/appartenance.ts`),
 * le seul appelant de `organisationÀGérer` et de `lecteursÀGérer`, et
 * `tests/architecture.test.ts` le vérifie. Jamais une adresse ni un identifiant
 * d'accès dans ce qu'elles rendent : les lecteurs sont lus par leur nom.
 */

export type OrganisationÀGérer = {
  readonly id: string
  readonly slug: string
  readonly nom: string
  readonly état: ÉtatOrganisation
  readonly étatAvantDécision: ÉtatOrganisation | null
  readonly suspendueLe: Date | null
  readonly outilsStratégiques: boolean
  readonly espaceRéorganisé: boolean
}

export async function organisationÀGérer(slug: string, db: Base = base()): Promise<OrganisationÀGérer | null> {
  return protéger('lecture d’une organisation à gérer', async () => {
    const [ligne] = await db
      .select({
        id: organisations.id,
        slug: organisations.slug,
        nom: organisations.nom,
        état: organisations.état,
        étatAvantDécision: organisations.étatAvantDécision,
        suspendueLe: organisations.suspendueLe,
        outilsStratégiques: organisations.outilsStratégiques,
        espaceRéorganisé: organisations.espaceRéorganisé,
      })
      .from(organisations)
      .where(eq(organisations.slug, slug))
      .limit(1)
    return ligne ?? null
  })
}

export type LecteurÀGérer = {
  /** L'identifiant de la ligne, pour les gestes de l'écran ; jamais l'identifiant d'accès. */
  readonly id: string
  readonly nom: string
  readonly actif: boolean
  readonly dernièreVisiteLe: Date | null
}

/** Les lecteurs de l'organisation, actifs d'abord, l'opérateur global exclu. */
export async function lecteursÀGérer(organisationId: string, db: Base = base()): Promise<LecteurÀGérer[]> {
  return protéger('lecture des lecteurs à gérer', async () => {
    const lignes = await db
      .select({ id: lecteurs.id, nom: lecteurs.nom, actif: lecteurs.actif, dernièreVisiteLe: lecteurs.dernièreVisiteLe })
      .from(lecteurs)
      .where(and(eq(lecteurs.organisationId, organisationId), eq(lecteurs.tousLesEspaces, false)))
      .orderBy(asc(lecteurs.nom))
    return [...lignes].sort((a, b) => Number(b.actif) - Number(a.actif))
  })
}

/**
 * L'adresse d'un lecteur de l'organisation, par l'identifiant de sa ligne, pour
 * renvoyer son lien ou le réactiver. Elle ne quitte jamais le serveur : l'action
 * la passe à l'envoi, qui relit la ligne par la façade d'accès.
 */
export async function adresseDUnLecteur(
  entrée: { readonly organisationId: string; readonly lecteurId: string },
  db: Base = base(),
): Promise<string | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrée.lecteurId)) return null
  return protéger('lecture de l’adresse d’un lecteur', async () => {
    const [ligne] = await db
      .select({ email: lecteurs.email })
      .from(lecteurs)
      .where(and(eq(lecteurs.id, entrée.lecteurId), eq(lecteurs.organisationId, entrée.organisationId), eq(lecteurs.tousLesEspaces, false)))
      .limit(1)
    return ligne?.email ?? null
  })
}
