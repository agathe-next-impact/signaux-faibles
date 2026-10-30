'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Onglet } from '@/components/coquille'
import { estOngletCourant } from '@/lib/portail/onglet'

/**
 * La navigation du rail. Cliente pour connaître l'écran courant : le layout est
 * partagé par les cinq écrans, et c'est le chemin qui les distingue.
 */
export function NavLatérale({ onglets }: { onglets: readonly Onglet[] }) {
  const chemin = usePathname()

  return (
    <nav aria-label="Sections" className="flex flex-wrap gap-1 lg:flex-col">
      {onglets.map((onglet, rang) => {
        const courant = estOngletCourant(onglet, chemin)
        // Le nom de la rubrique, posé avant son premier onglet (espace réorganisé).
        const rubrique = onglet.rubrique && onglet.rubrique !== onglets[rang - 1]?.rubrique ? onglet.rubrique : null

        return [
          rubrique ? (
            onglet.rubriqueHref ? (
              <Link
                key={`rubrique-${rubrique}`}
                href={onglet.rubriqueHref}
                aria-current={chemin === onglet.rubriqueHref ? 'page' : undefined}
                className={`label-mono w-full px-3 pb-1 hover:text-encre ${chemin === onglet.rubriqueHref ? 'text-encre' : 'text-ardoise'} ${rang > 0 ? 'pt-4' : ''}`}
              >
                {rubrique} →
              </Link>
            ) : (
              <p key={`rubrique-${rubrique}`} className={`label-mono w-full px-3 pb-1 text-ardoise ${rang > 0 ? 'pt-4' : ''}`}>
                {rubrique}
              </p>
            )
          ) : null,
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
              <span className="label-mono rounded-full bg-fond-neutre px-2 py-1 text-ardoise">
                {onglet.compte}
              </span>
            ) : null}
          </Link>,
        ]
      })}
    </nav>
  )
}
