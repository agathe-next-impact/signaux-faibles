import { lireAccèsActifParEmail } from '@/lib/auth/source-acces'
import { organisationsEnEssai } from '@/lib/base/courriers'
import { fixerJ0 } from '@/lib/base/organisations'
import { composerCourrierDeParcours, courrierDuParcours, type SorteDeParcours } from '@/lib/domaine/courriers-parcours'
import { étapeDuParcours } from '@/lib/domaine/parcours'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { estUneDateISO, lundiDeLaSemaine } from '@/lib/domaine/semaines'
import { listerÉditionsPubliées } from '@/lib/notion/editions'
import { adressePostale } from '@/lib/email/gmail'
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
 *
 * **J0 est fixé ici** (18 octobre 2026) : une organisation ouverte en essai par
 * l'onboarding (`POST /api/veille/organisations`) n'a pas de date d'activation.
 * Le passage lit ses éditions publiées (lecture cachée) et, s'il en trouve
 * une datée de la semaine d'entrée en essai ou après, pose J0 à la date de la
 * plus ancienne, à midi UTC pour que la semaine ISO de Paris soit celle de la
 * lettre. Une date déjà posée n'est
 * jamais déplacée (`fixerJ0`). Tant qu'aucune lettre n'est publiée, l'espace
 * reste en lecture complète et aucun courrier n'est dû.
 */

/**
 * La date d'activation déduite de la première lettre publiée, ou `null`. Une
 * lettre datée d'avant la semaine d'entrée en essai (test, erreur de statut)
 * est ignorée : elle raccourcirait l'essai, voire le sauterait entièrement.
 */
export function j0DesÉditions(
  éditions: ReadonlyArray<{ readonly dateÉdition: string }>,
  essaiOuvertLe: Date | null = null,
): Date | null {
  const plancher = essaiOuvertLe ? lundiDeLaSemaine(aujourdHuiÀParis(essaiOuvertLe)) : ''
  const dates = éditions
    .map((é) => é.dateÉdition)
    .filter(estUneDateISO)
    .filter((date) => date >= plancher)
    .sort()
  return dates.length > 0 ? new Date(`${dates[0]}T12:00:00Z`) : null
}

export type RapportDeParcours = {
  readonly date: string
  readonly organisationsEnEssai: number
  /** Organisations dont J0 a été fixé par ce passage. */
  readonly j0Fixés: string[]
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
  const j0Fixés: string[] = []

  for (const organisation of organisations) {
    let activéeLe = organisation.activéeLe
    if (!activéeLe) {
      if (!organisation.registreNotion) continue
      // Entrée par prospection : l'essai n'ouvre qu'à la première visite, qui
      // pose `essai_ouvert_le`. Avant, la lettre 1 est publiée mais ne compte pas.
      if (organisation.entréeParProspection && !organisation.essaiOuvertLe) continue
      try {
        // Le registre tel que la base le tient (32 hexadécimaux), la même clé
        // que les écrans en mode `postgres`.
        const j0 = j0DesÉditions(await listerÉditionsPubliées(organisation.registreNotion), organisation.essaiOuvertLe)
        if (!j0) continue
        // Une fixation refusée (état changé entre-temps, J0 déjà posé) : rien
        // n'est calculé sur une date qui n'est pas en base ; repris demain.
        if (!(await fixerJ0(organisation.id, j0))) continue
        j0Fixés.push(organisation.slug)
        activéeLe = j0
        const retard = Math.floor((Date.parse(`${entrée.aujourdHui}T12:00:00Z`) - j0.getTime()) / 86_400_000)
        if (retard > 7) {
          console.warn(`[parcours] ${organisation.slug} : J0 fixé ${retard} jours après la première lettre publiée.`)
        }
      } catch (erreur) {
        console.error(
          `[parcours] ${organisation.slug} : J0 non fixé (${erreur instanceof Error ? erreur.name : 'inconnue'}), repris au prochain passage.`,
        )
        continue
      }
    }

    const étape = étapeDuParcours({
      organisation: { état: 'essai', activéeLe, offre: organisation.offre, parutionsDEssai: organisation.parutionsDEssai },
      abonnement: organisation.abonnement,
      aujourdHui: entrée.aujourdHui,
    })
    const sorte = courrierDuParcours(étape)
    if (!sorte) continue

    const contenu = (prénomOuNom: string, destinataire: string | null) =>
      composerCourrierDeParcours({
        destinataire,
        adressePostale: adressePostale(),
        parutions: organisation.parutionsDEssai,
        offre: organisation.offre,
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
      const { sujet, texte, html } = contenu(destinataire.nom, destinataire.relecture ? null : destinataire.adresse)
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
            html,
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

  for (const slug of j0Fixés) console.info(`[parcours] ${slug} : J0 fixé à la première lettre publiée.`)
  for (const c of courriers) console.info(`[parcours] ${c.slug} : ${c.sorte} → ${c.destinataire} : ${c.issue}`)
  return { date: entrée.aujourdHui, organisationsEnEssai: organisations.length, j0Fixés, courriers }
}
