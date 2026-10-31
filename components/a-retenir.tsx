import Link from 'next/link'
import { BadgeImpact } from '@/components/badge-impact'
import { Texte } from '@/components/document'
import { Fraicheur } from '@/components/fraicheur'
import { TitreAxe } from '@/components/titre-axe'
import type { AxeÀRetenir } from '@/lib/domaine/tendances'

/**
 * « À retenir » (31 octobre 2026, demande de l'opératrice) : les points forts
 * et les nouveautés d'une lettre ou d'une semaine, en tête d'écran, pour qu'ils
 * se repèrent d'un coup d'œil. Un encadré isolé, hors grille : le filet rose à
 * gauche y est permis, il ne touche aucune case voisine (`Case` interdit le
 * trait de couleur parce que les cases partagent leurs filets). Fond blanc, le
 * badge FORT devant rester lisible. Le rose ne porte que le FORT et la
 * nouveauté, jamais un autre sens.
 */
export function ÀRetenir({
  titre,
  mention,
  axes,
  lien,
}: {
  titre: string
  mention?: string
  axes: readonly AxeÀRetenir[]
  /** Où mène un axe : son ancre dans la lettre, ou la page de l'axe. */
  lien: (axe: AxeÀRetenir) => string
}) {
  if (axes.length === 0) return null
  return (
    <section aria-label={titre} className="border border-l-4 border-gris-ligne border-l-rose bg-blanc p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="label-mono text-encre">{titre}</h2>
        {mention ? <p className="label-mono text-ardoise">{mention}</p> : null}
      </div>
      <ul className="mt-4 flex flex-col divide-y divide-gris-ligne">
        {axes.map((axe) => (
          <li key={axe.titre} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-3">
              {axe.fort ? <BadgeImpact niveau="FORT" /> : null}
              {axe.nouveau ? <Fraicheur fraîcheur="nouveau" libellé={axe.mouvement === 'monté' ? 'en hausse' : 'nouveau'} /> : null}
              <Link href={lien(axe)} className="font-titre text-h3 font-semibold text-encre underline decoration-gris-ligne underline-offset-4 hover:decoration-encre">
                <TitreAxe axe={axe} />
              </Link>
            </div>
            {axe.points[0] ? (
              <p className="max-w-[68ch] text-ardoise">
                <Texte segments={axe.points[0].segments} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
