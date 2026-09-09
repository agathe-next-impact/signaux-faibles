import type { NiveauImpact } from '@/lib/domaine/impact'

/**
 * Trois niveaux, pas quatre.
 *
 * Un suffixe inconnu — FAIBLE le premier — ne reçoit aucun badge et n'est
 * jamais converti : le composant rend `null`, il ne choisit pas un niveau par
 * défaut.
 */
const LIBELLÉS: Record<NiveauImpact, string> = {
  FORT: 'fort',
  MOYEN: 'moyen',
  RAS: 'RAS',
}

const STYLES: Record<NiveauImpact, string> = {
  FORT: 'bg-impact-fort-fond text-impact-fort',
  MOYEN: 'bg-impact-moyen-fond text-impact-moyen',
  RAS: 'bg-impact-ras-fond text-impact-ras',
}

export function BadgeImpact({ niveau }: { niveau: NiveauImpact | null }) {
  if (!niveau) return null

  return (
    <span
      className={`rounded-douce px-2 py-0.5 font-mono text-xs ${STYLES[niveau]}`}
      // Le badge répète une information déjà portée par le titre pour qui voit
      // les couleurs ; l'intitulé reste lisible pour qui ne les voit pas.
    >
      impact {LIBELLÉS[niveau]}
    </span>
  )
}
