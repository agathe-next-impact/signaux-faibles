import type { Base } from '@/lib/base/client'
import {
  conclureLeTravail,
  lireLeTravail,
  planifierLesLettres,
  poserUnTravailDeLettre,
  prendreLeProchainTravail,
  étatDeLaFile,
  type RapportDePlanification,
  type RésultatDeConclusion,
  type RésultatDePose,
  type TravailDeLaFile,
  type ÉtatDeLaFile,
} from '@/lib/base/travaux'
import { lireBlocsDePage } from '@/lib/notion/editions'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { lireÉditionDeTravail, listerÉditionsDeTravail } from '@/lib/notion/travail'
import { contexteDeFamille, type ContexteDeFamille } from '@/lib/portail/contexte'
import { identifiantAvecTirets } from '@/lib/portail/garde-veille'
import { contrôlerLaLettre, type Rapport, type Rupture } from '@/lib/portail/lint'

/**
 * L'orchestration de la file de travaux (palier 2, 21 octobre 2026) : le seul
 * endroit qui écrit dans `travaux` et `runs`, et le seul qui confronte un
 * résultat posté à ce que le portail attendait.
 *
 * L'exécuteur (la tâche « Runs de veille », ou demain un appel d'API) ne fait
 * que trois gestes : prendre un travail, rédiger la lettre dans Notion en
 * Brouillon, poster la page. Le portail décide du reste, ici :
 *
 *   · **à la prise**, il complète le contexte Postgres (numéro à attribuer,
 *     parution, prompt) par ce que Notion sait de la famille (dernières
 *     éditions, dossiers ouverts, période couverte), la même lecture que
 *     `GET /api/veille/contexte` ;
 *   · **à la réception**, il passe la page dans le parseur de production
 *     (`contrôlerLaLettre`) et tient trois portes de plus que le lint, qui ne
 *     peut pas les connaître : la page appartient bien à l'organisation du
 *     travail (règle 2, le cloisonnement se vérifie en code), porte la famille
 *     attendue, et le numéro attribué. Un résultat qui franchit tout est
 *     accepté et le numéro est écrit ; sinon le travail redevient prenable,
 *     avec le rapport, jusqu'à l'abandon.
 *
 * Aucune de ces lectures Notion n'est faite hors cache ; la route qui reçoit le
 * résultat expire le tag de la page avant, comme le validateur.
 */

export type TravailPris = {
  readonly travail: TravailDeLaFile
  /** Ce que Notion sait de la famille de la veille ; nul pour un travail sans famille ou sans registre. */
  readonly notion: ContexteDeFamille | null
}

/** Le prochain travail prenable, avec son contexte Notion ; `null` si la file est vide. */
export async function prendreUnTravail(
  { session, maintenant }: { readonly session: string; readonly maintenant?: Date },
  db?: Base,
): Promise<TravailPris | null> {
  const travail = await prendreLeProchainTravail({ session, maintenant }, db)
  if (!travail) return null

  const famille = travail.contexte.veille?.famille ?? null
  const registre = travail.organisation.registreNotion
  if (!famille || !registre) return { travail, notion: null }

  const éditions = await listerÉditionsDeTravail(registre)
  return { travail, notion: contexteDeFamille(éditions, famille) }
}

/** Les portes que le portail tient en plus du lint, et que le lint ne peut pas connaître. */
export type PorteDuPortail = {
  readonly code:
    | 'type-non-pris-en-charge'
    | 'page-introuvable'
    | 'organisation-différente'
    | 'famille-différente'
    | 'numéro-différent'
  readonly message: string
}

export type Portes = {
  readonly portail: readonly PorteDuPortail[]
  readonly ruptures: readonly Rupture[]
  readonly avertissements: Rapport['avertissements']
}

export type RéceptionDuRésultat =
  | { readonly sorte: 'inconnu' }
  | { readonly sorte: 'pas-pris'; readonly état: string }
  | { readonly sorte: 'autre-session' }
  | {
      readonly sorte: 'accepté' | 'refusé' | 'abandonné'
      readonly conclusion: Extract<RésultatDeConclusion, { sorte: 'accepté' | 'refusé' | 'abandonné' }>
      readonly portes: Portes
      readonly aperçu: Rapport['aperçu'] | null
    }

/**
 * Reçoit la page qu'un exécuteur a écrite pour un travail, la contrôle, et
 * conclut le travail. La page est désignée par son identifiant Notion ; elle
 * est relue (son tag a été expiré par la route) et jamais copiée.
 */
export async function recevoirUnRésultat(
  entrée: {
    readonly travailId: string
    readonly session: string
    readonly page: string
    readonly exécuteur: string
    readonly début?: Date | null
    readonly fin?: Date | null
    readonly résultat?: Record<string, unknown>
    readonly coût?: Record<string, unknown> | null
    readonly maintenant?: Date
  },
  db?: Base,
): Promise<RéceptionDuRésultat> {
  const travail = await lireLeTravail(entrée.travailId, db)
  if (!travail) return { sorte: 'inconnu' }
  if (travail.état !== 'pris') return { sorte: 'pas-pris', état: travail.état }
  if (travail.prisPar !== entrée.session) return { sorte: 'autre-session' }

  const pageId = identifiantAvecTirets(entrée.page)
  const { portes, aperçu } = await contrôlerLaPage(travail, pageId)
  const accepté = portes.portail.length === 0 && portes.ruptures.length === 0

  const conclusion = await conclureLeTravail(
    {
      travailId: travail.id,
      session: entrée.session,
      accepté,
      résultat: entrée.résultat ?? {},
      portes: { ...portes },
      pageNotion: normaliserIdentifiant(pageId),
      exécuteur: entrée.exécuteur,
      début: entrée.début ?? null,
      fin: entrée.fin ?? null,
      coût: entrée.coût ?? null,
      maintenant: entrée.maintenant,
    },
    db,
  )
  switch (conclusion.sorte) {
    case 'inconnu':
    case 'autre-session':
      return { sorte: conclusion.sorte }
    case 'pas-pris':
      return { sorte: 'pas-pris', état: conclusion.état }
    default:
      return { sorte: conclusion.sorte, conclusion, portes, aperçu }
  }
}

async function contrôlerLaPage(
  travail: TravailDeLaFile,
  pageId: string,
): Promise<{ portes: Portes; aperçu: Rapport['aperçu'] | null }> {
  const portail: PorteDuPortail[] = []

  if (travail.type !== 'lettre' && travail.type !== 'premiere_lettre') {
    portail.push({
      code: 'type-non-pris-en-charge',
      message: `le portail ne contrôle que les lettres ; ce travail est de type ${travail.type}`,
    })
    return { portes: { portail, ruptures: [], avertissements: [] }, aperçu: null }
  }

  const édition = await lireÉditionDeTravail(pageId)
  if (!édition) {
    portail.push({ code: 'page-introuvable', message: 'aucune page d’édition à cet identifiant, ou page à la corbeille' })
    return { portes: { portail, ruptures: [], avertissements: [] }, aperçu: null }
  }

  // Règle 2 : la page doit porter, dans sa relation Organisation, la ligne du
  // registre de l'organisation du travail. Une page d'un autre client, ou sans
  // organisation, n'est pas un résultat, quel que soit son contenu.
  const registre = travail.organisation.registreNotion
  if (!registre || !édition.organisationIds.map(normaliserIdentifiant).includes(registre)) {
    portail.push({
      code: 'organisation-différente',
      message: 'la page ne porte pas la ligne du registre de l’organisation du travail',
    })
  }

  const famille = travail.contexte.veille?.famille ?? null
  if (famille && édition.famille !== famille) {
    portail.push({
      code: 'famille-différente',
      message: `la page porte la famille « ${édition.famille ?? 'aucune'} », le travail attend « ${famille} »`,
    })
  }

  const numéro = travail.contexte.numéro
  if (typeof numéro === 'number' && édition.numéro !== numéro) {
    portail.push({
      code: 'numéro-différent',
      message: `la page porte le numéro ${édition.numéro ?? 'aucun'}, le portail a attribué le ${numéro}`,
    })
  }

  const blocs = await lireBlocsDePage(pageId)
  const rapport = contrôlerLaLettre({
    titre: édition.titre,
    blocs,
    dossiersBruts: édition.dossiersOuvertsBruts,
    numéro: édition.numéro,
  })

  return {
    portes: { portail, ruptures: rapport.ruptures, avertissements: rapport.avertissements },
    aperçu: rapport.aperçu,
  }
}

/** La planification quotidienne : un travail par parution de la semaine qui vient. */
export async function planifierLaFile(
  { aujourdHui }: { readonly aujourdHui: string },
  db?: Base,
): Promise<RapportDePlanification> {
  return planifierLesLettres({ aujourdHui }, db)
}

/** Un travail de lettre posé à la main par l'opératrice ou l'onboarding. */
export async function poserUnTravail(
  entrée: {
    readonly slug: string
    readonly veille: string
    readonly type: 'lettre' | 'premiere_lettre'
    readonly dateDeParution: string
  },
  db?: Base,
): Promise<RésultatDePose> {
  return poserUnTravailDeLettre(entrée, db)
}

/** L'état de la file, pour l'opératrice et le contrôle du soir. */
export async function lireLaFile(maintenant?: Date, db?: Base): Promise<ÉtatDeLaFile> {
  return étatDeLaFile(maintenant, db)
}
