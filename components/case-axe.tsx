import { BadgeImpact } from '@/components/badge-impact'
import { Case, LienFlèche } from '@/components/coquille'
import { SurtitreAxe } from '@/components/titre-axe'
import type { NiveauImpact } from '@/lib/domaine/impact'

/**
 * Un axe dans une grille.
 *
 * Le nom de l'axe est en surtitre et non en titre : ce que la case doit donner
 * à lire, ce sont les éléments importants de la semaine, pas le nom d'une
 * rubrique que le lecteur connaît déjà. Le nom reste néanmoins en encre, assez
 * appuyé pour situer la case d'un coup d'œil.
 *
 * Le badge est en pied, sur la même ligne que le lien : la case entière mène au
 * suivi de l'axe, et le lien est étendu plutôt qu'enveloppant pour que son nom
 * accessible reste « Détail » et non toute la liste.
 */
export function CaseAxe({
  axe,
  points,
  mention,
  href,
}: {
  axe: { readonly titre: string; readonly numéro: number | null; readonly niveau: NiveauImpact | null }
  points: readonly string[]
  /**
   * Une mention de contexte — le mouvement de l'axe. `accentuée` la passe en
   * rose : c'est le seul accent possible ici, le fond de la case devant rester
   * blanc (voir le commentaire du composant).
   */
  mention?: { readonly texte: string; readonly accentuée?: boolean } | null
  href: string
}) {
  return (
    // Jamais de fond accentué sur une case d'axe : les trois badges d'impact
    // occupent les trois fonds teintés de la charte, et un fond de case teinté
    // en effacerait un. « Signal fort » sur fond rose disparaissait ainsi
    // entièrement.
    <Case>
      <div className="flex flex-col gap-1">
        <SurtitreAxe axe={axe} />
        {mention ? (
          <p className={`label-mono ${mention.accentuée ? 'text-rose' : 'text-ardoise'}`}>
            {mention.texte}
          </p>
        ) : null}
      </div>

      {points.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {points.map((point) => (
            <li key={point} className="flex gap-2.5">
              {/* Puce carrée : la grille est à angle droit, ses puces aussi. */}
              <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 bg-ardoise" />
              <span className="text-encre">{point}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ardoise">Aucun développement cette semaine.</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <BadgeImpact niveau={axe.niveau} />
        <LienFlèche href={href} étendu>
          Détail
        </LienFlèche>
      </div>
    </Case>
  )
}
