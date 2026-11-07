import Image from 'next/image'

/**
 * Les logos des organisations qui reçoivent leur veille, sous l'ouverture de
 * l'accueil (7 novembre 2026, à la demande de l'opératrice : L'Hermitage,
 * Infralliance et Konica Minolta).
 *
 * Une rangée immobile, centrée, qui passe à la ligne sur mobile : à trois
 * logos, un défilement laisserait un vide sur grand écran. Les logos sont en
 * niveaux de gris, pour ne pas faire entrer dans la page des couleurs que la
 * charte n'a pas, et reprennent leurs couleurs au survol ; en mode sombre, ils
 * sont inversés, sans quoi le noir de Konica Minolta disparaîtrait. Pas
 * d'opacité réduite : L'Hermitage et Infralliance, clairs à l'origine, ne se
 * liraient plus. Les tailles sont optiques, pas égales : à surface égale, un
 * logo large est moins haut qu'un logo carré, et aucun ne dépasse 44 px. Les
 * fichiers sont dans `public/logos/`, recadrés à 120 px de haut.
 *
 * Afficher le logo d'une organisation sur la vitrine suppose son accord.
 */
type Logo = { readonly nom: string; readonly fichier: string; readonly largeur: number; readonly hauteur: number }

export const LOGOS: readonly Logo[] = [
  { nom: 'L’Hermitage', fichier: 'hermitage', largeur: 128, hauteur: 33 },
  { nom: 'Infralliance', fichier: 'infralliance', largeur: 108, hauteur: 39 },
  { nom: 'Konica Minolta', fichier: 'konica-minolta', largeur: 77, hauteur: 44 },
]

export function BandeauLogos() {
  return (
    <section aria-labelledby="bandeau-logos-titre" className="flex flex-col gap-6 border-b border-gris-ligne px-6 py-8 lg:px-12">
      <p id="bandeau-logos-titre" className="label-mono text-center text-ardoise">
        Ils reçoivent leur veille chaque semaine
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
        {LOGOS.map((logo) => (
          <li key={logo.fichier} className="flex h-12 items-center">
            <Image
              src={`/logos/${logo.fichier}.webp`}
              alt={logo.nom}
              width={logo.largeur}
              height={logo.hauteur}
              unoptimized
              className="grayscale transition hover:grayscale-0 dark:invert dark:hover:invert-0"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
