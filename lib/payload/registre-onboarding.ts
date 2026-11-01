/**
 * Le registre Payload vu par l'onboarding (lot 5 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026), quand
 * `SOURCE_DOCUMENTS=payload` : la collection `organisations` remplace le
 * registre Notion. Trois gestes, et eux seuls : lire une organisation par son
 * slug, la créer depuis le formulaire de l'opératrice, la marquer « à
 * onboarder » quand le portail vient de lancer son run.
 *
 * **Ce module importe Payload : il ne s'importe qu'à la demande**
 * (`await import(...)`), depuis `lib/portail/onboarding.ts`. La collection
 * `organisations` appelle cette orchestration dans son crochet ; un import
 * statique bouclerait (collection, orchestration, ce module, configuration,
 * collection). `tests/architecture.test.ts` tient la règle.
 */
import config from '@payload-config'
import { getPayload } from 'payload'
import { CONTEXTE_LANCÉ_PAR_LE_PORTAIL } from '@/lib/payload/contexte-onboarding'

export type OrganisationDuRegistre = {
  readonly id: string
  readonly nom: string
  readonly slug: string
  readonly etat: string
  readonly contact: { readonly nom: string | null; readonly email: string | null } | null
}

const versLOrganisation = (d: { id: unknown; nom?: unknown; slug?: unknown; etat?: unknown; contact?: unknown }): OrganisationDuRegistre => {
  const contact = (d.contact ?? null) as { nom?: unknown; email?: unknown } | null
  return {
    id: String(d.id),
    nom: String(d.nom ?? ''),
    slug: String(d.slug ?? ''),
    etat: String(d.etat ?? ''),
    contact: contact ? { nom: typeof contact.nom === 'string' ? contact.nom : null, email: typeof contact.email === 'string' ? contact.email : null } : null,
  }
}

export async function organisationDuRegistre(slug: string): Promise<OrganisationDuRegistre | null> {
  const payload = await getPayload({ config })
  const trouvées = await payload.find({ collection: 'organisations', where: { slug: { equals: slug } }, limit: 1, depth: 0, pagination: false })
  const d = trouvées.docs[0]
  return d ? versLOrganisation(d) : null
}

/**
 * Crée l'organisation au registre, à l'état « prospect » : rien n'est lancé
 * (le crochet ne lance qu'au passage à « à onboarder »). Le contact porte le
 * lecteur final et son adresse : c'est désormais le registre qui les tient, la
 * copie du portail est effacée (décision 1).
 */
export async function créerDansLeRegistre(entrée: {
  readonly nom: string
  readonly slug: string
  readonly site: string
  readonly contact: { readonly nom: string | null; readonly email: string | null }
}): Promise<{ readonly sorte: 'créée'; readonly id: string } | { readonly sorte: 'slug-pris' }> {
  const payload = await getPayload({ config })
  if ((await payload.find({ collection: 'organisations', where: { slug: { equals: entrée.slug } }, limit: 1, depth: 0, pagination: false })).docs.length > 0) {
    return { sorte: 'slug-pris' }
  }
  const créée = await payload.create({
    collection: 'organisations',
    data: {
      nom: entrée.nom,
      slug: entrée.slug,
      site: entrée.site,
      etat: 'prospect',
      ...(entrée.contact.nom || entrée.contact.email ? { contact: { nom: entrée.contact.nom ?? undefined, email: entrée.contact.email ?? undefined } } : {}),
    },
    depth: 0,
  })
  return { sorte: 'créée', id: String(créée.id) }
}

/** Le run vient d'être lancé par le portail : l'organisation passe « à onboarder », sans que le crochet relance quoi que ce soit. */
export async function marquerÀOnboarder(id: string): Promise<void> {
  const payload = await getPayload({ config })
  await payload.update({ collection: 'organisations', id, data: { etat: 'a_onboarder' }, depth: 0, context: { [CONTEXTE_LANCÉ_PAR_LE_PORTAIL]: true } })
}
