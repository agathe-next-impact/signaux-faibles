import Link from 'next/link'
import { gérerLAbonnement, souscrire } from '@/lib/portail/abonnement'
import {
  DÉFINITIONS_DES_FORFAITS,
  enEuros,
  FORFAITS,
  FRAIS_DE_MISE_EN_PLACE_HT,
  HEURES_DE_PRISE_EN_MAIN,
  plafondDeLecteurs,
  prixAnnuelDuForfaitHT,
  PRIX_FONDATEUR_HT,
  équivalentMensuelDuForfait,
  type Forfait,
} from '@/lib/domaine/offre'
import type { Formule } from '@/lib/stripe/souscription'
import type { Offre } from '@/lib/domaine/parcours'

/**
 * Le chemin vers « Mon abonnement », dans le pied du rail (19 octobre 2026).
 * Toujours présent, quel que soit le droit de lecture : un espace suspendu
 * doit encore mener à l'endroit où l'on s'abonne. Ce n'est pas un onglet : les
 * onglets sont les écrans de veille, et le menu de pied en porte déjà sept.
 */
export function LienMonAbonnement({ slug }: { slug: string }) {
  return (
    <Link
      href={`/${slug}/abonnement`}
      className="self-start text-label text-ardoise underline decoration-gris-ligne underline-offset-2"
    >
      Mon abonnement
    </Link>
  )
}

/**
 * Les boutons d'abonnement (palier 1c). De vrais formulaires, comme
 * « resynchroniser » et « quitter » : l'action serveur porte le contrôle, le
 * slug voyage en champ caché et y est vérifié, et les boutons fonctionnent sans
 * JavaScript.
 *
 * Depuis le 19 novembre 2026, une case par forfait de lecteurs (trois, dix,
 * cent, illimité), sur une grille à angle droit comme le reste de l'espace ;
 * chaque case porte ses deux formules, mensuelle et annuelle, en deux boutons
 * du même formulaire. L'annuelle porte son équivalent mensuel : c'est la seule
 * comparaison que le lecteur fait de tête. Un forfait plus petit que le nombre
 * de lecteurs déjà actifs n'est pas proposé, et l'action le refuse aussi.
 *
 * Quand les frais de mise en place sont dus (`fraisDeMiseEnPlaceDus`, une
 * inscription après la période early adopter), la grille les annonce : la page
 * de paiement Stripe les ajoute à la première facture, et le lecteur ne doit pas
 * les y découvrir.
 */
export function ChoixDeFormule({
  slug,
  offre = 'standard',
  fraisDeMiseEnPlace = false,
  lecteursActifs = 0,
}: {
  slug: string
  offre?: Offre
  fraisDeMiseEnPlace?: boolean
  lecteursActifs?: number
}) {
  // Le tarif fondateur (19 octobre 2026) ne voit que sa formule : afficher le prix standard
  // à qui paiera 29 € serait faux. L'action serveur revérifie l'offre.
  if (offre === 'fondateur') {
    return (
      <div className="grid grid-cols-1 border-l border-t border-gris-ligne sm:grid-cols-2">
        <form action={souscrire} className="flex flex-col gap-3 border-b border-r border-gris-ligne bg-blanc p-6">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="formule" value="fondateur" />
          <input type="hidden" name="forfait" value="trois" />
          <p className="label-mono text-ardoise">Tarif fondateur</p>
          <p className="font-titre text-h3 font-semibold text-encre">{enEuros(PRIX_FONDATEUR_HT)} € HT par mois</p>
          <p className="text-ardoise">
            Tarif réservé à votre organisation, {DÉFINITIONS_DES_FORFAITS.trois.lecteurs} lecteurs. Sans
            engagement, résiliable à tout moment.
          </p>
          <BoutonDeSouscription formule="fondateur">S’abonner</BoutonDeSouscription>
        </form>
      </div>
    )
  }
  const forfaits = FORFAITS.filter((forfait) => {
    const plafond = plafondDeLecteurs(forfait)
    return plafond === null || plafond >= lecteursActifs
  })
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 border-l border-t border-gris-ligne sm:grid-cols-2">
        {forfaits.map((forfait) => (
          <CaseDeForfait key={forfait} slug={slug} forfait={forfait} />
        ))}
      </div>
      <p className="text-ardoise">
        Création du référentiel et {HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises dans chaque
        forfait. Mensuel sans engagement, résiliable à tout moment ; annuel à dix mois payés, deux mois
        offerts.
        {fraisDeMiseEnPlace
          ? ` Frais de mise en place de ${enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT, facturés une fois avec la première échéance.`
          : ''}
      </p>
    </div>
  )
}

function CaseDeForfait({ slug, forfait }: { slug: string; forfait: Forfait }) {
  const définition = DÉFINITIONS_DES_FORFAITS[forfait]
  return (
    <form action={souscrire} className="flex flex-col gap-3 border-b border-r border-gris-ligne bg-blanc p-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="forfait" value={forfait} />
      <p className="label-mono text-ardoise">{définition.libellé}</p>
      <p className="font-titre text-h3 font-semibold text-encre">{enEuros(définition.prixMensuelHT)} € HT par mois</p>
      <p className="text-ardoise">
        Ou {enEuros(prixAnnuelDuForfaitHT(forfait))} € HT par an, soit {enEuros(équivalentMensuelDuForfait(forfait))} €
        HT par mois.
      </p>
      <div className="mt-auto flex flex-wrap gap-3">
        <BoutonDeSouscription formule="mensuelle">Mensuel</BoutonDeSouscription>
        <BoutonDeSouscription formule="annuelle">Annuel</BoutonDeSouscription>
      </div>
    </form>
  )
}

/** Le bouton plein est celui de la page de secours et de la bannière d'installation. */
function BoutonDeSouscription({ formule, children }: { formule: Formule; children: string }) {
  return (
    <button
      type="submit"
      name="formule"
      value={formule}
      className="self-start rounded-douce bg-encre px-4 py-2 text-corps font-medium text-blanc"
    >
      {children}
    </button>
  )
}

/** L'accès à l'espace de facturation Stripe, pour un abonné : factures, carte, formule, résiliation. */
export function GérerLAbonnement({ slug }: { slug: string }) {
  return (
    <form action={gérerLAbonnement}>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className="self-start text-label text-ardoise underline decoration-gris-ligne underline-offset-2"
      >
        Gérer mon abonnement
      </button>
    </form>
  )
}

/**
 * Le retour de la page de paiement ou un refus, lu dans `?abonnement=`.
 *
 * `merci` ne prouve pas le paiement : seul le webhook signé ouvre l'espace. Le
 * message dit donc ce qui va se passer, sans rien promettre de plus.
 */
export function RetourDAbonnement({ motif }: { motif: string | undefined }) {
  const texte =
    motif === 'merci'
      ? 'Merci. Votre paiement est en cours de confirmation par Stripe : votre espace s’ouvre en entier dans quelques instants. Rechargez la page si ce n’est pas le cas.'
      : motif === 'indisponible'
        ? 'La souscription en ligne est momentanément indisponible. Réessayez dans quelques minutes, ou écrivez-nous.'
        : motif === 'operateur'
          ? 'Accès opérateur : la souscription et la facturation sont réservées aux lecteurs de l’organisation.'
          : motif === 'aucun'
            ? 'Aucun abonnement n’est encore associé à votre organisation.'
            : motif === 'offerte'
              ? 'Votre accès est offert : il n’y a rien à payer.'
              : motif === 'formule'
                ? 'Cette formule n’est pas celle de votre organisation. Choisissez celle qui vous est proposée.'
                : motif === 'forfait'
                  ? 'Ce forfait compte moins de lecteurs que votre organisation n’en a d’actifs. Choisissez un forfait plus grand, ou retirez d’abord des lecteurs.'
                  : null
  if (!texte) return null
  return (
    <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
      {texte}
    </p>
  )
}

/**
 * L'essai en cours, sur la vue d'ensemble : une ligne en tête, qui dit où en
 * est l'essai, et les formules en pied d'écran (`#abonnement`). Le tableau de
 * bord reste le contenu ; l'offre ne passe pas devant ce que le lecteur vient
 * lire.
 */
export function LigneDEssai({ parution, parutions }: { parution: number; parutions: number }) {
  return (
    <p className="label-mono text-ardoise">
      {parution === parutions ? 'dernière parution complète' : `essai · parution ${parution} sur ${parutions}`} ·{' '}
      <a href="#abonnement" className="text-encre underline underline-offset-2">
        s’abonner
      </a>
    </p>
  )
}

export function OffreDEssai({
  slug,
  parution,
  parutions,
  offre = 'standard',
  historique = false,
  fraisDeMiseEnPlace = false,
}: {
  slug: string
  parution: number
  parutions: number
  offre?: Offre
  /** Un client d'avant l'offre, entré dans le parcours par l'opératrice : son accès était complet jusqu'ici. */
  historique?: boolean
  fraisDeMiseEnPlace?: boolean
}) {
  const restantes = parutions - parution
  return (
    <section id="abonnement" className="mt-12 flex max-w-3xl flex-col gap-4">
      <h2 className="font-titre text-h3 font-semibold text-encre">S’abonner</h2>
      <p className="text-ardoise">
        {historique
          ? restantes > 0
            ? `Votre accès complet prend fin : il vous reste ${restantes} parution${restantes > 1 ? 's' : ''} complète${restantes > 1 ? 's' : ''} après celle-ci.`
            : 'Votre accès complet prend fin : c’est votre dernière parution complète.'
          : restantes > 0
            ? `Votre essai comprend ${parutions} parutions complètes ; il en reste ${restantes} après celle-ci.`
            : 'C’est la dernière parution complète de votre essai.'}{' '}
        La semaine suivante, sans abonnement, chaque lettre est réduite à sa rubrique
        « L’essentiel ». L’abonnement couvre votre organisation et ses deux veilles, pour le
        nombre de lecteurs de son forfait.
      </p>
      <ChoixDeFormule slug={slug} offre={offre} fraisDeMiseEnPlace={fraisDeMiseEnPlace} />
    </section>
  )
}
