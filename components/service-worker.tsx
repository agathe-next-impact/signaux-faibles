'use client'

import { useEffect } from 'react'

/**
 * Enregistre le service worker.
 *
 * En développement, on ne l'enregistre pas : un cache d'application masque les
 * changements et fait perdre plus de temps qu'il n'en gagne.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const enregistrer = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Un échec d'enregistrement ne doit rien casser : le portail marche
        // sans service worker, il perd seulement le hors-ligne.
      })
    }

    if (document.readyState === 'complete') enregistrer()
    else window.addEventListener('load', enregistrer, { once: true })
  }, [])

  return null
}

/** Demande au service worker d'oublier les pages mises en cache. */
export async function purgerLeCache(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const enregistrement = await navigator.serviceWorker.getRegistration()
  enregistrement?.active?.postMessage('purger')
}
