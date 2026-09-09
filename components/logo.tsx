/**
 * Le mot-symbole.
 *
 * « signauxfaibles » en bas de casse, soudé, suivi du curseur — la barre qui
 * dit que la veille est en train de s'écrire. Composé en Lora gras.
 *
 * Quatre interdits de la charte, tenus ici : pas de capitales ni d'espace dans
 * le mot, pas d'autre police, pas d'ombre ni de contour ni d'inclinaison, et
 * jamais d'inversion des couleurs du mot et du curseur — le curseur reste rose
 * sur fond clair comme sur fond encre, seul le mot change.
 *
 * Taille minimale : 120 px de large à l'écran. `text-h3` y suffit largement ;
 * ne pas descendre en dessous, le curseur deviendrait illisible.
 */
export function Logo({ négatif = false }: { négatif?: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline font-titre text-h3 font-bold tracking-tight ${
        négatif ? 'text-blanc' : 'text-encre'
      }`}
    >
      signauxfaibles
      <span
        aria-hidden="true"
        className="ml-[0.06em] inline-block h-[0.92em] w-[0.08em] translate-y-[0.06em] bg-rose"
      />
    </span>
  )
}
