import { sourceAccès } from '@/lib/auth/source-acces'
import { base, baseConfigurée, type Base } from '@/lib/base/client'
import {
  créerProspectionÀLaVisite,
  enregistrerVisite,
  journaliserÉvénement,
  noterLaSynchro,
  ouvrirLEssaiÀLaVisite,
  passerAuStatut,
  prospectionDuLecteur,
  prospectionsEnCours,
  prospectionsÀSynchroniser,
  rattacherLead,
  type ProspectionÀSynchroniser,
  type StatutProspection,
} from '@/lib/base/prospection'
import { étapeDuParcours } from '@/lib/domaine/parcours'
import { clientLemlistConfiguré, type ClientLemlist } from '@/lib/lemlist/client'
import type { ÉvénementLemlist } from '@/lib/lemlist/webhook'
import { empreinte } from '@/lib/portail/debit'

/**
 * La prospection par lemlist, côté portail (19 octobre 2026).
 *
 * Trois entrées, et c'est tout ce qui relie le portail à lemlist :
 *
 *   · `traiterÉvénementLemlist` : ce que lemlist dit au portail par webhook
 *     (lettre envoyée, ouverte, cliquée, réponse, rebond, désinscription), écrit
 *     au journal et appliqué au statut ;
 *   · `signalerVisite` : ce que le portail dit à lemlist à la seconde où un
 *     prospect ouvre son espace, c'est-à-dire **arrêter la séquence**. C'est le
 *     seul appel à lemlist qui ne peut pas attendre le lendemain : une relance
 *     « avez-vous vu votre lettre ? » après l'activation est une faute ;
 *   · `synchroniserLaProspection` : chaque jour, par le cron du parcours,
 *     déduire `abonne`, `expire` et `resilie` de l'étape du parcours (calculée,
 *     jamais stockée) et écrire dans lemlist tout ce qu'il ne sait pas encore,
 *     y compris ce qui a échoué la veille.
 *
 * Le portail **n'ajoute jamais un contact à une campagne lemlist** et ne lance
 * rien : c'est le rôle de la tâche de prospection, par le connecteur lemlist.
 * Sans `LEMLIST_API_KEY`, tout est tenu dans Postgres et rien ne part.
 *
 * Aucune adresse dans les journaux : l'adresse sert à nommer le lead chez lemlist
 * et à rattacher un lecteur ; partout ailleurs, l'empreinte.
 */

type Dépendances = { readonly db?: Base; readonly lemlist?: ClientLemlist | null }

/** Vrai quand Postgres porte l'état : en `SOURCE_ACCES=notion`, la base n'est jamais ouverte. */
function prospectionActive(): boolean {
  return baseConfigurée() && sourceAccès() !== 'notion'
}

export type IssueDÉvénement =
  | { readonly sorte: 'enregistré'; readonly statut: StatutProspection; readonly rattaché: boolean }
  | { readonly sorte: 'déjà-reçu' }
  | { readonly sorte: 'inactif' }

export async function traiterÉvénementLemlist(événement: ÉvénementLemlist, dépendances: Dépendances = {}): Promise<IssueDÉvénement> {
  if (!dépendances.db && !prospectionActive()) return { sorte: 'inactif' }
  const db = dépendances.db ?? base()
  const lead = await rattacherLead(
    { email: événement.email, empreinte: empreinte(événement.email), campagne: événement.campagne, lead: événement.lead, contact: événement.contact },
    db,
  )
  const issue = await journaliserÉvénement(
    lead.id,
    { activité: événement.activité, type: événement.type, survenuLe: événement.survenuLe, étape: événement.étape },
    db,
  )
  if (issue.sorte === 'déjà-reçu') return issue
  return { sorte: 'enregistré', statut: issue.statut, rattaché: lead.rattachée }
}

/**
 * Appelée après la pose du cookie, hors du chemin de la réponse (`after`). Ne
 * lève jamais : une panne de Postgres ou de lemlist ne doit pas toucher à
 * l'ouverture de l'espace, qui est déjà faite quand ceci s'exécute.
 */
export async function signalerVisite(identifiantAcces: string, dépendances: Dépendances = {}): Promise<void> {
  try {
    if (!dépendances.db && !prospectionActive()) return
    const db = dépendances.db ?? base()
    const maintenant = new Date()
    const visite = await enregistrerVisite(identifiantAcces, maintenant, db)
    if (!visite || !visite.première) return

    // Entrée par prospection : c'est cette visite qui ouvre le mois d'essai.
    const essaiOuvert = visite.organisationId !== null && (await ouvrirLEssaiÀLaVisite(visite.organisationId, maintenant, db))
    if (essaiOuvert) console.info('[prospection] essai ouvert à la première visite.')

    const marque = visite.email ? empreinte(visite.email) : null
    const ligne = await prospectionDuLecteur({ id: visite.lecteurId, organisationId: visite.organisationId, empreinte: marque }, db)
    if (!ligne) {
      // Prospect écrit sans lemlist (pilote par Gmail) : aucun webhook n'a créé
      // sa ligne. La visite qui ouvre l'essai la crée, déjà active, pour que la
      // synchronisation voie l'activation. Rien à dire à lemlist.
      if (essaiOuvert && visite.organisationId && marque) {
        await créerProspectionÀLaVisite({ id: visite.lecteurId, organisationId: visite.organisationId, empreinte: marque }, maintenant, db)
        console.info('[prospection] prospection sans lemlist créée à la première visite.')
      }
      return
    }
    const changé = await passerAuStatut(ligne.id, 'actif', db)
    if (!changé) return

    const lemlist = dépendances.lemlist === undefined ? clientLemlistConfiguré() : dépendances.lemlist
    await synchroniserUne(
      {
        id: ligne.id,
        statut: 'actif',
        campagneLemlist: ligne.campagneLemlist,
        leadLemlist: ligne.leadLemlist,
        séquenceArrêtéeLe: ligne.séquenceArrêtéeLe,
        synchroniséStatut: ligne.synchroniséStatut,
        email: visite.email,
      },
      lemlist,
      db,
    )
  } catch (erreur) {
    // L'erreur sort de lib/base sans donnée : seulement un code.
    console.error(`[prospection] activation non signalée : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
  }
}

export type RapportDeSynchro = {
  readonly état: 'inactif' | 'passée'
  readonly examinées: number
  readonly passées: Readonly<Record<'abonne' | 'expire' | 'resilie', number>>
  readonly synchronisées: number
  readonly enAttente: number
  readonly échecs: number
}

export async function synchroniserLaProspection(
  entrée: { readonly aujourdHui: string } & Dépendances,
): Promise<RapportDeSynchro> {
  const vide = { examinées: 0, passées: { abonne: 0, expire: 0, resilie: 0 }, synchronisées: 0, enAttente: 0, échecs: 0 }
  if (!entrée.db && !prospectionActive()) return { état: 'inactif', ...vide }
  const db = entrée.db ?? base()
  const lemlist = entrée.lemlist === undefined ? clientLemlistConfiguré() : entrée.lemlist

  const passées = { abonne: 0, expire: 0, resilie: 0 }
  const enCours = await prospectionsEnCours(db)
  for (const ligne of enCours) {
    const étape = étapeDuParcours({ organisation: ligne.organisation, abonnement: ligne.abonnement, aujourdHui: entrée.aujourdHui })
    const cible = statutDéduit(ligne.statut, étape.étape)
    if (cible && (await passerAuStatut(ligne.id, cible, db))) passées[cible] += 1
  }

  let synchronisées = 0
  let enAttente = 0
  let échecs = 0
  for (const ligne of await prospectionsÀSynchroniser(db)) {
    const issue = await synchroniserUne(ligne, lemlist, db)
    if (issue === 'synchronisée') synchronisées += 1
    else if (issue === 'en-attente') enAttente += 1
    else échecs += 1
  }

  return { état: 'passée', examinées: enCours.length, passées, synchronisées, enAttente, échecs }
}

/** Ce que l'étape du parcours impose au statut de prospection, quand elle impose quelque chose. */
function statutDéduit(statut: StatutProspection, étape: string): 'abonne' | 'expire' | 'resilie' | null {
  if (étape === 'abonnee') return statut === 'abonne' ? null : 'abonne'
  if (statut === 'abonne') return étape === 'suspendue' ? 'resilie' : null
  if (étape === 'suspendue') return 'expire'
  return null
}

/**
 * Dit à lemlist ce qu'il ne sait pas encore d'une prospection : la séquence à
 * arrêter (par l'adresse, dans la campagne), puis le statut (par l'identifiant
 * du lead). Ce qui ne peut pas être dit faute d'identifiant reste en attente ;
 * un refus de lemlist est noté par son code et retenté le lendemain, sauf un
 * lead disparu (404), qu'il ne sert à rien de retenter.
 */
async function synchroniserUne(
  ligne: ProspectionÀSynchroniser,
  lemlist: ClientLemlist | null,
  db: Base,
): Promise<'synchronisée' | 'en-attente' | 'échec'> {
  if (!lemlist) return 'en-attente'
  const acquis: { statut?: StatutProspection; séquenceArrêtée?: boolean } = {}

  const séquenceÀArrêter = (ligne.statut === 'actif' || ligne.statut === 'abonne') && ligne.séquenceArrêtéeLe === null
  if (séquenceÀArrêter) {
    if (!ligne.campagneLemlist || !ligne.email) return 'en-attente'
    const résultat = await lemlist.arrêterLaSéquence(ligne.campagneLemlist, ligne.email)
    if (!résultat.ok && résultat.code !== 'lemlist-404') {
      await noterLaSynchro(ligne.id, { erreur: résultat.code }, db)
      return 'échec'
    }
    acquis.séquenceArrêtée = true
  }

  if (ligne.synchroniséStatut !== ligne.statut) {
    if (!ligne.leadLemlist) {
      if (acquis.séquenceArrêtée) await noterLaSynchro(ligne.id, acquis, db)
      return 'en-attente'
    }
    const résultat = await lemlist.écrireVariables(ligne.leadLemlist, { sfStatut: ligne.statut })
    if (!résultat.ok && résultat.code !== 'lemlist-404') {
      await noterLaSynchro(ligne.id, { erreur: résultat.code }, db)
      return 'échec'
    }
    acquis.statut = ligne.statut
  }

  await noterLaSynchro(ligne.id, acquis, db)
  return 'synchronisée'
}
