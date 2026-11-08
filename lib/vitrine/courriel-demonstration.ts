import { adressePostale } from '@/lib/email/gmail'
import { composerLettre } from '@/lib/email/lettre'
import { cléDeCloisonnementDeDémonstration, démonstrationDuSlug, SLUGS_DE_DÉMONSTRATION } from '@/lib/domaine/demonstration'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import { blocsDeDémonstration, éditionsDeDémonstration } from '@/lib/vitrine/espace-demonstration'

/**
 * Une lettre d'une organisation de démonstration, **telle que le client la
 * reçoit par courriel** (8 novembre 2026, demande de l'opératrice : « la lettre
 * affichée en démo doit reprendre strictement l'apparence et la structure d'un
 * email reçu »).
 *
 * Rien n'est redessiné : c'est `composerLettre` (`lib/email/lettre.ts`), le
 * compositeur que `POST /api/veille/courriel` emploie pour les lettres des
 * clients, appliqué aux blocs de la lettre fictive ; le gabarit de la charte
 * (`lib/email/gabarit.ts`) fait le reste. Les liens du courriel mènent à
 * l'espace de démonstration, ouvert sans identifiant. Aucune lecture : tout
 * vient du code. Sans numéro, c'est la dernière lettre ; `précédente` et
 * `suivante` donnent les numéros voisins de la série, pour aller de semaine en
 * semaine (la lettre de la semaine précédente est le second lien de « Exemples »).
 */
export type CourrielDeDémonstration = {
  readonly slug: string
  readonly organisation: string
  readonly numéro: number
  readonly objet: string
  readonly date: string
  readonly dateÉdition: string
  readonly périodeCouverte: string
  readonly précédente: number | null
  readonly suivante: number | null
  readonly html: string
}

function racine(): string {
  return process.env['PORTAIL_URL'] ?? 'https://www.signauxfaibles.io'
}

/** Les numéros des lettres d'une démonstration, de la plus récente à la plus ancienne ; vide pour un autre slug. */
export function numérosDeDémonstration(slug: string): number[] {
  const clé = démonstrationDuSlug(slug)
  if (!clé) return []
  return éditionsDeDémonstration(cléDeCloisonnementDeDémonstration(clé)).map((é) => é.numéro ?? 0)
}

/** Toutes les adresses à pré-rendre : chaque lettre de chaque démonstration. */
export function paramètresDesLettresDeDémonstration(): Array<{ organisation: string; numero: string }> {
  return Object.values(SLUGS_DE_DÉMONSTRATION).flatMap((organisation) =>
    numérosDeDémonstration(organisation).map((numéro) => ({ organisation, numero: String(numéro) })),
  )
}

/**
 * Le courriel d'une lettre de l'organisation de démonstration que porte ce slug
 * (la dernière sans numéro) ; `null` pour tout autre slug ou un numéro qu'aucune
 * lettre ne porte.
 */
export function courrielDeDémonstration(slug: string, numéro?: number | string): CourrielDeDémonstration | null {
  const clé = démonstrationDuSlug(slug)
  if (!clé) return null
  const démonstration = DÉMONSTRATIONS.find((d) => d.clé === clé)
  const éditions = éditionsDeDémonstration(cléDeCloisonnementDeDémonstration(clé))
  const rang = numéro === undefined ? 0 : éditions.findIndex((é) => é.numéro === Number(numéro))
  const édition = rang >= 0 ? éditions[rang] : undefined
  if (!démonstration || !édition || édition.numéro === null) return null
  const lettre = composerLettre({
    édition,
    blocs: blocsDeDémonstration(édition.pageId),
    slug,
    organisation: démonstration.organisation,
    portailUrl: racine(),
    adressePostale: adressePostale(),
  })
  return {
    slug,
    organisation: démonstration.organisation,
    numéro: édition.numéro,
    objet: lettre.courriel.objet,
    date: lettre.courriel.date,
    dateÉdition: édition.dateÉdition ?? '',
    périodeCouverte: édition.périodeCouverte,
    précédente: éditions[rang + 1]?.numéro ?? null,
    suivante: rang > 0 ? (éditions[rang - 1]?.numéro ?? null) : null,
    html: lettre.html,
  }
}
