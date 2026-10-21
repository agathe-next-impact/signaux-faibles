'use client'

import { useEffect } from 'react'
import { CLASSE_ACTION_DE_SECOURS } from '@/components/page-de-secours'

/**
 * L'erreur d'un écran de l'espace client, rendue **dans** le rail.
 *
 * Une page qui tombe ne doit pas faire perdre le cadre : le lecteur garde le
 * menu, les autres écrans continuent de répondre, et il peut réessayer celui-ci.
 * Comme `app/error.tsx`, aucun message technique n'est affiché.
 */
export default function ErreurDEcran({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(`[portail] écran en erreur (digest ${error.digest ?? 'absent'})`)
  }, [error])

  return (
    <section className="flex flex-col gap-4 py-8">
      <h2 className="font-titre text-h2 font-bold text-encre">Cet écran n’a pas pu s’ouvrir</h2>
      <p className="text-ardoise">
        Les autres écrans de votre espace restent disponibles. Vous pouvez réessayer celui-ci.
      </p>
      <div>
        <button type="button" onClick={reset} className={CLASSE_ACTION_DE_SECOURS}>
          Réessayer
        </button>
      </div>
    </section>
  )
}
