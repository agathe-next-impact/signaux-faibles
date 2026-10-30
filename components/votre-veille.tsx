import type { MoisDuCalendrier } from '@/lib/domaine/fiche-veille'
import type { Veille } from '@/lib/domaine/strategie'
import { dateCourte } from '@/lib/domaine/strategie-vues'

/**
 * Les briques communes des écrans « Votre veille » (lot 6, 30 octobre 2026).
 * Les numéros de familles se répètent d'une veille à l'autre : chaque écran
 * range donc ses lignes sous la veille qui les porte, nommée pour le lecteur.
 */
export const VEILLES_AFFICHÉES: readonly { readonly veille: Veille; readonly titre: string }[] = [
  { veille: 'ecosysteme', titre: 'Votre environnement' },
  { veille: 'concurrentiel', titre: 'Votre concurrence' },
]

/** Ce qu'un écran dit tant que l'opératrice n'a pas publié la fiche de veille. */
export function PasEncorePubliée({ quoi }: { quoi: string }) {
  return (
    <p className="mt-6 max-w-[68ch] border border-gris-ligne bg-fond-neutre p-4 text-ardoise">
      {quoi} n’est pas encore publié. La fiche de votre veille est rédigée à la revue du mois, relue, puis publiée ici.
    </p>
  )
}

/**
 * Le calendrier en frise verticale (30 octobre 2026, demande de l'opératrice) :
 * le mois à gauche, un fil continu, un repère carré par mois, ocre s'il porte
 * une échéance (l'ocre porte le temps, charte §02), gris de filet sinon ; un
 * mois vide le dit, il n'est pas un mois calme.
 */
export function FriseDesÉchéances({ mois }: { mois: readonly MoisDuCalendrier[] }) {
  return (
    <ol className="mt-4 flex flex-col" aria-label="Échéances des douze prochains mois">
      {mois.map((m) => {
        const occupé = m.échéances.length > 0
        return (
          <li key={m.mois} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <p className={`label-mono pt-1 text-right ${occupé ? 'text-encre' : 'text-ardoise'}`}>{m.libellé}</p>
            <div className="relative flex flex-col gap-4 border-l-2 border-gris-ligne pb-8 pl-6">
              <span aria-hidden="true" className={`absolute top-2 -left-[6px] size-[10px] ${occupé ? 'bg-ocre' : 'bg-gris-ligne'}`} />
              {occupé ? (
                m.échéances.map((é) => (
                  <div key={`${é.date}-${é.libellé}`} className="flex flex-col gap-1">
                    <p className="font-mono text-label text-ocre-texte">{dateCourte(é.date)}</p>
                    <p className="leading-snug text-encre">{é.libellé}</p>
                    {é.famille ? <p className="font-mono text-label text-ardoise">{é.famille}</p> : null}
                  </div>
                ))
              ) : (
                <p className="pt-1 text-sm text-ardoise">Rien d’annoncé pour l’instant.</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
