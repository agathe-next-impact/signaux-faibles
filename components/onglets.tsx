'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type Panneau = {
  readonly clé: string
  readonly libellé: string
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
 */
export function Onglets({
  étiquette,
  panneaux,
  ancre = false,
  taille = 'grande',
}: {
  étiquette: string
  panneaux: readonly Panneau[]
  ancre?: boolean
  taille?: 'grande' | 'petite'
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

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={étiquette}
        className="flex flex-wrap gap-x-6 gap-y-2 border-b border-gris-ligne"
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
              className={`-mb-px border-b-2 pb-3 text-left ${
                taille === 'grande' ? 'text-h3 font-semibold' : 'text-corps'
              } ${
                actif ? 'border-rose text-encre' : 'border-transparent text-ardoise hover:text-encre'
              }`}
            >
              {panneau.libellé}
            </button>
          )
        })}
      </div>

      {panneaux.map((panneau) => (
        <div
          key={panneau.clé}
          role="tabpanel"
          id={`${base}-panneau-${panneau.clé}`}
          aria-labelledby={`${base}-onglet-${panneau.clé}`}
          hidden={panneau.clé !== courant}
          tabIndex={0}
          className="min-w-0"
        >
          {panneau.contenu}
        </div>
      ))}
    </div>
  )
}
