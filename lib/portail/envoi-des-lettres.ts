import { lireAccèsActifParEmail } from '@/lib/auth/source-acces'
import { cléDUneOrganisationÀGérer } from '@/lib/base/gestion'
import { destinatairesDUneLettre } from '@/lib/base/parution'
import { lireBlocsDeLÉdition } from '@/lib/documents'
import { composerLettre } from '@/lib/email/lettre'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { empreinte } from '@/lib/portail/debit'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { déclencherLaPublication, type IssueDeLaPublication } from '@/lib/portail/onboarding'
import { semainesDeLEspace } from '@/lib/portail/semaine'

/**
 * « Envoyer les lettres » (2 novembre 2026, lot 6 de
 * `docs/proposition-onboarding-admin.md`) : l'opératrice a lu dans l'espace, en
 * aperçu, les lettres d'une organisation que la première lettre vient de
 * produire, et les envoie depuis son tableau. Le portail les envoie lui-même,
 * mises à la charte comme `POST /api/veille/courriel`, puis lance la tâche qui
 * les passe au statut « Envoyé » dans Notion : le portail n'y écrit jamais.
 *
 * L'appelant a vérifié le privilège (`exigerOpérateur`, action de
 * `lib/portail/gestion-actions.ts`) ; les éditions sont lues par le seul chemin
 * de l'aperçu (`semainesDeLEspace`), avec la clé de cloisonnement de
 * l'organisation, jamais une autre.
 *
 * Gardes, dans l'ordre : une lettre non conforme au lint ne part pas ; chaque
 * lecteur est revérifié par la façade d'accès (Notion fait foi en mode
 * `double`) ; chaque envoi est **unique** par lettre et par lecteur (clé
 * `lettre:<page>`, index `courriers_commerciaux_unique`) : un second clic, ou un
 * clic avant que Notion ne soit à jour, ne renvoie rien. Tant que la relecture
 * des courriers est requise, la lettre va à l'adresse de relecture, comme une
 * parution du moteur.
 */

export type BilanDeLEnvoi =
  | {
      readonly sorte: 'envoyées'
      /** Les lettres parties à tous leurs destinataires (ou déjà parties) : celles que la tâche publie. */
      readonly publiées: number
      readonly nonConformes: number
      readonly envoyés: number
      readonly déjàEnvoyés: number
      readonly incomplètes: number
      readonly publication: IssueDeLaPublication | 'rien-à-publier'
    }
  | { readonly sorte: 'inconnu' | 'sans-registre' | 'sans-lettre' | 'sans-destinataire' }

function portailUrl(): string {
  return process.env['PORTAIL_URL'] ?? 'https://www.signauxfaibles.io'
}

function adressePostale(): string | null {
  const valeur = process.env['ADRESSE_POSTALE']?.trim()
  return valeur ? valeur : null
}

export async function envoyerLesLettresÀPublier(entrée: { readonly slug: string }): Promise<BilanDeLEnvoi> {
  const clé = await cléDUneOrganisationÀGérer(entrée.slug)
  if (!clé) return { sorte: 'sans-registre' }
  const organisation = await destinatairesDUneLettre(clé)
  if (!organisation) return { sorte: 'inconnu' }

  const éditions = (await semainesDeLEspace({ organisationId: clé, aperçu: true })).flatMap((s) => s.éditions).filter((é) => é.aperçu === true)
  if (éditions.length === 0) return { sorte: 'sans-lettre' }

  const relecteur = organisation.relectureRequise ? (organisation.emailRelecture ?? process.env['RELECTEUR_EMAIL'] ?? null) : null
  const destinataires = organisation.relectureRequise
    ? relecteur
      ? [{ lecteurId: null as string | null, adresse: relecteur, relecture: true }]
      : []
    : organisation.lecteurs.map((l) => ({ lecteurId: l.id as string | null, adresse: l.email, relecture: false }))
  if (destinataires.length === 0) return { sorte: 'sans-destinataire' }

  const publiées: string[] = []
  let nonConformes = 0
  let envoyés = 0
  let déjàEnvoyés = 0
  let incomplètes = 0
  for (const édition of éditions) {
    const blocs = await lireBlocsDeLÉdition(édition)
    const rapport = contrôlerLaLettre({ titre: édition.titre, blocs, dossiersBruts: édition.dossiersOuvertsBruts, numéro: édition.numéro })
    if (!rapport.conforme) {
      nonConformes += 1
      console.warn(`[envoi] ${entrée.slug} : ${édition.pageId} non conforme (${rapport.ruptures.length} rupture(s)), non envoyée.`)
      continue
    }
    const lettre = composerLettre({
      objet: édition.titre,
      édition,
      blocs,
      slug: organisation.slug,
      organisation: organisation.nom,
      portailUrl: portailUrl(),
      adressePostale: adressePostale(),
    })
    let partisOuDéjà = 0
    for (const d of destinataires) {
      // La relecture n'est pas un lecteur : elle n'a pas de ligne « Accès » à revérifier.
      if (!d.relecture && !(await lireAccèsActifParEmail(d.adresse))) {
        console.warn(`[envoi] ${entrée.slug} : ${empreinte(d.adresse)} introuvable ou révoqué à la relecture, lettre non envoyée.`)
        continue
      }
      try {
        const issue = await envoyerCourrier({
          message: { destinataire: d.adresse, sujet: d.relecture ? `[Relecture, pour ${organisation.slug}] ${lettre.courriel.objet}` : lettre.courriel.objet, texte: lettre.texte, html: lettre.html },
          sorte: 'lettre',
          déclencheur: 'operatrice',
          organisation: { id: organisation.organisationId },
          lecteurId: d.lecteurId,
          unique: true,
          clé: `lettre:${édition.pageId.replaceAll('-', '').toLowerCase()}`,
        })
        if (issue.sorte === 'envoyé') {
          envoyés += 1
          partisOuDéjà += 1
        } else if (issue.sorte === 'déjà-envoyé') {
          déjàEnvoyés += 1
          partisOuDéjà += 1
        } else console.warn(`[envoi] ${entrée.slug} : lettre vers ${empreinte(d.adresse)} non envoyée (${issue.sorte}).`)
      } catch (erreur) {
        console.error(`[envoi] ${entrée.slug} : lettre vers ${empreinte(d.adresse)} en échec (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
      }
    }
    if (partisOuDéjà === destinataires.length) publiées.push(édition.pageId.replaceAll('-', '').toLowerCase())
    else incomplètes += 1
  }

  // La tâche ne publie dans Notion que les lettres parties à tous leurs destinataires.
  const publication = publiées.length > 0 ? await déclencherLaPublication({ slug: entrée.slug, éditions: publiées }) : 'rien-à-publier'
  return { sorte: 'envoyées', publiées: publiées.length, nonConformes, envoyés, déjàEnvoyés, incomplètes, publication }
}
