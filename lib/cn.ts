/**
 * Les classes d'un élément, réunies (30 octobre 2026, pour le composant chart
 * de shadcn/ui) : chaînes, valeurs fausses ignorées, objets dont seules les clés
 * vraies comptent. Sans fusion des classes Tailwind en conflit : le portail n'en
 * pose pas, et une dépendance de plus ne s'imposait pas.
 */
type Classe = string | false | null | undefined | Readonly<Record<string, boolean | undefined>>

export function cn(...classes: readonly Classe[]): string {
  return classes
    .flatMap((c) => (typeof c === 'object' && c !== null ? Object.entries(c).filter(([, oui]) => oui).map(([nom]) => nom) : c ? [c] : []))
    .join(' ')
}
