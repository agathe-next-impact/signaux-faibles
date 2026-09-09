import type { Édition } from '@/lib/notion/editions'

/**
 * Le cartouche d'une note.
 *
 * Le titre est affiché tel quel : il est fixé par le référentiel de chaque
 * organisation et varie de l'une à l'autre. Ne jamais raisonner dessus.
 */
export function EntêteÉdition({ édition }: { édition: Édition }) {
  const métadonnées = [
    édition.veille,
    édition.numéro !== null ? `n° ${édition.numéro}` : null,
    édition.périodeCouverte || null,
    édition.fenêtreÉlargie ? 'fenêtre élargie' : null,
  ].filter((valeur): valeur is string => Boolean(valeur))

  return (
    <header className="flex flex-col gap-2 border-b border-trait pb-4">
      <h2 className="font-titre text-2xl text-encre">{édition.titre}</h2>
      {métadonnées.length > 0 ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-encre-tenue">
          {métadonnées.map((valeur) => (
            <span key={valeur}>{valeur}</span>
          ))}
        </p>
      ) : null}
    </header>
  )
}
