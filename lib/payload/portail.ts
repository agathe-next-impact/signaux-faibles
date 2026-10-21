/**
 * Ce que le registre Payload écrit dans la base du portail (programme du
 * 22 octobre 2026, §4) : quand l'opératrice passe une organisation « à
 * onboarder » ou crée un prospect, le portail a besoin de sa ligne
 * `organisations` (le parcours, les lecteurs, l'abonnement) et, si un contact
 * est connu, de son premier lecteur. La clé de cloisonnement des éditions
 * Payload est l'identifiant Payload de l'organisation, gardé sans tirets dans
 * `registre_notion` comme l'était l'identifiant de la ligne du registre Notion.
 *
 * Ce module n'importe pas Payload : les crochets des collections l'appellent,
 * et Payload importe les collections ; un import en retour bouclerait.
 */
import { baseConfigurée } from '@/lib/base/client'
import { créerLecteur } from '@/lib/base/ecriture-lecteurs'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import { empreinte } from '@/lib/portail/debit'
import { lecteursModifiables } from '@/lib/portail/situation'

export type OrganisationDuRegistre = {
  readonly id: string
  readonly nom: string
  readonly slug: string
  readonly contact?: { readonly nom?: string | null; readonly email?: string | null } | null
}

/** L'identifiant Payload (uuid avec tirets) sous la forme que `registre_notion` admet. */
export function cléDeCloisonnement(identifiantPayload: string): string {
  return identifiantPayload.replaceAll('-', '').toLowerCase()
}

/** L'opération inverse : la clé de la base du portail vers l'identifiant Payload. */
export function identifiantPayload(clé: string): string {
  const hex = clé.replaceAll('-', '').toLowerCase()
  if (hex.length !== 32) return clé
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export type OuvertureDansLePortail = {
  readonly organisation: string
  readonly lecteur: string | null
}

/**
 * Ouvre l'organisation dans le portail (état `essai`, ou `demande` pour une
 * entrée par prospection tant que la première visite n'a pas eu lieu) et crée
 * son premier lecteur si Postgres fait foi et qu'un contact est connu. Chaque
 * geste est rejouable ; aucun n'interrompt l'enregistrement Payload : ce qui
 * échoue est journalisé, sans adresse en clair.
 */
export async function ouvrirDansLePortail(organisation: OrganisationDuRegistre, options: { prospection: boolean }): Promise<OuvertureDansLePortail> {
  if (!baseConfigurée()) return { organisation: 'base-absente', lecteur: null }
  const ouverture = await ouvrirEnEssai({
    slug: organisation.slug,
    nom: organisation.nom,
    registreNotion: cléDeCloisonnement(organisation.id),
    prospection: options.prospection,
  })
  if (ouverture.sorte !== 'créée' && ouverture.sorte !== 'passée-en-essai' && ouverture.sorte !== 'déjà-en-essai') {
    console.warn(`[registre] ${organisation.slug} : organisation non ouverte dans le portail (${ouverture.sorte}).`)
    return { organisation: ouverture.sorte, lecteur: null }
  }
  const email = organisation.contact?.email?.trim().toLowerCase()
  if (!email) return { organisation: ouverture.sorte, lecteur: null }
  if (!lecteursModifiables()) {
    console.warn(`[registre] ${organisation.slug} : lecteur ${empreinte(email)} non créé, Notion fait encore foi (SOURCE_ACCES).`)
    return { organisation: ouverture.sorte, lecteur: 'source-notion' }
  }
  const lecteur = await créerLecteur({ slug: organisation.slug, nom: organisation.contact?.nom?.trim() || organisation.nom, email })
  if (lecteur.sorte !== 'créé' && lecteur.sorte !== 'déjà-inscrit') {
    console.warn(`[registre] ${organisation.slug} : lecteur ${empreinte(email)} non créé (${lecteur.sorte}).`)
  }
  return { organisation: ouverture.sorte, lecteur: lecteur.sorte }
}
