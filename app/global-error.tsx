'use client'

import { useEffect } from 'react'
import './globals.css'

/**
 * Le dernier filet : l'erreur qui a fait tomber le layout racine lui-même.
 *
 * Ce composant remplace `<html>` et `<body>`, donc les polices de la charte ne
 * sont pas chargées ; les classes de la charte restent valides et retombent sur
 * les polices de secours du navigateur. Le texte est le même que celui de
 * `app/error.tsx`, et comme lui il ne dit rien de technique.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(`[portail] erreur globale (digest ${error.digest ?? 'absent'})`)
  }, [error])

  return (
    <html lang="fr">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-12">
          <p className="font-titre text-h3 font-bold text-encre">signauxfaibles</p>
          <h2 className="font-titre text-h2 font-bold text-encre">
            Le portail est momentanément indisponible
          </h2>
          <p className="text-ardoise">
            Rien n’est perdu : vos lettres sont conservées, et l’opérateur est prévenu.
          </p>
          <div>
            <button
              type="button"
              onClick={reset}
              className="inline-block rounded-douce bg-encre px-4 py-2 text-corps font-medium text-blanc"
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
