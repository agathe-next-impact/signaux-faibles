import { exigerLecture } from '@/lib/auth/appartenance'
import { ChoixDeFormule, GérerLAbonnement, RetourDAbonnement } from '@/components/abonnement'
import { Case, EntêteÉcran, Grille, LienFlèche, Panneau } from '@/components/coquille'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { ADRESSE_D_ABONNEMENT, LECTEURS_ACTIFS_MAX, PRIX_ANNUEL_HT, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours, type Étape } from '@/lib/domaine/parcours'
import { ajouterLecteur, retirerLecteur } from '@/lib/portail/lecteurs'
import { espacePrescripteurDe } from '@/lib/portail/prescripteur'
import { lecteursModifiables, situationDeLEspace } from '@/lib/portail/situation'

/**
 * Mon abonnement (19 octobre 2026) : où en est l'organisation, ce qu'elle
 * paie, qui lit.
 *
 * Ce n'est pas un écran de veille : il ne lit **aucune édition**, seulement
 * Postgres, et il reste ouvert quel que soit le droit de lecture, parce que
 * c'est l'endroit où un essai terminé mène à l'abonnement. D'où `exigerLecture`
 * et non `exigerLectureComplète`, et sa place dans la liste des écrans ouverts
 * de `tests/architecture.test.ts`.
 *
 * L'opératrice en visite le voit tel quel, bandeau compris : les boutons sont
 * là, et les actions les refusent (`lib/portail/abonnement.ts`,
 * `lib/portail/lecteurs.ts`), pour qu'elle voie ce que le client voit sans
 * pouvoir engager l'organisation.
 *
 * Aucune adresse email n'y figure : les lecteurs sont nommés, pas adressés, et
 * le retrait désigne une ligne par son identifiant.
 */
const MESSAGES_LECTEURS: Record<string, string> = {
  ajoute: 'Lecteur ajouté : son lien d’accès vient de partir.',
  reactive: 'Ce lecteur était inscrit puis retiré : il est de nouveau actif, son lien vient de partir.',
  deja: 'Cette adresse est déjà inscrite et active.',
  plafond: `${LECTEURS_ACTIFS_MAX} lecteurs actifs au plus : retirez-en un pour en ajouter un.`,
  retire: 'Lecteur retiré : son lien ne fonctionne plus.',
  'soi-meme': 'Vous ne pouvez pas retirer votre propre accès.',
  inconnu: 'Ce lecteur n’existe pas, ou n’est pas dans votre organisation.',
  invalide: 'Nom ou adresse manquants ou invalides.',
  operateur: 'Accès opérateur : les lecteurs se gèrent par les lecteurs de l’organisation.',
  indisponible: `La gestion des lecteurs en ligne n’est pas encore ouverte. Écrivez à ${ADRESSE_D_ABONNEMENT}.`,
  echec: 'La base n’a pas répondu : rien n’a été modifié.',
  'lien-non-envoye':
    'Lecteur ajouté, mais son lien n’a pas pu partir : il peut le demander sur « recevoir mon lien ».',
  debit: 'Lecteur ajouté. Un lien vient déjà de partir à cette adresse : le suivant dans dix minutes.',
}

export default async function MonAbonnement({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ abonnement?: string | string[]; lecteurs?: string | string[] }>
}) {
  const { slug } = await params
  const { accès, étape: étapeLue } = await exigerLecture(slug)
  const paramètres = await searchParams
  const retour = typeof paramètres.abonnement === 'string' ? paramètres.abonnement : undefined
  const issueLecteurs = typeof paramètres.lecteurs === 'string' ? MESSAGES_LECTEURS[paramètres.lecteurs] : undefined

  const [situation, prescripteur] = await Promise.all([
    situationDeLEspace(accès.organisationId),
    espacePrescripteurDe(accès.organisationId),
  ])
  // L'opérateur en visite n'a pas d'étape calculée par la lecture (elle lui est
  // toujours complète) : elle se calcule ici, des mêmes données, pour qu'il
  // voie l'étape du client. Pour le client, c'est la même fonction : un seul
  // calcul, deux chemins.
  const étape: Étape | null =
    étapeLue ??
    (situation
      ? étapeDuParcours({
          organisation: situation.organisation,
          abonnement: situation.abonnement,
          aujourdHui: aujourdHuiÀParis(),
        })
      : null)

  const offre = situation?.organisation.offre ?? 'standard'
  const historique = situation?.organisation.historique ?? false
  const abonnéStripe = étape?.étape === 'abonnee' && étape.source === 'stripe'
  const offert = étape?.étape === 'abonnee' && étape.source === 'offerte'
  const suspenduÀLaMain = étape?.étape === 'suspendue' && étape.manuelle
  // S'abonner a un sens tant qu'on ne l'est pas, et qu'aucune suspension posée à
  // la main ne prime : à un abonné suspendu, proposer de payer serait absurde.
  const peutSouscrire = étape?.étape !== 'abonnee' && !suspenduÀLaMain && offre !== 'gratuite'
  const gestion = lecteursModifiables() && situation !== null
  const auPlafond = situation !== null && situation.lecteurs.length >= LECTEURS_ACTIFS_MAX

  return (
    <>
      <EntêteÉcran
        surtitre="abonnement"
        titre="Mon abonnement"
        état={étape ? libelléDÉtape(étape) : undefined}
      />

      <div className="mt-8 flex max-w-3xl flex-col gap-8">
        <RetourDAbonnement motif={retour} />

        {/* Un prescripteur (24 octobre 2026) suit ses recommandations sur un
            écran à part, atteint d'ici seulement : ce n'est pas un écran de veille. */}
        {prescripteur ? (
          <Panneau>
            <p className="text-encre">
              Vous recommandez signauxfaibles : votre lien et les organisations qui ont accepté de
              partager leur suivi sont sur un écran dédié.
            </p>
            <p className="mt-3">
              <LienFlèche href={`/${slug}/prescripteur`}>Vos recommandations</LienFlèche>
            </p>
          </Panneau>
        ) : null}

        <Panneau ton={étape?.étape === 'suspendue' || étape?.étape === 'tronquee' ? 'rose' : 'ardoise'}>
          <p className="text-encre">{phraseDÉtape(étape, situation?.organisation.activéeLe ?? null, historique)}</p>
        </Panneau>

        <section className="flex flex-col gap-3">
          <h2 className="font-titre text-h3 font-semibold text-encre">Formule</h2>
          {abonnéStripe && situation?.abonnement ? (
            <>
              <Grille étiquette="Abonnement en cours" colonnes={2}>
                <Case>
                  <p className="label-mono text-ardoise">formule</p>
                  <p className="font-titre text-h3 font-semibold text-encre">
                    {situation.abonnement.formule === 'annuelle'
                      ? `Annuelle · ${PRIX_ANNUEL_HT} € HT par an`
                      : situation.abonnement.formule === 'mensuelle'
                        ? `Mensuelle · ${PRIX_MENSUEL_HT} € HT par mois`
                        : 'Non précisée'}
                  </p>
                </Case>
                <Case>
                  <p className="label-mono text-ardoise">prochaine échéance</p>
                  <p className="font-titre text-h3 font-semibold text-encre">
                    {situation.abonnement.périodeFin
                      ? dateLongueDeParis(situation.abonnement.périodeFin)
                      : 'Non précisée'}
                  </p>
                  {étape?.étape === 'abonnee' && étape.paiementEnRetard ? (
                    <p className="label-mono text-rose-texte">paiement en retard · stripe relance</p>
                  ) : null}
                </Case>
              </Grille>
              <p className="text-ardoise">
                Factures, moyen de paiement, changement de formule et résiliation se font dans votre
                espace de facturation Stripe.
              </p>
              <GérerLAbonnement slug={accès.slug} />
            </>
          ) : offert ? (
            <p className="text-ardoise">
              Votre accès est offert : il n’y a rien à payer, et rien ne se ferme. Pour toute question,
              écrivez à{' '}
              <a className="text-encre underline" href={`mailto:${ADRESSE_D_ABONNEMENT}`}>
                {ADRESSE_D_ABONNEMENT}
              </a>
              .
            </p>
          ) : étape?.étape === 'abonnee' ? (
            <p className="text-ardoise">
              Votre organisation est abonnée sur bon de commande ou par virement. Pour toute
              question sur votre contrat, écrivez à{' '}
              <a className="text-encre underline" href={`mailto:${ADRESSE_D_ABONNEMENT}`}>
                {ADRESSE_D_ABONNEMENT}
              </a>
              .
            </p>
          ) : peutSouscrire ? (
            <>
              <p className="text-ardoise">
                L’abonnement couvre votre organisation, ses deux veilles et {LECTEURS_ACTIFS_MAX}{' '}
                lecteurs.
              </p>
              <ChoixDeFormule slug={accès.slug} offre={offre} />
              <p className="text-ardoise">
                Paiement sécurisé par Stripe, facture à chaque échéance. Pour un bon de commande ou un
                virement, écrivez à{' '}
                <a className="text-encre underline" href={`mailto:${ADRESSE_D_ABONNEMENT}`}>
                  {ADRESSE_D_ABONNEMENT}
                </a>
                .
              </p>
            </>
          ) : (
            <p className="text-ardoise">
              Pour en savoir plus, écrivez à{' '}
              <a className="text-encre underline" href={`mailto:${ADRESSE_D_ABONNEMENT}`}>
                {ADRESSE_D_ABONNEMENT}
              </a>
              .
            </p>
          )}
        </section>

        <section id="lecteurs" className="flex flex-col gap-3">
          <h2 className="font-titre text-h3 font-semibold text-encre">Lecteurs</h2>
          {issueLecteurs ? (
            <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
              {issueLecteurs}
            </p>
          ) : null}
          {situation ? (
            <>
              <p className="label-mono text-ardoise">
                {situation.lecteurs.length} sur {LECTEURS_ACTIFS_MAX} lecteurs actifs
              </p>
              {situation.lecteurs.length === 0 ? (
                <p className="text-ardoise">Aucun lecteur actif n’est rattaché à votre organisation.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-gris-ligne border border-gris-ligne">
                  {situation.lecteurs.map((lecteur) => (
                    <li key={lecteur.id} className="flex items-center justify-between gap-4 px-6 py-3">
                      <span className="text-encre">{lecteur.nom}</span>
                      {gestion ? (
                        <form action={retirerLecteur}>
                          <input type="hidden" name="slug" value={accès.slug} />
                          <input type="hidden" name="lecteur" value={lecteur.id} />
                          <button
                            type="submit"
                            className="text-label text-ardoise underline decoration-gris-ligne underline-offset-2"
                          >
                            Retirer
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-ardoise">La liste des lecteurs est momentanément indisponible.</p>
          )}
          <p className="text-ardoise">
            Chaque lecteur reçoit son propre lien d’accès, personnel et à ne pas transférer.
          </p>
          {gestion ? (
            auPlafond ? (
              <p className="text-ardoise">
                Votre organisation a ses {LECTEURS_ACTIFS_MAX} lecteurs. Pour en ajouter un, retirez-en un
                d’abord.
              </p>
            ) : (
              <form action={ajouterLecteur} className="flex flex-col gap-3 border border-gris-ligne bg-blanc p-6">
                <input type="hidden" name="slug" value={accès.slug} />
                <p className="label-mono text-ardoise">ajouter un lecteur</p>
                <label className="flex flex-col gap-1 text-ardoise">
                  Nom
                  <input
                    type="text"
                    name="nom"
                    required
                    maxLength={200}
                    autoComplete="off"
                    className="rounded-douce border border-gris-ligne bg-blanc px-3 py-2 text-corps text-encre"
                  />
                </label>
                <label className="flex flex-col gap-1 text-ardoise">
                  Adresse email
                  <input
                    type="email"
                    name="email"
                    required
                    maxLength={320}
                    autoComplete="off"
                    className="rounded-douce border border-gris-ligne bg-blanc px-3 py-2 text-corps text-encre"
                  />
                </label>
                <p className="text-ardoise">
                  Son lien d’accès lui est envoyé aussitôt, à cette adresse.
                </p>
                <button
                  type="submit"
                  className="self-start rounded-douce bg-encre px-4 py-2 text-corps font-medium text-blanc"
                >
                  Ajouter et envoyer le lien
                </button>
              </form>
            )
          ) : (
            <p className="text-ardoise">
              Pour ajouter ou retirer un lecteur, écrivez à{' '}
              <a className="text-encre underline" href={`mailto:${ADRESSE_D_ABONNEMENT}`}>
                {ADRESSE_D_ABONNEMENT}
              </a>
              .
            </p>
          )}
        </section>
      </div>
    </>
  )
}

/** La phrase du panneau, par étape ; aucune ne promet ce que seul Stripe confirme. */
function phraseDÉtape(étape: Étape | null, activéeLe: Date | null, historique: boolean): string {
  if (!étape) return 'La situation de votre abonnement est momentanément indisponible. Réessayez dans quelques minutes.'
  switch (étape.étape) {
    case 'essai': {
      const restantes = étape.parutions - étape.parution
      if (historique) {
        // Un client d'avant l'offre, entré dans le parcours par l'opératrice :
        // son accès était complet jusqu'ici, et ce n'est pas un essai.
        return (
          'Votre accès complet prend fin.' +
          (restantes > 0
            ? ` Il vous reste ${restantes} parution${restantes > 1 ? 's' : ''} complète${restantes > 1 ? 's' : ''} après celle-ci.`
            : ' Cette parution est la dernière complète.') +
          ' La semaine suivante, sans abonnement, chaque lettre est réduite à « L’essentiel », puis votre espace est suspendu. Vos lettres et vos archives restent conservées.'
        )
      }
      const depuis = activéeLe ? ` Votre essai a commencé le ${dateLongueDeParis(activéeLe)}.` : ''
      return (
        `Votre essai comprend ${étape.parutions} parutions complètes ; celle-ci est la ${étape.parution}e` +
        (restantes > 0 ? `, il en reste ${restantes}.` : ', la dernière.') +
        depuis +
        ' La semaine suivante, sans abonnement, chaque lettre est réduite à « L’essentiel ».'
      )
    }
    case 'tronquee':
      return 'Votre essai est terminé : cette semaine, chaque lettre est réduite à sa rubrique « L’essentiel ». Les lettres complètes, les axes, les acteurs, les recommandations et vos archives sont réservés aux abonnés.'
    case 'abonnee':
      if (étape.paiementEnRetard) {
        return 'Votre organisation est abonnée. Le dernier paiement n’a pas abouti : Stripe le représente pendant quelques jours, et votre espace reste ouvert entre-temps.'
      }
      if (étape.source === 'offerte') return 'Votre accès est offert. Votre espace est ouvert en entier, sans échéance.'
      return 'Votre organisation est abonnée. Votre espace est ouvert en entier.'
    case 'suspendue':
      return étape.manuelle
        ? 'Votre espace est momentanément suspendu. Vos lettres et vos archives sont conservées.'
        : 'Votre essai est terminé et votre espace est suspendu. Vos lettres et vos archives sont conservées : elles redeviennent lisibles dès votre abonnement.'
    case 'hors-parcours':
      return étape.raison === 'pas encore activée' || étape.raison === 'aucune date d’activation'
        ? 'Votre espace est ouvert. Votre essai commence avec votre première lettre.'
        : 'Votre espace est ouvert en entier.'
  }
}
