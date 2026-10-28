/**
 * Des étiquettes de la sortie structurée au lot que la porte contrôle (lot 13
 * du plan des outils stratégiques, à la bascule du moteur).
 *
 * Le modèle étiquette chaque fait dans la sortie même qui rédige la lettre
 * (`schémaDeLaLettreÉtiquetée`) : l'étape 4ter n'est plus un second passage
 * sur une lettre déjà écrite. Il ne désigne pourtant ni la place du fait ni sa
 * phrase-titre : le code les lit dans la lettre assemblée, par
 * `faitsDeLaLettre`, exactement comme la porte les relira. Un fait de la sortie
 * que la lettre ne porte pas à la place attendue est un écart nommé, jamais une
 * étiquette devinée. Aucun modèle ici, et rien n'est écrit : le lot rendu passe
 * ensuite par `recevoirLesÉtiquettes` comme celui de la tâche.
 */
import { construireDocument, type BlocNotion } from '@/lib/domaine/document'
import { faitsDeLaLettre, type ÉtiquetteProposée } from '@/lib/domaine/strategie'
import type { SortieÉtiquetée } from '@/lib/moteur/redaction'

export type ÉtiquettesDeLaSortie = {
  readonly lot: readonly ÉtiquetteProposée[]
  /** Les faits de la sortie qui n'ont pas trouvé leur place dans la lettre, nommés « axe N, fait R ». */
  readonly écarts: readonly string[]
}

export function étiquettesDeLaSortie(sortie: SortieÉtiquetée, blocs: readonly BlocNotion[]): ÉtiquettesDeLaSortie {
  const faits = faitsDeLaLettre(construireDocument(blocs)).filter((f) => f.section === 'axe')
  const parPlace = new Map(faits.map((f) => [`${f.axe}:${f.rang}`, f]))
  const lot: ÉtiquetteProposée[] = []
  const écarts: string[] = []
  for (const axe of sortie.axes) {
    if (axe.niveau === 'RAS') continue
    axe.faits.forEach((fait, i) => {
      const place = parPlace.get(`${axe.numéro}:${i + 1}`)
      if (!place) {
        écarts.push(`axe ${axe.numéro}, fait ${i + 1}`)
        return
      }
      const é = fait.étiquette
      lot.push({
        section: 'axe',
        axe: axe.numéro,
        rang: i + 1,
        titre: place.titre,
        date: fait.date,
        source: fait.url,
        pestel: é.pestel,
        porter: é.porter,
        ansoff: é.ansoff,
        entite: é.entite,
        rupture: é.rupture,
        impact: é.impact,
        nouveaute: fait.contexte ? 'contexte' : 'nouveau',
      })
    })
  }
  return { lot, écarts }
}
