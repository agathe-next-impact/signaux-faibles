import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Requis par `use cache`, `cacheLife` et `cacheTag`.
  cacheComponents: true,

  cacheLife: {
    // Profil unique du portail. `stale` : ce que le routeur client peut
    // réutiliser sans revenir au serveur. `revalidate` : au-delà, la réponse
    // reste servie depuis le cache et la régénération part en arrière-plan.
    // `expire` très long : c'est lui qui porte le mode dégradé de la règle 4,
    // pour que la dernière version connue continue d'être servie quand Notion
    // ne répond pas.
    notion: {
      stale: 60 * 5,
      revalidate: 60 * 60,
      expire: 60 * 60 * 24 * 30,
    },

    // Les URL de fichiers Notion expirent en une heure. Ce profil garde une
    // marge confortable sous cette limite : jamais d'URL périmée servie depuis
    // le cache. Il ne s'applique qu'à la résolution des médias, pas au contenu.
    media: {
      stale: 60,
      revalidate: 60 * 10,
      expire: 60 * 50,
    },
  },

  // Aucune image distante : les médias Notion passent par /api/media/[block_id]
  // (règle 5, les URL de fichiers Notion expirent en une heure).
  images: { remotePatterns: [] },

  async headers() {
    return [
      {
        source: '/:chemin*',
        headers: [
          // Le jeton ne doit jamais fuir par l'en-tête Referer (règle 8).
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
