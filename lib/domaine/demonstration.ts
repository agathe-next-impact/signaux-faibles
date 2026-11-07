/**
 * Les espaces de démonstration (7 novembre 2026, demande de l'opératrice) :
 * trois espaces clients **réels**, ouverts à tout visiteur sans identification,
 * sur les trois organisations **fictives** de « Exemples » : Lisière Conseil,
 * Tolmen Mécanique et Atelier Passerelle.
 *
 * Ce module ne porte que les constantes et les prédicats, pour être importé
 * partout où une frontière doit reconnaître une démonstration (proxy, contrôle
 * d'appartenance, droit de lecture, lectures Postgres) sans charger les lettres.
 *
 * La clé de cloisonnement d'une démonstration n'est **pas** un identifiant
 * Notion ni un uuid : la contrainte `organisations_registre_notion_forme` de
 * Postgres (`^[0-9a-f]{32}$`) lui interdit d'y exister, et aucune ligne
 * « Accès » ne la porte. Une lecture de client qui la recevrait ne trouverait
 * donc rien ; mais aucune ne la reçoit, les lectures de l'espace la
 * reconnaissent avant d'ouvrir une base (`estLaDémonstration`).
 */
export type CléDeDémonstration = 'conseil' | 'pme' | 'ess'

/** Le slug de l'espace de chaque organisation fictive ; chacun est réservé (`SLUGS_RÉSERVÉS`). */
export const SLUGS_DE_DÉMONSTRATION: Readonly<Record<CléDeDémonstration, string>> = {
  conseil: 'lisiere-conseil',
  pme: 'tolmen-mecanique',
  ess: 'atelier-passerelle',
}

const PRÉFIXE_DE_CLÉ = 'demonstration:'

/** Le préfixe des identifiants de page des lettres fictives, jamais une page Notion ni Payload. */
export const PRÉFIXE_DE_PAGE_DÉMONSTRATION = 'demo-'

export function cléDeCloisonnementDeDémonstration(clé: CléDeDémonstration): string {
  return `${PRÉFIXE_DE_CLÉ}${clé}`
}

/** La démonstration que désigne un slug, ou `null` pour le slug d'un client. */
export function démonstrationDuSlug(slug: string): CléDeDémonstration | null {
  for (const [clé, s] of Object.entries(SLUGS_DE_DÉMONSTRATION)) if (s === slug) return clé as CléDeDémonstration
  return null
}

/** La démonstration que désigne une clé de cloisonnement, ou `null` pour celle d'un client. */
export function démonstrationDeLaClé(organisationId: string): CléDeDémonstration | null {
  if (!organisationId.startsWith(PRÉFIXE_DE_CLÉ)) return null
  const clé = organisationId.slice(PRÉFIXE_DE_CLÉ.length)
  return clé in SLUGS_DE_DÉMONSTRATION ? (clé as CléDeDémonstration) : null
}

export function estLaDémonstration(organisationId: string): boolean {
  return démonstrationDeLaClé(organisationId) !== null
}

export function estUnePageDeDémonstration(pageId: string): boolean {
  return pageId.startsWith(PRÉFIXE_DE_PAGE_DÉMONSTRATION)
}
