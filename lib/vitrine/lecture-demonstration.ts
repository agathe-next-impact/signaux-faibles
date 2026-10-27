import { construireDocument, type Document } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { faitsDeLaLettre, lectureDesÉtiquettes, type FaitÀLire, type LectureDesÉtiquettes } from '@/lib/domaine/strategie'
import type { Démonstration } from '@/lib/vitrine/demonstrations'

/**
 * La « Lecture stratégique » d'une organisation fictive (27 octobre 2026) :
 * les faits de sa lettre, relevés par `faitsDeLaLettre` comme pour un vrai
 * client, étiquetés par la grille de la démonstration au lieu de la tâche
 * d'étiquetage, puis comptés par `lectureDesÉtiquettes`, la même agrégation
 * que la vue d'ensemble. Rien n'est écrit en dur dans le résultat : changer la
 * lettre change la lecture.
 */
export function lectureDeDémonstration(
  démonstration: Démonstration,
  document: Document = construireDocument(markdownVersBlocs(démonstration.markdown)),
): LectureDesÉtiquettes {
  const { axes, entités, ruptures } = démonstration.grille
  const contient = (texte: string, mot: string) => texte.toLowerCase().includes(mot.toLowerCase())
  const faits: FaitÀLire[] = faitsDeLaLettre(document).map((f) => {
    const cadre = f.axe === null ? undefined : axes[f.axe]
    const porter = cadre && 'porter' in cadre ? cadre.porter : null
    const entité = porter ? (entités.find((e) => contient(f.titre, e.nom)) ?? null) : null
    return {
      pestel: cadre && 'pestel' in cadre ? cadre.pestel : null,
      porter,
      ansoff: entité?.ansoff ?? null,
      entite: entité?.nom ?? null,
      rupture: ruptures.some((r) => r.axe === f.axe && contient(f.titre, r.contient)),
      date: démonstration.dateÉdition,
      source: f.urls[0] ?? null,
      titre: f.titre,
    }
  })
  return lectureDesÉtiquettes(faits)
}
