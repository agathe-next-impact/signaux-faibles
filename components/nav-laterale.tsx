'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Onglet } from '@/components/coquille'

/**
 * La navigation du rail. Cliente pour connaître l'écran courant : le layout est
 * partagé par les cinq écrans, et c'est le chemin qui les distingue.
 */
export function NavLatérale({ onglets }: { onglets: readonly Onglet[] }) {
  const chemin = usePathname()

  return (
    <nav aria-label="Sections" className="flex flex-wrap gap-1 lg:flex-col">
      {onglets.map((onglet) => {
        // L'archive garde son onglet actif sur la page d'une semaine.
        const courant =
          chemin === onglet.href ||
          (onglet.href.endsWith('/archives') && chemin.startsWith(`${onglet.href}/`))

        return (
          <Link
            key={onglet.href}
            href={onglet.href}
            aria-current={courant ? 'page' : undefined}
            className={`flex items-center justify-between gap-3 rounded-douce px-3 py-2 text-corps ${
              courant
                ? 'bg-fond-ardoise font-medium text-encre'
                : 'text-ardoise hover:bg-fond-neutre hover:text-encre'
            }`}
          >
            <span>{onglet.libellé}</span>
            {onglet.compte ? (
              <span className="label-mono rounded-full bg-fond-neutre px-2 py-0.5 text-ardoise">
                {onglet.compte}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
