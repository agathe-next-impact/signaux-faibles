'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

/**
 * Le bouton d'un formulaire d'action serveur, sur les pages de l'opératrice
 * (31 octobre 2026) : pendant que l'action tourne, il se désactive et dit
 * « en cours », pour qu'un clic ne paraisse pas perdu et qu'un second ne
 * reparte pas (un lien d'accès renvoyé deux fois tombe sur la limitation de
 * débit). Sans JavaScript, le formulaire part comme avant.
 *
 * Un indicateur tournant précède « En cours… » (demande de l'opératrice du
 * 31 octobre 2026) : un anneau à la couleur du texte du bouton, qui ne tourne
 * qu'en `prefers-reduced-motion: no-preference` et reste fixe sinon ; le mot
 * dit l'attente dans les deux cas, et `aria-busy` la dit aux lecteurs d'écran.
 */
export function BoutonEnvoi({ className, children }: { className: string; children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
          En cours…
        </>
      ) : (
        children
      )}
    </button>
  )
}
