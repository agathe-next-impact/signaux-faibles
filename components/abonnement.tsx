import Link from 'next/link'
import { gérerLAbonnement, souscrire } from '@/lib/portail/abonnement'
import { enEuros, PRIX_ANNUEL_HT, PRIX_FONDATEUR_HT, PRIX_MENSUEL_HT, équivalentMensuelDeLAnnuel } from '@/lib/domaine/offre'
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
 * Deux formules côte à côte, sur une grille à angle droit comme le reste de
 * l'espace. L'annuelle porte son équivalent mensuel : c'est la seule
 * comparaison que le lecteur fait de tête, autant la faire pour lui.
 */
export function ChoixDeFormule({ slug, offre = 'standard' }: { slug: string; offre?: Offre }) {
  const équivalent = enEuros(équivalentMensuelDeLAnnuel())
  // Le tarif fondateur (19 octobre 2026) ne voit que sa formule : afficher le prix standard
  // à qui paiera 29 € serait faux. L'action serveur revérifie l'offre.
  if (offre === 'fondateur') {
    return (
      <div className="grid grid-cols-1 border-l border-t border-gris-ligne sm:grid-cols-2">
        <Formule
          slug={slug}
          formule="fondateur"
          intitulé="Tarif fondateur"
          prix={`${enEuros(PRIX_FONDATEUR_HT)} € HT par mois`}
          détail="Tarif réservé à votre organisation. Sans engagement, résiliable à tout moment."
        />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 border-l border-t border-gris-ligne sm:grid-cols-2">
      <Formule
        slug={slug}
        formule="mensuelle"
        intitulé="Mensuel"
        prix={`${enEuros(PRIX_MENSUEL_HT)} € HT par mois`}
        détail="Sans engagement, résiliable à tout moment."
      />
      <Formule
        slug={slug}
        formule="annuelle"
        intitulé="Annuel"
        prix={`${enEuros(PRIX_ANNUEL_HT)} € HT par an`}
        détail={`Soit ${équivalent} € HT par mois, deux mois offerts.`}
      />
    </div>
  )
}

/** Le bouton plein est celui de la page de secours et de la bannière d'installation. */
function Formule({
  slug,
  formule,
  intitulé,
  prix,
  détail,
}: {
  slug: string
  formule: 'mensuelle' | 'annuelle' | 'fondateur'
  intitulé: string
  prix: string
  détail: string
}) {
  return (
    <form action={souscrire} className="flex flex-col gap-3 border-b border-r border-gris-ligne bg-blanc p-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="formule" value={formule} />
      <p className="label-mono text-ardoise">{intitulé}</p>
      <p className="font-titre text-h3 font-semibold text-encre">{prix}</p>
      <p className="text-ardoise">{détail}</p>
      <button
        type="submit"
        className="mt-auto self-start rounded-douce bg-encre px-4 py-2 text-corps font-medium text-blanc"
      >
        S’abonner
      </button>
    </form>
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
}: {
  slug: string
  parution: number
  parutions: number
  offre?: Offre
  /** Un client d'avant l'offre, entré dans le parcours par l'opératrice : son accès était complet jusqu'ici. */
  historique?: boolean
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
        « L’essentiel ». L’abonnement couvre votre organisation, ses deux veilles et trois
        lecteurs.
      </p>
      <ChoixDeFormule slug={slug} offre={offre} />
    </section>
  )
}
