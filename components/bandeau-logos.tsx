import Image from 'next/image'

/**
 * Le bandeau de logos sous l'ouverture de l'accueil (24 octobre 2026) : les
 * organisations qui reçoivent leur veille, en défilement continu.
 *
 * Les logos sont en niveaux de gris, pour ne pas faire entrer dans la page
 * des couleurs que la charte n'a pas ; ils reprennent leurs couleurs au
 * survol. Pas d'opacité réduite : L'Hermitage et Infralliance, clairs à
 * l'origine, ne se liraient plus. Les tailles sont optiques, pas égales : à surface égale,
 * un logo large est moins haut qu'un logo carré, et aucun ne dépasse 44 px.
 * Les fichiers sont dans `public/logos/`, recadrés à 120 px de haut ; le mot
 * « HERITECH », blanc à l'origine, y est passé à l'encre pour se lire sur fond
 * clair.
 *
 * Afficher le logo d'une organisation sur la vitrine suppose son accord.
 */
type Logo = { readonly nom: string; readonly fichier: string; readonly largeur: number; readonly hauteur: number }

const LOGOS: readonly Logo[] = [
  { nom: 'L’Hermitage', fichier: 'hermitage', largeur: 128, hauteur: 33 },
  { nom: 'Infralliance', fichier: 'infralliance', largeur: 108, hauteur: 39 },
  { nom: 'Konica Minolta', fichier: 'konica-minolta', largeur: 77, hauteur: 44 },
  { nom: 'Suneido', fichier: 'suneido', largeur: 49, hauteur: 44 },
  { nom: 'Heritech', fichier: 'heritech', largeur: 72, hauteur: 44 },
]

/** L'écart entre deux logos (24 octobre 2026 : doublé, de 4 à 8 rem). */
const ÉCART = '8rem'

function Liste({ copie }: { copie: boolean }) {
  return (
    // L'écart et la marge de fin sont posés ensemble, en style : la marge doit
    // égaler l'écart entre deux logos pour que la copie raccorde sans saut, et
    // une remise à zéro des listes l'emporterait sur un utilitaire.
    <ul
      className={`flex shrink-0 items-center${copie ? ' copie' : ''}`}
      style={{ columnGap: ÉCART, paddingRight: ÉCART }}
      aria-hidden={copie ? true : undefined}
    >
      {LOGOS.map((logo) => (
        <li key={logo.fichier} className="flex h-12 items-center">
          <Image
            src={`/logos/${logo.fichier}.webp`}
            alt={copie ? '' : logo.nom}
            width={logo.largeur}
            height={logo.hauteur}
            unoptimized
            className="grayscale transition hover:grayscale-0"
          />
        </li>
      ))}
    </ul>
  )
}

export function BandeauLogos() {
  return (
    // Remonté vers l'ouverture pour tenir dans le premier écran dès 720 px de haut.
    <section aria-labelledby="bandeau-logos-titre" className="-mt-10 flex flex-col gap-4">
      <p id="bandeau-logos-titre" className="label-mono text-center text-ardoise">
        Ils reçoivent leur veille chaque semaine
      </p>
      <div className="bandeau-logos overflow-hidden">
        <div className="piste flex w-max">
          <Liste copie={false} />
          <Liste copie />
        </div>
      </div>
    </section>
  )
}
