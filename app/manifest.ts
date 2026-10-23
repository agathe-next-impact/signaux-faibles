import type { MetadataRoute } from 'next'

/**
 * Le manifeste de l'application installable.
 *
 * Couleurs de la charte : le blanc est le fond unique du site, l'encre porte
 * la barre de l'application. Le portail étant privé, rien n'y est indexable et
 * le manifeste ne sert qu'à l'installation.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'signauxfaibles — votre veille',
    short_name: 'signauxfaibles',
    description: 'Votre veille, rédigée. Vos éditions, semaine après semaine.',
    // L'identité de l'application reste « / », celle des installations
    // existantes ; le paramètre dit à la racine qu'elle est ouverte depuis
    // l'application, où un lecteur sans session cherche à se reconnecter et
    // non à découvrir l'offre (`app/(portail)/page.tsx`).
    id: '/',
    start_url: '/?app=1',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#111418',
    lang: 'fr',
    dir: 'ltr',
    categories: ['business', 'news'],
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
