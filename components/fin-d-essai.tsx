import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { ADRESSE_D_ABONNEMENT, PRIX_ANNUEL_HT, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'

/**
 * La vue d'ensemble d'un espace dont l'essai est terminé (palier 1c).
 *
 * Elle remplace le tableau de bord, qui assemble des passages de plusieurs
 * lettres : rien de ce qu'elle montre ne vient d'une lettre. Deux cas :
 *   · `essentiel` (la semaine qui suit l'essai) : les lettres restent ouvertes,
 *     réduites à « L'essentiel » ;
 *   · `aucune` (au-delà) : l'espace est suspendu, les lettres sont conservées.
 */
export function FinDEssai({ slug, lecture }: { slug: string; lecture: 'essentiel' | 'aucune' }) {
  const prix = `${PRIX_MENSUEL_HT} € HT par mois, ou ${PRIX_ANNUEL_HT} € HT par an`
  return (
    <>
      <EntêteÉcran
        surtitre="veille personnalisée"
        titre={lecture === 'essentiel' ? 'Votre essai est terminé' : 'Votre espace est suspendu'}
      />
      <div className="mt-8 flex max-w-prose flex-col gap-6">
        <Panneau ton="rose">
          {lecture === 'essentiel' ? (
            <p className="text-encre">
              Vos trois premières parutions étaient complètes. Cette semaine, chaque lettre est réduite à
              sa rubrique « L’essentiel ». Les lettres complètes, les axes, les acteurs, les
              recommandations et vos archives sont réservés aux abonnés.
            </p>
          ) : (
            <p className="text-encre">
              Votre essai est terminé. Vos lettres et vos archives sont conservées : elles redeviennent
              lisibles dès votre abonnement.
            </p>
          )}
        </Panneau>
        <div className="flex flex-col gap-2">
          <h2 className="font-titre text-h3 font-semibold text-encre">S’abonner</h2>
          <p className="text-ardoise">
            L’abonnement couvre votre organisation, ses deux veilles et trois lecteurs : {prix}.
          </p>
          <p className="text-ardoise">
            Pour vous abonner, écrivez à{' '}
            <a className="text-encre underline" href={`mailto:${ADRESSE_D_ABONNEMENT}`}>
              {ADRESSE_D_ABONNEMENT}
            </a>
            .
          </p>
        </div>
        {lecture === 'essentiel' ? (
          <p>
            <LienFlèche href={`/${slug}/lettres`}>Lire l’essentiel des lettres</LienFlèche>
          </p>
        ) : null}
      </div>
    </>
  )
}
