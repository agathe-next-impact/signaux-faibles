/**
 * Ce que la parution d'une lettre lit dans la base du portail : l'organisation
 * par sa clé de cloisonnement et ses lecteurs actifs, pour l'envoi. Lecture
 * réservée à `lib/portail/parution.ts`, après la remise d'une édition par le
 * moteur ; aucun écran ne l'appelle.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { base, type Base } from '@/lib/base/client'
import { protéger } from '@/lib/base/erreurs'
import { lecteurs, organisations } from '@/lib/base/schema'

export type DestinatairesDUneLettre = {
  readonly organisationId: string
  readonly slug: string
  readonly nom: string
  readonly relectureRequise: boolean
  readonly emailRelecture: string | null
  readonly lecteurs: ReadonlyArray<{ readonly id: string; readonly nom: string; readonly email: string }>
}

export async function destinatairesDUneLettre(registreNotion: string, db: Base = base()): Promise<DestinatairesDUneLettre | null> {
  const clé = registreNotion.replaceAll('-', '').toLowerCase()
  return protéger('destinataires d’une lettre', async () => {
    const [organisation] = await db
      .select({
        id: organisations.id,
        slug: organisations.slug,
        nom: organisations.nom,
        relectureRequise: organisations.relectureRequise,
        emailRelecture: organisations.emailRelecture,
      })
      .from(organisations)
      .where(and(eq(organisations.registreNotion, clé), isNull(organisations.archivéeLe)))
      .limit(1)
    if (!organisation) return null
    const actifs = await db
      .select({ id: lecteurs.id, nom: lecteurs.nom, email: lecteurs.email })
      .from(lecteurs)
      .where(and(eq(lecteurs.organisationId, organisation.id), eq(lecteurs.actif, true)))
    return {
      organisationId: organisation.id,
      slug: organisation.slug,
      nom: organisation.nom,
      relectureRequise: organisation.relectureRequise,
      emailRelecture: organisation.emailRelecture,
      lecteurs: actifs.flatMap((l) => (l.email ? [{ id: l.id, nom: l.nom, email: l.email }] : [])),
    }
  })
}

/** La clé de cloisonnement d'une organisation du portail, pour nommer l'organisation Payload à la première visite. */
export async function registreDeLOrganisation(organisationId: string, db: Base = base()): Promise<string | null> {
  const [ligne] = await protéger('lecture du registre d’une organisation', () =>
    db.select({ registreNotion: organisations.registreNotion }).from(organisations).where(eq(organisations.id, organisationId)).limit(1),
  )
  return ligne?.registreNotion ?? null
}
