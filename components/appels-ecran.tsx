import { BadgeImpact } from '@/components/badge-impact'
import { Fraicheur } from '@/components/fraicheur'
import { LienFlèche } from '@/components/coquille'
import type { AppelSuivi } from '@/lib/domaine/appels'
import { dateCourte } from '@/lib/domaine/strategie-vues'

/**
 * Le rendu de l'écran « Appels à projets » (18 novembre 2026). Ne lit rien :
 * l'écran lui passe les appels suivis, calculés à la lecture. Le rose ne porte
 * que le FORT et la nouveauté, l'ocre la date de clôture (charte §02).
 */

const dateLongue = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

function délai(jours: number): string {
  if (jours < 0) return `clos depuis ${-jours} jour${-jours > 1 ? 's' : ''}`
  if (jours === 0) return 'clôture aujourd’hui'
  return `dans ${jours} jour${jours > 1 ? 's' : ''}`
}

export function ListeDesAppels({
  appels,
  slug,
  pages,
  clos = false,
}: {
  appels: readonly AppelSuivi[]
  slug: string
  /** Identifiant normalisé de l'édition vers son identifiant d'adresse. */
  pages: ReadonlyMap<string, string>
  clos?: boolean
}) {
  return (
    <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
      {appels.map((a) => {
        const page = pages.get(a.édition)
        return (
          <li key={a.clé} className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
            <div className="flex flex-col gap-1">
              <p className={`font-mono text-label ${clos ? 'text-ardoise' : 'text-ocre-texte'}`}>{dateLongue(a.clôture)}</p>
              <p className="font-mono text-label text-ardoise">{délai(a.joursAvantClôture)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                {clos ? null : <BadgeImpact niveau={a.impact === 'fort' ? 'FORT' : 'MOYEN'} />}
                {a.nouveau && !clos ? <Fraicheur fraîcheur="nouveau" libellé="nouveau" /> : null}
                {a.àVérifier ? <span className="label-mono rounded-full bg-fond-neutre px-3 py-1 text-ardoise">à vérifier</span> : null}
              </div>
              <p className="leading-snug text-encre">
                {a.financeur ? <span className="font-semibold">{a.financeur} : </span> : null}
                {a.intitulé}
              </p>
              <p className="font-mono text-label text-ardoise">
                relevé le {dateCourte(a.premièreVue)}
                {a.dernièreVue !== a.premièreVue ? `, cité encore le ${dateCourte(a.dernièreVue)}` : ''}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {a.adresse ? (
                  <a href={a.adresse} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-encre underline decoration-gris-ligne underline-offset-4">
                    Ouvrir l’appel
                    <span aria-hidden="true" className="text-rose">↗</span>
                  </a>
                ) : null}
                {page ? <LienFlèche href={`/${slug}/lettres/${page}`}>Ce qu’en dit la lettre</LienFlèche> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
