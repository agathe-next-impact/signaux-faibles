import { Case, Grille, LienFlèche } from '@/components/coquille'
import type { CaseDÉcran } from '@/lib/domaine/tableau-de-bord'

/**
 * La grille des écrans d'une rubrique (30 octobre 2026) : une case par écran,
 * avec son chiffre clé et sa mention, cliquable en entier. Les chiffres sont
 * ceux de la carte de la rubrique sur la vue d'ensemble (`tableauDeLEspace`).
 */
export function GrilleDesÉcrans({ cases, étiquette }: { cases: readonly CaseDÉcran[]; étiquette: string }) {
  return (
    <Grille étiquette={étiquette} colonnes={cases.length >= 4 ? 4 : cases.length === 3 ? 3 : 2}>
      {cases.map((c) => (
        <Case key={c.href}>
          <h2 className="font-titre text-h3 font-semibold text-encre">{c.écran}</h2>
          <p className="text-corps font-medium text-encre">{c.valeur}</p>
          <p className="label-mono text-ardoise">{c.mention}</p>
          <div className="mt-auto pt-1">
            <LienFlèche href={c.href} étendu>
              Ouvrir
            </LienFlèche>
          </div>
        </Case>
      ))}
    </Grille>
  )
}
