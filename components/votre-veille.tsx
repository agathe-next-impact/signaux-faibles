import type { Veille } from '@/lib/domaine/strategie'

/**
 * Les briques communes des écrans « Votre veille » (lot 6, 30 octobre 2026).
 * Les numéros de familles se répètent d'une veille à l'autre : chaque écran
 * range donc ses lignes sous la veille qui les porte, nommée pour le lecteur.
 */
export const VEILLES_AFFICHÉES: readonly { readonly veille: Veille; readonly titre: string }[] = [
  { veille: 'ecosysteme', titre: 'Votre environnement' },
  { veille: 'concurrentiel', titre: 'Votre concurrence' },
]

/** Ce qu'un écran dit tant que l'opératrice n'a pas publié la fiche de veille. */
export function PasEncorePubliée({ quoi }: { quoi: string }) {
  return (
    <p className="mt-6 max-w-[68ch] border border-gris-ligne bg-fond-neutre p-4 text-ardoise">
      {quoi} n’est pas encore publié. La fiche de votre veille est rédigée à la revue du mois, relue, puis publiée ici.
    </p>
  )
}
