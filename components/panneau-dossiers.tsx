import { lireDossiersOuverts } from '@/lib/domaine/dossiers'

/**
 * Les dossiers ouverts suivis d'édition en édition.
 *
 * Le compteur est le nombre de semaines où le dossier a été rouvert sans avoir
 * bougé. Un compteur absent n'est pas affiché comme un zéro : zéro veut dire
 * « rouvert, rien de neuf », l'absence veut dire « format non lu ».
 */
export function PanneauDossiers({ brut }: { brut: string }) {
  const dossiers = lireDossiersOuverts(brut)
  if (dossiers.length === 0) return null

  return (
    <section className="rounded-carte border border-trait-tenu bg-papier-creux p-4">
      <h3 className="font-mono text-xs uppercase tracking-wide text-encre-tenue">
        Dossiers ouverts
      </h3>

      <ul className="mt-3 flex flex-col gap-2">
        {dossiers.map((dossier, index) => (
          <li key={index} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="text-encre">{dossier.nom}</span>
            {dossier.compteur !== null ? (
              <span
                className="font-mono text-xs text-encre-tenue"
                title={`${dossier.compteur} semaine(s) sans mouvement`}
              >
                {dossier.compteur}
              </span>
            ) : null}
            {dossier.précision ? (
              <span className="text-encre-douce">— {dossier.précision}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
