import { BadgeImpact } from '@/components/badge-impact'
import { Case, LienFlèche } from '@/components/coquille'
import { extraitDAxe, type Axe } from '@/lib/domaine/document'

/**
 * Un axe dans une grille.
 *
 * Le badge est en pied et non contre le titre : le titre garde toute la
 * largeur et ne se casse pas en deux mots par ligne.
 */
export function CaseAxe({ axe, href }: { axe: Axe; href: string }) {
  const extrait = extraitDAxe(axe)

  return (
    <Case>
      <h3 className="font-titre text-h3 font-semibold text-encre">{axe.titre}</h3>
      {extrait ? <p className="text-ardoise">{extrait}</p> : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <BadgeImpact niveau={axe.niveau} />
        <LienFlèche href={href}>Détail</LienFlèche>
      </div>
    </Case>
  )
}
