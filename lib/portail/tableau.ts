import { casesDuTableauDeBord, type CaseDÉcran } from '@/lib/domaine/tableau-de-bord'
import { normaliserTitre } from '@/lib/domaine/strategie'
import type { SemaineDActivité } from '@/lib/domaine/strategie-vues'
import { suivreLesDossiers } from '@/lib/domaine/tendances'
import type { SemaineDÉditions } from '@/lib/portail/semaine'
import { faitsRécentsDeLEspace, synthèseDeLEspace } from '@/lib/portail/strategie'

/**
 * Les cases des écrans de l'espace réorganisé, pour la vue d'ensemble (une
 * carte par rubrique) et pour l'écran de chaque rubrique (la grille de ses
 * écrans). Un seul endroit les calcule : une carte et l'écran qu'elle ouvre
 * disent les mêmes chiffres.
 *
 * Lectures : la synthèse publiée et les faits étiquetés des treize dernières
 * semaines, dans Postgres, par le registre de la session (règle 2) ; la liste
 * des éditions est celle que l'écran a déjà. Aucun corps de lettre : les axes de
 * la semaine sont passés par l'écran qui les a lus, `null` sinon.
 */
export async function tableauDeLEspace(entrée: {
  readonly slug: string
  readonly registre: string
  readonly semaines: readonly SemaineDÉditions[]
  readonly concurrents: readonly string[]
  readonly axes: { readonly total: number; readonly forts: number } | null
}): Promise<{ readonly cases: readonly CaseDÉcran[]; readonly activité: readonly SemaineDActivité[] | null }> {
  const { semaines } = entrée
  const courante = semaines[0]
  const fin = courante?.éditions.map((é) => é.dateÉdition).sort().at(-1)
  const numéros = new Map(semaines.flatMap((s) => s.éditions).flatMap((é) => (é.numéro !== null ? [[é.pageId, é.numéro] as const] : [])))
  const [synthèse, récents] = await Promise.all([
    synthèseDeLEspace({ registre: entrée.registre, numéros }),
    fin ? faitsRécentsDeLEspace({ registre: entrée.registre, fin }) : null,
  ])
  const concurrents = new Set(entrée.concurrents.map(normaliserTitre))
  const cases = casesDuTableauDeBord({
    slug: entrée.slug,
    lettres: semaines.reduce((n, s) => n + s.éditions.length, 0),
    dernièreSemaine: courante?.libellé ?? null,
    archives: semaines.length,
    axes: entrée.axes?.total ?? null,
    axesForts: entrée.axes?.forts ?? 0,
    dossiersHorsConcurrents: suivreLesDossiers(semaines).filter((d) => !concurrents.has(normaliserTitre(d.nom))).length,
    concurrents: entrée.concurrents.length,
    synthèse,
    pestel: récents?.pestel ?? null,
  })
  return { cases, activité: récents?.activité ?? null }
}
