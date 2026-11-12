import type { Base } from '@/lib/base/client'
import {
  derniersSegments,
  mesuresVivantes,
  périodesMesurées,
  posterLesSegments,
  publierLesMesures,
  remplacerLesMesures,
  type MesureEnregistrée,
  type ÉtatDesMesures,
} from '@/lib/base/marches'
import { faitsDeLaFenêtre, lireLaGrille, lireLaSynthèse, organisationPourLesOutils, synthèsePrécédente } from '@/lib/base/strategie'
import {
  contrôlerLesSegments,
  empreinteDesSegments,
  fenêtreDuTrimestre,
  mesurerLesSegments,
  MONTANT_MAX_D_UN_MARCHÉ,
  messageDeRepriseDesSegments,
  TRANCHES_D_EFFECTIF,
  vueDesMarchés,
  type AchatsPublics,
  type Compte,
  type ComptesDuSegment,
  type MesureDeSegment,
  type SegmentDeMarché,
  type VueDesMarchés,
} from '@/lib/domaine/marches'
import { périodesDuCycle, type LigneDeBenchmark, type Refus } from '@/lib/domaine/strategie'
import { bornée, organisationDuRegistre } from '@/lib/portail/strategie'
import { compterLesAnnonces, compterLesEntreprises, FAMILLES_ENTRANTS, lireLesAchatsPublics, SECTIONS_D_ACTIVITÉ } from '@/lib/registres'

/**
 * Marchés et niches (12 novembre 2026, `docs/plan-marches-et-niches.md`) :
 * seule orchestration des segments et de leurs mesures, seul appelant de
 * `lib/base/marches.ts`.
 *
 *   · les segments se postent (`POST /api/veille/marches`) et passent la porte
 *     `contrôlerLesSegments` avant toute écriture ;
 *   · les mesures d'un trimestre sont **calculées par le portail**
 *     (`PATCH`, `action: mesurer`) : comptes du registre des entreprises et du
 *     BODACC, marchés publics attribués (DECP) sur les codes CPV du segment,
 *     faits étiquetés de la période, comptes publiés lus par le benchmark du
 *     trimestre ; aucun chiffre ne vient d'un modèle ni du client ;
 *   · rien n'est montré au client avant que l'opératrice publie la période ;
 *   · l'écran lit les seules mesures publiées, par le registre de la session
 *     (règle 2), dans une lecture bornée, sans lecture Notion ni appel aux
 *     registres.
 */

export const BUDGET_DES_MESURES_MS = 45_000
const BUDGET_D_UN_COMPTE_MS = 6_000
/** L'API publique limite le débit par adresse : un appel après l'autre, avec une pause. */
const PAUSE_ENTRE_DEUX_COMPTES_MS = 150

export type DépendancesDesMesures = {
  readonly f?: typeof fetch
  readonly attente?: (ms: number) => Promise<unknown>
  readonly maintenant?: () => number
}

type Pilote =
  | { readonly sorte: 'pilote'; readonly organisation: { readonly id: string; readonly nom: string } }
  | { readonly sorte: 'organisation-inconnue' | 'hors-pilote' }

async function piloteDe(slug: string, db?: Base): Promise<Pilote> {
  const organisation = await organisationPourLesOutils({ slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  return { sorte: 'pilote', organisation }
}

export type RésultatDesSegments =
  | { readonly sorte: 'créée' | 'inchangée'; readonly version: number; readonly segments: number }
  | { readonly sorte: 'refusée'; readonly refus: readonly Refus[]; readonly message: string }
  | { readonly sorte: 'organisation-inconnue' | 'hors-pilote' | 'grille-absente' }

/** Reçoit l'arbre des segments : le pilote et la grille d'abord, la porte ensuite, l'écriture en dernier. */
export async function recevoirLesSegments(entrée: { readonly slug: string; readonly segments: readonly SegmentDeMarché[] }, db?: Base): Promise<RésultatDesSegments> {
  const pilote = await piloteDe(entrée.slug, db)
  if (pilote.sorte !== 'pilote') return pilote
  const grille = await lireLaGrille(pilote.organisation.id, db)
  if (!grille) return { sorte: 'grille-absente' }
  const refus = contrôlerLesSegments(entrée.segments, grille.grille)
  if (refus.length > 0) return { sorte: 'refusée', refus, message: messageDeRepriseDesSegments(refus) }
  const écrit = await posterLesSegments(
    { organisationId: pilote.organisation.id, empreinte: empreinteDesSegments(entrée.segments), grilleVersion: grille.version, contenu: [...entrée.segments] },
    db,
  )
  return { ...écrit, segments: entrée.segments.length }
}

const versLesMesures = (lignes: readonly MesureEnregistrée[]) => {
  const périodes = new Map<string, MesureDeSegment[]>()
  for (const l of lignes) périodes.set(l.période, [...(périodes.get(l.période) ?? []), l.valeur as unknown as MesureDeSegment])
  return [...périodes].sort(([a], [b]) => a.localeCompare(b)).map(([période, mesures]) => ({ période, mesures }))
}

export type LectureDesMarchés =
  | {
      readonly sorte: 'lus'
      readonly version: number
      readonly grilleVersion: number
      readonly segments: readonly SegmentDeMarché[]
      readonly périodes: readonly { readonly période: string; readonly état: ÉtatDesMesures; readonly mesures: number }[]
      /** La vue sur toutes les mesures vivantes, publiées ou non : ce que l'opératrice relit. */
      readonly vue: VueDesMarchés | null
    }
  | { readonly sorte: 'aucun' | 'organisation-inconnue' | 'hors-pilote' }

/** La dernière version des segments et l'état de leurs mesures, pour la relecture. */
export async function lireLesMarchésDuPilote(entrée: { readonly slug: string }, db?: Base): Promise<LectureDesMarchés> {
  const pilote = await piloteDe(entrée.slug, db)
  if (pilote.sorte !== 'pilote') return pilote
  const [segments, périodes, mesures] = await Promise.all([
    derniersSegments(pilote.organisation.id, db),
    périodesMesurées(pilote.organisation.id, db),
    mesuresVivantes({ organisationId: pilote.organisation.id }, db),
  ])
  if (!segments) return { sorte: 'aucun' }
  return {
    sorte: 'lus',
    version: segments.version,
    grilleVersion: segments.grilleVersion,
    segments: segments.contenu as SegmentDeMarché[],
    périodes,
    vue: vueDesMarchés(versLesMesures(mesures)),
  }
}

/**
 * Les comptes d'un segment, un appel après l'autre dans le budget de temps : ce
 * qui n'a pas répondu à l'échéance vaut `null`, jamais une erreur. Une mesure
 * incomplète vaut mieux qu'une mesure refusée pour un chiffre.
 */
async function compterUnSegment(
  segment: SegmentDeMarché,
  fin: string,
  contexte: { readonly f: typeof fetch; readonly attente: (ms: number) => Promise<unknown>; readonly maintenant: () => number; readonly échéance: number; readonly lus: Map<string, Promise<Awaited<ReturnType<typeof compterLesEntreprises>> | null>>; readonly achats: Map<string, Promise<AchatsPublics | null>>; readonly sirens: readonly string[] },
): Promise<ComptesDuSegment> {
  const dansLeTemps = async <T>(lecture: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    const reste = contexte.échéance - contexte.maintenant()
    if (reste <= 0) return null
    // Un second essai : l'API publique coupe parfois une connexion sans raison durable.
    for (const _essai of [1, 2]) {
      const encore = contexte.échéance - contexte.maintenant()
      if (encore <= 0) return null
      await contexte.attente(PAUSE_ENTRE_DEUX_COMPTES_MS)
      try {
        return await lecture(AbortSignal.timeout(Math.min(encore, BUDGET_D_UN_COMPTE_MS)))
      } catch {
        // essai suivant, ou n.d.
      }
    }
    return null
  }
  type Périmètre = Parameters<typeof compterLesEntreprises>[0]
  const lire = (périmètre: Périmètre) => {
    const clé = JSON.stringify(périmètre)
    const connu = contexte.lus.get(clé)
    if (connu) return connu
    const lecture = dansLeTemps((signal) => compterLesEntreprises(périmètre, contexte.f, signal))
    contexte.lus.set(clé, lecture)
    return lecture
  }
  /**
   * Au plafond du registre, le périmètre se partage : par tranche d'effectif
   * d'abord, puis, pour une tranche encore au plafond, par code NAF quand il en
   * porte plusieurs, par section d'activité quand il n'en porte aucun. Chaque
   * entreprise est dans une seule case, la somme est le nombre. Une case qui
   * resterait au plafond fait du total un minimum, et le compte le dit.
   */
  const compte = async (périmètre: Périmètre): Promise<Compte> => {
    const lu = await lire(périmètre)
    if (!lu) return { nombre: null, plafonné: false, source: null }
    if (!lu.plafonné) return lu
    let somme = 0
    let plafonné = false
    for (const tranche of périmètre.tranches?.length ? périmètre.tranches : TRANCHES_D_EFFECTIF) {
      const part = await lire({ ...périmètre, tranches: [tranche] })
      if (!part) return lu
      const codes = périmètre.naf ?? []
      const cases: Périmètre[] = !part.plafonné
        ? []
        : codes.length > 1
          ? codes.map((naf) => ({ ...périmètre, tranches: [tranche], naf: [naf] }))
          : codes.length === 0
            ? SECTIONS_D_ACTIVITÉ.map((section) => ({ ...périmètre, tranches: [tranche], section }))
            : []
      if (cases.length === 0) {
        somme += part.nombre
        plafonné ||= part.plafonné
        continue
      }
      // Trois à la fois : vingt et une sections l'une après l'autre mangeraient le budget, plus de trois dépasseraient le débit du registre.
      for (let i = 0; i < cases.length; i += 3) {
        const fines = await Promise.all(cases.slice(i, i + 3).map(lire))
        for (const fine of fines) {
          if (!fine) return lu
          somme += fine.nombre
          plafonné ||= fine.plafonné
        }
      }
    }
    return { nombre: somme, plafonné, source: lu.source, découpé: true }
  }

  const c = segment.cibles ?? null
  const o = segment.offre ?? null
  const cibles =
    c?.sorte === 'registre'
      ? await compte({
          ...(c.naf ? { naf: c.naf } : {}),
          ...(c.tranches ? { tranches: c.tranches } : {}),
          ...(c.départements ? { départements: c.départements } : {}),
          ...(c.collectivités ? { collectivités: true } : {}),
        })
      : null
  const offreurs = o?.naf?.length ? await compte({ naf: o.naf, ...(o.départements ? { départements: o.départements } : {}) }) : null
  let entrées: number | null = null
  let sorties: number | null = null
  if (o?.texte !== undefined && o.départements?.length) {
    const { courante } = périodesDuCycle(fin)
    const base = { departements: o.départements, texte: o.texte, depuis: courante.du, jusqua: courante.au }
    entrées = await dansLeTemps((signal) => compterLesAnnonces({ ...base, familles: FAMILLES_ENTRANTS }, contexte.f, signal))
    sorties = await dansLeTemps((signal) => compterLesAnnonces({ ...base, familles: ['collective'] }, contexte.f, signal))
  }
  // Les marchés publics attribués sur les codes CPV du segment, sur les douze mois qui s'achèvent à la fin de la mesure.
  const cpv = segment.marchésPublics?.cpv ?? []
  if (cpv.length === 0) return { cibles, offreurs, entrées, sorties }
  const { courante } = périodesDuCycle(fin)
  const clé = JSON.stringify([...cpv].sort())
  let achats = contexte.achats.get(clé)
  if (!achats) {
    achats = dansLeTemps((signal) =>
      lireLesAchatsPublics({ cpv, depuis: courante.du, jusqua: courante.au, sirens: contexte.sirens, montantMax: MONTANT_MAX_D_UN_MARCHÉ }, contexte.f, signal),
    )
    contexte.achats.set(clé, achats)
  }
  return { cibles, offreurs, entrées, sorties, achats: await achats }
}

export type RésultatDesMesures =
  | { readonly sorte: 'enregistrées'; readonly période: string; readonly version: number; readonly mesures: number; readonly archivées: number; readonly vue: VueDesMarchés | null }
  | { readonly sorte: 'période-invalide' | 'période-publiée' | 'segments-absents' | 'organisation-inconnue' | 'hors-pilote' }

/**
 * Calcule et enregistre, en proposition, les mesures d'un trimestre sur la
 * dernière version des segments. Les comptes s'arrêtent à la fin du trimestre,
 * ou à aujourd'hui pour un trimestre en cours ; les comptes publiés des
 * concurrents présents sont ceux que le benchmark de ce trimestre a déjà lus
 * (celui du trimestre précédent à défaut), sans nouvel appel.
 */
export async function mesurerLesMarchésDuPilote(
  entrée: { readonly slug: string; readonly période: string },
  db?: Base,
  dépendances: DépendancesDesMesures = {},
): Promise<RésultatDesMesures> {
  const fenêtre = fenêtreDuTrimestre(entrée.période)
  if (!fenêtre) return { sorte: 'période-invalide' }
  const pilote = await piloteDe(entrée.slug, db)
  if (pilote.sorte !== 'pilote') return pilote
  const organisationId = pilote.organisation.id
  const enregistrés = await derniersSegments(organisationId, db)
  if (!enregistrés) return { sorte: 'segments-absents' }
  const segments = enregistrés.contenu as SegmentDeMarché[]

  const maintenant = dépendances.maintenant ?? Date.now
  const aujourdHui = new Date(maintenant()).toISOString().slice(0, 10)
  const fin = fenêtre.fin < aujourdHui ? fenêtre.fin : aujourdHui
  const [faits, synthèse, grille] = await Promise.all([
    faitsDeLaFenêtre({ organisationId, début: fenêtre.début, fin }, db),
    lireLaSynthèse({ organisationId, période: entrée.période }, db),
    lireLaGrille(organisationId, db),
  ])
  // Le benchmark de ce trimestre, ou à défaut celui du trimestre d'avant : un trimestre en cours n'a pas encore sa revue.
  const lignesDe = (éléments: readonly { outil: string; valeur: unknown }[] | undefined) =>
    (éléments?.find((é) => é.outil === 'benchmark')?.valeur as { lignes?: readonly LigneDeBenchmark[] } | null | undefined) ?? null
  const benchmark = lignesDe(synthèse.éléments) ?? lignesDe((await synthèsePrécédente({ organisationId, période: entrée.période }, db))?.éléments)
  const chiffres = Array.isArray(benchmark?.lignes) ? benchmark.lignes.map((l) => ({ nom: l.nom, chiffreDAffaires: l.chiffreDAffaires })) : []

  const concurrents = grille ? grille.grille.entités.filter((e) => e.veille === 'concurrentiel' && e.organisation !== true) : []
  const sirens = concurrents.flatMap((e) => (typeof e.siren === 'string' && /^\d{9}$/.test(e.siren) ? [{ nom: e.nom, siren: e.siren }] : []))
  const elle = grille?.grille.entités.find((e) => e.organisation === true && typeof e.siren === 'string' && /^\d{9}$/.test(e.siren))?.siren ?? null
  const contexte = {
    f: dépendances.f ?? fetch,
    attente: dépendances.attente ?? ((ms: number) => new Promise((r) => setTimeout(r, ms))),
    maintenant,
    échéance: maintenant() + BUDGET_DES_MESURES_MS,
    // Deux segments de même périmètre ne paient qu'un compte.
    lus: new Map(),
    achats: new Map(),
    sirens: [...new Set([...sirens.map((x) => x.siren), ...(elle ? [elle] : [])])],
  }
  const comptes = new Map<string, ComptesDuSegment>()
  for (const s of segments) comptes.set(s.clé, await compterUnSegment(s, fin, contexte))

  const mesures = mesurerLesSegments(segments, {
    comptes,
    faits: faits.map((f) => ({ famille: f.familleÉdition, axe: f.numéroAxe, entité: f.entité, impact: f.impact })),
    chiffres,
    concurrents: concurrents.map((e) => e.nom),
    sirens,
    sirenDeLOrganisation: elle,
  })
  const écrit = await remplacerLesMesures(
    { organisationId, période: entrée.période, segmentsVersion: enregistrés.version, mesures: mesures.map((m) => ({ clé: m.clé, valeur: { ...m } })) },
    db,
    new Date(maintenant()),
  )
  if (écrit.sorte !== 'enregistrées') return écrit
  const toutes = await mesuresVivantes({ organisationId }, db)
  const jusquÀ = versLesMesures(toutes).filter((p) => p.période <= entrée.période)
  return { sorte: 'enregistrées', période: entrée.période, version: enregistrés.version, mesures: écrit.mesures, archivées: écrit.archivées, vue: vueDesMarchés(jusquÀ) }
}

export type PublicationDesMesures =
  | { readonly sorte: 'réglée'; readonly période: string; readonly état: ÉtatDesMesures; readonly mesures: number }
  | { readonly sorte: 'aucune' | 'organisation-inconnue' | 'hors-pilote' }

/** Le geste de l'opératrice après relecture : rien n'est montré au client avant lui. */
export async function publierLesMarchésDuPilote(entrée: { readonly slug: string; readonly période: string; readonly état: ÉtatDesMesures }, db?: Base): Promise<PublicationDesMesures> {
  const pilote = await piloteDe(entrée.slug, db)
  if (pilote.sorte !== 'pilote') return pilote
  const mesures = await publierLesMesures({ organisationId: pilote.organisation.id, période: entrée.période, état: entrée.état }, db)
  return mesures > 0 ? { sorte: 'réglée', période: entrée.période, état: entrée.état, mesures } : { sorte: 'aucune' }
}

// ── L'écran « Marchés et niches » ───────────────────────────────────────────

/**
 * Les marchés de l'organisation de la session : les seules mesures publiées,
 * toutes périodes, d'où l'état de chaque segment se calcule. `null` hors de
 * l'espace réorganisé, sans mesure publiée, ou dans le doute. Aucune lecture
 * Notion, aucun appel aux registres depuis l'écran.
 *
 * `aperçu` (12 novembre 2026) : la session de l'opératrice (`accès.aperçu`,
 * privilège « Tous les espaces ») lit aussi les mesures proposées, pour les
 * relire dans l'espace avant de les publier ; jamais les retirées. `nonPublié`
 * dit alors que la période montrée n'est pas celle que le client voit, et
 * l'écran le signale. Un client ne passe jamais `aperçu`.
 */
export async function marchésDeLEspace(
  entrée: { readonly registre: string; readonly aperçu?: boolean },
  db?: Base,
): Promise<(VueDesMarchés & { readonly nonPublié: boolean }) | null> {
  return bornée('lecture des marchés', async () => {
    const organisation = await organisationDuRegistre(entrée.registre, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const mesures =
      entrée.aperçu === true
        ? (await mesuresVivantes({ organisationId: organisation.id }, db)).filter((m) => m.état !== 'retire')
        : await mesuresVivantes({ organisationId: organisation.id, publiées: true }, db)
    const vue = vueDesMarchés(versLesMesures(mesures))
    return vue ? { ...vue, nonPublié: mesures.some((m) => m.période === vue.période && m.état !== 'publie') } : null
  })
}
