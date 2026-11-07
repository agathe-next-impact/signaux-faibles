'use client'

import { useEffect, useRef } from 'react'

/**
 * La vidéo de l'espace (7 novembre 2026, montage LinkedIn de l'opératrice,
 * 57 s, carrée), rendue muette, en boucle, sans commande : une image animée du
 * produit, pas un film à regarder. Quand le système demande moins de mouvement,
 * elle reste sur son image d'attente. Fichiers dans `public/vitrine/`, ouverts
 * par le proxy en préfixe `/vitrine/`.
 */
export function VidéoDeLEspace({ className }: { className?: string }) {
  const vidéo = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = vidéo.current
    if (!v) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause()
      return
    }
    v.play().catch(() => undefined)
  }, [])
  return (
    <video
      ref={vidéo}
      className={className}
      src="/vitrine/espace.mp4"
      poster="/vitrine/espace.jpg"
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-label="L’espace client, écran par écran"
    />
  )
}
