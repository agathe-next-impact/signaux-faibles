'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Onglet } from '@/components/coquille'
import { estOngletCourant, groupeCourant, grouperParRubrique } from '@/lib/portail/onglet'

/**
 * La navigation du rail. Cliente pour connaître l'écran courant : le layout est
 * partagé par les écrans, et c'est le chemin qui les distingue.
 *
 * Dans l'espace réorganisé, chaque rubrique est un accordéon (30 octobre 2026,
 * demande de l'opératrice) : un `details` natif, qui s'ouvre au clavier comme à
 * la souris, ouvert d'office sur la rubrique de l'écran courant. Son écran de
 * rubrique est le premier lien du panneau. Sans rubrique, le rail reste une
 * liste simple.
 */
export function NavLatérale({ onglets }: { onglets: readonly Onglet[] }) {
  const chemin = usePathname()

  return (
    <nav aria-label="Sections" className="flex flex-wrap gap-1 lg:flex-col">
      {grouperParRubrique(onglets).map((groupe, rang) =>
        groupe.rubrique ? (
          <details key={groupe.rubrique} open={groupeCourant(groupe, chemin)} className={`group/rubrique w-full ${rang > 0 ? 'pt-2' : ''}`}>
            <summary className="label-mono flex cursor-pointer list-none items-center justify-between gap-2 rounded-douce px-3 py-2 text-ardoise hover:bg-fond-neutre hover:text-encre [&::-webkit-details-marker]:hidden">
              <span>{groupe.rubrique}</span>
              <span aria-hidden="true" className="text-rose transition-transform group-open/rubrique:rotate-90">
                →
              </span>
            </summary>
            <div className="flex flex-col gap-1 pt-1">
              {groupe.rubriqueHref ? (
                <LienDOnglet href={groupe.rubriqueHref} courant={chemin === groupe.rubriqueHref}>
                  Vue de la rubrique<span className="sr-only"> {groupe.rubrique}</span>
                </LienDOnglet>
              ) : null}
              {groupe.onglets.map((onglet) => (
                <LienDOnglet key={onglet.href} href={onglet.href} courant={estOngletCourant(onglet, chemin)} compte={onglet.compte}>
                  {onglet.libellé}
                </LienDOnglet>
              ))}
            </div>
          </details>
        ) : (
          groupe.onglets.map((onglet) => (
            <LienDOnglet key={onglet.href} href={onglet.href} courant={estOngletCourant(onglet, chemin)} compte={onglet.compte}>
              {onglet.libellé}
            </LienDOnglet>
          ))
        ),
      )}
    </nav>
  )
}

function LienDOnglet({ href, courant, compte, children }: { href: string; courant: boolean; compte?: number | null; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={courant ? 'page' : undefined}
      className={`flex items-center justify-between gap-3 rounded-douce px-3 py-2 text-corps ${
        courant ? 'bg-fond-ardoise font-medium text-encre' : 'text-ardoise hover:bg-fond-neutre hover:text-encre'
      }`}
    >
      <span>{children}</span>
      {compte ? <span className="label-mono rounded-full bg-fond-neutre px-2 py-1 text-ardoise">{compte}</span> : null}
    </Link>
  )
}
