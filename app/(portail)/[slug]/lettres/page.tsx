import { redirect } from 'next/navigation'
import { exigerLecture } from '@/lib/auth/appartenance'
import { Case, EntêteÉcran, Grille, LienFlèche } from '@/components/coquille'
import { lettresPubliées, semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

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
 *
 * Dans l'espace réorganisé (31 octobre 2026, demande de l'opératrice), l'écran
 * appartient à la rubrique « Cette semaine » : il ne montre que les lettres de
 * la dernière semaine publiée, une carte par lettre sur une colonne, et renvoie
 * aux archives pour les semaines d'avant.
 */
export default async function Lettres({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { accès, lecture } = await exigerLecture(slug)
  if (lecture === 'aucune') redirect(`/${accès.slug}`)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  const réorganisé = espace?.réorganisé ?? false
  const lettres = lettresPubliées(réorganisé ? semaines.slice(0, 1) : semaines)

  return (
    <>
      <EntêteÉcran
        surtitre={réorganisé ? 'cette semaine' : 'lettres'}
        titre={réorganisé ? 'Les lettres de la semaine' : 'Toutes les lettres'}
        état={réorganisé && semaines[0] ? semaines[0].libellé : `${lettres.length} lettre${lettres.length > 1 ? 's' : ''}`}
      />

      {lettres.length === 0 ? (
        <p className="mt-8 text-ardoise">
          Aucune lettre publiée pour l’instant. Si vous en avez déjà reçu, dites-le nous :
          votre espace n’est peut-être pas encore relié à vos éditions.
        </p>
      ) : (
        <div className="mt-8">
          <Grille étiquette={réorganisé ? 'Lettres de la semaine' : 'Lettres publiées'} colonnes={réorganisé ? 1 : 3}>
            {lettres.map(({ édition, semaine }, rang) => (
              <Case key={édition.pageId} accent={!réorganisé && rang === 0}>
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
                {lecture === 'complète' && édition.actionDeLaSemaine ? (
                  <p className="text-ardoise">{édition.actionDeLaSemaine}</p>
                ) : null}
                <div className="mt-auto pt-1">
                  <LienFlèche href={`/${accès.slug}/lettres/${édition.pageId}`} étendu>
                    {lecture === 'complète' ? 'Lire' : 'Lire l’essentiel'}
                  </LienFlèche>
                </div>
              </Case>
            ))}
          </Grille>
          {réorganisé && semaines.length > 1 ? (
            <p className="mt-8">
              <LienFlèche href={`/${accès.slug}/archives`}>Voir les semaines précédentes</LienFlèche>
            </p>
          ) : null}
        </div>
      )}
    </>
  )
}
