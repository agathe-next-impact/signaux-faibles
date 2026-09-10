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
    start_url: '/',
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
