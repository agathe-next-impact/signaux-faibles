import { nomme } from '@/lib/domaine/mentions'
import { LIBELLÉS_MENDELOW, type FaitCité, type PositionLue, type VueDeLaCarte, type VueDeMendelow } from '@/lib/domaine/strategie-vues'

/**
 * Le suivi des acteurs d'un écran, et les dossiers ouverts qui les nomment
 * (18 novembre 2026, demande de l'opératrice : « le suivi des dossiers n'est pas
 * corrélé au contenu de l'écran »).
 *
 * Sur « Acteurs », la carte et la matrice de Mendelow placent des **acteurs** :
 * les sujets des positions publiées, des institutions et des concurrents. Le
 * suivi des dossiers, lui, vient de la propriété `Dossiers ouverts suivis` des
 * éditions, et ses entrées sont pour la plupart des **sujets** : une loi, un
 * budget, un programme, un marché. Les deux listes ne partageaient aucun nom :
 * sur L'Hermitage, sept parties prenantes (ANCT, RTES, Sénat…) au-dessus de
 * treize dossiers (« Budget de l'État pour 2027 », « Licence IV rurale »…) dont
 * aucun ne nommait l'une d'elles. La section se lisait comme le suivi des
 * acteurs montrés, et n'en était pas un.
 *
 * Un dossier est rattaché à un acteur quand **son nom ou sa précision actuelle
 * nomme l'acteur**, par la règle des mentions (`nomme`) : bornée aux mots,
 * accents et casse ignorés. Jamais par le sens : « Budget de l'État pour 2027 »
 * n'est rattaché au Sénat que parce que sa précision écrit « commission des
 * finances du Sénat ». Un nom d'acteur se cherche sous ses formes courtes
 * (`formesDuNom`) : « Sénat, examen du PLF 2027 » se cherche aussi « Sénat ».
 *
 * Décision de l'opératrice du même jour : la section suit **les acteurs**, pas
 * les dossiers. Une ligne par acteur placé (`suiviDesActeurs`), avec sa
 * position, les faits datés que la synthèse cite pour lui et les dossiers qui le
 * nomment ; un dossier qui ne nomme aucun acteur placé quitte l'écran (il garde
 * sa page, et l'accueil le montre quand il bouge).
 */

/** Trois caractères au moins : « RTE », « DGE » ; jamais une lettre seule. */
const LONGUEUR_MINIMALE = 3

/**
 * Le nom d'un acteur et ses formes courtes : la tête avant la première virgule
 * ou parenthèse (« Broadcom, éditeur de VMware » donne « Broadcom »), et chaque
 * nom listé entre parenthèses (« Instituts monétaires clients (US Mint, Royal
 * Mint) » donne « US Mint » et « Royal Mint »). Jamais un découpage sur « et » :
 * « Ville et Métiers d'Art » chercherait « Ville » partout.
 */
export function formesDuNom(acteur: string): readonly string[] {
  const formes = new Set<string>([acteur.trim()])
  const tête = acteur.split(/[,(]/)[0]?.trim()
  if (tête) formes.add(tête)
  for (const [, dedans] of acteur.matchAll(/\(([^)]*)\)/g)) {
    for (const nom of (dedans ?? '').split(',')) if (nom.trim()) formes.add(nom.trim())
  }
  return [...formes].filter((f) => f.replace(/[^\p{L}\p{N}]/gu, '').length >= LONGUEUR_MINIMALE)
}

/** Les acteurs que l'écran place : les sujets de Mendelow, et ceux de la carte quand elle est montrée (l'organisation exceptée). */
export function acteursPlacés(mendelow: VueDeMendelow | null, carte: VueDeLaCarte | null): readonly string[] {
  const noms = new Set<string>()
  for (const liste of carte?.cases.values() ?? []) for (const o of liste) if (!o.organisation) noms.add(o.sujet)
  for (const liste of mendelow?.cases.values() ?? []) for (const s of liste) noms.add(s.sujet)
  return [...noms].sort((a, b) => a.localeCompare(b, 'fr'))
}

type DossierLu = { readonly nom: string; readonly précisionActuelle: string | null }

export type DossiersDesActeurs<D> = {
  /** Les dossiers qui nomment au moins un acteur de l'écran, dans leur ordre d'entrée, avec les acteurs nommés. */
  readonly rattachés: readonly { readonly dossier: D; readonly acteurs: readonly string[] }[]
  /** Les dossiers qui n'en nomment aucun, dans leur ordre d'entrée. */
  readonly autres: readonly D[]
  /** Les acteurs de l'écran qu'aucun dossier ne nomme. */
  readonly sansDossier: readonly string[]
}

export function rattacherAuxActeurs<D extends DossierLu>(dossiers: readonly D[], acteurs: readonly string[]): DossiersDesActeurs<D> {
  const formes = acteurs.map((acteur) => ({ acteur, formes: formesDuNom(acteur) }))
  const nommés = new Set<string>()
  const rattachés: { dossier: D; acteurs: string[] }[] = []
  const autres: D[] = []
  for (const dossier of dossiers) {
    const texte = [dossier.nom, dossier.précisionActuelle ?? ''].join(' · ')
    const siens = formes.filter((a) => a.formes.some((f) => nomme(f, texte))).map((a) => a.acteur)
    if (siens.length === 0) {
      autres.push(dossier)
      continue
    }
    for (const a of siens) nommés.add(a)
    rattachés.push({ dossier, acteurs: siens })
  }
  return { rattachés, autres, sansDossier: acteurs.filter((a) => !nommés.has(a)) }
}

/** Un fait cité pour un acteur : sa date, sa lettre, et le numéro de la lettre quand l'écran le connaît. */
export type FaitDeLActeur = FaitCité & { readonly numéro: number | null }

export type ActeurSuivi<D> = {
  readonly sujet: string
  /** « pouvoir élevé · intérêt bas » quand l'acteur est sur Mendelow ; nul sinon (la carte est au-dessus). */
  readonly position: string | null
  /** Une case a changé depuis la synthèse publiée précédente. */
  readonly aBougé: boolean
  /** Toutes ses positions du mois sont déclaratives : lues dans le corpus, sans fait daté. */
  readonly déclaratif: boolean
  /** Les faits que ses positions citent, du plus récent au plus ancien, sans doublon. */
  readonly faits: readonly FaitDeLActeur[]
  readonly dossiers: readonly D[]
}

/**
 * Une ligne par acteur placé : ceux qui ont bougé d'abord, puis ceux dont le
 * dernier fait est le plus récent, puis les autres par nom. Seuls comptent les
 * outils montrés par l'écran (`outils`) : sur l'espace réorganisé, la carte des
 * concurrents a son propre écran.
 */
export function suiviDesActeurs<D extends DossierLu>(entrée: {
  readonly acteurs: readonly string[]
  readonly outils: readonly string[]
  readonly positions: readonly PositionLue[]
  readonly précédentes: readonly PositionLue[]
  readonly faits: ReadonlyMap<string, FaitCité>
  readonly numéros: ReadonlyMap<string, number>
  readonly dossiers: readonly D[]
}): readonly ActeurSuivi<D>[] {
  const { rattachés } = rattacherAuxActeurs(entrée.dossiers, entrée.acteurs)
  const crans = (liste: readonly PositionLue[], sujet: string) =>
    new Map(liste.filter((p) => p.sujet === sujet && entrée.outils.includes(p.outil) && p.cran !== null).map((p) => [`${p.outil}:${p.axe}`, p.cran]))
  const lignes = entrée.acteurs.map((sujet): ActeurSuivi<D> => {
    const siennes = entrée.positions.filter((p) => p.sujet === sujet && entrée.outils.includes(p.outil))
    const maintenant = crans(entrée.positions, sujet)
    const avant = crans(entrée.précédentes, sujet)
    const aBougé = entrée.précédentes.length > 0 && [...maintenant].some(([clé, cran]) => avant.get(clé) !== cran)
    const vus = new Set<string>()
    const faits: FaitDeLActeur[] = []
    for (const id of siennes.flatMap((p) => p.faits)) {
      const f = entrée.faits.get(id)
      if (!f || vus.has(`${f.date}:${f.édition}`)) continue
      vus.add(`${f.date}:${f.édition}`)
      faits.push({ ...f, numéro: entrée.numéros.get(f.édition) ?? null })
    }
    faits.sort((a, b) => b.date.localeCompare(a.date))
    const pouvoir = maintenant.get('mendelow:pouvoir')
    const intérêt = maintenant.get('mendelow:interet')
    return {
      sujet,
      position:
        pouvoir && intérêt ? `pouvoir ${LIBELLÉS_MENDELOW[pouvoir - 1] ?? '?'} · intérêt ${LIBELLÉS_MENDELOW[intérêt - 1] ?? '?'}` : null,
      aBougé,
      déclaratif: siennes.length > 0 && siennes.every((p) => p.origine === 'declaratif'),
      faits,
      dossiers: rattachés.filter((r) => r.acteurs.includes(sujet)).map((r) => r.dossier),
    }
  })
  return lignes.sort(
    (a, b) =>
      Number(b.aBougé) - Number(a.aBougé) ||
      (b.faits[0]?.date ?? '').localeCompare(a.faits[0]?.date ?? '') ||
      a.sujet.localeCompare(b.sujet, 'fr'),
  )
}
