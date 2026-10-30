/**
 * Ce qui dépasse la lecture rapide (lot 4 de la réorganisation, 30 octobre
 * 2026) : au-delà de quelques lignes, le reste d'une liste se replie derrière
 * « Voir les N autres ». Un `details` natif, sans script : la liste entière est
 * dans le HTML, elle s'ouvre au clavier comme à la souris, et une recherche
 * dans la page la retrouve.
 */
export function Repliable({ reste, nom, children }: { reste: number; nom: string; children: React.ReactNode }) {
  if (reste <= 0) return null
  return (
    <details className="group mt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-corps text-encre [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Voir {reste > 1 ? `les ${reste} autres ${nom}` : `l’autre`}</span>
        <span className="hidden group-open:inline">Replier</span>
        <span aria-hidden="true" className="text-rose transition-transform group-open:rotate-90">→</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}
