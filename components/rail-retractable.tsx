'use client'

import { useState } from 'react'
import { COOKIE_DU_RAIL } from '@/lib/portail/rail'

/**
 * Le rail latéral rétractable (30 octobre 2026, demande de l'opératrice). Sur
 * grand écran, un bouton le replie en une colonne étroite qui ne garde que lui,
 * pour laisser la largeur aux grilles et aux graphiques ; le choix est gardé un
 * an dans un cookie de préférence, sans rien d'identifiant. Sous cette largeur,
 * le rail n'a pas de navigation (le menu de pied la porte) : le bouton n'y
 * apparaît pas, et le rail reste ouvert.
 */
export function RailRétractable({ repliéAuDépart, children }: { repliéAuDépart: boolean; children: React.ReactNode }) {
  const [replié, setReplié] = useState(repliéAuDépart)
  const basculer = () => {
    const suivant = !replié
    setReplié(suivant)
    document.cookie = `${COOKIE_DU_RAIL}=${suivant ? 'replie' : 'ouvert'}; path=/; max-age=31536000; samesite=lax`
  }
  return (
    <aside
      data-replie={replié ? 'oui' : 'non'}
      className="group/rail shrink-0 border-b border-gris-ligne lg:w-64 lg:border-b-0 lg:border-r lg:data-[replie=oui]:w-14"
    >
      <div className="lg:sticky lg:top-[var(--bandeau)] lg:h-[calc(100dvh-var(--bandeau))] lg:group-data-[replie=oui]/rail:flex lg:group-data-[replie=oui]/rail:justify-center">
        <button
          type="button"
          onClick={basculer}
          aria-expanded={!replié}
          aria-controls="rail-contenu"
          title={replié ? 'Afficher le menu' : 'Replier le menu'}
          className="hidden h-10 w-10 items-center justify-center text-ardoise hover:text-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ardoise lg:mt-4 lg:ml-auto lg:mr-3 lg:flex lg:group-data-[replie=oui]/rail:mx-0"
        >
          <span className="sr-only">{replié ? 'Afficher le menu' : 'Replier le menu'}</span>
          <span aria-hidden="true" className="font-mono text-label">{replié ? '»' : '«'}</span>
        </button>
        <div id="rail-contenu" className="lg:h-[calc(100%-3.5rem)] lg:group-data-[replie=oui]/rail:hidden">
          {children}
        </div>
      </div>
    </aside>
  )
}
