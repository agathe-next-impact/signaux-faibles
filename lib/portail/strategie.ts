import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée, type Base } from '@/lib/base/client'
import {
  faitsDeLaFenêtre,
  faitsDesÉditions,
  lireLaGrille,
  organisationPourLesOutils,
  remplacerLesÉtiquettes,
  réglerLesOutilsStratégiques,
  étatDeLÉtiquetage,
} from '@/lib/base/strategie'
import { construireDocument, type Document } from '@/lib/domaine/document'
import {
  contrôlerLesÉtiquettes,
  faitsDeLaLettre,
  lectureDesÉtiquettes,
  messageDeRefus,
  type LectureDesÉtiquettes,
  type Refus,
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
