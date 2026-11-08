'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Le cadre qui montre un courriel tel qu'il est reçu : le document est servi
 * entier par sa propre adresse (même origine) et le cadre prend sa hauteur,
 * pour que la page défile comme une page et non dans une boîte. La mesure se
 * fait au montage si le document est déjà là (il l'est souvent avant
 * l'hydratation), à son chargement sinon, et à chaque changement de largeur.
 * Tant que la hauteur n'est pas connue, un plein écran évite le saut.
 */
export function CadreCourriel({ src, titre }: { src: string; titre: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [hauteur, setHauteur] = useState<number | null>(null)

  useEffect(() => {
    const cadre = ref.current
    if (!cadre) return
    const mesurer = () => {
      try {
        const document = cadre.contentDocument
        const totale = document?.documentElement?.scrollHeight ?? 0
        if (totale > 0) setHauteur(totale + 8)
      } catch {
        // Hors de la même origine, rien à mesurer : le cadre garde sa hauteur.
      }
    }
    if (cadre.contentDocument?.readyState === 'complete') mesurer()
    cadre.addEventListener('load', mesurer)
    window.addEventListener('resize', mesurer)
    return () => {
      cadre.removeEventListener('load', mesurer)
      window.removeEventListener('resize', mesurer)
    }
  }, [src])

  return (
    <iframe
      ref={ref}
      src={src}
      title={titre}
      className="block w-full border-0 bg-blanc"
      style={{ height: hauteur ? `${hauteur}px` : '100vh' }}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="same-origin"
    />
  )
}
