import { adressePostale } from '@/lib/email/gmail'
import { composerLettre } from '@/lib/email/lettre'
import { démonstrationDuSlug, PRÉFIXE_DE_PAGE_DÉMONSTRATION, SLUGS_DE_DÉMONSTRATION } from '@/lib/domaine/demonstration'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import {
  estUneVeilleDeDémonstration,
  lettreDeLaSemaine,
  QUALIFICATIF_DE_LA_VEILLE,
  titreDeLaLettre,
  VEILLES_DE_DÉMONSTRATION,
  type VeilleDeDémonstration,
} from '@/lib/vitrine/lettres-par-veille'

/**
 * Une lettre d'une organisation de démonstration, **telle que le client la
 * reçoit par courriel** (8 novembre 2026, demande de l'opératrice : « la lettre
 * affichée en démo doit reprendre strictement l'apparence et la structure d'un
 * email reçu »), pour l'une des deux veilles du dispositif en service : la
 * lettre écosystème ou la lettre concurrentielle de la dernière semaine
 * (`lib/vitrine/lettres-par-veille.ts` ; même jour, à sa demande : « Lire la
 * dernière lettre » ne propose que ces deux-là).
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
  readonly veille: VeilleDeDémonstration
  /** « écosystème » ou « concurrentielle », pour un libellé. */
  readonly qualificatif: string
  /** L'autre lettre de la même semaine. */
  readonly autre: { readonly veille: VeilleDeDémonstration; readonly qualificatif: string }
  readonly numéro: number
  readonly objet: string
  readonly date: string
  readonly dateÉdition: string
  readonly périodeCouverte: string
  readonly html: string
}

function racine(): string {
  return process.env['PORTAIL_URL'] ?? 'https://www.signauxfaibles.io'
}

/** Toutes les adresses à pré-rendre : les deux lettres de chaque démonstration. */
export function paramètresDesLettresDeDémonstration(): Array<{ organisation: string; veille: VeilleDeDémonstration }> {
  return Object.values(SLUGS_DE_DÉMONSTRATION).flatMap((organisation) => VEILLES_DE_DÉMONSTRATION.map((veille) => ({ organisation, veille })))
}

/**
 * Le courriel de la dernière lettre d'une veille de l'organisation de
 * démonstration que porte ce slug ; `null` pour tout autre slug ou pour un
 * segment qui n'est pas une veille.
 */
export function courrielDeDémonstration(slug: string, veille: string): CourrielDeDémonstration | null {
  const clé = démonstrationDuSlug(slug)
  const démonstration = DÉMONSTRATIONS.find((d) => d.clé === clé)
  if (!clé || !démonstration || !estUneVeilleDeDémonstration(veille)) return null
  const lettre = lettreDeLaSemaine(clé, veille)
  const titre = titreDeLaLettre(clé, lettre)
  const courriel = composerLettre({
    édition: {
      pageId: `${PRÉFIXE_DE_PAGE_DÉMONSTRATION}${clé}-${veille}-${lettre.numéro}`,
      titre,
      veille: lettre.nomDeLaVeille,
      numéro: lettre.numéro,
      dateÉdition: lettre.dateÉdition,
      périodeCouverte: lettre.périodeCouverte,
    },
    blocs: markdownVersBlocs(lettre.markdown),
    slug,
    organisation: démonstration.organisation,
    portailUrl: racine(),
    adressePostale: adressePostale(),
  })
  const autre: VeilleDeDémonstration = veille === 'ecosysteme' ? 'concurrentielle' : 'ecosysteme'
  return {
    slug,
    organisation: démonstration.organisation,
    veille,
    qualificatif: QUALIFICATIF_DE_LA_VEILLE[veille],
    autre: { veille: autre, qualificatif: QUALIFICATIF_DE_LA_VEILLE[autre] },
    numéro: lettre.numéro,
    objet: courriel.courriel.objet,
    date: courriel.courriel.date,
    dateÉdition: lettre.dateÉdition,
    périodeCouverte: lettre.périodeCouverte,
    html: courriel.html,
  }
}
