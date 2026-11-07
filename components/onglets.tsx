'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type Panneau = {
  readonly clé: string
  readonly libellé: string
  /** Une phrase sous le libellé, montrée seulement par la forme `cases`. */
  readonly description?: string
  readonly contenu: React.ReactNode
}

/**
 * Des onglets accessibles (motif ARIA « tabs ») : une seule vue à la fois, les
 * flèches gauche et droite passent d'un onglet à l'autre, Début et Fin vont aux
 * extrémités. Tous les panneaux sont rendus par le serveur et seulement masqués
 * (`hidden`) : la page reste lisible sans JavaScript dans son premier onglet, et
 * aucun contenu n'est chargé après coup.
 *
 * `ancre` : l'onglet suit l'ancre de l'adresse (`#pme`), pour qu'un lien puisse
 * ouvrir directement une vue. Un seul jeu d'onglets par page doit la porter.
 *
 * Sentence case, angle droit, filet de la charte : l'onglet courant est souligné
 * en rose, comme le lien courant de l'en-tête vitrine.
 *
 * `forme="cases"` (vitrine, 7 novembre 2026) : les onglets deviennent une rangée
 * de cases qui partagent leurs filets, libellé et description, pleine largeur
 * de leur bande ; l'onglet courant prend le fond neutre et un filet rose en
 * tête. Le panneau est alors posé avec les marges de la bande.
 */
export function Onglets({
  étiquette,
  panneaux,
  ancre = false,
  taille = 'grande',
  forme = 'soulignée',
}: {
  étiquette: string
  panneaux: readonly Panneau[]
  ancre?: boolean
  taille?: 'grande' | 'petite'
  forme?: 'soulignée' | 'cases'
}) {
  const base = useId()
  const [courant, setCourant] = useState(panneaux[0]?.clé ?? '')
  const boutons = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!ancre) return
    const lire = () => {
      const clé = window.location.hash.slice(1)
      if (panneaux.some((p) => p.clé === clé)) setCourant(clé)
    }
    lire()
    window.addEventListener('hashchange', lire)
    return () => window.removeEventListener('hashchange', lire)
  }, [ancre, panneaux])

  const choisir = (clé: string, focus = false) => {
    setCourant(clé)
    if (ancre) {
      try {
        window.history.replaceState(null, '', `#${clé}`)
      } catch {
        // Une adresse qui ne se réécrit pas ne doit pas empêcher de changer d'onglet.
      }
    }
    if (focus) boutons.current[panneaux.findIndex((p) => p.clé === clé)]?.focus()
  }

  const auClavier = (évènement: React.KeyboardEvent, index: number) => {
    const dernier = panneaux.length - 1
    const cible =
      évènement.key === 'ArrowRight' ? (index === dernier ? 0 : index + 1)
      : évènement.key === 'ArrowLeft' ? (index === 0 ? dernier : index - 1)
      : évènement.key === 'Home' ? 0
      : évènement.key === 'End' ? dernier
      : null
    if (cible === null) return
    évènement.preventDefault()
    const panneau = panneaux[cible]
    if (panneau) choisir(panneau.clé, true)
  }

  const enCases = forme === 'cases'
  const colonnes = panneaux.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : panneaux.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'

  return (
    <div className={enCases ? 'flex flex-col' : 'flex flex-col gap-6'}>
      {/* En cases, chaque case pose ses filets droit et bas ; le dernier filet droit déborde du cadre et s'y cache. */}
      <div className={enCases ? 'overflow-hidden border-t border-gris-ligne' : 'contents'}>
      <div
        role="tablist"
        aria-label={étiquette}
        className={
          enCases
            ? `-mr-px grid ${colonnes}`
            : 'flex flex-wrap gap-x-6 gap-y-2 border-b border-gris-ligne'
        }
      >
        {panneaux.map((panneau, index) => {
          const actif = panneau.clé === courant
          return (
            <button
              key={panneau.clé}
              ref={(élément) => {
                boutons.current[index] = élément
              }}
              type="button"
              role="tab"
              id={`${base}-onglet-${panneau.clé}`}
              aria-selected={actif}
              aria-controls={`${base}-panneau-${panneau.clé}`}
              tabIndex={actif ? 0 : -1}
              onClick={() => choisir(panneau.clé)}
              onKeyDown={(évènement) => auClavier(évènement, index)}
              className={
                enCases
                  ? `flex flex-col gap-2 border-r border-b border-gris-ligne p-4 text-left sm:p-6 ${
                      actif ? 'bg-fond-neutre shadow-[inset_0_2px_0_var(--color-rose)]' : 'bg-blanc hover:bg-fond-neutre'
                    }`
                  : `-mb-px border-b-2 pb-3 text-left ${
                      taille === 'grande' ? 'text-h3 font-semibold' : 'text-corps'
                    } ${
                      actif ? 'border-rose text-encre' : 'border-transparent text-ardoise hover:text-encre'
                    }`
              }
            >
              {enCases ? (
                <>
                  <span className={`font-titre text-h3 font-semibold ${actif ? 'text-encre' : 'text-ardoise'}`}>
                    {panneau.libellé}
                  </span>
                  {/* Sur mobile, le libellé seul : quatre descriptions empilées repousseraient le panneau d'un écran. */}
                  {panneau.description ? <span className="hidden text-ardoise sm:block">{panneau.description}</span> : null}
                </>
              ) : (
                panneau.libellé
              )}
            </button>
          )
        })}
      </div>
      </div>

      {panneaux.map((panneau) => (
        <div
          key={panneau.clé}
          role="tabpanel"
          id={`${base}-panneau-${panneau.clé}`}
          aria-labelledby={`${base}-onglet-${panneau.clé}`}
          hidden={panneau.clé !== courant}
          tabIndex={0}
          className={enCases ? 'min-w-0 px-6 py-12 lg:px-12' : 'min-w-0'}
        >
          {panneau.contenu}
        </div>
      ))}
    </div>
  )
}
