import type { LectureDesÉtiquettes } from '@/lib/domaine/strategie'
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
  readonly axes: number
  readonly axesForts: number
  /** Les dossiers ouverts qui ne nomment pas un concurrent de la grille. */
  readonly dossiersHorsConcurrents: number
  readonly concurrents: number
  readonly synthèse: SynthèseVue | null
  readonly étiquettes: LectureDesÉtiquettes | null
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
  const pestel = d.étiquettes ? [...d.étiquettes.pestel].sort((a, b) => b.faits - a.faits)[0] : undefined
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
    { rubrique: 'L’environnement', écran: 'Les axes', href: href('/axes'), valeur: pluriel(d.axes, 'axe'), mention: `${pluriel(d.axesForts, 'signal fort', 'signaux forts')} cette semaine` },
    {
      rubrique: 'L’environnement',
      écran: 'PESTEL',
      href: href('/pestel'),
      valeur: pestel && pestel.faits > 0 ? pestel.libellé : 'n.d.',
      mention: pestel && pestel.faits > 0 ? `la plus citée, ${pluriel(pestel.faits, 'fait')} récents` : 'treize semaines',
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
