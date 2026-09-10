'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Onglet } from '@/components/coquille'
import { estOngletCourant } from '@/lib/portail/onglet'

/**
 * Le menu de pied, sur mobile.
 *
 * Il porte les mêmes cinq écrans que le rail latéral, qui disparaît sous
 * l'écran large. En application installée, c'est la barre que le pouce
 * atteint ; d'où le retrait sous la zone sûre des appareils à encoche.
 */
export function MenuBas({ onglets }: { onglets: readonly Onglet[] }) {
  const chemin = usePathname()

  return (
    <nav
      aria-label="Sections"
      className="sticky bottom-0 z-30 border-t border-gris-ligne bg-blanc pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {onglets.map((onglet) => {
          const courant = estOngletCourant(onglet, chemin)

          return (
            <li key={onglet.href} className="min-w-0 flex-1">
              <Link
                href={onglet.href}
                aria-current={courant ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-1 py-2.5 text-center ${
                  courant ? 'text-encre' : 'text-ardoise'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-0.5 w-6 rounded-full ${courant ? 'bg-rose' : 'bg-transparent'}`}
                />
                <span className="truncate text-label">{onglet.libelléCourt}</span>
                {onglet.compte ? (
                  <span className="label-mono text-ardoise">{onglet.compte}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
