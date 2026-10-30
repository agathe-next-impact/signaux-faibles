import { cache } from 'react'
import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée, type Base } from '@/lib/base/client'
import {
  dernièreSynthèsePubliée,
  enregistrerLaSynthèse,
  faitsConnus,
  faitsDeLaFenêtre,
  faitsDesÉditions,
  faitsDUneEntité,
  faitsParEntité,
  lireLaGrille,
  lireLaSynthèse,
  modifierUnÉnoncé,
  organisationPourLesOutils,
  positionsPubliées,
  posterLaGrille,
  périodesDesSynthèses,
  publierLaSynthèse,
  remplacerLesÉtiquettes,
  réglerLEspaceRéorganisé,
  réglerLesOutilsStratégiques,
  synthèsePrécédente,
  validerLaGrille,
  étatDeLÉtiquetage,
  type GrilleEnregistrée,
  type PositionÀEnregistrer,
  type ÉlémentÀEnregistrer,
} from '@/lib/base/strategie'
import { construireDocument, type Document } from '@/lib/domaine/document'
import { calculer, type Calculs, type Dépendances } from '@/lib/portail/calculs'
import {
  activitéParRubrique,
  activitéParSemaine,
  nomsDesConcurrents,
  pestelDesFaits,
  périodesAPublier,
  SEMAINES_D_ACTIVITÉ,
  vueDeLaChaleur,
  vueDeLAxe,
  vueDesIndicateurs,
  vueDeLaCarte,
  vueDeLaFiche,
  vueDesConcurrents,
  vueDeLaSwot,
  vueDeLaTows,
  vueDeMendelow,
  vueDesForces,
  vueDesScénarios,
  vueDuPestel,
  type CarteDeChaleur,
  type FicheDuConcurrent,
  type ForceLue,
  type SemaineDActivité,
  type VueDeLAxe,
  type VueDesIndicateurs,
  type ScénarioLu,
  type SynthèsesDUneOrganisation,
  type SynthèseVue,
  type VueDesConcurrents,
  type VueDeLaCarte,
  type VueDeLaSwot,
  type VueDeLaTows,
  type VueDeMendelow,
  type VueDuPestel,
} from '@/lib/domaine/strategie-vues'
import {
  contrôlerLaGrille,
  contrôlerLaSynthèse,
  contrôlerLesParamètresDuCycle,
  contrôlerLesÉtiquettes,
  contrôlerUnÉnoncé,
  empreinteDeLaGrille,
  faitsDeLaLettre,
  forcesNonSuivies,
  lectureDesÉtiquettes,
  messageDeRefus,
  normaliserTitre,
  rendreLaSynthèse,
  trousDuPestel,
  type CaseSwot,
  type LigneDeBenchmark,
  type ForcePorter,
  type Grille,
  type LectureDesÉtiquettes,
  type Pestel,
  type Refus,
  type ParamètresDuCycle,
  type SynthèseProposée,
  type ÉtiquetteProposée,
} from '@/lib/domaine/strategie'
import { sansAccent } from '@/lib/domaine/texte'
import { lireBlocsDePage, listerÉditionsPubliées } from '@/lib/notion/editions'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { lireÉditionDeTravail } from '@/lib/notion/travail'
import type { Défaut } from '@/lib/portail/etat'
import { identifiantAvecTirets } from '@/lib/portail/garde-veille'

/**
 * L'orchestration des outils stratégiques (lot 3 de
 * `docs/plan-outils-strategiques.md`) : le seul appelant de
 * `lib/base/strategie.ts` (`tests/architecture.test.ts`).
 *
 * Elle tient l'ordre que rien d'autre ne doit pouvoir contourner :
 *   1. l'organisation de la demande et son drapeau de pilote, dans Postgres,
 *      **avant** toute lecture Notion : une organisation hors du pilote ne coûte
 *      aucune requête Notion ;
 *   2. l'édition, par les lectures cachées existantes (règle 1), et sa relation
 *      `Organisation` rapportée à la ligne du registre de l'organisation
 *      (règle 2) ;
 *   3. la porte de `lib/domaine/strategie.ts` ;
 *   4. seulement alors, l'écriture.
 *
 * **Elle n'expire aucun tag.** Les étiquettes se posent après le lint (étape
 * 4bis de la tâche des lettres), qui vient d'expirer la page et de la relire :
 * l'entrée de cache est celle de la version contrôlée. Une lettre corrigée
 * repasse par le lint avant d'être ré-étiquetée. Ajouter ici un pouvoir
 * d'invalidation n'apporterait rien et en ferait un sixième à tenir.
 */

export type RésultatDesÉtiquettes =
  | {
      readonly sorte: 'accepté'
      readonly édition: string
      readonly faits: number
      readonly insérées: number
      readonly archivées: number
    }
  | { readonly sorte: 'refusé'; readonly refus: readonly Refus[]; readonly message: string; readonly faits: number }
  | {
      readonly sorte:
        | 'organisation-inconnue'
        | 'hors-pilote'
        | 'édition-introuvable'
        | 'organisation-différente'
        | 'organisations-multiples'
        | 'édition-sans-date'
    }

/**
 * Fait entrer une organisation dans le pilote, ou l'en fait sortir
 * (`PATCH /api/veille/organisations`, action `outils`). Ses lignes restent :
 * une organisation sortie du pilote garde ses étiquettes et ses synthèses, et
 * les retrouve si elle y revient.
 */
export async function réglerLePilote(
  entrée: { readonly slug: string; readonly actif: boolean },
  db?: Base,
): Promise<'réglé' | 'organisation-inconnue'> {
  return réglerLesOutilsStratégiques(entrée, db)
}

// ── La grille (lot 5) ────────────────────────────────────────────────────────

/** Ce que la grille laisse sans couverture : de quoi lire un PESTEL ou des cinq forces sans inventer de trou. */
type TrousDeLaGrille = { readonly trousDuPestel: readonly Pestel[]; readonly forcesNonSuivies: readonly ForcePorter[] }

export type RésultatDeLaGrille =
  | ({ readonly sorte: 'créée' | 'inchangée'; readonly version: number; readonly empreinte: string } & TrousDeLaGrille)
  | { readonly sorte: 'refusée'; readonly refus: readonly Refus[]; readonly message: string }
  | { readonly sorte: 'organisation-inconnue' | 'hors-pilote' }

/**
 * Reçoit la grille d'une organisation du pilote, rédigée dans son référentiel
 * (section « Grille stratégique ») et postée par la revue ou par la tâche qui
 * tient le référentiel. Le pilote est vérifié avant la porte, la porte avant
 * l'écriture ; le référentiel n'est pas lu (le portail n'y a pas accès), seul
 * son identifiant est gardé. La même grille re-postée ne crée pas de version.
 *
 * Une fois une grille postée, la porte des étiquettes refuse une entité qui
 * n'y figure pas (`entité-hors-grille`) : la grille doit nommer toutes celles
 * que les lettres suivent.
 */
export async function recevoirLaGrille(
  entrée: { readonly slug: string; readonly référentiel: string; readonly grille: Grille },
  db?: Base,
): Promise<RésultatDeLaGrille> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }

  const refus = contrôlerLaGrille(entrée.grille)
  if (refus.length > 0) return { sorte: 'refusée', refus, message: messageDeRefus(refus) }

  const écrit = await posterLaGrille(
    { organisationId: organisation.id, référentielNotion: normaliserIdentifiant(entrée.référentiel), grille: entrée.grille },
    db,
  )
  if (écrit.sorte === 'hors-pilote') return { sorte: 'hors-pilote' }
  return {
    sorte: écrit.sorte,
    version: écrit.version,
    empreinte: empreinteDeLaGrille(entrée.grille),
    trousDuPestel: trousDuPestel(entrée.grille),
    forcesNonSuivies: forcesNonSuivies(entrée.grille),
  }
}

export type LectureDeLaGrille =
  | ({ readonly sorte: 'lue' } & GrilleEnregistrée & TrousDeLaGrille)
  | { readonly sorte: 'aucune' | 'organisation-inconnue' | 'hors-pilote' }

/** La dernière version de la grille, telle que la revue la relit avant une synthèse. */
export async function lireLaGrilleDuPilote(entrée: { readonly slug: string }, db?: Base): Promise<LectureDeLaGrille> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const lue = await lireLaGrille(organisation.id, db)
  if (!lue) return { sorte: 'aucune' }
  return { sorte: 'lue', ...lue, trousDuPestel: trousDuPestel(lue.grille), forcesNonSuivies: forcesNonSuivies(lue.grille) }
}

/**
 * Pose la validation de la dernière version, une fois répondus les points de
 * validation de ses axes. Une version dépassée ne se valide pas : ses axes ne
 * sont plus ceux que la synthèse lira.
 */
export async function validerLaVersion(
  entrée: { readonly slug: string; readonly version: number },
  db?: Base,
): Promise<'validée' | 'déjà-validée' | 'version-dépassée' | 'aucune' | 'organisation-inconnue' | 'hors-pilote'> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return 'organisation-inconnue'
  if (!organisation.outilsStratégiques) return 'hors-pilote'
  const dernière = await lireLaGrille(organisation.id, db)
  if (!dernière) return 'aucune'
  if (dernière.version !== entrée.version) return 'version-dépassée'
  const résultat = await validerLaGrille({ organisationId: organisation.id, version: entrée.version }, db)
  return résultat === 'inconnue' ? 'aucune' : résultat
}

// ── La synthèse (lot 6) ──────────────────────────────────────────────────────

export type RésultatDeLaSynthèse =
  | {
      readonly sorte: 'enregistrée'
      readonly éléments: number
      readonly positions: number
      readonly archivés: number
      readonly avertissements: readonly Refus[]
    }
  | { readonly sorte: 'refusée'; readonly refus: readonly Refus[]; readonly message: string; readonly avertissements: readonly Refus[] }
  | {
      readonly sorte:
        | 'organisation-inconnue'
        | 'hors-pilote'
        | 'grille-absente'
        | 'grille-périmée'
        | 'fait-inconnu'
        | 'filiation-inconnue'
    }
  | { readonly sorte: 'référence-inconnue'; readonly référence: string }

/** Les éléments et positions à enregistrer, depuis la synthèse contrôlée par la porte. */
function àEnregistrer(synthèse: SynthèseProposée): { éléments: ÉlémentÀEnregistrer[]; positions: PositionÀEnregistrer[] } {
  const éléments: ÉlémentÀEnregistrer[] = []
  for (const l of synthèse.pestel) {
    éléments.push({ outil: 'pestel', clé: `pestel:${l.lettre}`, rang: 1, énoncé: l.énoncé, faits: l.faits })
  }
  const rangs = new Map<string, number>()
  const rangSuivant = (clé: string) => {
    const r = (rangs.get(clé) ?? 0) + 1
    rangs.set(clé, r)
    return r
  }
  for (const é of synthèse.swot) {
    éléments.push({
      outil: 'swot',
      clé: é.case,
      rang: rangSuivant(`swot:${é.case}`),
      énoncé: é.énoncé,
      état: é.état,
      origine: é.origine,
      hypothèse: é.hypothèse,
      filiation: é.filiation ?? null,
      faits: é.faits,
      ...(é.référenceFiche ? { références: { fiche: é.référenceFiche } } : {}),
      idProvisoire: é.id,
    })
  }
  for (const o of synthèse.tows) {
    éléments.push({
      outil: 'tows',
      clé: o.type,
      rang: rangSuivant(`tows:${o.type}`),
      énoncé: o.énoncé,
      faits: [],
      croise: o.éléments,
      candidateRecommandation: o.candidate,
    })
  }
  ;(synthèse.scénarios ?? []).forEach((s, i) => {
    éléments.push({
      outil: 'scenario',
      clé: `scenario-${i + 1}`,
      rang: 1,
      énoncé: s.énoncé,
      faits: s.faits,
      références: { titre: s.titre, indicateurs: s.indicateurs },
    })
  })
  for (const it of synthèse.interprétations ?? []) {
    éléments.push({ outil: it.outil, clé: it.outil, rang: 1, énoncé: it.énoncé, faits: [] })
  }
  const positions: PositionÀEnregistrer[] = synthèse.positions.map((p) => ({
    outil: p.outil,
    sujet: p.sujet,
    axe: p.axe,
    cran: p.nonSuivi ? null : p.cran,
    nonSuivi: p.nonSuivi ?? false,
    tendance: p.tendance ?? null,
    faits: p.faits,
    origine: p.origine === 'declaratif' ? 'declaratif' : 'faits',
    référence: p.origine === 'declaratif' ? (p.référence?.trim() ?? null) : null,
  }))
  return { éléments, positions }
}

/**
 * Pose les chiffres calculés sur les éléments d'interprétation : l'énoncé vient
 * du modèle, la valeur du portail. Un chiffre sans interprétation est gardé
 * quand même, sans énoncé, pour la relecture.
 */
function avecLesCalculs(éléments: readonly ÉlémentÀEnregistrer[], calculs: Calculs): ÉlémentÀEnregistrer[] {
  const valeurs = new Map<string, Record<string, unknown>>([['benchmark', { ...calculs.benchmark }]])
  if (calculs.indice) valeurs.set('indice_cycle', { ...calculs.indice })
  const posés = éléments.map((é) => (valeurs.has(é.outil) ? { ...é, valeur: valeurs.get(é.outil)! } : é))
  for (const [outil, valeur] of valeurs) {
    if (!posés.some((é) => é.outil === outil)) posés.push({ outil: outil as ÉlémentÀEnregistrer['outil'], clé: outil, rang: 1, énoncé: null, faits: [], valeur })
  }
  return posés
}

/**
 * Reçoit la synthèse d'une période (revue mensuelle, section « Synthèse
 * stratégique »). Le pilote et la grille sont vérifiés avant la porte ; la
 * porte reçoit les faits cités tels que la base les connaît, la synthèse
 * précédente de même granularité (filiations, mouvements de crans) et la
 * dernière grille ; l'écriture ne vient qu'après, et revérifie dans sa
 * transaction ce qui a pu changer. Aucune lecture Notion : une synthèse ne
 * cite que des faits déjà étiquetés.
 */
export async function recevoirLaSynthèse(
  entrée: {
    readonly slug: string
    readonly période: string
    readonly fenêtre: { readonly début: string; readonly fin: string }
    readonly synthèse: SynthèseProposée
    /** Trimestre seulement : les départements et le texte d'activité de l'indice de cycle de vie. */
    readonly cycle?: ParamètresDuCycle | null
  },
  db?: Base,
  dépendances: Dépendances = {},
): Promise<RésultatDeLaSynthèse> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const grille = await lireLaGrille(organisation.id, db)
  if (!grille) return { sorte: 'grille-absente' }

  const s = entrée.synthèse
  const cités = [
    ...s.pestel.flatMap((l) => l.faits),
    ...s.swot.flatMap((é) => é.faits),
    ...s.positions.flatMap((p) => p.faits),
    ...(s.scénarios ?? []).flatMap((x) => x.faits),
  ]
  const [faits, précédente] = await Promise.all([
    faitsConnus({ organisationId: organisation.id, ids: cités }, db),
    synthèsePrécédente({ organisationId: organisation.id, période: entrée.période }, db),
  ])
  const élémentsPrécédents = new Map<string, CaseSwot>()
  const positionsPrécédentes = new Map<string, number | null>()
  for (const é of précédente?.éléments ?? []) if (é.outil === 'swot') élémentsPrécédents.set(é.id, é.clé as CaseSwot)
  for (const p of précédente?.positions ?? []) positionsPrécédentes.set(`${p.outil}:${normaliserTitre(p.sujet)}:${p.axe}`, p.cran)

  const porte = contrôlerLaSynthèse(s, {
    faits,
    fenêtre: entrée.fenêtre,
    grille: grille.grille,
    grilleVersion: grille.version,
    élémentsPrécédents,
    positionsPrécédentes,
    revueAnnuelle: /-T4$/.test(entrée.période),
  })
  const refusDuCycle: readonly Refus[] = !entrée.cycle
    ? []
    : s.mode === 'trimestriel'
      ? contrôlerLesParamètresDuCycle(entrée.cycle)
      : [{ code: 'hors-période', message: 'l’indice de cycle de vie se calcule au trimestre', cible: 'cycle' }]
  const contrôle = { refus: [...porte.refus, ...refusDuCycle], avertissements: porte.avertissements }
  if (contrôle.refus.length > 0) {
    return { sorte: 'refusée', refus: contrôle.refus, message: messageDeRefus(contrôle.refus), avertissements: contrôle.avertissements }
  }

  const { éléments: énoncés, positions } = àEnregistrer(s)
  // Les chiffres du trimestre, calculés après la porte : une synthèse refusée ne
  // coûte aucun appel aux registres.
  const éléments =
    s.mode === 'trimestriel'
      ? avecLesCalculs(
          énoncés,
          await calculer({ grille: grille.grille, organisation: organisation.nom, fin: entrée.fenêtre.fin, cycle: entrée.cycle ?? null }, dépendances),
        )
      : énoncés
  const écrit = await enregistrerLaSynthèse(
    { organisationId: organisation.id, période: entrée.période, fenêtre: entrée.fenêtre, grilleVersion: s.grilleVersion, éléments, positions },
    db,
  )
  if (écrit.sorte !== 'enregistrée') return écrit
  return { ...écrit, avertissements: contrôle.avertissements }
}

export type LectureDeLaSynthèse =
  | {
      readonly sorte: 'lue'
      readonly période: string
      readonly fenêtre: { readonly début: string; readonly fin: string }
      readonly grilleVersion: number
      readonly éléments: number
      readonly positions: number
      readonly texte: string
      /** Les éléments SWOT par leur identifiant : la `filiation` du mois suivant les désigne ainsi. */
      readonly swot: readonly { readonly id: string; readonly case: CaseSwot; readonly rang: number; readonly énoncé: string | null; readonly état: string | null }[]
      /** Les crans posés : le mois suivant ne les bouge qu'avec un fait de sa fenêtre. */
      readonly crans: readonly { readonly outil: string; readonly sujet: string; readonly axe: string; readonly cran: number | null }[]
    }
  | { readonly sorte: 'aucune' | 'organisation-inconnue' | 'hors-pilote' }

/** La synthèse vivante d'une période, rendue en texte pour le courriel « [Relecture] ». */
export async function lireLaSynthèseDuPilote(
  entrée: { readonly slug: string; readonly période: string },
  db?: Base,
): Promise<LectureDeLaSynthèse> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const lue = await lireLaSynthèse({ organisationId: organisation.id, période: entrée.période }, db)
  const premier = lue.éléments[0] ?? null
  if (!premier && lue.positions.length === 0) return { sorte: 'aucune' }

  const grilleVersion = premier?.grilleVersion ?? lue.positions[0]!.grilleVersion
  const grille = await lireLaGrille(organisation.id, db)
  const cités = [...lue.éléments.flatMap((é) => é.faits), ...lue.positions.flatMap((p) => p.faits)]
  const faits = await faitsConnus({ organisationId: organisation.id, ids: cités }, db)
  const fenêtre = premier ? { début: premier.fenêtreDébut, fin: premier.fenêtreFin } : { début: '', fin: '' }
  const texte = rendreLaSynthèse({
    organisation: entrée.slug,
    période: entrée.période,
    fenêtre,
    grilleVersion,
    grille: grille?.grille ?? { axesGroupes: [], familles: [], entités: [], partiesPrenantes: [] },
    éléments: lue.éléments,
    positions: lue.positions,
    faits,
  })
  return {
    sorte: 'lue',
    période: entrée.période,
    fenêtre,
    grilleVersion,
    éléments: lue.éléments.length,
    positions: lue.positions.length,
    texte,
    swot: lue.éléments
      .filter((é) => é.outil === 'swot')
      .map((é) => ({ id: é.id, case: é.clé as CaseSwot, rang: é.rang, énoncé: é.énoncé, état: é.état })),
    crans: lue.positions.map((p) => ({ outil: p.outil, sujet: p.sujet, axe: p.axe, cran: p.cran })),
  }
}

/** `Écosystème` devient `ecosysteme` : la clé interne, sans accent, comme dans le domaine. */
function familleNormalisée(famille: string | null): string | null {
  const f = famille?.trim()
  return f ? sansAccent(f).toLowerCase() : null
}

/**
 * Reçoit le lot d'étiquettes d'une édition, le passe à la porte et, s'il est
 * accepté entier, remplace les étiquettes précédentes de cette édition. Un lot
 * refusé n'écrit rien et rend le message de reprise, dans le format du moteur.
 */
export async function recevoirLesÉtiquettes(
  entrée: { readonly slug: string; readonly page: string; readonly lot: readonly ÉtiquetteProposée[] },
  db?: Base,
  maintenant: Date = new Date(),
): Promise<RésultatDesÉtiquettes> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }

  const pageId = identifiantAvecTirets(entrée.page)
  const édition = await lireÉditionDeTravail(pageId)
  if (!édition) return { sorte: 'édition-introuvable' }

  // Règle 2 : la relation de l'édition est une liste ; on ne lit jamais son
  // premier élément. Plusieurs organisations sur une édition sont une anomalie,
  // jamais une donnée à interpréter.
  const organisations = [...new Set(édition.organisationIds.map(normaliserIdentifiant))]
  if (!organisation.registreNotion || !organisations.includes(organisation.registreNotion)) {
    console.warn(`[stratégie] ${entrée.slug} : l’édition ${pageId} ne porte pas son organisation.`)
    return { sorte: 'organisation-différente' }
  }
  if (organisations.length > 1) {
    console.error(`[stratégie] ${entrée.slug} : l’édition ${pageId} porte ${organisations.length} organisations.`)
    return { sorte: 'organisations-multiples' }
  }
  if (!édition.dateÉdition) return { sorte: 'édition-sans-date' }

  const [blocs, grille] = await Promise.all([lireBlocsDePage(pageId), lireLaGrille(organisation.id, db)])
  const contrôle = contrôlerLesÉtiquettes({
    blocs,
    dateÉdition: édition.dateÉdition,
    lot: entrée.lot,
    entités: grille ? grille.grille.entités.map((e) => e.nom) : null,
  })
  if (contrôle.refus.length > 0) {
    return { sorte: 'refusé', refus: contrôle.refus, message: messageDeRefus(contrôle.refus), faits: contrôle.faits }
  }

  const écrit = await remplacerLesÉtiquettes(
    {
      organisationId: organisation.id,
      édition: { notion: normaliserIdentifiant(pageId), famille: familleNormalisée(édition.famille), date: édition.dateÉdition },
      étiquettes: contrôle.acceptées,
    },
    db,
    maintenant,
  )
  if (écrit.sorte !== 'enregistré') return { sorte: écrit.sorte }
  return { sorte: 'accepté', édition: normaliserIdentifiant(pageId), faits: contrôle.faits, insérées: écrit.insérées, archivées: écrit.archivées }
}

/** Un fait tel que la revue le lit : ses étiquettes, et sa phrase-titre relue dans la lettre. */
export type FaitPourLaRevue = {
  readonly id: string
  readonly édition: string
  readonly dateÉdition: string
  readonly famille: string | null
  readonly section: 'axe' | 'acteurs'
  readonly axe: number | null
  readonly rang: number
  /**
   * La phrase-titre, relue dans la lettre en cache. Nulle si la lettre a changé
   * depuis l'étiquetage (empreinte différente) ou ne se lit plus : la revue
   * dispose alors des étiquettes seules, et le signale.
   */
  readonly titre: string | null
  readonly date: string
  readonly source: string
  readonly pestel: string | null
  readonly porter: string | null
  readonly ansoff: string | null
  readonly entite: string | null
  readonly rupture: boolean
  readonly impact: string
  readonly nouveaute: string
}

export type LectureDesFaits =
  | { readonly sorte: 'lu'; readonly faits: readonly FaitPourLaRevue[]; readonly titresIntrouvables: number }
  | { readonly sorte: 'organisation-inconnue' | 'hors-pilote' }

/**
 * Les faits étiquetés des éditions parues dans la fenêtre, pour la revue
 * mensuelle. Postgres ne garde que l'empreinte des phrases-titres : elles sont
 * relues dans les lettres, par la lecture cachée des corps (règle 1), une
 * lecture par édition et non par fait. Les éditions lues sont celles que la
 * base a rattachées à l'organisation à l'écriture, après la vérification de la
 * règle 2 ; aucune n'est désignée par l'appelant.
 */
export async function lireLesFaits(
  entrée: { readonly slug: string; readonly début: string; readonly fin: string },
  db?: Base,
): Promise<LectureDesFaits> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }

  const lignes = await faitsDeLaFenêtre({ organisationId: organisation.id, début: entrée.début, fin: entrée.fin }, db)
  const éditions = [...new Set(lignes.map((l) => l.éditionNotion))]
  const titres = new Map<string, Map<string, { titre: string; empreinte: string }>>()
  await Promise.all(
    éditions.map(async (édition) => {
      try {
        const faits = faitsDeLaLettre(construireDocument(await lireBlocsDePage(identifiantAvecTirets(édition))))
        titres.set(édition, new Map(faits.map((f) => [`${f.section}:${f.axe ?? 0}:${f.rang}`, { titre: f.titre, empreinte: f.empreinte }])))
      } catch (erreur) {
        console.warn(`[stratégie] ${entrée.slug} : l’édition ${édition} ne se lit pas (${erreur instanceof Error ? erreur.name : 'erreur'}).`)
      }
    }),
  )

  let titresIntrouvables = 0
  const faits = lignes.map((l): FaitPourLaRevue => {
    const relu = titres.get(l.éditionNotion)?.get(`${l.section}:${l.numéroAxe ?? 0}:${l.rang}`)
    const titre = relu && relu.empreinte === l.empreinteTitre ? relu.titre : null
    if (titre === null) titresIntrouvables++
    return {
      id: l.id,
      édition: l.éditionNotion,
      dateÉdition: l.dateÉdition,
      famille: l.familleÉdition,
      section: l.section,
      axe: l.numéroAxe,
      rang: l.rang,
      titre,
      date: l.dateFait,
      source: l.sourceUrl,
      pestel: l.pestel,
      porter: l.forcePorter,
      ansoff: l.ansoff,
      entite: l.entité,
      rupture: l.rupture,
      impact: l.impact,
      nouveaute: l.nouveauté,
    }
  })
  return { sorte: 'lu', faits, titresIntrouvables }
}

/**
 * Le contrôle du soir des étiquettes (lot 4) : pour chaque organisation du
 * pilote, les éditions publiées depuis la première étiquetée qui n'ont pas
 * d'étiquettes. Avant la première, rien n'est dû : le pilote n'a pas commencé
 * pour elle. Les éditions publiées sont celles que la route du soir a déjà lues
 * (`lettresParRegistre`, par registre sans tirets) ; à défaut, elles sont lues
 * ici, par la même fonction cachée et la clé de cloisonnement de
 * l'organisation (règles 1 et 2).
 *
 * Une lettre dont tous les axes sont RAS n'a aucun fait à étiqueter, et son lot
 * vide ne laisse pas de trace : elle apparaîtrait ici. Le message le dit.
 */
export async function contrôlerLÉtiquetage(
  lettresParRegistre: ReadonlyMap<string, readonly { readonly pageId: string; readonly dateÉdition: string }[]>,
  db?: Base,
): Promise<Défaut[]> {
  const défauts: Défaut[] = []
  for (const o of await étatDeLÉtiquetage(db)) {
    if (!o.registreNotion || !o.première) continue
    const lettres = lettresParRegistre.get(o.registreNotion) ?? (await listerÉditionsPubliées(o.registreNotion))
    const manquantes = lettres.filter((l) => l.dateÉdition >= o.première! && !o.éditions.has(normaliserIdentifiant(l.pageId)))
    if (manquantes.length === 0) continue
    const dates = manquantes.map((l) => l.dateÉdition).sort()
    défauts.push({
      slug: o.slug,
      code: 'étiquettes-manquantes',
      message:
        `${manquantes.length === 1 ? 'une édition publiée n’a pas d’étiquettes' : `${manquantes.length} éditions publiées n’ont pas d’étiquettes`} ` +
        `(du ${dates[0]} au ${dates.at(-1)}) : relancer l’étape 4ter, ou « pnpm tache etiquetage --organisation ${o.slug} ». ` +
        'Une lettre dont tous les axes sont RAS n’a rien à étiqueter et figure ici à tort.',
    })
  }
  return défauts
}

/** Au-delà, la section n'est pas montrée : une page ne doit pas attendre la base. */
export const DÉLAI_DE_LECTURE_STRATÉGIQUE_MS = 400

/**
 * La même borne pour « Acteurs », « Recommandations » et l'onglet PESTEL
 * (29 octobre 2026). À 400 ms, la recette sur L'Hermitage a montré que la
 * synthèse publiée et l'onglet PESTEL n'étaient jamais affichés en production :
 * l'ouverture de la connexion à Neon depuis une fonction Vercel, puis quatre à
 * cinq allers-retours, dépassent ce délai. Ces sections sont l'objet de l'écran
 * pour une organisation du pilote ; la vue d'ensemble garde 400 ms.
 */
export const DÉLAI_DES_ÉCRANS_STRATÉGIQUES_MS = 1500

/**
 * La lecture stratégique d'un espace, pour la vue d'ensemble (26 octobre 2026) :
 * les étiquettes des lettres que l'écran vient de lire, agrégées. **Seulement
 * pour une organisation du pilote** ; ailleurs, et dans tout doute (base absente,
 * `SOURCE_ACCES=notion`, base lente ou en panne), rien : la section n'apparaît
 * pas, et l'écran reste celui d'avant.
 *
 * Aucune lecture Notion : les phrases-titres des ruptures sont relues dans les
 * documents que l'écran a déjà en main, par leur empreinte. Les éditions sont
 * celles que l'écran a lues pour la clé de cloisonnement de la session
 * (règle 2), et la base ne rend que les faits de cette organisation.
 */
export async function lectureStratégiqueDeLEspace(
  entrée: {
    readonly registre: string
    readonly lettres: readonly { readonly pageId: string; readonly document: Document }[]
  },
  db?: Base,
): Promise<LectureDesÉtiquettes | null> {
  if (!baseConfigurée() || sourceAccès() === 'notion' || entrée.lettres.length === 0) return null
  let minuterie: ReturnType<typeof setTimeout> | undefined
  const délai = new Promise<null>((résoudre) => {
    minuterie = setTimeout(() => résoudre(null), DÉLAI_DE_LECTURE_STRATÉGIQUE_MS)
  })
  try {
    const lecture = (async () => {
      const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
      if (!organisation?.outilsStratégiques) return null
      const éditions = entrée.lettres.map((l) => normaliserIdentifiant(l.pageId))
      const lignes = await faitsDesÉditions({ organisationId: organisation.id, éditions }, db)
      if (lignes.length === 0) return null
      const titres = new Map<string, string>()
      for (const l of entrée.lettres) {
        for (const f of faitsDeLaLettre(l.document)) titres.set(`${normaliserIdentifiant(l.pageId)}:${f.empreinte}`, f.titre)
      }
      return lectureDesÉtiquettes(
        lignes.map((l) => ({
          pestel: l.pestel,
          porter: l.forcePorter,
          ansoff: l.ansoff,
          entite: l.entité,
          rupture: l.rupture,
          date: l.dateFait,
          source: l.sourceUrl,
          titre: titres.get(`${l.éditionNotion}:${l.empreinteTitre}`) ?? null,
        })),
      )
    })()
    // Une lecture qui finit après le délai ne doit pas lever sans personne pour l'écouter.
    lecture.catch(() => undefined)
    const résultat = await Promise.race([lecture.then((r) => ({ r })), délai])
    if (résultat === null) {
      console.warn(`[stratégie] lecture de l’espace en plus de ${DÉLAI_DE_LECTURE_STRATÉGIQUE_MS} ms, section non montrée.`)
      return null
    }
    return résultat.r
  } catch (erreur) {
    console.warn(`[stratégie] lecture de l’espace impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return null
  } finally {
    clearTimeout(minuterie)
  }
}

export type LectureDesCalculs =
  | ({ readonly sorte: 'calculé'; readonly grilleVersion: number } & Calculs)
  | { readonly sorte: 'organisation-inconnue' | 'hors-pilote' | 'grille-absente' }
  | { readonly sorte: 'refusée'; readonly refus: readonly Refus[] }

/**
 * Les chiffres du trimestre, pour que la revue en écrive l'interprétation avant
 * de poster (`GET /api/veille/calculs`). N'écrit rien : la synthèse postée les
 * recalcule et les garde.
 */
export async function lireLesCalculs(
  entrée: { readonly slug: string; readonly fin: string; readonly cycle: ParamètresDuCycle | null },
  db?: Base,
  dépendances: Dépendances = {},
): Promise<LectureDesCalculs> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  if (entrée.cycle) {
    const refus = contrôlerLesParamètresDuCycle(entrée.cycle)
    if (refus.length > 0) return { sorte: 'refusée', refus }
  }
  const grille = await lireLaGrille(organisation.id, db)
  if (!grille) return { sorte: 'grille-absente' }
  const calculs = await calculer({ grille: grille.grille, organisation: organisation.nom, fin: entrée.fin, cycle: entrée.cycle }, dépendances)
  return { sorte: 'calculé', grilleVersion: grille.version, ...calculs }
}

// ── Écrans du client (lot 11) ────────────────────────────────────────────────

export type RésultatDeLaPublication =
  | { readonly sorte: 'publiée' | 'retirée' | 'proposée'; readonly éléments: number; readonly positions: number }
  | { readonly sorte: 'organisation-inconnue' | 'hors-pilote' | 'aucune' }

/**
 * Les périodes de synthèse de toutes les organisations du pilote, pour le
 * tableau de l'opératrice (29 octobre 2026). Traverse les clients : sa garde est
 * dans `listerLesSynthèses` (`lib/auth/appartenance.ts`), son seul appelant
 * (`tests/architecture.test.ts`). Des comptes et des états, jamais un énoncé.
 */
export async function tableauDesSynthèses(db?: Base): Promise<SynthèsesDUneOrganisation[]> {
  return périodesAPublier(await périodesDesSynthèses(db))
}

/**
 * Le geste de l'opératrice après relecture : publier la synthèse d'une période,
 * la retirer, ou la remettre en proposition. Les écrans du client ne lisent que
 * ce qui est publié.
 */
export async function publierLaSynthèseDuPilote(
  entrée: { readonly slug: string; readonly période: string; readonly état: 'publie' | 'retire' | 'propose' },
  db?: Base,
): Promise<RésultatDeLaPublication> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const r = await publierLaSynthèse({ organisationId: organisation.id, période: entrée.période, état: entrée.état }, db)
  if (r.éléments + r.positions === 0) return { sorte: 'aucune' }
  return { sorte: entrée.état === 'publie' ? 'publiée' : entrée.état === 'retire' ? 'retirée' : 'proposée', ...r }
}

// ── Relecture avant publication ──────────────────────────────────────────────

/** Un élément d'une période, tel que l'opératrice le relit et le retouche. */
export type ÉlémentÀRelire = {
  readonly id: string
  readonly outil: string
  readonly clé: string
  readonly rang: number
  readonly énoncé: string | null
  /** Le titre d'un scénario, sinon `null`. */
  readonly titre: string | null
  readonly origine: string
  readonly candidate: boolean
  readonly faits: number
}

export type SynthèseÀRelire =
  | {
      readonly sorte: 'lue'
      readonly nom: string
      readonly période: string
      /** `true` dès qu'une ligne est publiée : la période ne se retouche plus sans être retirée. */
      readonly publiée: boolean
      readonly éléments: readonly ÉlémentÀRelire[]
    }
  | { readonly sorte: 'aucune' | 'organisation-inconnue' | 'hors-pilote' }

/**
 * Les éléments d'une période pour la page de relecture de l'opératrice
 * (30 octobre 2026). Cette lecture n'est faite que derrière
 * `lireUneSynthèseÀRelire` (`lib/auth/appartenance.ts`), qui vérifie le
 * privilège avant ; `tests/architecture.test.ts` tient ce seul appelant.
 */
export async function synthèseÀRelire(entrée: { readonly slug: string; readonly période: string }, db?: Base): Promise<SynthèseÀRelire> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const lue = await lireLaSynthèse({ organisationId: organisation.id, période: entrée.période }, db)
  if (lue.éléments.length === 0 && lue.positions.length === 0) return { sorte: 'aucune' }
  return {
    sorte: 'lue',
    nom: organisation.nom,
    période: entrée.période,
    publiée: [...lue.éléments, ...lue.positions].some((l) => l.étatPublication === 'publie'),
    éléments: lue.éléments.map((é) => ({
      id: é.id,
      outil: é.outil,
      clé: é.clé,
      rang: é.rang,
      énoncé: é.énoncé,
      titre: é.outil === 'scenario' && typeof é.références['titre'] === 'string' ? é.références['titre'] : null,
      origine: é.origine,
      candidate: é.candidateRecommandation,
      faits: é.faits.length,
    })),
  }
}

export type RésultatDeLaModification =
  | { readonly sorte: 'modifié' }
  | { readonly sorte: 'refusé'; readonly refus: readonly Refus[] }
  | { readonly sorte: 'introuvable' | 'sans-énoncé' | 'déjà-publiée' | 'organisation-inconnue' | 'hors-pilote' }

/**
 * Retouche l'énoncé d'un élément d'une période non publiée (30 octobre 2026) :
 * la page de relecture de l'opératrice et `PATCH /api/veille/syntheses`. Le
 * pilote d'abord, la porte de l'énoncé ensuite, l'écriture en dernier ; une
 * période dont une ligne est publiée est refusée (`déjà-publiée`).
 */
export async function modifierLÉnoncéDuPilote(
  entrée: { readonly slug: string; readonly période: string; readonly élément: string; readonly énoncé: string; readonly titre?: string | null },
  db?: Base,
): Promise<RésultatDeLaModification> {
  const organisation = await organisationPourLesOutils({ slug: entrée.slug }, db)
  if (!organisation) return { sorte: 'organisation-inconnue' }
  if (!organisation.outilsStratégiques) return { sorte: 'hors-pilote' }
  const lue = await lireLaSynthèse({ organisationId: organisation.id, période: entrée.période }, db)
  const élément = lue.éléments.find((é) => é.id === entrée.élément)
  if (!élément) return { sorte: 'introuvable' }
  const énoncé = entrée.énoncé.trim()
  const titre = entrée.titre == null ? null : entrée.titre.trim()
  const refus = contrôlerUnÉnoncé({ outil: élément.outil, énoncé, titre })
  if (refus.length > 0) return { sorte: 'refusé', refus }
  const r = await modifierUnÉnoncé({ organisationId: organisation.id, période: entrée.période, élémentId: élément.id, énoncé, titre }, db)
  return r.sorte === 'modifié' ? { sorte: 'modifié' } : r
}

/** Une lecture bornée dans le temps : `null` au-delà du délai, ou sur toute erreur, sans faire tomber l'écran. */
export async function bornée<T>(nom: string, lecture: () => Promise<T | null>, ms: number = DÉLAI_DES_ÉCRANS_STRATÉGIQUES_MS): Promise<T | null> {
  if (!baseConfigurée() || sourceAccès() === 'notion') return null
  let minuterie: ReturnType<typeof setTimeout> | undefined
  const délai = new Promise<null>((résoudre) => {
    minuterie = setTimeout(() => résoudre(null), ms)
  })
  try {
    const promesse = lecture()
    promesse.catch(() => undefined)
    const r = await Promise.race([promesse.then((x) => ({ x })), délai])
    if (r === null) {
      console.warn(`[stratégie] ${nom} en plus de ${ms} ms, section non montrée.`)
      return null
    }
    return r.x
  } catch (erreur) {
    console.warn(`[stratégie] ${nom} impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return null
  } finally {
    clearTimeout(minuterie)
  }
}

/** Ce que les écrans du client lisent d'une synthèse publiée ; le type vit avec les vues. */
export type SynthèseDeLEspace = SynthèseVue

/**
 * La dernière synthèse **publiée** de l'organisation de la session, mise en
 * vues pour « Acteurs » et « Recommandations » (lot 11). La clé est le registre
 * de la session, comme pour la lecture stratégique de la vue d'ensemble : la base
 * ne rend que les lignes de cette organisation. Hors du pilote, sans synthèse
 * publiée, ou dans le doute : `null`, et l'écran reste celui d'avant. Aucune
 * lecture Notion ; `numéros` vient de la liste des éditions que l'écran a déjà.
 */
export async function synthèseDeLEspace(
  entrée: { readonly registre: string; readonly numéros: ReadonlyMap<string, number> },
  db?: Base,
): Promise<SynthèseDeLEspace | null> {
  return bornée('lecture de la synthèse publiée', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques) return null
    const [mois, trimestre, grille] = await Promise.all([
      dernièreSynthèsePubliée({ organisationId: organisation.id, granularité: 'mois' }, db),
      dernièreSynthèsePubliée({ organisationId: organisation.id, granularité: 'trimestre' }, db),
      lireLaGrille(organisation.id, db),
    ])
    if (!mois && !trimestre) return null
    // La synthèse précédente et les faits cités ne dépendent que du mois : en parallèle.
    const cités = [...(mois?.éléments ?? []), ...(mois?.positions ?? [])].flatMap((x) => x.faits)
    const [précédente, connus] = await Promise.all([
      mois ? dernièreSynthèsePubliée({ organisationId: organisation.id, granularité: 'mois', avant: mois.période }, db) : null,
      faitsConnus({ organisationId: organisation.id, ids: cités }, db),
    ])
    const faits = new Map([...connus].map(([id, f]) => [id, { date: f.date, édition: f.édition ?? '' }]))
    const numéros = new Map([...entrée.numéros].map(([page, n]) => [normaliserIdentifiant(page), n]))
    const vueDuMois = mois
      ? (() => {
          const { swot, codes } = vueDeLaSwot(mois.éléments, faits, numéros)
          return {
            période: mois.période,
            carte: grille ? vueDeLaCarte(grille.grille, mois.positions, précédente?.positions ?? [], organisation.nom, faits) : null,
            mendelow: vueDeMendelow(mois.positions, précédente?.positions ?? [], faits),
            swot,
            tows: vueDeLaTows(mois.éléments, codes),
          }
        })()
      : null
    return {
      mois: vueDuMois,
      trimestre: trimestre
        ? {
            période: trimestre.période,
            forces: vueDesForces(trimestre.positions),
            scénarios: vueDesScénarios(trimestre.éléments),
            indicateurs: vueDesIndicateurs(trimestre.période, trimestre.éléments),
          }
        : null,
    }
  })
}

/** Treize semaines : la fenêtre de l'onglet PESTEL, qui finit à la dernière lettre publiée. */
export const FENÊTRE_DU_PESTEL_JOURS = 91

/**
 * L'onglet PESTEL de « Les axes » (lot 11) : les faits étiquetés des treize
 * dernières semaines, comptés par dimension et par mois, et cités quand l'écran
 * a déjà lu leur lettre (`lettres`, les documents de la semaine et de la
 * précédente). Hors du pilote, sans grille ou sans fait : `null`.
 */
export async function pestelDeLEspace(
  entrée: { readonly registre: string; readonly fin: string; readonly lettres: readonly { readonly pageId: string; readonly document: Document }[] },
  db?: Base,
): Promise<VueDuPestel | null> {
  return bornée('lecture de l’onglet PESTEL', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques) return null
    const fin = entrée.fin
    const d = new Date(`${fin}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (FENÊTRE_DU_PESTEL_JOURS - 1))
    const début = d.toISOString().slice(0, 10)
    const [lignes, grille] = await Promise.all([faitsDeLaFenêtre({ organisationId: organisation.id, début, fin }, db), lireLaGrille(organisation.id, db)])
    if (!grille || lignes.length === 0) return null
    const titres = new Map<string, string>()
    const noms = new Map<string, string>()
    const familleDeLÉdition = new Map(lignes.map((l) => [l.éditionNotion, l.familleÉdition]))
    for (const l of entrée.lettres) {
      const page = normaliserIdentifiant(l.pageId)
      for (const f of faitsDeLaLettre(l.document)) titres.set(`${page}:${f.empreinte}`, f.titre)
      const famille = sansAccent(familleDeLÉdition.get(page) ?? '').toLowerCase()
      const veille = famille.startsWith('eco') ? 'ecosysteme' : famille.startsWith('conc') ? 'concurrentiel' : null
      if (!veille) continue
      for (const r of l.document.rubriques) for (const axe of r.axes) if (axe.numéro !== null) noms.set(`${veille}:${axe.numéro}`, axe.titre)
    }
    return vueDuPestel(
      lignes.map((l) => ({
        pestel: l.pestel,
        rupture: l.rupture,
        dateÉdition: l.dateÉdition,
        dateFait: l.dateFait,
        édition: l.éditionNotion,
        famille: l.familleÉdition,
        axe: l.numéroAxe,
        titre: titres.get(`${l.éditionNotion}:${l.empreinteTitre}`) ?? null,
        source: l.sourceUrl,
      })),
      grille.grille,
      noms,
      { début, fin },
    )
  })
}

// ── L'espace réorganisé (lot 2, 30 octobre 2026) ─────────────────────────────

/**
 * Ouvre ou referme l'espace réorganisé d'une organisation
 * (`PATCH /api/veille/organisations`, action `espace`). Refusé hors du pilote
 * des outils : les écrans par outil lisent la grille et les synthèses.
 */
export async function réglerLEspace(
  entrée: { readonly slug: string; readonly actif: boolean },
  db?: Base,
): Promise<'réglé' | 'organisation-inconnue' | 'hors-pilote'> {
  return réglerLEspaceRéorganisé(entrée, db)
}

export type EspaceDeLOrganisation = {
  readonly réorganisé: boolean
  /** Les concurrents de la grille, l'organisation exclue : ce qu'« Acteurs » laisse à « Concurrents ». */
  readonly concurrents: readonly string[]
}

const NON_RÉORGANISÉ: EspaceDeLOrganisation = { réorganisé: false, concurrents: [] }

/**
 * L'espace de l'organisation de la session est-il réorganisé ? Le rail le
 * demande à chaque page, « Acteurs » aussi : la lecture est **mémoïsée par
 * requête**, et bornée à 400 ms comme le droit de lecture. `null` dans le doute
 * (base absente, `SOURCE_ACCES=notion`, base lente) : le rail garde alors ses
 * sept écrans, et un écran par outil le dit plutôt que de répondre 404.
 */
export async function espaceDeLOrganisation(registre: string, db?: Base): Promise<EspaceDeLOrganisation | null> {
  return espaceMémoïsé(normaliserIdentifiant(registre), db)
}

const espaceMémoïsé = cache(async (registre: string, db?: Base): Promise<EspaceDeLOrganisation | null> =>
  bornée(
    'lecture de l’espace réorganisé',
    async () => {
      const organisation = await organisationPourLesOutils({ registreNotion: registre }, db)
      if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return NON_RÉORGANISÉ
      const grille = await lireLaGrille(organisation.id, db)
      return { réorganisé: true, concurrents: grille ? nomsDesConcurrents(grille.grille, organisation.nom) : [] }
    },
    DÉLAI_DE_LECTURE_STRATÉGIQUE_MS,
  ),
)

export type ConcurrentsDeLEspace = {
  /** La période de la dernière synthèse mensuelle publiée, ou `null` s'il n'y en a pas. */
  readonly période: string | null
  readonly carte: VueDeLaCarte | null
  readonly vue: VueDesConcurrents
}

/**
 * L'écran « Concurrents » : la carte de la dernière synthèse publiée et la
 * liste des concurrents de la grille, avec leurs crans et le nombre de faits
 * qui les nomment. Par le registre de la session (règle 2), sans aucune lecture
 * Notion. `null` hors de l'espace réorganisé, sans grille, ou dans le doute.
 */
export async function concurrentsDeLEspace(
  entrée: { readonly registre: string },
  db?: Base,
): Promise<ConcurrentsDeLEspace | null> {
  return bornée('lecture des concurrents', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const [mois, grille, comptes] = await Promise.all([
      dernièreSynthèsePubliée({ organisationId: organisation.id, granularité: 'mois' }, db),
      lireLaGrille(organisation.id, db),
      faitsParEntité({ organisationId: organisation.id }, db),
    ])
    if (!grille) return null
    const [précédente, connus] = await Promise.all([
      mois ? dernièreSynthèsePubliée({ organisationId: organisation.id, granularité: 'mois', avant: mois.période }, db) : null,
      faitsConnus({ organisationId: organisation.id, ids: (mois?.positions ?? []).flatMap((p) => p.faits) }, db),
    ])
    const faits = new Map([...connus].map(([id, f]) => [id, { date: f.date, édition: f.édition ?? '' }]))
    return {
      période: mois?.période ?? null,
      carte: mois ? vueDeLaCarte(grille.grille, mois.positions, précédente?.positions ?? [], organisation.nom, faits) : null,
      vue: vueDesConcurrents(grille.grille, mois?.positions ?? [], précédente?.positions ?? [], comptes, organisation.nom),
    }
  })
}

export type FicheLue = { readonly sorte: 'fiche'; readonly fiche: FicheDuConcurrent } | { readonly sorte: 'inconnu' }

/**
 * La fiche d'un concurrent : position et historique de ses crans publiés, ses
 * faits étiquetés, ses chiffres du registre lus par le benchmark du dernier
 * trimestre publié. Le concurrent est retrouvé par le segment d'URL **dans la
 * grille de l'organisation de la session** : un segment inconnu rend `inconnu`,
 * et rien venu de l'URL n'atteint la base autrement que comparé à cette grille.
 */
export async function ficheDuConcurrent(
  entrée: { readonly registre: string; readonly segment: string },
  db?: Base,
): Promise<FicheLue | null> {
  return bornée('lecture d’une fiche concurrent', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const grille = await lireLaGrille(organisation.id, db)
    if (!grille) return null
    const vide = vueDeLaFiche(grille.grille, entrée.segment, [], [], null)
    if (!vide) return { sorte: 'inconnu' }
    const [lignes, faits, trimestre] = await Promise.all([
      positionsPubliées({ organisationId: organisation.id, outil: 'groupes' }, db),
      faitsDUneEntité({ organisationId: organisation.id, entité: vide.nom }, db),
      dernièreSynthèsePubliée({ organisationId: organisation.id, granularité: 'trimestre' }, db),
    ])
    const valeur = trimestre?.éléments.find((é) => é.outil === 'benchmark')?.valeur as { lignes?: unknown } | null | undefined
    const benchmark = trimestre && Array.isArray(valeur?.lignes) ? { période: trimestre.période, lignes: valeur.lignes as readonly LigneDeBenchmark[] } : null
    const fiche = vueDeLaFiche(
      grille.grille,
      entrée.segment,
      lignes,
      faits.map((f) => ({ date: f.dateFait, édition: f.éditionNotion, empreinte: f.empreinteTitre, pestel: f.pestel, porter: f.forcePorter, impact: f.impact, rupture: f.rupture })),
      benchmark,
    )
    return fiche ? { sorte: 'fiche', fiche } : { sorte: 'inconnu' }
  })
}

// ── Les graphiques de l'espace réorganisé (lot 5, 30 octobre 2026) ───────────

export type FaitsRécentsDeLEspace = {
  /** Les faits étiquetés des treize dernières semaines, par semaine de parution. */
  readonly activité: readonly SemaineDActivité[]
  /** Les axes de la grille sur les huit dernières semaines, au niveau de leur fait le plus fort ; `null` sans grille. */
  readonly chaleur: CarteDeChaleur | null
  /** Les faits de chaque rubrique sur huit semaines, pour le mini graphique de sa carte. */
  readonly parRubrique: ReturnType<typeof activitéParRubrique>
  /** Les mêmes faits par dimension PESTEL, pour la case de l'écran « PESTEL ». */
  readonly pestel: readonly { readonly libellé: string; readonly faits: number }[]
}

/**
 * L'activité de la vue d'ensemble et la carte de chaleur de « Les axes », lues
 * dans les faits étiquetés (une requête sur treize semaines) et la grille :
 * aucune lecture Notion, et rien de plus que ce que l'onglet PESTEL lit déjà.
 * `fin` est la date de la dernière lettre publiée, que l'écran a en main.
 * `null` hors de l'espace réorganisé, sans fait, ou dans le doute.
 */
export async function faitsRécentsDeLEspace(
  entrée: { readonly registre: string; readonly fin: string },
  db?: Base,
): Promise<FaitsRécentsDeLEspace | null> {
  return bornée('lecture des faits récents', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const d = new Date(`${entrée.fin}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7 * SEMAINES_D_ACTIVITÉ)
    const [lignes, grille] = await Promise.all([
      faitsDeLaFenêtre({ organisationId: organisation.id, début: d.toISOString().slice(0, 10), fin: entrée.fin }, db),
      lireLaGrille(organisation.id, db),
    ])
    if (lignes.length === 0) return null
    const faits = lignes.map((l) => ({ dateÉdition: l.dateÉdition, famille: l.familleÉdition, axe: l.numéroAxe, impact: l.impact, rupture: l.rupture, pestel: l.pestel }))
    return {
      activité: activitéParSemaine(faits, entrée.fin),
      parRubrique: activitéParRubrique(faits, entrée.fin),
      chaleur: grille ? vueDeLaChaleur(faits, grille.grille, entrée.fin) : null,
      pestel: pestelDesFaits(faits),
    }
  })
}

/**
 * L'écran « Indicateurs » : l'indice de cycle de vie et le benchmark du dernier
 * trimestre **publié**, calculés par le portail au moment de la synthèse et
 * gardés dans leurs éléments. Aucune lecture Notion, aucun appel au BODACC ni au
 * registre depuis l'écran. `null` hors de l'espace réorganisé, sans trimestre
 * publié qui les porte, ou dans le doute.
 */
export async function indicateursDeLEspace(entrée: { readonly registre: string }, db?: Base): Promise<VueDesIndicateurs | null> {
  return bornée('lecture des indicateurs', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const trimestre = await dernièreSynthèsePubliée({ organisationId: organisation.id, granularité: 'trimestre' }, db)
    return trimestre ? vueDesIndicateurs(trimestre.période, trimestre.éléments) : null
  })
}

export type AxeLu = { readonly sorte: 'axe'; readonly vue: VueDeLAxe } | { readonly sorte: 'inconnu' }

/**
 * L'écran des faits d'un axe (30 octobre 2026), atteint depuis « PESTEL » : les
 * faits étiquetés de la famille sur treize semaines, par le registre de la
 * session (règle 2). Le segment n'est comparé qu'à la grille de l'organisation ;
 * inconnu, il rend `inconnu`. Aucune lecture Notion ; `null` hors de l'espace
 * réorganisé, sans grille, ou dans le doute.
 */
export async function faitsDeLAxeDeLEspace(
  entrée: { readonly registre: string; readonly segment: string; readonly fin: string },
  db?: Base,
): Promise<AxeLu | null> {
  return bornée('lecture des faits d’un axe', async () => {
    const organisation = await organisationPourLesOutils({ registreNotion: normaliserIdentifiant(entrée.registre) }, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const grille = await lireLaGrille(organisation.id, db)
    if (!grille) return null
    if (!vueDeLAxe(grille.grille, entrée.segment, [])) return { sorte: 'inconnu' }
    const d = new Date(`${entrée.fin}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (FENÊTRE_DU_PESTEL_JOURS - 1))
    const lignes = await faitsDeLaFenêtre({ organisationId: organisation.id, début: d.toISOString().slice(0, 10), fin: entrée.fin }, db)
    const vue = vueDeLAxe(
      grille.grille,
      entrée.segment,
      lignes.map((l) => ({
        date: l.dateFait,
        dateÉdition: l.dateÉdition,
        édition: l.éditionNotion,
        empreinte: l.empreinteTitre,
        famille: l.familleÉdition,
        axe: l.numéroAxe,
        pestel: l.pestel,
        porter: l.forcePorter,
        impact: l.impact,
        rupture: l.rupture,
      })),
    )
    return vue ? { sorte: 'axe', vue } : { sorte: 'inconnu' }
  })
}
