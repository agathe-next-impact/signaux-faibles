import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { abonnementQuiFaitFoi } from '@/lib/base/abonnements'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, lecteurs, organisations } from '@/lib/base/schema'
import type { ÉtatOrganisation } from '@/lib/domaine/parcours'

/**
 * La situation d'abonnement, telle que deux écrans la montrent (19 octobre
 * 2026) : « Mon abonnement » dans l'espace client, et le tableau des
 * abonnements de l'opératrice.
 *
 * Ces lectures ne décident rien : l'étape du parcours se calcule ensuite, par
 * `étapeDuParcours`, à partir de ce qu'elles rendent. Elles ne font que
 * rassembler ce que trois tables savent d'une organisation : son état et ses
 * dates, l'abonnement Stripe qui fait foi (même règle que `lireAbonnement`),
 * et ses lecteurs actifs.
 *
 * **Aucune adresse email n'en sort.** L'écran client liste ses lecteurs par leur
 * nom ; le tableau de l'opératrice ne les compte. L'opérateur global, rattaché
 * à aucune organisation, n'apparaît dans aucun des deux.
 */

export type AbonnementLu = {
  readonly état: string
  readonly formule: 'mensuelle' | 'annuelle' | null
  readonly périodeFin: Date | null
}

export type SituationDAbonnement = {
  readonly organisation: {
    readonly état: ÉtatOrganisation
    readonly activéeLe: Date | null
    readonly essaiOuvertLe: Date | null
  }
  readonly abonnement: AbonnementLu | null
  /**
   * Les lecteurs actifs de l'organisation, par leur nom seul. L'identifiant est
   * celui de la ligne, pour le retrait depuis l'écran ; jamais l'identifiant d'accès.
   */
  readonly lecteurs: ReadonlyArray<{ readonly id: string; readonly nom: string }>
}

function formuleLue(formule: string | null): 'mensuelle' | 'annuelle' | null {
  return formule === 'mensuelle' || formule === 'annuelle' ? formule : null
}

/**
 * La situation d'une organisation, désignée par sa clé de cloisonnement
 * (`registre_notion`, celle que porte la session) : la même clé que le
 * parcours et la facturation, jamais un slug venu du navigateur.
 *
 * Rend `null` si l'organisation n'est pas dans Postgres : l'écran le dit, sans
 * rien deviner.
 */
export async function lireSituationDAbonnement(
  registreNotion: string,
  db: Base = base(),
): Promise<SituationDAbonnement | null> {
  if (!/^[0-9a-f]{32}$/.test(registreNotion)) return null

  return protéger('lecture de la situation d’abonnement', async () => {
    const [organisation] = await db
      .select({
        id: organisations.id,
        état: organisations.état,
        activéeLe: organisations.activéeLe,
        essaiOuvertLe: organisations.essaiOuvertLe,
      })
      .from(organisations)
      .where(and(eq(organisations.registreNotion, registreNotion), isNull(organisations.archivéeLe)))
      .limit(1)
    if (!organisation) return null

    const [lignes, actifs] = await Promise.all([
      db
        .select({ état: abonnements.état, formule: abonnements.formule, périodeFin: abonnements.périodeFin })
        .from(abonnements)
        .where(eq(abonnements.organisationId, organisation.id))
        .orderBy(desc(abonnements.événementLe)),
      db
        .select({ id: lecteurs.id, nom: lecteurs.nom })
        .from(lecteurs)
        .where(and(eq(lecteurs.organisationId, organisation.id), eq(lecteurs.actif, true)))
        .orderBy(asc(lecteurs.nom)),
    ])
    const abonnement = abonnementQuiFaitFoi(lignes)

    return {
      organisation: {
        état: organisation.état,
        activéeLe: organisation.activéeLe,
        essaiOuvertLe: organisation.essaiOuvertLe,
      },
      abonnement: abonnement ? { ...abonnement, formule: formuleLue(abonnement.formule) } : null,
      lecteurs: actifs,
    }
  })
}

export type LigneDAbonnement = {
  readonly slug: string
  readonly nom: string
  readonly état: ÉtatOrganisation
  readonly activéeLe: Date | null
  readonly essaiOuvertLe: Date | null
  readonly relectureRequise: boolean
  readonly abonnement: (AbonnementLu & { readonly abonnementStripe: string }) | null
  readonly lecteursActifs: number
}

/**
 * Toutes les organisations non archivées, avec leur abonnement qui fait foi et
 * leur nombre de lecteurs actifs, pour le tableau de l'opératrice.
 *
 * C'est une lecture qui **traverse les clients**, comme la liste des espaces du
 * sélecteur : sa garde est dans `listerLesAbonnements` (`lib/auth/appartenance.ts`), le seul
 * appelant admis, et `tests/architecture.test.ts` le vérifie. Elle n'expose ni
 * adresse ni identifiant d'accès ; l'identifiant d'abonnement Stripe y est,
 * pour mener au tableau de bord Stripe, où l'abonnement lui-même se gère.
 */
export async function tableauDesAbonnements(db: Base = base()): Promise<LigneDAbonnement[]> {
  return protéger('tableau des abonnements', async () => {
    const [lignes, abonnementsLus, comptes] = await Promise.all([
      db
        .select({
          id: organisations.id,
          slug: organisations.slug,
          nom: organisations.nom,
          état: organisations.état,
          activéeLe: organisations.activéeLe,
          essaiOuvertLe: organisations.essaiOuvertLe,
          relectureRequise: organisations.relectureRequise,
        })
        .from(organisations)
        .where(isNull(organisations.archivéeLe))
        .orderBy(asc(organisations.nom)),
      db
        .select({
          organisationId: abonnements.organisationId,
          abonnementStripe: abonnements.abonnementStripe,
          état: abonnements.état,
          formule: abonnements.formule,
          périodeFin: abonnements.périodeFin,
        })
        .from(abonnements)
        .orderBy(desc(abonnements.événementLe)),
      db
        .select({ organisationId: lecteurs.organisationId, n: sql<number>`count(*)::int` })
        .from(lecteurs)
        .where(eq(lecteurs.actif, true))
        .groupBy(lecteurs.organisationId),
    ])

    const parOrganisation = new Map<string, typeof abonnementsLus>()
    for (const ligne of abonnementsLus) {
      const liste = parOrganisation.get(ligne.organisationId) ?? []
      liste.push(ligne)
      parOrganisation.set(ligne.organisationId, liste)
    }
    const lecteursPar = new Map(comptes.map((c) => [c.organisationId, Number(c.n)]))

    return lignes
      .map((ligne) => {
        const abonnement = abonnementQuiFaitFoi(parOrganisation.get(ligne.id) ?? [])
        return {
          slug: ligne.slug,
          nom: ligne.nom,
          état: ligne.état,
          activéeLe: ligne.activéeLe,
          essaiOuvertLe: ligne.essaiOuvertLe,
          relectureRequise: ligne.relectureRequise,
          abonnement: abonnement
            ? {
                abonnementStripe: abonnement.abonnementStripe,
                état: abonnement.état,
                formule: formuleLue(abonnement.formule),
                périodeFin: abonnement.périodeFin,
              }
            : null,
          lecteursActifs: lecteursPar.get(ligne.id) ?? 0,
        }
      })
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  })
}
