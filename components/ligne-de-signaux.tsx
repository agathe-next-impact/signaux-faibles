/**
 * Le motif signature : la ligne de signaux.
 *
 * Un axe gris, des impulsions verticales — rose pour un signal fort, ardoise
 * pour un signal secondaire. Toujours horizontal, jamais plus de sept
 * impulsions, jamais en fond de texte.
 *
 * Le motif n'est pas un décor : chaque impulsion vaut un signal. Il n'est donc
 * employé qu'à l'entrée du portail, là où la charte l'emploie elle-même sur sa
 * couverture, et jamais derrière du contenu.
 */
export type Impulsion = {
  /** Position sur l'axe, de 0 à 1. */
  readonly position: number
  readonly force: 'fort' | 'secondaire'
}

const MAXIMUM = 7

export function LigneDeSignaux({ impulsions }: { impulsions: readonly Impulsion[] }) {
  const retenues = impulsions.slice(0, MAXIMUM)

  return (
    <div aria-hidden="true" className="relative h-8 w-full">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gris-ligne" />
      {retenues.map((impulsion, index) => (
        <span
          key={index}
          className={`absolute top-1/2 w-[3px] -translate-y-1/2 rounded-full ${
            impulsion.force === 'fort' ? 'h-6 bg-rose' : 'h-3 bg-ardoise'
          }`}
          style={{ left: `${Math.min(Math.max(impulsion.position, 0), 1) * 100}%` }}
        />
      ))}
    </div>
  )
}
