import { adressePostale } from '@/lib/email/gmail'
import { composerLettre } from '@/lib/email/lettre'
import { cléDeCloisonnementDeDémonstration, démonstrationDuSlug } from '@/lib/domaine/demonstration'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import { blocsDeDémonstration, éditionsDeDémonstration } from '@/lib/vitrine/espace-demonstration'

/**
 * La dernière lettre d'une organisation de démonstration, **telle que le client
 * la reçoit par courriel** (8 novembre 2026, demande de l'opératrice : « la
 * lettre affichée en démo doit reprendre strictement l'apparence et la
 * structure d'un email reçu »).
 *
 * Rien n'est redessiné : c'est `composerLettre` (`lib/email/lettre.ts`), le
 * compositeur que `POST /api/veille/courriel` emploie pour les lettres des
 * clients, appliqué aux blocs de la lettre fictive ; le gabarit de la charte
 * (`lib/email/gabarit.ts`) fait le reste. Les liens du courriel mènent à
 * l'espace de démonstration, ouvert sans identifiant. Aucune lecture : tout
 * vient du code.
 */
export type CourrielDeDémonstration = {
  readonly slug: string
  readonly organisation: string
  readonly objet: string
  readonly date: string
  readonly html: string
}

function racine(): string {
  return process.env['PORTAIL_URL'] ?? 'https://www.signauxfaibles.io'
}

/** Le courriel de la dernière lettre de l'organisation de démonstration que porte ce slug ; `null` pour tout autre slug. */
export function courrielDeDémonstration(slug: string): CourrielDeDémonstration | null {
  const clé = démonstrationDuSlug(slug)
  if (!clé) return null
  const démonstration = DÉMONSTRATIONS.find((d) => d.clé === clé)
  const édition = éditionsDeDémonstration(cléDeCloisonnementDeDémonstration(clé))[0]
  if (!démonstration || !édition) return null
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
    objet: lettre.courriel.objet,
    date: lettre.courriel.date,
    html: lettre.html,
  }
}
