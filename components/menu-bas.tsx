'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import type { Onglet } from '@/components/coquille'
import { estOngletCourant, groupeCourant, grouperParRubrique, répartirLeMenuBas } from '@/lib/portail/onglet'

/**
 * Le menu de pied, sur mobile, sur le site comme dans l'application installée.
 *
 * Il porte les mêmes écrans que le rail latéral, qui disparaît sous l'écran
 * large. En application installée, c'est la barre que le pouce atteint ; d'où
 * le retrait sous la zone sûre des appareils à encoche.
 *
 * Trois éléments au plus (décision du 25 octobre 2026) : la vue d'ensemble, les
 * lettres, et « Plus », qui ouvre au-dessus de la barre la liste des autres
 * écrans, dans l'ordre du rail et sous leur libellé entier. Jusque-là, les sept
 * écrans s'y partageaient la largeur et la barre défilait : on ne voyait pas
 * qu'il en restait, et les libellés devaient être abrégés (« Reco. »,
 * « Périm. »). Quand l'espace n'a que un ou deux écrans (fin d'essai), ils sont
 * posés directement et « Plus » n'existe pas : `répartirLeMenuBas`.
 *
 * La liste ne reste ouverte que sur le chemin où elle a été ouverte : changer
 * d'écran la referme, sans effet ni écouteur à défaire.
 *
 * Dans l'espace réorganisé, les rubriques de la liste sont des accordéons
 * (30 octobre 2026), comme dans le rail : fermées, sauf celle de l'écran
 * courant ; l'écran de la rubrique est le premier lien de son panneau.
 */
export function MenuBas({ onglets }: { onglets: readonly Onglet[] }) {
  const chemin = usePathname()
  const { directs, autres } = répartirLeMenuBas(onglets)
  const [ouvertSur, setOuvertSur] = useState<string | null>(null)
  const ouvert = autres.length > 0 && ouvertSur === chemin
  const bouton = useRef<HTMLButtonElement>(null)
  const surUnAutre = autres.some((onglet) => estOngletCourant(onglet, chemin))

  function fermer() {
    setOuvertSur(null)
  }

  return (
    <nav
      aria-label="Sections"
      className="sticky bottom-0 z-30 border-t border-gris-ligne bg-blanc pb-[env(safe-area-inset-bottom)] lg:hidden"
      onKeyDown={(évènement) => {
        if (évènement.key === 'Escape' && ouvert) {
          fermer()
          bouton.current?.focus()
        }
      }}
    >
      {ouvert ? (
        <ul id="menu-bas-plus" className="absolute inset-x-0 bottom-full flex max-h-[70dvh] flex-col overflow-y-auto border-t border-gris-ligne bg-blanc">
          {grouperParRubrique(autres).map((groupe) =>
            groupe.rubrique ? (
              <li key={groupe.rubrique} className="border-b border-gris-ligne">
                <details open={groupeCourant(groupe, chemin)} className="group/rubrique">
                  <summary className="label-mono flex cursor-pointer list-none items-center justify-between bg-fond-neutre px-6 py-3 text-ardoise [&::-webkit-details-marker]:hidden">
                    <span>{groupe.rubrique}</span>
                    <span aria-hidden="true" className="text-rose transition-transform group-open/rubrique:rotate-90">
                      →
                    </span>
                  </summary>
                  <ul>
                    {groupe.rubriqueHref ? (
                      <ÉlémentDeListe href={groupe.rubriqueHref} courant={chemin === groupe.rubriqueHref} onClick={fermer}>
                        Vue de la rubrique<span className="sr-only"> {groupe.rubrique}</span>
                      </ÉlémentDeListe>
                    ) : null}
                    {groupe.onglets.map((onglet) => (
                      <ÉlémentDeListe key={onglet.href} href={onglet.href} courant={estOngletCourant(onglet, chemin)} compte={onglet.compte} onClick={fermer}>
                        {onglet.libellé}
                      </ÉlémentDeListe>
                    ))}
                  </ul>
                </details>
              </li>
            ) : (
              groupe.onglets.map((onglet) => (
                <ÉlémentDeListe key={onglet.href} href={onglet.href} courant={estOngletCourant(onglet, chemin)} compte={onglet.compte} onClick={fermer}>
                  {onglet.libellé}
                </ÉlémentDeListe>
              ))
            ),
          )}
        </ul>
      ) : null}

      <ul className="flex">
        {directs.map((onglet) => {
          const courant = estOngletCourant(onglet, chemin)

          return (
            <li key={onglet.href} className="min-w-0 flex-1">
              <Link
                href={onglet.href}
                aria-current={courant ? 'page' : undefined}
                onClick={fermer}
                className={`flex flex-col items-center gap-1 px-1 py-3 text-center ${
                  courant ? 'text-encre' : 'text-ardoise'
                }`}
              >
                <Marque allumée={courant} />
                <span className="truncate text-label">{onglet.libelléCourt}</span>
                {onglet.compte ? (
                  <span className="label-mono text-ardoise">{onglet.compte}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
        {autres.length > 0 ? (
          <li className="min-w-0 flex-1">
            <button
              ref={bouton}
              type="button"
              aria-expanded={ouvert}
              aria-controls="menu-bas-plus"
              onClick={() => setOuvertSur(ouvert ? null : chemin)}
              className={`flex w-full flex-col items-center gap-1 px-1 py-3 text-center ${
                surUnAutre || ouvert ? 'text-encre' : 'text-ardoise'
              }`}
            >
              <Marque allumée={surUnAutre} />
              <span className="truncate text-label">Plus</span>
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}

/** Un écran de la liste ouverte par « Plus ». */
function ÉlémentDeListe({
  href,
  courant,
  compte,
  onClick,
  children,
}: {
  href: string
  courant: boolean
  compte?: number | null
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <li className="border-t border-gris-ligne first:border-t-0">
      <Link
        href={href}
        aria-current={courant ? 'page' : undefined}
        onClick={onClick}
        className={`flex items-center justify-between gap-4 px-6 py-3 text-corps ${courant ? 'bg-fond-neutre text-encre' : 'text-ardoise'}`}
      >
        <span>{children}</span>
        {compte ? <span className="label-mono text-ardoise">{compte}</span> : null}
      </Link>
    </li>
  )
}

/** Le trait rose au-dessus de l'élément courant. */
function Marque({ allumée }: { allumée: boolean }) {
  return <span aria-hidden="true" className={`h-0.5 w-6 rounded-full ${allumée ? 'bg-rose' : 'bg-transparent'}`} />
}
