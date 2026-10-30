/**
 * Le squelette d'un écran qui attend ses lectures (30 octobre 2026, suggestion
 * « un squelette plutôt qu'un vide ») : l'écran s'annonce par sa forme, en-tête
 * puis grille de cases à angle droit, au lieu d'un « Chargement… » ou d'un vide.
 * Purement décoratif : `aria-hidden`, et un seul texte lu, `role="status"`.
 *
 * La lueur (`.squelette` dans `app/globals.css`) est la seule animation en
 * boucle admise par la charte (§05) : elle ne porte aucune donnée et dit
 * seulement que l'écran arrive. Rien ne bouge quand le système demande moins de
 * mouvement.
 */
export function SqueletteDÉcran() {
  return (
    <div className="flex flex-col gap-8">
      <p role="status" className="sr-only">
        Chargement de l’écran
      </p>
      <div aria-hidden="true" className="squelette flex flex-col gap-3 border-b border-gris-ligne pb-6">
        <span className="h-3 w-32" />
        <span className="h-9 w-2/3 max-w-md" />
      </div>
      <div aria-hidden="true" className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="squelette flex min-h-40 flex-col gap-3 border-r border-b border-gris-ligne p-6">
            <span className="h-5 w-1/2" />
            <span className="h-3 w-3/4" />
            <span className="h-3 w-2/3" />
            <span className="mt-auto h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
