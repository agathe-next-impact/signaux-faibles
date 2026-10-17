import { gérerLAbonnement, souscrire } from '@/lib/portail/abonnement'
import { PRIX_ANNUEL_HT, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'

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
export function ChoixDeFormule({ slug }: { slug: string }) {
  const équivalent = (PRIX_ANNUEL_HT / 12).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  return (
    <div className="grid grid-cols-1 border-l border-t border-gris-ligne sm:grid-cols-2">
      <Formule
        slug={slug}
        formule="mensuelle"
        intitulé="Mensuel"
        prix={`${PRIX_MENSUEL_HT} € HT par mois`}
        détail="Sans engagement, résiliable à tout moment."
      />
      <Formule
        slug={slug}
        formule="annuelle"
        intitulé="Annuel"
        prix={`${PRIX_ANNUEL_HT} € HT par an`}
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
  formule: 'mensuelle' | 'annuelle'
  intitulé: string
  prix: string
  détail: string
}) {
  return (
    <form action={souscrire} className="flex flex-col gap-3 border-b border-r border-gris-ligne bg-blanc p-5">
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
export function LigneDEssai({ parution }: { parution: 1 | 2 | 3 }) {
  return (
    <p className="label-mono text-ardoise">
      essai · parution {parution} sur 3 ·{' '}
      <a href="#abonnement" className="text-encre underline underline-offset-2">
        s’abonner
      </a>
    </p>
  )
}

export function OffreDEssai({ slug, parution }: { slug: string; parution: 1 | 2 | 3 }) {
  const restantes = 3 - parution
  return (
    <section id="abonnement" className="mt-12 flex max-w-3xl flex-col gap-4">
      <h2 className="font-titre text-h3 font-semibold text-encre">S’abonner</h2>
      <p className="text-ardoise">
        {restantes > 0
          ? `Votre essai comprend trois parutions complètes ; il en reste ${restantes} après celle-ci.`
          : 'C’est la dernière parution complète de votre essai.'}{' '}
        La semaine suivante, sans abonnement, chaque lettre est réduite à sa rubrique
        « L’essentiel ». L’abonnement couvre votre organisation, ses deux veilles et trois
        lecteurs.
      </p>
      <ChoixDeFormule slug={slug} />
    </section>
  )
}
