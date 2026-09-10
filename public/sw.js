/*
 * Le service worker du portail.
 *
 * Deux règles, et une précaution.
 *
 * 1. Les fichiers versionnés de Next.js (`/_next/static`) sont immuables :
 *    cache d'abord, ils ne changent jamais sous un même nom.
 * 2. Les pages sont servies par le réseau d'abord, et le cache ne prend le
 *    relais que hors ligne. Une veille périmée servie alors qu'on est en ligne
 *    serait pire que pas de veille du tout.
 *
 * La précaution : le portail sert du contenu privé, propre à un client. Ce
 * cache vit sur l'appareil de la personne. Dès qu'une navigation est renvoyée
 * vers « recevoir mon lien » — accès révoqué, cookie expiré —, tout le cache
 * des pages est purgé. Sans cela, une révocation laisserait les éditions
 * lisibles hors ligne.
 */
const VERSION = 'v1'
const CACHE_PAGES = `sf-pages-${VERSION}`
const CACHE_ACTIFS = `sf-actifs-${VERSION}`
const HORS_LIGNE = '/hors-ligne'

/** Chemins qui ne doivent jamais être mis en cache. */
const JAMAIS = ['/api/webhooks/', '/acces/', '/quitter']

self.addEventListener('install', (événement) => {
  événement.waitUntil(
    caches.open(CACHE_PAGES).then((cache) => cache.addAll([HORS_LIGNE])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (événement) => {
  événement.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(
          noms
            .filter((nom) => nom.startsWith('sf-') && !nom.endsWith(VERSION))
            .map((nom) => caches.delete(nom)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Purge le cache des pages : appelée à la révocation, et par « quitter ». */
async function purgerLesPages() {
  await caches.delete(CACHE_PAGES)
  const cache = await caches.open(CACHE_PAGES)
  await cache.addAll([HORS_LIGNE])
}

self.addEventListener('message', (événement) => {
  if (événement.data === 'purger') événement.waitUntil(purgerLesPages())
})

self.addEventListener('fetch', (événement) => {
  const requête = événement.request
  if (requête.method !== 'GET') return

  const url = new URL(requête.url)
  if (url.origin !== self.location.origin) return
  if (JAMAIS.some((chemin) => url.pathname.startsWith(chemin))) return

  // 1. Fichiers versionnés : cache d'abord.
  if (url.pathname.startsWith('/_next/static')) {
    événement.respondWith(
      caches.match(requête).then(
        (enCache) =>
          enCache ??
          fetch(requête).then((réponse) => {
            const copie = réponse.clone()
            caches.open(CACHE_ACTIFS).then((cache) => cache.put(requête, copie))
            return réponse
          }),
      ),
    )
    return
  }

  // 2. Pages : réseau d'abord, cache en secours, page hors ligne en dernier.
  if (requête.mode === 'navigate') {
    événement.respondWith(
      fetch(requête)
        .then((réponse) => {
          // Accès révoqué : le portail a **redirigé** vers le formulaire. Le
          // drapeau `redirected` est indispensable ici — sans lui, la simple
          // visite du formulaire purgerait le cache, et plus aucune page ne
          // serait jamais disponible hors ligne.
          if (
            réponse.redirected &&
            new URL(réponse.url).pathname.startsWith('/recevoir-mon-lien')
          ) {
            événement.waitUntil(purgerLesPages())
            return réponse
          }
          if (réponse.ok) {
            const copie = réponse.clone()
            caches.open(CACHE_PAGES).then((cache) => cache.put(requête, copie))
          }
          return réponse
        })
        .catch(async () => {
          const enCache = await caches.match(requête)
          if (enCache) return enCache
          return (await caches.match(HORS_LIGNE)) ?? Response.error()
        }),
    )
    return
  }

  // 3. Le reste, dont les médias : cache d'abord, réseau ensuite.
  événement.respondWith(
    caches.match(requête).then(
      (enCache) =>
        enCache ??
        fetch(requête)
          .then((réponse) => {
            if (réponse.ok) {
              const copie = réponse.clone()
              caches.open(CACHE_ACTIFS).then((cache) => cache.put(requête, copie))
            }
            return réponse
          })
          .catch(() => Response.error()),
    ),
  )
})
