import type { Payload } from 'payload'
import { identifiantDeRelation } from '@/lib/payload/relations'

/**
 * Les lettres « à publier » d'une organisation (1er novembre 2026, aperçu avant
 * envoi) : acceptées par le moteur, écrites dans Payload sans être publiées,
 * elles attendent que l'opératrice les lise dans l'espace puis les publie de la
 * fiche de l'organisation. Seul module qui écrit ce passage de statut ; son seul
 * appelant est `lib/portail/lettres-a-publier.ts`, derrière le privilège
 * opérateur (`tests/architecture.test.ts`).
 *
 * Payload est importé à la demande, dans chaque fonction : en mode `notion`,
 * la fiche n'appelle jamais ce module, et aucun écran ne charge l'adaptateur.
 */
export type LettreÀPublier = {
  readonly id: string
  readonly titre: string
  readonly numéro: number | null
  readonly dateÉdition: string | null
}

export type LettrePubliée = {
  readonly id: string
  readonly titre: string
  readonly numéro: number | null
  readonly dateÉdition: string
  readonly périodeCouverte: string
  readonly markdown: string
}

const À_PUBLIER = 'a_publier'

async function instance(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
  return getPayload({ config })
}

function champ(doc: unknown, nom: string): unknown {
  return typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>)[nom] : undefined
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : ''
}

function jour(valeur: unknown): string | null {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valeur) ? valeur.slice(0, 10) : null
}

/** Les lettres à publier de l'organisation, la plus ancienne d'abord : on publie dans l'ordre de parution. */
export async function lettresÀPublier(organisationPayload: string): Promise<LettreÀPublier[]> {
  const payload = await instance()
  const { docs } = await payload.find({
    collection: 'editions',
    where: { and: [{ organisation: { equals: organisationPayload } }, { statut: { equals: À_PUBLIER } }] },
    sort: 'dateEdition',
    depth: 0,
    pagination: false,
  })
  return (docs as unknown[])
    // Règle 2, ceinture et bretelles : la requête a filtré, la lecture revérifie.
    .filter((doc) => identifiantDeRelation(champ(doc, 'organisation')) === organisationPayload && champ(doc, 'statut') === À_PUBLIER)
    .map((doc) => {
      const numéro = champ(doc, 'numero')
      return {
        id: String(champ(doc, 'id')),
        titre: texte(champ(doc, 'titre')),
        numéro: typeof numéro === 'number' ? numéro : null,
        dateÉdition: jour(champ(doc, 'dateEdition')),
      }
    })
}

/**
 * Publie une lettre à publier, si elle porte bien cette organisation et ce
 * statut ; rend ce qu'il faut pour l'envoyer, ou `null` (inconnue, autre
 * organisation, déjà publiée). L'organisation en onboarding devient active,
 * comme à une publication directe du moteur (`enregistrerLÉdition`).
 */
export async function publierUneLettre(entrée: { readonly id: string; readonly organisationPayload: string }): Promise<LettrePubliée | null> {
  const payload = await instance()
  const { docs } = await payload.find({
    collection: 'editions',
    where: { and: [{ id: { equals: entrée.id } }, { organisation: { equals: entrée.organisationPayload } }, { statut: { equals: À_PUBLIER } }] },
    depth: 0,
    limit: 1,
    pagination: false,
  })
  const doc = (docs as unknown[])[0]
  if (!doc || identifiantDeRelation(champ(doc, 'organisation')) !== entrée.organisationPayload || champ(doc, 'statut') !== À_PUBLIER) return null
  const dateÉdition = jour(champ(doc, 'dateEdition'))
  if (!dateÉdition) return null

  await payload.update({ collection: 'editions', id: entrée.id, data: { statut: 'publiee' } })
  const organisation = await payload.findByID({ collection: 'organisations', id: entrée.organisationPayload, depth: 0 }).catch(() => null)
  const état = champ(organisation, 'etat')
  if (état === 'a_onboarder' || état === 'en_onboarding') {
    await payload.update({ collection: 'organisations', id: entrée.organisationPayload, data: { etat: 'active' } })
  }

  const numéro = champ(doc, 'numero')
  return {
    id: entrée.id,
    titre: texte(champ(doc, 'titre')),
    numéro: typeof numéro === 'number' ? numéro : null,
    dateÉdition,
    périodeCouverte: texte(champ(doc, 'periodeCouverte')),
    markdown: texte(champ(doc, 'markdown')),
  }
}
