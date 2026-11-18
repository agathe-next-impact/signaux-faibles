import { and, asc, eq } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { appelsÀProjets } from '@/lib/base/schema'
import type { AppelDUneÉdition, AppelRelevé } from '@/lib/domaine/appels'

/**
 * Les appels à projets relevés (18 novembre 2026, migration 0030) : seul
 * écrivain et seul lecteur de `appels_a_projets`, appelé par la seule
 * orchestration `lib/portail/appels.ts`. `tests/architecture.test.ts` le tient.
 */

/**
 * Remplace les appels d'une édition par ceux de sa dernière version conforme :
 * une lettre corrigée puis relue par le lint ne garde pas un appel qu'elle a
 * retiré. Une transaction, pour que l'écran ne lise jamais une édition à moitié
 * réécrite.
 */
export async function remplacerLesAppelsDeLÉdition(
  entrée: {
    readonly organisationId: string
    readonly édition: string
    readonly dateÉdition: string
    readonly appels: readonly AppelRelevé[]
  },
  db: Base = base(),
): Promise<{ readonly relevés: number }> {
  return protéger('enregistrement des appels d’une édition', () =>
    db.transaction(async (tx) => {
      await tx.delete(appelsÀProjets).where(eq(appelsÀProjets.éditionNotion, entrée.édition))
      if (entrée.appels.length > 0) {
        await tx.insert(appelsÀProjets).values(
          entrée.appels.map((a) => ({
            organisationId: entrée.organisationId,
            éditionNotion: entrée.édition,
            dateÉdition: entrée.dateÉdition,
            clé: a.clé,
            rang: a.rang,
            intitulé: a.intitulé,
            financeur: a.financeur,
            clôture: a.clôture,
            adresse: a.adresse,
            impact: a.impact,
            àVérifier: a.àVérifier,
          })),
        )
      }
      return { relevés: entrée.appels.length }
    }),
  )
}

/** Tous les appels relevés d'une organisation, de la plus ancienne édition à la plus récente. */
export async function appelsDeLOrganisation(organisationId: string, db: Base = base()): Promise<AppelDUneÉdition[]> {
  return protéger('lecture des appels d’une organisation', async () => {
    const lignes = await db
      .select()
      .from(appelsÀProjets)
      .where(and(eq(appelsÀProjets.organisationId, organisationId)))
      .orderBy(asc(appelsÀProjets.dateÉdition), asc(appelsÀProjets.rang))
    return lignes.map((l) => ({
      édition: l.éditionNotion,
      dateÉdition: l.dateÉdition,
      clé: l.clé,
      rang: l.rang,
      intitulé: l.intitulé,
      financeur: l.financeur,
      clôture: l.clôture,
      adresse: l.adresse,
      impact: l.impact === 'fort' ? 'fort' : 'moyen',
      àVérifier: l.àVérifier,
    }))
  })
}

/** Les éditions d'une organisation qui portent au moins un appel relevé. */
export async function éditionsDAppels(organisationId: string, db: Base = base()): Promise<string[]> {
  return protéger('lecture des éditions d’appels', async () => {
    const lignes = await db
      .selectDistinct({ édition: appelsÀProjets.éditionNotion })
      .from(appelsÀProjets)
      .where(eq(appelsÀProjets.organisationId, organisationId))
    return lignes.map((l) => l.édition)
  })
}
