import { libelléDePériode, mouvementsDeLaCarte, TYPES_DE_TOWS, type SynthèseVue } from '@/lib/domaine/strategie-vues'

/**
 * Le tableau de bord en cases de l'espace réorganisé (lot 4 de
 * `docs/proposition-reorganisation-espace.md`, 30 octobre 2026) : une case par
 * écran, dans l'ordre du rail, avec son chiffre clé. Calculé sans rien lire :
 * la vue d'ensemble a déjà la liste des lettres, les axes de la semaine, la
 * lecture des étiquettes et la synthèse publiée. Un chiffre que ces lectures ne
 * donnent pas n'est pas inventé ; la case le dit.
 */
export type CaseDÉcran = {
  readonly rubrique: string
  readonly écran: string
  readonly href: string
  readonly valeur: string
  readonly mention: string
}

export type DonnéesDuTableau = {
  readonly slug: string
  readonly lettres: number
  readonly dernièreSemaine: string | null
  readonly archives: number
  /** Les axes de la semaine ; `null` pour un écran qui ne lit pas les lettres de la semaine. */
  readonly axes: number | null
  readonly axesForts: number
  /** Les dossiers ouverts qui ne nomment pas un concurrent de la grille. */
  readonly dossiersHorsConcurrents: number
  readonly concurrents: number
  readonly synthèse: SynthèseVue | null
  /** Les faits étiquetés des treize dernières semaines par dimension PESTEL, comme l'écran « PESTEL » les compte. */
  readonly pestel: readonly { readonly libellé: string; readonly faits: number }[] | null
}

const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`

export function casesDuTableauDeBord(d: DonnéesDuTableau): readonly CaseDÉcran[] {
  const mois = d.synthèse?.mois ?? null
  const trimestre = d.synthèse?.trimestre ?? null
  const pasEncore = 'pas encore publié'
  const mouvements = mouvementsDeLaCarte(mois?.carte ?? null)
  const swot = mois ? [...mois.swot.forces, ...mois.swot.faiblesses, ...mois.swot.opportunites, ...mois.swot.menaces] : []
  const options = mois ? TYPES_DE_TOWS.reduce((n, t) => n + mois.tows.parType[t.type].length, 0) : 0
  const retenue = mois?.tows.candidate ? TYPES_DE_TOWS.find((t) => t.libellé === mois.tows.candidate?.libellé) : undefined
  const pestel = d.pestel ? [...d.pestel].sort((a, b) => b.faits - a.faits)[0] : undefined
  const intenses = trimestre ? trimestre.forces.filter((f) => f.cran === 3).length : 0
  const indice = trimestre?.indicateurs?.indice?.valeurs ?? null
  const href = (segment: string) => `/${d.slug}${segment}`
  return [
    { rubrique: 'Cette semaine', écran: 'Lettres', href: href('/lettres'), valeur: String(d.lettres), mention: d.dernièreSemaine ? `la dernière, ${d.dernièreSemaine}` : 'aucune lettre' },
    {
      rubrique: 'Le marché',
      écran: 'Concurrents',
      href: href('/concurrents'),
      valeur: pluriel(d.concurrents, 'suivi'),
      mention: mois ? (mouvements > 0 ? `${pluriel(mouvements, 'a changé', 'ont changé')} de case` : 'aucun n’a changé de case') : pasEncore,
    },
    {
      rubrique: 'Le marché',
      écran: 'Acteurs',
      href: href('/acteurs'),
      valeur: pluriel(d.dossiersHorsConcurrents, 'dossier'),
      mention: mois ? `${pluriel(mois.mendelow.placés, 'partie prenante', 'parties prenantes')} sur Mendelow` : 'hors concurrents',
    },
    {
      rubrique: 'Le marché',
      écran: 'Forces du marché',
      href: href('/forces'),
      valeur: trimestre && trimestre.forces.length > 0 ? pluriel(intenses, 'intense') : 'n.d.',
      mention: trimestre ? `trimestre ${libelléDePériode(trimestre.période)}` : pasEncore,
    },
    {
      rubrique: 'L’environnement',
      écran: 'Les axes',
      href: href('/axes'),
      valeur: d.axes === null ? 'n.d.' : pluriel(d.axes, 'axe'),
      mention: d.axes === null ? 'cette semaine' : `${pluriel(d.axesForts, 'signal fort', 'signaux forts')} cette semaine`,
    },
    {
      rubrique: 'L’environnement',
      écran: 'PESTEL',
      href: href('/pestel'),
      valeur: pestel && pestel.faits > 0 ? pestel.libellé : 'n.d.',
      mention: pestel && pestel.faits > 0 ? `la plus citée, ${pluriel(pestel.faits, 'fait')} en treize semaines` : 'treize semaines',
    },
    {
      rubrique: 'Stratégie',
      écran: 'Diagnostic',
      href: href('/diagnostic'),
      valeur: mois ? pluriel(swot.length, 'élément') : 'n.d.',
      mention: mois ? `${pluriel(mois.swot.menaces.length, 'menace')}, ${pluriel(mois.swot.opportunites.length, 'opportunité')}` : pasEncore,
    },
    {
      rubrique: 'Stratégie',
      écran: 'Options',
      href: href('/recommandations'),
      valeur: mois ? pluriel(options, 'option') : 'n.d.',
      mention: retenue ? `retenue : ${retenue.verbe.toLowerCase()}, ${retenue.libellé.toLowerCase()}` : pasEncore,
    },
    {
      rubrique: 'Stratégie',
      écran: 'Scénarios',
      href: href('/scenarios'),
      valeur: trimestre && trimestre.scénarios.length > 0 ? pluriel(trimestre.scénarios.length, 'scénario') : 'n.d.',
      mention: trimestre ? `trimestre ${libelléDePériode(trimestre.période)}` : pasEncore,
    },
    {
      rubrique: 'Stratégie',
      écran: 'Indicateurs',
      href: href('/indicateurs'),
      valeur: indice && indice.entrées !== null ? pluriel(indice.entrées, 'entrée') : 'n.d.',
      mention: indice ? (indice.sorties !== null ? `${pluriel(indice.sorties, 'procédure')} au registre` : 'procédures n.d.') : trimestre ? 'indice non calculé' : pasEncore,
    },
    { rubrique: 'Votre veille', écran: 'Périmètre', href: href('/perimetre'), valeur: 'Ce qui est suivi', mention: 'et ce que nous proposons d’y changer' },
    { rubrique: 'Votre veille', écran: 'Archives', href: href('/archives'), valeur: pluriel(d.archives, 'semaine'), mention: 'une entrée par semaine' },
  ]
}

// ── Les rubriques (30 octobre 2026) ─────────────────────────────────────────

/**
 * Les rubriques du rail, chacune avec son écran (`/[slug]/marche`…), qui montre
 * la grille de ses écrans. Décision de l'opératrice du 30 octobre 2026 : le
 * tableau de bord porte une carte par rubrique, et non plus une case par écran ;
 * le rail garde ses écrans. « Cette semaine » n'a pas de carte : c'est la vue
 * d'ensemble elle-même, et « Lettres » reste au rail. Les noms sont ceux de
 * `Onglet.rubrique` (`ongletsDe`), écrits ici seulement.
 */
export const RUBRIQUES = [
  { clé: 'marche', titre: 'Le marché', question: 'Qui bouge sur votre marché', présentation: 'Qui vous dispute vos clients, qui pèse sur votre activité, et si le marché se durcit.' },
  { clé: 'environnement', titre: 'L’environnement', question: 'Ce qui change autour de vous', présentation: 'De quoi parle votre veille, et quelles dimensions de votre environnement bougent.' },
  { clé: 'strategie', titre: 'Stratégie', question: 'Où vous en êtes, et que faire', présentation: 'Votre situation, les options qui s’en déduisent, ce qui peut arriver et ce que disent les registres.' },
  { clé: 'veille', titre: 'Votre veille', question: 'Ce que nous suivons pour vous', présentation: 'Le périmètre de votre veille et l’archive de vos lettres.' },
] as const

export type CléDeRubrique = (typeof RUBRIQUES)[number]['clé']

export type CarteDeRubrique = {
  readonly clé: CléDeRubrique
  readonly titre: string
  readonly href: string
  /** Ses écrans, chacun avec son chiffre clé : la carte se lit sans s'ouvrir. */
  readonly écrans: readonly { readonly écran: string; readonly valeur: string }[]
}

/** Les cases d'une rubrique, dans l'ordre du rail. */
export function casesDeLaRubrique(cases: readonly CaseDÉcran[], clé: CléDeRubrique): readonly CaseDÉcran[] {
  const titre = RUBRIQUES.find((r) => r.clé === clé)!.titre
  return cases.filter((c) => c.rubrique === titre)
}

export function cartesDesRubriques(slug: string, cases: readonly CaseDÉcran[]): readonly CarteDeRubrique[] {
  return RUBRIQUES.map((r) => ({
    clé: r.clé,
    titre: r.titre,
    href: `/${slug}/${r.clé}`,
    écrans: casesDeLaRubrique(cases, r.clé).map((c) => ({ écran: c.écran, valeur: c.valeur })),
  }))
}
