'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import type { Onglet } from '@/components/coquille'
import { estOngletCourant, répartirLeMenuBas } from '@/lib/portail/onglet'

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
        <ul id="menu-bas-plus" className="absolute inset-x-0 bottom-full flex flex-col border-t border-gris-ligne bg-blanc">
          {autres.map((onglet, rang) => {
            const courant = estOngletCourant(onglet, chemin)
            const rubrique = onglet.rubrique && onglet.rubrique !== autres[rang - 1]?.rubrique ? onglet.rubrique : null
            return [
              rubrique ? (
                <li key={`rubrique-${rubrique}`} aria-hidden="true" className="label-mono border-b border-gris-ligne bg-fond-neutre px-6 py-1.5 text-ardoise">
                  {rubrique}
                </li>
              ) : null,
              <li key={onglet.href} className="border-b border-gris-ligne">
                <Link
                  href={onglet.href}
                  aria-current={courant ? 'page' : undefined}
                  onClick={fermer}
                  className={`flex items-center justify-between gap-4 px-6 py-3 text-corps ${
                    courant ? 'bg-fond-neutre text-encre' : 'text-ardoise'
                  }`}
                >
                  <span>{onglet.libellé}</span>
                  {onglet.compte ? <span className="label-mono text-ardoise">{onglet.compte}</span> : null}
                </Link>
              </li>,
            ]
          })}
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
                className={`flex flex-col items-center gap-1 px-1 py-2.5 text-center ${
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
              className={`flex w-full flex-col items-center gap-1 px-1 py-2.5 text-center ${
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

/** Le trait rose au-dessus de l'élément courant. */
function Marque({ allumée }: { allumée: boolean }) {
  return <span aria-hidden="true" className={`h-0.5 w-6 rounded-full ${allumée ? 'bg-rose' : 'bg-transparent'}`} />
}
