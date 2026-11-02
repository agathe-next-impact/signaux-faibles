import { composerLienDAccès } from '@/lib/auth/jeton'
import { lireAccèsActifParEmail } from '@/lib/auth/source-acces'
import { cléDUneOrganisationÀGérer } from '@/lib/base/gestion'
import { destinatairesDUneLettre } from '@/lib/base/parution'
import { composerCourrierDAccès } from '@/lib/email/gmail'
import { env } from '@/lib/env'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { autoriserLEnvoi, empreinte } from '@/lib/portail/debit'

/**
 * Le lien d'accès d'un lecteur, et l'ouverture d'un espace (2 novembre 2026,
 * lot 6 de `docs/proposition-onboarding-admin.md`). Un seul chemin pour les deux
 * gestes qui le font partir hors de l'activation par une tâche : le renvoi du
 * lien depuis la fiche de l'opératrice (`lib/portail/gestion-actions.ts`), et la
 * fin du run d'activation lancé par « Ouvrir l'espace et activer la veille »
 * (`lib/portail/onboarding.ts`).
 *
 * Le lecteur est **revérifié par la façade d'accès** avant l'envoi : en mode
 * `double`, Notion fait foi, et une ligne « Accès » décochée n'a pas de lien. La
 * limitation de débit est celle de l'activation ; l'adresse n'apparaît jamais
 * dans un journal, seulement son empreinte.
 */

export type IssueDuLien = 'lien-envoyé' | 'lien-non-envoyé' | 'débit'

export async function envoyerUnLienDAccès(entrée: {
  readonly email: string
  readonly organisationId: string
  readonly déclencheur: string
  /** L'origine réseau de la demande, pour la limitation de débit ; nulle hors d'un navigateur. */
  readonly origine: string | null
}): Promise<IssueDuLien> {
  const marque = empreinte(entrée.email)
  try {
    const lecteur = await lireAccèsActifParEmail(entrée.email)
    if (!lecteur?.email) {
      console.warn(`[ouverture] ${marque} introuvable ou révoqué à la relecture : lien non envoyé.`)
      return 'lien-non-envoyé'
    }
    const débit = autoriserLEnvoi(entrée.email, entrée.origine)
    if (!débit.autorisé) {
      console.warn(`[ouverture] ${marque} : lien refusé par la limitation de débit (${débit.motif}).`)
      return 'débit'
    }
    const lien = composerLienDAccès(lecteur.identifiant, env().ACCES_SECRET_HMAC, env().PORTAIL_URL)
    await envoyerCourrier({
      message: { ...composerCourrierDAccès(lecteur.nom, lien, { destinataire: lecteur.email }), destinataire: lecteur.email },
      sorte: 'lien_acces',
      déclencheur: entrée.déclencheur,
      organisation: { id: entrée.organisationId },
      lecteurId: null,
      unique: false,
    })
    return 'lien-envoyé'
  } catch (erreur) {
    console.error(`[ouverture] ${marque} : lien non envoyé (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    return 'lien-non-envoyé'
  }
}

export type IssueDeLOuverture = 'espace-ouvert' | 'ouverture-partielle' | 'sans-registre' | 'sans-lecteur' | 'débit' | 'lien-non-envoyé' | 'inconnu'

/**
 * Le lien d'accès à chaque lecteur actif de l'organisation : la fin de
 * l'ouverture. Les lecteurs sont ceux que Postgres porte (importés de Notion par
 * la tâche d'activation en mode `double`), chacun revérifié par la façade.
 */
export async function envoyerLesLiensDeLOrganisation(entrée: { readonly slug: string; readonly déclencheur: string; readonly origine: string | null }): Promise<IssueDeLOuverture> {
  const clé = await cléDUneOrganisationÀGérer(entrée.slug)
  if (!clé) return 'sans-registre'
  const organisation = await destinatairesDUneLettre(clé)
  if (!organisation) return 'inconnu'
  if (organisation.lecteurs.length === 0) return 'sans-lecteur'
  const issues: IssueDuLien[] = []
  for (const lecteur of organisation.lecteurs) {
    issues.push(await envoyerUnLienDAccès({ email: lecteur.email, organisationId: organisation.organisationId, déclencheur: entrée.déclencheur, origine: entrée.origine }))
  }
  const partis = issues.filter((i) => i === 'lien-envoyé').length
  if (partis === issues.length) return 'espace-ouvert'
  if (partis > 0) return 'ouverture-partielle'
  return issues.includes('débit') ? 'débit' : 'lien-non-envoyé'
}
