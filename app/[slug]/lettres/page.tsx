import { exigerAccès } from '@/lib/auth/appartenance'
import { Case, EntêteÉcran, Grille, LienFlèche } from '@/components/coquille'
import { lettresPubliées, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Lettres : la grille de tout ce qui a été envoyé.
 *
 * Une case par lettre, et non par semaine — c'est la différence avec les
 * archives. Deux lettres paraissent chaque semaine, une par veille ; on trouve
 * ici celle que l'on cherche sans passer par la semaine qui la porte.
 *
 * Cet écran ne lit **aucun corps de note** : tout vient de la liste des
 * éditions, déjà filtrée et cachée. Une grille de cinquante lettres coûte donc
 * exactement autant qu'une grille vide.
 */
export default async function Lettres({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const lettres = lettresPubliées(semaines)

  return (
    <>
      <EntêteÉcran
        surtitre="lettres"
        titre="Toutes les lettres"
        état={`${lettres.length} lettre${lettres.length > 1 ? 's' : ''}`}
      />

      {lettres.length === 0 ? (
        <p className="mt-8 text-ardoise">Aucune lettre publiée pour l’instant.</p>
      ) : (
        <div className="mt-8">
          <Grille étiquette="Lettres publiées">
            {lettres.map(({ édition, semaine }, rang) => (
              <Case key={édition.pageId} accent={rang === 0}>
                <p className="label-mono text-ardoise">
                  {édition.veille ?? 'veille'}
                  {édition.numéro !== null ? ` · n° ${édition.numéro}` : ''}
                </p>
                <h2 className="font-titre text-h3 font-semibold text-encre">
                  {semaine.libellé}
                </h2>
                {édition.périodeCouverte ? (
                  <p className="text-ardoise">{édition.périodeCouverte}</p>
                ) : null}
                {édition.actionDeLaSemaine ? (
                  <p className="text-ardoise">{édition.actionDeLaSemaine}</p>
                ) : null}
                <div className="mt-auto pt-1">
                  <LienFlèche href={`/${accès.slug}/lettres/${édition.pageId}`}>Lire</LienFlèche>
                </div>
              </Case>
            ))}
          </Grille>
        </div>
      )}
    </>
  )
}
