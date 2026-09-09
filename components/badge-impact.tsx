import { libelléDImpact, type NiveauImpact } from '@/lib/domaine/impact'

/**
 * Les badges d'impact de la charte.
 *
 * Trois niveaux, pas plus. « RAS » est un état à part entière : il se montre,
 * il ne se cache pas — d'où une pastille pleine et non une absence.
 *
 * Un suffixe inconnu, FAIBLE le premier, ne reçoit aucun badge et n'est jamais
 * converti : le composant rend `null` plutôt que de choisir un niveau.
 *
 * Le texte est en capitales, seule exception admise par la charte au sentence
 * case, parce que ce sont des labels mono.
 */
const STYLES: Record<NiveauImpact, string> = {
  FORT: 'bg-fond-rose text-rose',
  MOYEN: 'bg-fond-ardoise text-ardoise',
  RAS: 'bg-fond-neutre text-ardoise',
}

export function BadgeImpact({ niveau }: { niveau: NiveauImpact | null }) {
  if (!niveau) return null

  return (
    <span className={`label-mono rounded-full px-2.5 py-1 ${STYLES[niveau]}`}>
      {libelléDImpact(niveau)}
    </span>
  )
}
