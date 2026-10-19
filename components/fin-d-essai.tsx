import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { PurgeHorsLigne } from '@/components/purge-hors-ligne'
import { ChoixDeFormule, RetourDAbonnement } from '@/components/abonnement'
import { ADRESSE_D_ABONNEMENT } from '@/lib/domaine/offre'
import type { Offre } from '@/lib/domaine/parcours'

/**
 * La vue d'ensemble d'un espace dont l'essai est terminé (palier 1c).
 *
 * Elle remplace le tableau de bord, qui assemble des passages de plusieurs
 * lettres : rien de ce qu'elle montre ne vient d'une lettre. Deux cas :
 *   · `essentiel` (la semaine qui suit l'essai) : les lettres restent ouvertes,
 *     réduites à « L'essentiel » ;
 *   · `aucune` (au-delà) : l'espace est suspendu, les lettres sont conservées.
 * Une suspension posée par l'opérateur (`suspenduAlaMain`) n'est pas une fin
 * d'essai : elle peut frapper un abonné, à qui proposer de s'abonner serait
 * absurde. Elle a son propre texte, sans prix.
 */
export function FinDEssai({
  slug,
  lecture,
  suspenduAlaMain,
  retour,
  offre = 'standard',
}: {
  slug: string
  lecture: 'essentiel' | 'aucune'
  suspenduAlaMain: boolean
  offre?: Offre
  /** `?abonnement=` : retour de la page de paiement, ou refus. */
  retour?: string | undefined
}) {
    if (suspenduAlaMain) {
    return (
      <>
        <PurgeHorsLigne />
        <EntêteÉcran surtitre="veille personnalisée" titre="Votre espace est suspendu" />
        <div className="mt-8 flex max-w-prose flex-col gap-6">
          <Panneau ton="rose">
            <p className="text-encre">
              Votre espace est momentanément suspendu. Vos lettres et vos archives sont conservées.
              Pour en savoir plus, écrivez à{' '}
              <a className="underline" href={`mailto:${ADRESSE_D_ABONNEMENT}`}>
                {ADRESSE_D_ABONNEMENT}
              </a>
              .
            </p>
          </Panneau>
        </div>
      </>
    )
  }
  return (
    <>
      <PurgeHorsLigne />
      <EntêteÉcran
        surtitre="veille personnalisée"
        titre={lecture === 'essentiel' ? 'Votre essai est terminé' : 'Votre espace est suspendu'}
      />
      <div className="mt-8 flex max-w-prose flex-col gap-6">
        <RetourDAbonnement motif={retour} />
        <Panneau ton="rose">
          {lecture === 'essentiel' ? (
            <p className="text-encre">
              Vos premières parutions étaient complètes. Cette semaine, chaque lettre est réduite à
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
            L’abonnement couvre votre organisation, ses deux veilles et trois lecteurs.
          </p>
          <ChoixDeFormule slug={slug} offre={offre} />
          <p className="text-ardoise">
            Paiement sécurisé par Stripe, facture à chaque échéance. Pour un bon de commande ou
            un virement, écrivez à{' '}
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
