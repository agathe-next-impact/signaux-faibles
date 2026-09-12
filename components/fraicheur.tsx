import type { Fraîcheur } from '@/lib/domaine/fraicheur'

/**
 * La couleur de la fraîcheur, et pourquoi elle est une pastille.
 *
 * Trois états, et la charte n'a que deux couleurs de texte lisibles — encre et
 * ardoise. Inventer une troisième teinte de texte aurait réinventé la palette ;
 * s'en tenir à deux aurait effacé un état. La couleur passe donc par un **carré
 * décoratif**, où le gris de filet est admis parce qu'il ne porte aucun mot :
 * le libellé, lui, reste en ardoise et toujours lisible.
 *
 * Le carré, et non le rond : la grille est à angle droit, ses puces aussi.
 *
 * Cette pastille ne remplace pas le badge d'impact et ne s'y substitue jamais.
 * Elle répond à « est-ce nouveau ? », il répond à « est-ce important ? ». Les
 * deux cohabitent sur une case d'axe, qui reste sur fond blanc : les trois
 * badges occupent déjà les trois fonds teintés de la charte.
 */
const COULEUR: Readonly<Record<Fraîcheur, string>> = {
  nouveau: 'bg-rose',
  suivi: 'bg-ardoise',
  dormant: 'bg-gris-ligne',
}

export function Fraicheur({
  fraîcheur,
  libellé,
}: {
  fraîcheur: Fraîcheur
  /** Ce que la pastille veut dire, en clair : la couleur seule n'informe pas. */
  libellé: string
}) {
  return (
    <p className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 ${COULEUR[fraîcheur]}`}
      />
      <span className={`label-mono ${fraîcheur === 'nouveau' ? 'text-rose' : 'text-ardoise'}`}>
        {libellé}
      </span>
    </p>
  )
}

/**
 * La légende du code couleur.
 *
 * Un code couleur qu'on n'explique pas est une décoration. Trois lignes en pied
 * d'écran coûtent moins cher qu'un lecteur qui devine.
 */
export function LégendeFraicheur() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {(
        [
          ['nouveau', 'du nouveau cette semaine'],
          ['suivi', 'suivi, rien de neuf'],
          ['dormant', 'sans nouveauté depuis plusieurs semaines'],
        ] as const
      ).map(([fraîcheur, libellé]) => (
        <li key={fraîcheur} className="flex items-center gap-2">
          <span aria-hidden="true" className={`size-1.5 shrink-0 ${COULEUR[fraîcheur]}`} />
          <span className="label-mono text-ardoise">{libellé}</span>
        </li>
      ))}
    </ul>
  )
}
