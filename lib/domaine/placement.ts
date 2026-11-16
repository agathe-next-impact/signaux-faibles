import { courrierDuParcours, LIBELLÉS_DES_COURRIERS_DE_PARCOURS, type SorteDeParcours } from '@/lib/domaine/courriers-parcours'
import {
  abonnementOuvert,
  dateDeParis,
  dateLongueDeParis,
  lectureAutorisée,
  libelléDÉtape,
  semainesÉcoulées,
  étapeDuParcours,
  type EntréeDuParcours,
  type Offre,
  type Étape,
  type ÉtatOrganisation,
} from '@/lib/domaine/parcours'
import { lundiDeLaSemaine } from '@/lib/domaine/semaines'

/**
 * Placer une organisation à une étape du parcours, et lire ce qui vient
 * (16 novembre 2026, demande de l'opératrice : gérer les essais sans calculer
 * J0).
 *
 * L'étape n'est jamais stockée : `étapeDuParcours` la calcule de J0, du nombre
 * de parutions complètes et de la date. Jusqu'ici, l'opératrice devait donc
 * raisonner à l'envers (dater une « prochaine lettre », compter les parutions
 * restantes) pour obtenir une étape. Ce module fait l'inverse à sa place :
 * elle nomme l'étape, il rend le J0 qui la produit. Il ne stocke toujours
 * rien, et sa garantie se teste comme une propriété : pour toute cible et tout
 * nombre de parutions, `étapeDuParcours` appliquée au J0 rendu redonne la
 * cible.
 *
 * Tout est pur : ni base, ni horloge, ni réseau.
 */

const SEMAINE_MS = 7 * 24 * 60 * 60 * 1000

/** L'étape visée : une parution complète de l'essai, la parution réduite, ou la suspension par le calendrier. */
export type Cible =
  | { readonly sorte: 'essai'; readonly parution: number }
  | { readonly sorte: 'tronquee' }
  | { readonly sorte: 'suspendue' }

const CLÉ_DE_CIBLE = /^(?:essai-([1-8])|derniere|tronquee|suspendue)$/

/**
 * La cible que nomme une clé de formulaire ou de route : `essai-2`, `derniere`
 * (la dernière parution complète, quel que soit leur nombre : utile en série,
 * où il diffère d'une organisation à l'autre), `tronquee`, `suspendue`. `null`
 * si la clé est inconnue ou si la parution dépasse l'essai de l'organisation.
 */
export function lireUneCible(clé: unknown, parutions: number): Cible | null {
  if (typeof clé !== 'string') return null
  const lue = CLÉ_DE_CIBLE.exec(clé)
  if (!lue) return null
  if (clé === 'tronquee' || clé === 'suspendue') return { sorte: clé }
  const parution = clé === 'derniere' ? parutions : Number(lue[1])
  return parution >= 1 && parution <= parutions ? { sorte: 'essai', parution } : null
}

/** Une clé est-elle bien formée, sans savoir encore pour quelle organisation ? */
export function estUneCléDeCible(clé: unknown): clé is string {
  return typeof clé === 'string' && CLÉ_DE_CIBLE.test(clé)
}

export function cléDeCible(cible: Cible): string {
  return cible.sorte === 'essai' ? `essai-${cible.parution}` : cible.sorte
}

/** Les étapes où l'on peut placer une organisation, dans l'ordre du parcours. */
export function ciblesPossibles(parutions: number): Cible[] {
  return [
    ...Array.from({ length: parutions }, (_, i) => ({ sorte: 'essai', parution: i + 1 }) as const),
    { sorte: 'tronquee' },
    { sorte: 'suspendue' },
  ]
}

/** L'étape que la cible désigne, pour la nommer par `libelléDÉtape` : un seul vocabulaire. */
export function étapeDeLaCible(cible: Cible, parutions: number): Étape {
  if (cible.sorte === 'essai') return { étape: 'essai', parution: cible.parution, parutions }
  if (cible.sorte === 'tronquee') return { étape: 'tronquee' }
  return { étape: 'suspendue', manuelle: false }
}

/**
 * Le J0 qui met l'organisation à la cible cette semaine : le lundi de la
 * semaine d'`aujourdHui`, reculé d'autant de semaines que l'étape en suppose
 * d'écoulées. Six heures UTC, comme la mise en parcours : c'est un lundi à
 * Paris, hiver comme été.
 */
export function j0PourLaCible(cible: Cible, parutions: number, aujourdHui: string): Date {
  const écoulées = cible.sorte === 'essai' ? cible.parution - 1 : cible.sorte === 'tronquee' ? parutions : parutions + 1
  return new Date(Date.parse(`${lundiDeLaSemaine(aujourdHui)}T06:00:00Z`) - écoulées * SEMAINE_MS)
}

/** Pourquoi une organisation ne peut pas être placée, ou `null` si elle le peut. */
export type RefusDePlacement = 'pas-en-essai' | 'abonnée-stripe' | 'accès-offert'

/**
 * Les mêmes gardes que la mise en parcours, lues par la base avant d'écrire et
 * par l'écran avant de proposer : un geste grisé dit sa raison au lieu de
 * répondre 409 après le clic.
 */
export function refusDuPlacement(
  organisation: { readonly état: ÉtatOrganisation; readonly offre: Offre },
  stripeOuvert: boolean,
): RefusDePlacement | null {
  if (organisation.état !== 'essai' && organisation.état !== 'abonnee') return 'pas-en-essai'
  if (stripeOuvert) return 'abonnée-stripe'
  if (organisation.offre === 'gratuite') return 'accès-offert'
  return null
}

/** La raison d'un refus, en une phrase qui dit quoi faire. */
export function raisonDuRefus(refus: RefusDePlacement, état: ÉtatOrganisation): string {
  if (refus === 'abonnée-stripe') return 'Un abonnement Stripe est ouvert : l’étape suit Stripe, elle ne se place pas.'
  if (refus === 'accès-offert') return 'Accès offert : il n’a pas de fin d’essai. Repasser l’offre en standard d’abord.'
  switch (état) {
    case 'suspendue':
    case 'ecartee':
      return 'Suspendue ou écartée par décision : la réactiver d’abord.'
    case 'test':
      return 'Organisation de test : elle n’entre pas dans le parcours.'
    default:
      return 'Pas encore entrée en essai : l’onboarding le fait à la première lettre.'
  }
}

/** Prolonger demande un essai dont J0 est posé ; sinon, la raison. */
export function refusDeProlonger(organisation: { readonly état: ÉtatOrganisation; readonly activéeLe: Date | null }): string | null {
  if (organisation.état !== 'essai') return 'Cette organisation n’est pas en essai : rien à prolonger.'
  if (organisation.activéeLe === null) return 'J0 n’est pas encore posé : rien à prolonger.'
  return null
}

/**
 * Le courrier de parcours que le passage quotidien prépare à cette date, ou
 * `null`. Il ne lit que les organisations à l'état `essai` dont J0 est posé :
 * une abonnée historique dont le calendrier reprend n'en reçoit aucun.
 */
export function courrierAttendu(entrée: EntréeDuParcours): SorteDeParcours | null {
  const { organisation, aujourdHui } = entrée
  if (organisation.état !== 'essai' || organisation.activéeLe === null) return null
  const premièreSemaineDeSuspension =
    semainesÉcoulées(dateDeParis(organisation.activéeLe), aujourdHui) === organisation.parutionsDEssai + 1
  return courrierDuParcours(étapeDuParcours(entrée), premièreSemaineDeSuspension)
}

export type Échéance = {
  /** Le lundi du changement, `AAAA-MM-JJ`. */
  readonly le: string
  readonly étape: Étape
}

const HORIZON_SEMAINES = 12

function lundiDans(aujourdHui: string, semaines: number): string {
  return new Date(Date.parse(`${lundiDeLaSemaine(aujourdHui)}T00:00:00Z`) + semaines * SEMAINE_MS).toISOString().slice(0, 10)
}

/**
 * Le prochain lundi où le calendrier fait changer l'organisation de régime
 * (essai, parution réduite, suspension), ou `null` si rien ne vient : abonnée,
 * suspendue, hors parcours sans date. Calculée en rejouant `étapeDuParcours`
 * semaine après semaine : la règle n'est écrite qu'une fois.
 */
export function prochaineÉchéance(entrée: EntréeDuParcours): Échéance | null {
  const aujourdhui = étapeDuParcours(entrée)
  for (let semaines = 1; semaines <= HORIZON_SEMAINES; semaines++) {
    const le = lundiDans(entrée.aujourdHui, semaines)
    const étape = étapeDuParcours({ ...entrée, aujourdHui: le })
    if (étape.étape !== aujourdhui.étape) return { le, étape }
  }
  return null
}

/** Ce que le placement change, montré avant de confirmer. */
export type AperçuDuPlacement = {
  readonly j0: string
  readonly étape: Étape
  readonly lecture: ReturnType<typeof lectureAutorisée>
  /** Le brouillon que le passage quotidien préparera, s'il ne l'a pas déjà été. */
  readonly courrier: SorteDeParcours | null
  readonly échéance: Échéance | null
}

export function aperçuDuPlacement(cible: Cible, organisation: { readonly offre: Offre; readonly parutionsDEssai: number }, aujourdHui: string): AperçuDuPlacement {
  const activéeLe = j0PourLaCible(cible, organisation.parutionsDEssai, aujourdHui)
  const entrée: EntréeDuParcours = {
    organisation: { état: 'essai', activéeLe, offre: organisation.offre, parutionsDEssai: organisation.parutionsDEssai },
    // Le placement est refusé sous un abonnement ouvert ; un abonnement fermé laisse le calendrier décider.
    abonnement: null,
    aujourdHui,
  }
  const étape = étapeDuParcours(entrée)
  return {
    j0: dateDeParis(activéeLe),
    étape,
    lecture: lectureAutorisée(étape),
    courrier: courrierAttendu(entrée),
    échéance: prochaineÉchéance(entrée),
  }
}

export type LigneDuParcours = {
  readonly slug: string
  readonly nom: string
  readonly état: ÉtatOrganisation
  readonly activéeLe: Date | null
  readonly offre: Offre
  readonly parutionsDEssai: number
  readonly abonnement: { readonly état: string } | null
}

export type MouvementDeLaSemaine = {
  readonly slug: string
  readonly nom: string
  readonly étape: Étape
  readonly courrier: SorteDeParcours | null
}

function entréeDe(ligne: LigneDuParcours, aujourdHui: string): EntréeDuParcours {
  return {
    organisation: { état: ligne.état, activéeLe: ligne.activéeLe, offre: ligne.offre, parutionsDEssai: ligne.parutionsDEssai },
    abonnement: ligne.abonnement,
    aujourdHui,
  }
}

/**
 * Ce qui se joue cette semaine et lundi prochain, pour le bandeau du tableau.
 *
 *   · `cetteSemaine` : les organisations pour lesquelles un courrier de
 *     parcours est dû cette semaine (un brouillon à relire et envoyer) ;
 *   · `lundiProchain` : celles qui changent de régime lundi, ou pour lesquelles
 *     un courrier sera préparé la semaine prochaine.
 *
 * Des dates et des règles, jamais une lecture du journal : un brouillon déjà
 * envoyé y figure encore, c'est le calendrier qui parle.
 */
export function semaineDuParcours(
  lignes: readonly LigneDuParcours[],
  aujourdHui: string,
): { readonly cetteSemaine: MouvementDeLaSemaine[]; readonly lundiProchain: (MouvementDeLaSemaine & { readonly le: string })[] } {
  const cetteSemaine: MouvementDeLaSemaine[] = []
  const lundiProchain: (MouvementDeLaSemaine & { readonly le: string })[] = []
  const le = lundiDans(aujourdHui, 1)
  for (const ligne of lignes) {
    const maintenant = entréeDe(ligne, aujourdHui)
    const étape = étapeDuParcours(maintenant)
    const courrier = courrierAttendu(maintenant)
    if (courrier) cetteSemaine.push({ slug: ligne.slug, nom: ligne.nom, étape, courrier })

    const ensuite = entréeDe(ligne, le)
    const étapeSuivante = étapeDuParcours(ensuite)
    const courrierSuivant = courrierAttendu(ensuite)
    if (étapeSuivante.étape !== étape.étape || courrierSuivant) {
      lundiProchain.push({ slug: ligne.slug, nom: ligne.nom, étape: étapeSuivante, courrier: courrierSuivant, le })
    }
  }
  return { cetteSemaine, lundiProchain }
}

/**
 * Ce qu'attend une organisation hors parcours, en une phrase : un état sans
 * suite se lisait comme une panne (Eclairion, 12 novembre 2026, « hors parcours
 * · aucune date d'activation » le jour de sa première lettre). `null` hors de
 * ce cas.
 */
export function suiteDuHorsParcours(
  étape: Étape,
  organisation: { readonly état: ÉtatOrganisation; readonly activéeLe: Date | null; readonly essaiOuvertLe: Date | null },
): string | null {
  if (étape.étape !== 'hors-parcours') return null
  switch (organisation.état) {
    case 'ecartee':
      return 'Écartée par décision : elle reste lisible et sort de la production. « Réactiver » lui rend son état d’avant.'
    case 'test':
      return 'Organisation de test : hors du parcours par nature, lecture complète.'
    case 'demande':
    case 'generation':
      return 'Pas encore entrée en essai : l’onboarding le fait quand la première lettre est produite.'
    default:
      break
  }
  if (organisation.activéeLe !== null) {
    return `J0 est posé au ${dateLongueDeParis(organisation.activéeLe)}, dans le futur : l’essai commence cette semaine-là.`
  }
  if (organisation.essaiOuvertLe === null) {
    return 'Entrée par prospection : l’essai ouvre à la première visite du prospect, puis J0 se fixe à la première lettre publiée ensuite.'
  }
  return 'J0 se fixe seul, au passage quotidien, à la date de la première lettre publiée (statut « Envoyé ») : tant que les lettres sont en brouillon, l’espace reste en lecture complète et aucun courrier n’est dû. Ou placez-la à une étape ci-dessous.'
}

/**
 * Un geste appliqué à plusieurs organisations d'un coup (lot 2, même jour) :
 * placer à une étape, prolonger, ou régler la relecture. La clé voyage dans
 * l'URL de l'aperçu puis dans le formulaire de confirmation.
 */
export type Lot =
  | { readonly sorte: 'placer'; readonly cible: string }
  | { readonly sorte: 'prolonger'; readonly semaines: 1 | 2 | 3 }
  | { readonly sorte: 'relecture'; readonly requise: boolean }

export function lireUnLot(clé: unknown): Lot | null {
  if (typeof clé !== 'string') return null
  const [sorte, valeur, ...reste] = clé.split(':')
  if (reste.length > 0 || valeur === undefined) return null
  if (sorte === 'placer') return estUneCléDeCible(valeur) ? { sorte, cible: valeur } : null
  if (sorte === 'prolonger') return valeur === '1' || valeur === '2' || valeur === '3' ? { sorte, semaines: Number(valeur) as 1 | 2 | 3 } : null
  if (sorte === 'relecture') return valeur === 'oui' || valeur === 'non' ? { sorte, requise: valeur === 'oui' } : null
  return null
}

export function cléDeLot(lot: Lot): string {
  if (lot.sorte === 'placer') return `placer:${lot.cible}`
  if (lot.sorte === 'prolonger') return `prolonger:${lot.semaines}`
  return `relecture:${lot.requise ? 'oui' : 'non'}`
}

/** Les gestes proposés en série, dans l'ordre du menu. */
export const LOTS_PROPOSÉS: readonly { readonly clé: string; readonly libellé: string }[] = [
  { clé: 'placer:essai-1', libellé: 'Placer : essai, parution 1' },
  { clé: 'placer:essai-2', libellé: 'Placer : essai, parution 2' },
  { clé: 'placer:essai-3', libellé: 'Placer : essai, parution 3' },
  { clé: 'placer:derniere', libellé: 'Placer : dernière parution complète' },
  { clé: 'placer:tronquee', libellé: 'Placer : parution réduite (l’essentiel seul)' },
  { clé: 'placer:suspendue', libellé: 'Placer : suspendue, essai terminé' },
  { clé: 'prolonger:1', libellé: 'Prolonger l’essai d’une semaine' },
  { clé: 'prolonger:2', libellé: 'Prolonger l’essai de 2 semaines' },
  { clé: 'prolonger:3', libellé: 'Prolonger l’essai de 3 semaines' },
  { clé: 'relecture:oui', libellé: 'Lettres du portail : à la relecture' },
  { clé: 'relecture:non', libellé: 'Lettres du portail : aux lecteurs' },
]

export function libelléDeLot(lot: Lot): string {
  return LOTS_PROPOSÉS.find((l) => l.clé === cléDeLot(lot))?.libellé ?? cléDeLot(lot)
}

export type EffetEnSérie = {
  readonly slug: string
  readonly nom: string
} & ({ readonly possible: true; readonly effet: string } | { readonly possible: false; readonly raison: string })

const jourCourt = (dateISO: string) => `${dateISO.slice(8, 10)}/${dateISO.slice(5, 7)}/${dateISO.slice(0, 4)}`

/** Ce que le placement change, en une ligne : l'étape, J0, la lecture, le brouillon à venir. */
export function effetDuPlacement(aperçu: AperçuDuPlacement): string {
  const lecture = aperçu.lecture === 'complète' ? 'lecture complète' : aperçu.lecture === 'essentiel' ? 'l’essentiel seul, dès maintenant' : 'espace fermé, dès maintenant'
  const courrier = aperçu.courrier
    ? ` ; brouillon « ${LIBELLÉS_DES_COURRIERS_DE_PARCOURS[aperçu.courrier]} » par lecteur actif au prochain passage quotidien, s’il n’a pas déjà été préparé`
    : ' ; aucun courrier'
  return `${libelléDÉtape(aperçu.étape)} · J0 au ${jourCourt(aperçu.j0)} · ${lecture}${courrier}`
}

/**
 * L'effet du geste sur chaque organisation cochée, avant de confirmer : ce qui
 * changera, ou pourquoi rien ne changera. Les mêmes règles que la base, lues
 * sans écrire ; la base les revérifie à l'écriture.
 */
export function aperçuDeLaSérie(
  lot: Lot,
  lignes: readonly LigneDuParcours[],
  aujourdHui: string,
): EffetEnSérie[] {
  return lignes.map((ligne): EffetEnSérie => {
    const base = { slug: ligne.slug, nom: ligne.nom }
    if (lot.sorte === 'relecture') {
      return { ...base, possible: true, effet: lot.requise ? 'lettres envoyées par le portail : à l’adresse de relecture' : 'lettres envoyées par le portail : aux lecteurs' }
    }
    if (lot.sorte === 'placer') {
      const refus = refusDuPlacement(ligne, abonnementOuvert(ligne.abonnement))
      if (refus) return { ...base, possible: false, raison: raisonDuRefus(refus, ligne.état) }
      const cible = lireUneCible(lot.cible, ligne.parutionsDEssai)
      if (!cible) {
        return { ...base, possible: false, raison: `Cette étape n’existe pas dans son essai (${ligne.parutionsDEssai} parution${ligne.parutionsDEssai > 1 ? 's' : ''} complète${ligne.parutionsDEssai > 1 ? 's' : ''}).` }
      }
      const horsStripe = ligne.état === 'abonnee' ? ' ; elle quitte « abonnée hors Stripe » pour le parcours d’essai' : ''
      return { ...base, possible: true, effet: `${effetDuPlacement(aperçuDuPlacement(cible, ligne, aujourdHui))}${horsStripe}` }
    }
    const refus = refusDeProlonger(ligne)
    if (refus || ligne.activéeLe === null) return { ...base, possible: false, raison: refus ?? 'J0 n’est pas encore posé : rien à prolonger.' }
    const j0 = new Date(ligne.activéeLe.getTime() + lot.semaines * SEMAINE_MS)
    if (dateDeParis(j0) > aujourdHui) return { ...base, possible: false, raison: 'Ce décalage mettrait J0 après aujourd’hui.' }
    const étape = étapeDuParcours({ ...entréeDe(ligne, aujourdHui), organisation: { état: ligne.état, activéeLe: j0, offre: ligne.offre, parutionsDEssai: ligne.parutionsDEssai } })
    return { ...base, possible: true, effet: `${libelléDÉtape(étape)} · J0 au ${jourCourt(dateDeParis(j0))}` }
  })
}
