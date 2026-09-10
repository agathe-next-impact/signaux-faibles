'use client'

import { useRef } from 'react'
import { purgerLeCache } from '@/components/service-worker'

/**
 * Quitter le portail sur cet appareil.
 *
 * Le portail fonctionne hors ligne : les semaines déjà ouvertes restent sur
 * l'appareil. Sur un poste partagé, il faut donc un geste pour les retirer.
 * On purge le cache **avant** de partir, puis la route efface le cookie.
 *
 * Un vrai formulaire, et non une navigation pilotée en JavaScript : la purge
 * est asynchrone, on suspend donc l'envoi le temps qu'elle finisse, puis on
 * laisse le navigateur poster normalement. Sans JavaScript, le bouton marche
 * encore — il ne purge simplement pas le cache.
 */
export function Quitter() {
  const formulaire = useRef<HTMLFormElement>(null)
  const purgé = useRef(false)

  return (
    <form
      ref={formulaire}
      method="post"
      action="/quitter"
      className="contents"
      onSubmit={(événement) => {
        if (purgé.current) return
        événement.preventDefault()
        void purgerLeCache().finally(() => {
          purgé.current = true
          formulaire.current?.requestSubmit()
        })
      }}
    >
      <button
        type="submit"
        className="self-start text-label text-ardoise underline decoration-gris-ligne underline-offset-2"
      >
        Quitter sur cet appareil
      </button>
    </form>
  )
}
