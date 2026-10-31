'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

/**
 * Le bouton d'un formulaire d'action serveur, sur les pages de l'opératrice
 * (31 octobre 2026) : pendant que l'action tourne, il se désactive et dit
 * « en cours », pour qu'un clic ne paraisse pas perdu et qu'un second ne
 * reparte pas (un lien d'accès renvoyé deux fois tombe sur la limitation de
 * débit). Sans JavaScript, le formulaire part comme avant.
 */
export function BoutonEnvoi({ className, children }: { className: string; children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? 'En cours…' : children}
    </button>
  )
}
