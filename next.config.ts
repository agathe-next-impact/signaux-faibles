import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

/**
 * La politique de contenu, minimale et honnête.
 *
 * Le portail ne charge rien d'ailleurs : polices servies par next/font depuis
 * `/_next`, images par `/api/media`, aucun script tiers. Tout est donc borné à
 * l'origine, et les cadres, objets et bases externes sont interdits.
 *
 * `'unsafe-inline'` reste sur les scripts et les styles : Next.js hydrate par
 * des scripts en ligne et React pose des styles en ligne, et une politique à
 * nonce demanderait de renoncer au pré-rendu des enveloppes (`cacheComponents`).
 * Cette politique n'arrête donc pas une injection de script dans la page
 * elle-même ; elle arrête l'exfiltration vers un autre domaine, l'inclusion
 * dans un cadre et le chargement d'une ressource étrangère. C'est le premier
 * pas, posé le 14 octobre 2026 ; le nonce est un pas suivant.
 */
const EN_DÉVELOPPEMENT = process.env.NODE_ENV !== 'production'

const POLITIQUE_DE_CONTENU = [
  "default-src 'self'",
  // Le rechargement à chaud du serveur de développement évalue du code et ouvre
  // un websocket ; en production, ni l'un ni l'autre.
  `script-src 'self' 'unsafe-inline'${EN_DÉVELOPPEMENT ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${EN_DÉVELOPPEMENT ? ' ws: wss:' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  // Les migrations SQL sont lues à l'exécution par `POST /api/veille/migrer` :
  // sans cette inclusion, Vercel ne les embarquerait pas dans la fonction.
  outputFileTracingIncludes: {
    '/api/veille/migrer': ['./drizzle/**/*'],
    // Le contrôle du soir compare ce journal au registre de la base.
    '/api/veille/etat': ['./drizzle/meta/_journal.json'],
  },

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

    // Les lectures de la base « Accès — portail ». Volontairement court, pour
    // deux raisons. La révocation doit être effective à la requête suivante
    // (règle 8) : avec le profil `notion`, une case décochée resterait sans
    // effet jusqu'à une heure, sauf webhook. Et une ligne d'accès qui vient
    // d'être créée doit fonctionner tout de suite, sans quoi l'installation
    // d'un client paraît cassée alors qu'elle a réussi.
    // Le coût est nul : cette base tient en quelques lignes, et le débit
    // Notion reste très en deçà des trois requêtes par seconde.
    acces: {
      stale: 30,
      revalidate: 60,
      expire: 60 * 5,
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

  async redirects() {
    return [
      {
        // L'écran « Cadrage » est devenu « Périmètre » le 14 septembre 2026, en
        // accueillant la section des acteurs suivis. Un lecteur qui avait gardé
        // l'ancienne adresse doit arriver au bon endroit plutôt que sur un 404.
        source: '/:slug/cadrage',
        destination: '/:slug/perimetre',
        permanent: true,
      },
    ]
  },

  async headers() {
    return [
      {
        // Le service worker ne doit jamais être servi depuis un cache : c'est
        // lui qui décide de tout le reste. Et il lui faut la portée racine,
        // alors qu'il est servi depuis /public.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:chemin*',
        headers: [
          // Le jeton ne doit jamais fuir par l'en-tête Referer (règle 8).
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Vercel le pose sur ses propres domaines ; sur signauxfaibles.io il
          // est à nous. Un an, sous-domaines compris : le lien magique ne doit
          // jamais partir en clair.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // La politique de contenu vaut pour tout le portail, sauf l'admin
        // Payload et son API REST (22 octobre 2026) : l'admin charge ses
        // propres scripts et styles, que cette politique bornée à l'origine
        // casserait. Les autres en-têtes ci-dessus s'y appliquent, eux.
        source: '/((?!admin(?:/|$)|payload-api(?:/|$)).*)',
        headers: [{ key: 'Content-Security-Policy', value: POLITIQUE_DE_CONTENU }],
      },
    ]
  },
}

// `withPayload` ajoute ce dont l'admin et l'API Payload ont besoin (paquets
// externes côté serveur, en-têtes des routes Payload) sans toucher au reste.
export default withPayload(nextConfig)
