import type { AccèsAccordé } from '@/lib/auth/appartenance'
import {
  type CléDeDémonstration,
  cléDeCloisonnementDeDémonstration,
  démonstrationDeLaClé,
  PRÉFIXE_DE_PAGE_DÉMONSTRATION,
  SLUGS_DE_DÉMONSTRATION,
  estUnePageDeDémonstration,
} from '@/lib/domaine/demonstration'
import type { BlocNotion } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import type { Édition } from '@/lib/documents'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import { lettresDeDémonstration } from '@/lib/vitrine/lettres-demonstration'

/**
 * L'espace de démonstration vu comme une source de documents et comme un
 * accès (7 novembre 2026, demande de l'opératrice).
 *
 * Les écrans de l'espace client n'ont rien à apprendre : la façade des
 * documents (`lib/documents/index.ts`) sert ces éditions quand la clé de
 * cloisonnement est celle de la démonstration, et le contrôle d'appartenance
 * (`exigerAccès`) accorde cet accès au slug réservé sans lire de session. Tout
 * vient du code : ni Notion, ni Payload, ni Postgres, et donc aucune entrée de
 * cache partagée avec un client.
 */
function organisation(clé: CléDeDémonstration) {
  const d = DÉMONSTRATIONS.find((d) => d.clé === clé)
  if (!d) throw new Error(`démonstration « ${clé} » absente`)
  return d
}

export function identifiantDePage(clé: CléDeDémonstration, numéro: number): string {
  return `${PRÉFIXE_DE_PAGE_DÉMONSTRATION}${clé}-${numéro}`
}

/** Les éditions d'une démonstration, de la plus récente à la plus ancienne, publiées toutes ; aucune pour une clé de client. */
export function éditionsDeDémonstration(organisationId: string): Édition[] {
  const clé = démonstrationDeLaClé(organisationId)
  if (!clé) return []
  const { veille } = organisation(clé)
  return lettresDeDémonstration(clé).map((lettre) => ({
    pageId: identifiantDePage(clé, lettre.numéro),
    titre: `${veille}, édition n° ${lettre.numéro}`,
    veille,
    dateÉdition: lettre.dateÉdition,
    numéro: lettre.numéro,
    périodeCouverte: lettre.périodeCouverte,
    fenêtreÉlargie: false,
    actionDeLaSemaine: lettre.actionDeLaSemaine,
    dossiersOuvertsBruts: lettre.dossiers,
  }))
}

/** Le corps d'une lettre de la démonstration ; vide pour un identifiant qu'aucune lettre ne porte. */
export function blocsDeDémonstration(pageId: string): BlocNotion[] {
  if (!estUnePageDeDémonstration(pageId)) return []
  const [clé, numéro] = pageId.slice(PRÉFIXE_DE_PAGE_DÉMONSTRATION.length).split('-')
  if (!clé || !(clé in SLUGS_DE_DÉMONSTRATION)) return []
  const lettre = lettresDeDémonstration(clé as CléDeDémonstration).find((l) => l.numéro === Number(numéro))
  return lettre ? markdownVersBlocs(lettre.markdown) : []
}

/**
 * L'accès du visiteur : lecteur anonyme de l'organisation fictive, sans
 * courriel, sans privilège, jamais opérateur ni en aperçu. `démonstration` est
 * ce que les écrans et les actions regardent pour refuser tout geste.
 */
export function accèsDeDémonstration(clé: CléDeDémonstration): AccèsAccordé {
  return {
    nom: 'Visiteur',
    email: null,
    organisationLibellé: organisation(clé).organisation,
    organisationId: cléDeCloisonnementDeDémonstration(clé),
    slug: SLUGS_DE_DÉMONSTRATION[clé],
    actif: true,
    tousLesEspaces: false,
    enOpérateur: false,
    aperçu: false,
    démonstration: true,
  }
}
