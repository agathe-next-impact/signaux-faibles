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
    <header className="flex flex-col gap-2 border-b border-gris-ligne pb-4">
      <h2 className="font-titre text-h1 font-bold text-encre">{édition.titre}</h2>
      {métadonnées.length > 0 ? (
        // Séparateur point médian, comme la ligne de label de la charte
        // (« FAIT DATÉ · SOURCE CONSULTÉE · 24/08/2026 »).
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-label text-ardoise">
          {métadonnées.map((valeur, index) => (
            <span key={valeur}>
              {index > 0 ? <span className="mr-2 text-gris-ligne">·</span> : null}
              {valeur}
            </span>
          ))}
        </p>
      ) : null}
    </header>
  )
}
