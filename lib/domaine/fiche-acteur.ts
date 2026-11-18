import { nomme } from '@/lib/domaine/mentions'
import { enSlug } from '@/lib/domaine/slug'
import { nomDansLaGrille, normaliserTitre, type Grille } from '@/lib/domaine/strategie'
import { formesDuNom } from '@/lib/domaine/dossiers-des-acteurs'
import { LIBELLÉS_DES_SORTES, type FicheDeVeille, type SorteDEntité } from '@/lib/domaine/fiche-veille'
import {
  LIBELLÉS_MENDELOW,
  LIBELLÉS_SWOT,
  STRATÉGIES_MENDELOW,
  TYPES_DE_TOWS,
  libelléDePériode,
  type CranNommé,
  type PositionDatée,
  type ÉlémentLu,
} from '@/lib/domaine/strategie-vues'

/**
 * L'écran d'un acteur (18 novembre 2026, demande de l'opératrice : « crée des
 * écrans Acteur pour chaque acteur avec les infos le concernant »).
 *
 * Un acteur est un sujet placé par une synthèse publiée (Mendelow, carte des
 * groupes) ou un nom de la grille (entité, partie prenante). Son écran réunit
 * ce que le dispositif sait de lui, sans rien rédiger : sa présentation de la
 * fiche de veille publiée, sa position et son historique de synthèse en
 * synthèse, les faits datés qui le fondent ou le nomment, les énoncés des
 * synthèses publiées qui le nomment ou citent l'un de ses faits, et les
 * dossiers ouverts qui le nomment. Tout ce qui suit est pur ; l'orchestration
 * (`ficheDeLActeur`, `lib/portail/fiche-veille.ts`) lit, l'écran
 * (`/[slug]/acteurs/[acteur]`) ajoute les passages des dernières lettres.
 *
 * Le segment d'URL est `enSlug` du nom, comparé **aux seuls noms de
 * l'organisation de la session** : un segment inconnu ne mène à rien, et rien
 * venu de l'URL n'atteint la base.
 */

/** La sorte d'un acteur pour son surtitre ; `placé` quand la grille ne le nomme pas. */
export type SorteDActeur = SorteDEntité | 'placé'

export const LIBELLÉS_DES_SORTES_D_ACTEUR: Readonly<Record<SorteDActeur, string>> = {
  ...LIBELLÉS_DES_SORTES,
  placé: 'acteur suivi',
}

/**
 * Les noms qui ont un écran d'acteur : les sujets des positions publiées de
 * Mendelow et de la carte, puis les entités et parties prenantes de la grille.
 * L'organisation elle-même n'en a pas. Dédoublonnés par `normaliserTitre`, le
 * premier nom rencontré gardé.
 */
export function nomsDesActeurs(entrée: {
  readonly positions: readonly PositionDatée[]
  readonly grille: Grille | null
  readonly organisation: string
}): readonly string[] {
  const elle = normaliserTitre(entrée.grille ? nomDansLaGrille(entrée.grille, entrée.organisation) : entrée.organisation)
  const vus = new Map<string, string>()
  const ajouter = (nom: string) => {
    const clé = normaliserTitre(nom)
    if (clé && clé !== elle && !vus.has(clé)) vus.set(clé, nom)
  }
  for (const p of entrée.positions) if ((p.outil === 'mendelow' || p.outil === 'groupes') && p.cran !== null) ajouter(p.sujet)
  for (const e of entrée.grille?.entités ?? []) if (!e.organisation) ajouter(e.nom)
  for (const p of entrée.grille?.partiesPrenantes ?? []) ajouter(p.nom)
  return [...vus.values()]
}

/** Le nom dont le segment d'URL est `segment`, parmi les noms de l'organisation ; `null` sinon. */
export function acteurDuSegment(noms: readonly string[], segment: string): string | null {
  return noms.find((nom) => enSlug(nom) === segment) ?? null
}

/** Un fait étiqueté tel que la base le connaît, avec l'empreinte qui permet de relire sa phrase-titre. */
export type FaitLu = { readonly date: string; readonly édition: string; readonly empreinte: string | null }

export type FaitSurLActeur = {
  readonly date: string
  readonly édition: string
  readonly empreinte: string | null
  /** Le numéro de la lettre, quand l'organisation l'a listée. */
  readonly numéro: number | null
  /** `position` : cité par une de ses positions publiées ; `nommé` : étiqueté à son nom ; les deux possibles. */
  readonly raisons: readonly ('position' | 'nommé')[]
}

export type PositionDeLActeur = {
  readonly période: string
  readonly libellé: string
  /** Mendelow : « pouvoir élevé · intérêt bas » et le coin de la matrice quand il en a un. */
  readonly mendelow: { readonly pouvoir: string; readonly intérêt: string; readonly coin: string | null } | null
  /** Carte des groupes : les crans nommés par la grille. */
  readonly crans: readonly CranNommé[]
  readonly déclaratif: boolean
  /** Une case a changé depuis la période publiée précédente qui le plaçait. */
  readonly aBougé: boolean
}

export type ÉnoncéQuiLeConcerne = {
  readonly période: string
  readonly libellé: string
  /** `swot`, `tows` ou `scenario` : l'écran mène à celui qui le montre. */
  readonly outil: 'swot' | 'tows' | 'scenario'
  /** « Opportunités · O2 », « Option Forces × menaces », « Scénario : … ». */
  readonly rubrique: string
  /** Le code SWOT, ancre de « Diagnostic », quand il en a un. */
  readonly code: string | null
  readonly énoncé: string
  /** Pourquoi il est là : il nomme l'acteur, ou il cite un de ses faits. */
  readonly par: 'nom' | 'fait'
}

export type FicheDeLActeur = {
  readonly nom: string
  readonly segment: string
  readonly sorte: SorteDActeur
  readonly siren: string | null
  /** Sa présentation de la fiche de veille publiée ; `null` sans fiche publiée ou sans présentation. */
  readonly présentation: string | null
  /** Sa dernière position publiée, puis les précédentes : de la plus récente à la plus ancienne. */
  readonly historique: readonly PositionDeLActeur[]
  readonly faits: readonly FaitSurLActeur[]
  readonly synthèses: readonly ÉnoncéQuiLeConcerne[]
}

/** Une synthèse publiée telle que la fiche la parcourt. */
export type SynthèseLue = {
  readonly période: string
  readonly éléments: readonly ÉlémentLu[]
  /** Les codes SWOT de la période (`vueDeLaSwot`), par identifiant d'élément. */
  readonly codes: ReadonlyMap<string, string>
}

function sorteDans(grille: Grille | null, nom: string): { readonly sorte: SorteDActeur; readonly siren: string | null } {
  const clé = normaliserTitre(nom)
  const entité = grille?.entités.find((e) => normaliserTitre(e.nom) === clé)
  if (entité) return { sorte: entité.veille === 'concurrentiel' ? 'concurrent' : 'acteur', siren: entité.siren ?? null }
  if (grille?.partiesPrenantes.some((p) => normaliserTitre(p.nom) === clé)) return { sorte: 'partie-prenante', siren: null }
  return { sorte: 'placé', siren: null }
}

/** L'historique de ses positions publiées, de la plus récente à la plus ancienne. */
export function historiqueDeLActeur(nom: string, positions: readonly PositionDatée[], grille: Grille | null): readonly PositionDeLActeur[] {
  const clé = normaliserTitre(nom)
  const parPériode = new Map<string, PositionDatée[]>()
  for (const p of positions) {
    if ((p.outil !== 'mendelow' && p.outil !== 'groupes') || p.cran === null || normaliserTitre(p.sujet) !== clé) continue
    parPériode.set(p.période, [...(parPériode.get(p.période) ?? []), p])
  }
  const chronologie = [...parPériode.keys()].sort().flatMap((période) => {
    const siennes = parPériode.get(période)!
    const cran = (outil: string, axe: string) => siennes.find((p) => p.outil === outil && p.axe === axe)?.cran ?? null
    const pouvoir = cran('mendelow', 'pouvoir')
    const intérêt = cran('mendelow', 'interet')
    const crans = (grille?.axesGroupes ?? []).flatMap((axe) => {
      const c = cran('groupes', axe.clé)
      return c !== null ? [{ axe: axe.libellé, cran: c, libellé: axe.crans[c - 1] ?? `cran ${c}` }] : []
    })
    const mendelow =
      pouvoir !== null && intérêt !== null
        ? {
            pouvoir: LIBELLÉS_MENDELOW[pouvoir - 1] ?? `cran ${pouvoir}`,
            intérêt: LIBELLÉS_MENDELOW[intérêt - 1] ?? `cran ${intérêt}`,
            coin: STRATÉGIES_MENDELOW[`${pouvoir}:${intérêt}`] ?? null,
            clé: `${pouvoir}:${intérêt}`,
          }
        : null
    if (!mendelow && crans.length === 0) return []
    return [{ période, mendelow, crans, déclaratif: siennes.every((p) => p.origine === 'declaratif') }]
  })
  return chronologie
    .map((h, i) => {
      const avant = chronologie[i - 1]
      const aBougé =
        !!avant &&
        ((!!h.mendelow && !!avant.mendelow && h.mendelow.clé !== avant.mendelow.clé) ||
          h.crans.some((c) => avant.crans.some((a) => a.axe === c.axe && a.cran !== c.cran)))
      return {
        période: h.période,
        libellé: libelléDePériode(h.période),
        mendelow: h.mendelow ? { pouvoir: h.mendelow.pouvoir, intérêt: h.mendelow.intérêt, coin: h.mendelow.coin } : null,
        crans: h.crans,
        déclaratif: h.déclaratif,
        aBougé,
      }
    })
    .reverse()
}

/**
 * Ses faits : ceux que ses positions publiées citent, et ceux étiquetés à son
 * nom. Un même fait (même lettre, même phrase-titre) n'apparaît qu'une fois, ses
 * deux raisons réunies ; du plus récent au plus ancien.
 */
export function faitsDeLActeur(entrée: {
  readonly cités: readonly FaitLu[]
  readonly nommés: readonly FaitLu[]
  readonly numéros: ReadonlyMap<string, number>
}): readonly FaitSurLActeur[] {
  const parClé = new Map<string, { fait: FaitLu; raisons: Set<'position' | 'nommé'> }>()
  const ajouter = (fait: FaitLu, raison: 'position' | 'nommé') => {
    const clé = `${fait.édition}:${fait.empreinte ?? fait.date}`
    const déjà = parClé.get(clé)
    if (déjà) déjà.raisons.add(raison)
    else parClé.set(clé, { fait, raisons: new Set([raison]) })
  }
  for (const f of entrée.cités) ajouter(f, 'position')
  for (const f of entrée.nommés) ajouter(f, 'nommé')
  return [...parClé.values()]
    .map(({ fait, raisons }) => ({
      date: fait.date,
      édition: fait.édition,
      empreinte: fait.empreinte,
      numéro: entrée.numéros.get(fait.édition) ?? null,
      raisons: (['position', 'nommé'] as const).filter((r) => raisons.has(r)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.numéro ?? 0) - (a.numéro ?? 0))
}

/**
 * Les énoncés des synthèses publiées qui le concernent : une case SWOT, une
 * option TOWS ou un scénario qui **nomme** l'acteur (règle des mentions, sous
 * ses formes courtes), ou qui **cite un de ses faits**. Jamais un rapprochement
 * par le sens.
 */
export function énoncésQuiLeConcernent(
  nom: string,
  synthèses: readonly SynthèseLue[],
  sesFaits: ReadonlySet<string>,
): readonly ÉnoncéQuiLeConcerne[] {
  const formes = formesDuNom(nom)
  const leNomme = (texte: string) => formes.some((f) => nomme(f, texte))
  return synthèses.flatMap((s) =>
    s.éléments.flatMap((é): ÉnoncéQuiLeConcerne[] => {
      if (é.outil !== 'swot' && é.outil !== 'tows' && é.outil !== 'scenario') return []
      const titre = é.outil === 'scenario' ? ((é.références as { titre?: string } | null)?.titre ?? é.clé) : ''
      const énoncé = é.énoncé ?? ''
      const par = leNomme(`${titre} ${énoncé}`) ? 'nom' : é.faits.some((id) => sesFaits.has(id)) ? 'fait' : null
      if (!par || !énoncé) return []
      const code = é.outil === 'swot' ? (s.codes.get(é.id) ?? null) : null
      const rubrique =
        é.outil === 'swot'
          ? `${LIBELLÉS_SWOT[é.clé as keyof typeof LIBELLÉS_SWOT] ?? é.clé}${code ? ` · ${code}` : ''}`
          : é.outil === 'tows'
            ? `Option ${TYPES_DE_TOWS.find((t) => t.type === é.clé)?.libellé.toLowerCase() ?? é.clé}`
            : `Scénario : ${titre}`
      return [{ période: s.période, libellé: libelléDePériode(s.période), outil: é.outil, rubrique, code, énoncé, par }]
    }),
  )
}

/**
 * La fiche d'un acteur, sans ses dossiers ni ses passages de lettres, que
 * l'écran ajoute. `null` si le segment n'est le nom d'aucun acteur de
 * l'organisation.
 */
export function vueDeLActeur(entrée: {
  readonly segment: string
  readonly grille: Grille | null
  readonly organisation: string
  readonly fiche: FicheDeVeille | null
  readonly positions: readonly PositionDatée[]
  readonly faitsCités: ReadonlyMap<string, FaitLu>
  readonly faitsNommés: readonly (FaitLu & { readonly id: string })[]
  readonly numéros: ReadonlyMap<string, number>
  readonly synthèses: readonly SynthèseLue[]
}): FicheDeLActeur | null {
  const nom = acteurDuSegment(nomsDesActeurs({ positions: entrée.positions, grille: entrée.grille, organisation: entrée.organisation }), entrée.segment)
  if (!nom) return null
  const clé = normaliserTitre(nom)
  const idsCités = [
    ...new Set(
      entrée.positions.filter((p) => (p.outil === 'mendelow' || p.outil === 'groupes') && normaliserTitre(p.sujet) === clé).flatMap((p) => p.faits),
    ),
  ]
  const cités = idsCités.flatMap((id) => {
    const f = entrée.faitsCités.get(id)
    return f ? [f] : []
  })
  const sesFaits = new Set([...idsCités, ...entrée.faitsNommés.map((f) => f.id)])
  const { sorte, siren } = sorteDans(entrée.grille, nom)
  return {
    nom,
    segment: entrée.segment,
    sorte,
    siren,
    présentation: entrée.fiche?.présentations?.find((p) => normaliserTitre(p.nom) === clé)?.texte ?? null,
    historique: historiqueDeLActeur(nom, entrée.positions, entrée.grille),
    faits: faitsDeLActeur({ cités, nommés: entrée.faitsNommés, numéros: entrée.numéros }),
    synthèses: énoncésQuiLeConcernent(nom, entrée.synthèses, sesFaits),
  }
}
