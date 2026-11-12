import { matriceDeDécision, type VueDesMarchés } from '@/lib/domaine/marches'
import { libelléDePériode, type SynthèseVue } from '@/lib/domaine/strategie-vues'

/**
 * Le pied « Dans votre espace » du courriel d'une lettre (12 novembre 2026,
 * demande de l'opératrice, piste 4) : trois liens au plus vers les écrans des
 * outils stratégiques, chacun avec son chiffre, calculés sur ce que
 * l'opératrice a **publié** et rien d'autre. Aucun modèle, aucune page Notion :
 * la lettre ne change pas, seul son courriel gagne ce pied.
 *
 * Diagnostic (la SWOT du dernier mois publié), Scénarios (le dernier trimestre
 * publié) et Marchés et niches (les mesures publiées, rangées par la matrice de
 * décision). Un écran sans période publiée n'a pas de ligne ; sans aucune, le
 * pied n'existe pas. Seul endroit où ces lignes sont composées.
 */
export type LienDEspace = {
  readonly écran: string
  /** Le chemin dans l'espace, sans la racine du portail : `/<slug>/diagnostic`. */
  readonly chemin: string
  readonly valeur: string
  readonly mention: string
}

const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${n.toLocaleString('fr-FR')} ${n > 1 ? mots : mot}`

/** « pour octobre 2026 », « pour octobre à décembre 2026 ». */
function pourLaPériode(période: string): string {
  return `pour ${libelléDePériode(période).replace(/^(de |d’)/, '')}`
}

export function liensDeLEspace(entrée: {
  readonly slug: string
  readonly synthèse: SynthèseVue | null
  readonly marchés: VueDesMarchés | null
}): readonly LienDEspace[] {
  const liens: LienDEspace[] = []
  const chemin = (segment: string) => `/${entrée.slug}${segment}`

  const mois = entrée.synthèse?.mois ?? null
  if (mois) {
    const { forces, faiblesses, opportunites, menaces } = mois.swot
    const total = forces.length + faiblesses.length + opportunites.length + menaces.length
    if (total > 0) {
      liens.push({
        écran: 'Diagnostic',
        chemin: chemin('/diagnostic'),
        valeur: pluriel(menaces.length, 'menace'),
        mention: `et ${pluriel(opportunites.length, 'opportunité')}, ${pourLaPériode(mois.période)}`,
      })
    }
  }

  const trimestre = entrée.synthèse?.trimestre ?? null
  if (trimestre && trimestre.scénarios.length > 0) {
    liens.push({
      écran: 'Scénarios',
      chemin: chemin('/scenarios'),
      valeur: pluriel(trimestre.scénarios.length, 'scénario'),
      mention: `et leurs indicateurs, ${pourLaPériode(trimestre.période)}`,
    })
  }

  const marchés = entrée.marchés
  if (marchés) {
    const { cases } = matriceDeDécision(marchés.lignes)
    const rangés = cases.reduce((n, c) => n + c.segments.length, 0)
    if (rangés > 0) {
      const àPousser = cases.find((c) => c.verdict === 'pousser')?.segments.length ?? 0
      liens.push({
        écran: 'Marchés et niches',
        chemin: chemin('/marches'),
        valeur: `${pluriel(àPousser, 'segment')} à pousser`,
        mention: `sur ${pluriel(rangés, 'offre ou niche', 'offres et niches')}, ${pourLaPériode(marchés.période)}`,
      })
    }
  }

  return liens
}
