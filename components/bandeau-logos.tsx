import Image from 'next/image'

/**
 * Les logos des organisations qui reçoivent leur veille, dans l'ouverture de
 * l'accueil (7 novembre 2026, à la demande de l'opératrice : L'Hermitage,
 * Infralliance et Konica Minolta, rejointes le 8 novembre par Heritech et
 * Suneido ; sous l'ouverture jusqu'au 8 novembre, dans
 * l'ouverture depuis, pour être vus sans défiler).
 *
 * Une rangée immobile, centrée, qui passe à la ligne sur mobile : à cinq
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
  { nom: 'Heritech', fichier: 'heritech', largeur: 72, hauteur: 44 },
  { nom: 'Suneido', fichier: 'suneido', largeur: 49, hauteur: 44 },
]

/**
 * La rangée de logos. `négatif` la pose sur la bande encre de l'ouverture
 * (8 novembre 2026, à la demande de l'opératrice : les logos visibles sans
 * défiler) : les logos y sont inversés en mode clair, où la bande est sombre,
 * et tels quels en mode sombre, où elle est claire ; pas de couleurs au
 * survol, un logo inversé ne les rendrait pas. Alignée à gauche, sous les
 * boutons, et non centrée.
 */
export function BandeauLogos({ négatif = false }: { négatif?: boolean } = {}) {
  const titre = négatif ? 'logos-ouverture-titre' : 'bandeau-logos-titre'
  return (
    <section
      aria-labelledby={titre}
      className={
        négatif
          ? 'flex flex-col gap-4'
          : 'flex flex-col gap-6 border-b border-gris-ligne px-6 py-8 lg:px-12'
      }
    >
      <p id={titre} className={négatif ? 'label-mono text-gris-ligne' : 'label-mono text-center text-ardoise'}>
        Ils reçoivent leur veille chaque semaine
      </p>
      <ul className={négatif ? 'flex flex-wrap items-center gap-x-8 gap-y-4' : 'flex flex-wrap items-center justify-center gap-x-12 gap-y-6'}>
        {LOGOS.map((logo) => (
          <li key={logo.fichier} className="flex h-12 items-center">
            <Image
              src={`/logos/${logo.fichier}.webp`}
              alt={logo.nom}
              width={logo.largeur}
              height={logo.hauteur}
              unoptimized
              className={négatif ? 'grayscale invert dark:invert-0' : 'grayscale transition hover:grayscale-0 dark:invert dark:hover:invert-0'}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
