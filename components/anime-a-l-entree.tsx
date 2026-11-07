'use client'

import { useEffect, useRef, useState } from 'react'

type État = 'repos' | 'attente' | 'joue'

/**
 * Anime un graphique de la vitrine quand il entre dans l'écran, une seule fois
 * (charte §05, amendement du 7 novembre 2026, vitrine seulement).
 *
 * Le serveur rend le graphique à sa valeur, sans `data-anime` : sans
 * JavaScript, rien ne bouge et rien ne manque. Au montage, un graphique déjà
 * visible joue tout de suite ; un graphique plus bas passe en `attente` (sa
 * marque réduite, encore visible) et joue quand il paraît. Le système qui
 * demande moins de mouvement l'emporte : rien n'est posé. Les règles visuelles
 * sont dans `app/globals.css` (`anime-etire`, `anime-apparait`), le rang de
 * chaque marque dans `--i`.
 */
export function AnimerÀLEntrée({ children, className }: { children: React.ReactNode; className?: string }) {
  const élément = useRef<HTMLDivElement>(null)
  const [état, setÉtat] = useState<État>('repos')

  useEffect(() => {
    const nœud = élément.current
    if (!nœud) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (typeof IntersectionObserver === 'undefined') return

    const visible = (boîte: DOMRect) => boîte.top < window.innerHeight && boîte.bottom > 0
    if (visible(nœud.getBoundingClientRect())) {
      setÉtat('joue')
      return
    }
    setÉtat('attente')
    const observateur = new IntersectionObserver(
      (entrées) => {
        if (entrées.some((e) => e.isIntersecting)) {
          setÉtat('joue')
          observateur.disconnect()
        }
      },
      // Le graphique joue quand un cinquième en est visible : assez pour qu'on le voie partir.
      { threshold: 0.2 },
    )
    observateur.observe(nœud)
    return () => observateur.disconnect()
  }, [])

  return (
    <div ref={élément} className={className} data-anime={état === 'repos' ? undefined : état}>
      {children}
    </div>
  )
}
