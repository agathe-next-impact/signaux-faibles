import Link from 'next/link'
import { BandeauLogos } from '@/components/bandeau-logos'
import { VidéoDeLEspace } from '@/components/video-espace'
import { BoutonDémo } from '@/components/vitrine'

/**
 * L'ouverture de l'accueil (7 novembre 2026, retenue par l'opératrice parmi
 * quatre candidates : « moins chargée, plus explicite, visuellement rapidement
 * parlante »). Un surtitre, un titre, un bouton, un lien, et l'espace qui
 * défile à droite, muet et en boucle : le produit se montre lui-même. Ni
 * chapeau ni chiffres : ils sont plus bas dans la page. Bande encre
 * (amendement du §02 de la charte du même jour). Les logos clients sont sous
 * les boutons depuis le 8 novembre 2026 (demande de l'opératrice : visibles
 * sans défiler), et non plus dans une bande sous l'ouverture.
 */
export function HéroVidéo({ titre }: { titre: string }) {
  return (
    <section className="grid grid-cols-1 border-b border-gris-ligne bg-encre lg:grid-cols-[1fr_minmax(0,32rem)]">
      <div className="flex items-center">
        <div className="flex flex-col gap-8 px-6 py-12 lg:px-12">
          <p className="label-mono text-gris-ligne">Veille hebdomadaire rédigée</p>
          <h1 className="font-titre text-h1 font-bold text-blanc">{titre}</h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <BoutonDémo négatif />
            <Link href="/exemple" className="group inline-flex items-center gap-1 text-blanc">
              Voir des exemples
              <span aria-hidden="true" className="text-rose transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
          <BandeauLogos négatif />
        </div>
      </div>
      <figure className="flex flex-col gap-3 p-6 lg:p-12">
        <VidéoDeLEspace className="aspect-square w-full border border-ardoise bg-blanc object-cover" />
        <figcaption className="label-mono text-gris-ligne">Votre espace, écran par écran · 1 min, sans son</figcaption>
      </figure>
    </section>
  )
}
