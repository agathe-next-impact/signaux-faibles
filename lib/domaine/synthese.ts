import { famillesDuDocument, type Document } from '@/lib/domaine/document'
import { lireDossiersOuverts, type DossierOuvert } from '@/lib/domaine/dossiers'
import type { NiveauImpact } from '@/lib/domaine/impact'

/**
 * Ce que la vue d'ensemble sait dire d'une semaine.
 *
 * Tout se déduit de ce que Notion porte déjà : les familles du corps des notes,
 * et la propriété texte des dossiers ouverts. Rien n'est inventé, et rien ne
 * demande de lecture supplémentaire.
 */
export type Synthèse = {
  readonly parNiveau: Readonly<Record<NiveauImpact, number>>
  /** Familles dont le suffixe n'est pas un niveau connu : affichées, non comptées. */
  readonly sansNiveau: number
  readonly famillesTotal: number
  readonly dossiers: readonly DossierOuvert[]
  /** Dossiers rouverts au moins une fois sans avoir bougé. */
  readonly dossiersEnAttente: number
}

export function synthétiser(
  documents: readonly Document[],
  dossiersBruts: readonly string[],
): Synthèse {
  const parNiveau: Record<NiveauImpact, number> = { FORT: 0, MOYEN: 0, RAS: 0 }
  let sansNiveau = 0

  for (const document of documents) {
    for (const famille of famillesDuDocument(document)) {
      if (famille.niveau) parNiveau[famille.niveau] += 1
      else sansNiveau += 1
    }
  }

  // Une même semaine porte deux notes : un dossier peut figurer dans les deux.
  // On le compte une fois, en gardant la mention la plus avancée.
  const parNom = new Map<string, DossierOuvert>()
  for (const brut of dossiersBruts) {
    for (const dossier of lireDossiersOuverts(brut)) {
      const connu = parNom.get(dossier.nom)
      if (!connu || (dossier.compteur ?? -1) > (connu.compteur ?? -1)) {
        parNom.set(dossier.nom, dossier)
      }
    }
  }

  const dossiers = [...parNom.values()]

  return {
    parNiveau,
    sansNiveau,
    famillesTotal: parNiveau.FORT + parNiveau.MOYEN + parNiveau.RAS + sansNiveau,
    dossiers,
    dossiersEnAttente: dossiers.filter((dossier) => (dossier.compteur ?? 0) > 0).length,
  }
}

/** Écart d'un compte d'une semaine à la précédente. `null` s'il n'y a pas de précédente. */
export function écart(actuel: number, précédent: number | null): string | null {
  if (précédent === null) return null
  const différence = actuel - précédent
  if (différence === 0) return 'stable'
  return `${différence > 0 ? '+' : '−'}${Math.abs(différence)} vs semaine dernière`
}
