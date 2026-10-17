import { desc, eq } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { abonnements, organisations } from '@/lib/base/schema'
import type { EntréeDuParcours } from '@/lib/domaine/parcours'

/**
 * Ce que le parcours d'essai a besoin de lire dans Postgres pour une
 * organisation, désignée par sa clé de cloisonnement (`registre_notion`, celle
 * que porte la session) : son état, sa date d'activation, et l'abonnement qui
 * fait foi.
 *
 * L'abonnement qui fait foi suit l'ordre de `lireAbonnement` : un abonnement
 * ouvert, sinon le dernier fermé, sinon le plus récent. Il est relu ici dans la
 * même requête que l'organisation, pour ne pas faire deux allers-retours à
 * chaque page.
 *
 * Rend `null` si l'organisation n'est pas dans Postgres (un client que l'import
 * n'a pas encore vu) : l'appelant garde alors la lecture complète.
 */

const OUVERTS = new Set(['trialing', 'active', 'past_due'])
const FERMÉS = new Set(['canceled', 'unpaid', 'paused'])

export async function lireEntréeDuParcours(
  registreNotion: string,
  db: Base = base(),
): Promise<Omit<EntréeDuParcours, 'aujourdHui'> | null> {
  if (!/^[0-9a-f]{32}$/.test(registreNotion)) return null

  return protéger('lecture du parcours', async () => {
    const [organisation] = await db
      .select({ id: organisations.id, état: organisations.état, activéeLe: organisations.activéeLe })
      .from(organisations)
      .where(eq(organisations.registreNotion, registreNotion))
      .limit(1)
    if (!organisation) return null

    const lignes = await db
      .select({ état: abonnements.état })
      .from(abonnements)
      .where(eq(abonnements.organisationId, organisation.id))
      .orderBy(desc(abonnements.événementLe))
    const abonnement =
      lignes.find((l) => OUVERTS.has(l.état)) ?? lignes.find((l) => FERMÉS.has(l.état)) ?? lignes[0] ?? null

    return {
      organisation: { état: organisation.état, activéeLe: organisation.activéeLe },
      abonnement,
    }
  })
}
