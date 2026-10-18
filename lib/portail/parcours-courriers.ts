import { lireAccèsActifParEmail } from '@/lib/auth/source-acces'
import { organisationsEnEssai } from '@/lib/base/courriers'
import { composerCourrierDeParcours, courrierDuParcours, type SorteDeParcours } from '@/lib/domaine/courriers-parcours'
import { étapeDuParcours } from '@/lib/domaine/parcours'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { empreinte } from '@/lib/portail/debit'

/**
 * Le passage quotidien des courriers de fin d'essai (`/api/veille/parcours`,
 * cron de `vercel.json`).
 *
 * Pour chaque organisation en essai : l'étape du jour, calculée comme pour les
 * écrans (`étapeDuParcours`) ; si elle appelle un courrier, un courrier par
 * lecteur actif, réservé dans le journal avant l'envoi. Le passage est donc
 * rejouable sans risque : un lecteur déjà servi est sauté (`déjà-envoyé`).
 *
 * **Relecture** : tant que `relecture_requise` est vrai (c'est le cas des
 * organisations importées et de toute organisation qui démarre), le courrier
 * part à l'adresse de relecture de l'organisation, ou à `RELECTEUR_EMAIL`, une
 * seule fois, avec l'objet préfixé ; aucun lecteur ne le reçoit. C'est la même
 * règle que pour les lettres : rien ne part chez un client qu'on n'a pas relu.
 *
 * **Chaque lecteur est revérifié par la façade d'accès** avant l'envoi : en mode
 * `double`, c'est Notion qui fait foi, et la table `lecteurs` n'est alignée qu'à
 * l'import. Un lecteur révoqué dans Notion depuis le dernier import, ou rattaché
 * à une autre organisation, ne reçoit rien.
 */

export type RapportDeParcours = {
  readonly date: string
  readonly organisationsEnEssai: number
  readonly courriers: Array<{
    readonly slug: string
    readonly sorte: SorteDeParcours
    readonly destinataire: string
    readonly issue: string
  }>
}

export async function envoyerLesCourriersDeParcours(entrée: {
  readonly aujourdHui: string
  readonly portailUrl: string
  readonly relecteurParDéfaut: string | undefined
}): Promise<RapportDeParcours> {
  const organisations = await organisationsEnEssai()
  const courriers: RapportDeParcours['courriers'] = []

  for (const organisation of organisations) {
    const étape = étapeDuParcours({
      organisation: { état: 'essai', activéeLe: organisation.activéeLe },
      abonnement: organisation.abonnement,
      aujourdHui: entrée.aujourdHui,
    })
    const sorte = courrierDuParcours(étape)
    if (!sorte) continue

    const contenu = (prénomOuNom: string) =>
      composerCourrierDeParcours({
        sorte,
        prénomOuNom,
        organisation: organisation.nom,
        slug: organisation.slug,
        portailUrl: entrée.portailUrl,
      })

    const destinataires = organisation.relectureRequise
      ? (() => {
          const adresse = organisation.emailRelecture ?? entrée.relecteurParDéfaut
          return adresse ? [{ lecteurId: null, adresse, nom: '', relecture: true }] : []
        })()
      : organisation.lecteurs.map((l) => ({ lecteurId: l.id, adresse: l.email, nom: l.nom, relecture: false }))

    if (destinataires.length === 0) {
      console.warn(`[parcours] ${organisation.slug} : ${sorte} dû, aucun destinataire (lecteur actif ou relecture).`)
      courriers.push({ slug: organisation.slug, sorte, destinataire: '-', issue: 'sans-destinataire' })
      continue
    }

    for (const destinataire of destinataires) {
      const { sujet, texte } = contenu(destinataire.nom)
      let issue: string
      try {
        if (!destinataire.relecture) {
          const accès = await lireAccèsActifParEmail(destinataire.adresse)
          const registre = (accès?.organisationId ?? '').replaceAll('-', '').toLowerCase()
          if (!accès || accès.tousLesEspaces || registre !== organisation.registreNotion) {
            courriers.push({ slug: organisation.slug, sorte, destinataire: empreinte(destinataire.adresse), issue: 'accès-inactif' })
            continue
          }
        }
        const résultat = await envoyerCourrier({
          message: {
            destinataire: destinataire.adresse,
            sujet: destinataire.relecture ? `[Relecture, pour ${organisation.slug}] ${sujet}` : sujet,
            texte,
          },
          sorte,
          déclencheur: 'cron',
          organisation: { id: organisation.id },
          lecteurId: destinataire.lecteurId,
          unique: true,
        })
        issue = résultat.sorte
      } catch (erreur) {
        issue = 'échec'
        console.error(
          `[parcours] ${organisation.slug} : ${sorte} vers ${empreinte(destinataire.adresse)} en échec : ` +
            `${erreur instanceof Error ? erreur.name : 'inconnue'}`,
        )
      }
      courriers.push({ slug: organisation.slug, sorte, destinataire: empreinte(destinataire.adresse), issue })
    }
  }

  for (const c of courriers) console.info(`[parcours] ${c.slug} : ${c.sorte} → ${c.destinataire} : ${c.issue}`)
  return { date: entrée.aujourdHui, organisationsEnEssai: organisations.length, courriers }
}
