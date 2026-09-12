import { BadgeImpact } from '@/components/badge-impact'
import { Case, LienFlèche } from '@/components/coquille'
import { Texte } from '@/components/document'
import { Fraicheur } from '@/components/fraicheur'
import { SurtitreAxe } from '@/components/titre-axe'
import type { Extrait } from '@/lib/domaine/document'
import type { Fraîcheur } from '@/lib/domaine/fraicheur'
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
  fraîcheur,
  href,
}: {
  axe: { readonly titre: string; readonly numéro: number | null; readonly niveau: NiveauImpact | null }
  /**
   * Les éléments importants de la semaine, avec leur mise en forme. Ce sont des
   * extraits de la note : un gras ou un lien écrit dans la lettre se lit ici
   * comme il se lit dans Notion.
   */
  points: readonly Extrait[]
  /**
   * La fraîcheur de l'axe, avec le mot qui la dit. La couleur seule n'informe
   * pas ; la pastille et le libellé vont ensemble.
   */
  fraîcheur?: { readonly état: Fraîcheur; readonly libellé: string } | null
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
        {fraîcheur ? (
          <Fraicheur fraîcheur={fraîcheur.état} libellé={fraîcheur.libellé} />
        ) : null}
      </div>

      {points.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {points.map((point) => (
            <li key={point.texte} className="flex gap-2.5">
              {/* Puce carrée : la grille est à angle droit, ses puces aussi. */}
              <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 bg-ardoise" />
              <span className="text-encre">
                <Texte segments={point.segments} />
              </span>
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
