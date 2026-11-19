import type { Metadata } from 'next'
import { Case, Grille, Panneau } from '@/components/coquille'
import { CartesDeTarifs } from '@/components/vitrine-tarifs'
import { GraphiqueRepèresDeMarché } from '@/components/graphiques-vitrine'
import {
  AppelFinal,
  CoquilleVitrine,
  DonnéesStructurées,
  ListeCarrée,
  OuvertureVitrine,
  QuestionsFréquentes,
  SectionVitrine,
} from '@/components/vitrine'
import {
  DÉFINITIONS_DES_FORFAITS,
  enEuros,
  FIN_DU_TARIF_EARLY_ADOPTER,
  finDuTarifEarlyAdopter,
  FORFAITS,
  FRAIS_DE_MISE_EN_PLACE_HT,
  HEURES_DE_PRISE_EN_MAIN,
  LECTEURS_ACTIFS_MAX,
  PRIX_ANNUEL_HT,
  PRIX_MENSUEL_HT,
} from '@/lib/domaine/offre'
import { PARUTIONS_D_ESSAI } from '@/lib/domaine/parcours'
import { prixParLecteurEnPhrase } from '@/lib/vitrine/marche'
import { absolue, graphe, métadonnéesDeVitrine, nœudFAQ, nœudOrganisation, nœudService, type QuestionFréquente } from '@/lib/vitrine/referencement'

export const metadata: Metadata = métadonnéesDeVitrine({
  titre: `Tarifs de la veille stratégique : dès ${enEuros(PRIX_MENSUEL_HT)} € HT par mois · signauxfaibles`,
  description: `Un forfait par nombre de lecteurs : ${FORFAITS.map((f) => `${DÉFINITIONS_DES_FORFAITS[f].libellé.toLowerCase()} à ${enEuros(DÉFINITIONS_DES_FORFAITS[f].prixMensuelHT)} €`).join(', ')} HT par mois et par organisation, l’annuel à dix mois payés (${enEuros(PRIX_ANNUEL_HT)} € HT pour ${LECTEURS_ACTIFS_MAX} lecteurs). Création du référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises. Frais de mise en place offerts jusqu’au ${finDuTarifEarlyAdopter()}, puis ${enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT. Essai de ${PARUTIONS_D_ESSAI} parutions complètes.`,
  chemin: '/tarifs',
})

/**
 * Les questions de la page, rendues par `QuestionsFréquentes` et posées telles
 * quelles dans le `FAQPage` des données structurées.
 */
const QUESTIONS_DES_TARIFS: readonly QuestionFréquente[] = [
  {
    question: 'Où gérer mon abonnement et mes factures ?',
    réponse:
      'Dans votre espace, rubrique « Mon abonnement », qui ouvre l’espace de facturation de notre prestataire de paiement.',
  },
  {
    question: 'Comment ajouter ou retirer un lecteur ?',
    réponse: `Depuis « Mon abonnement », ou en nous écrivant : chaque lecteur reçoit son propre lien par courriel. Le forfait fixe le nombre de lecteurs actifs à la fois, de ${LECTEURS_ACTIFS_MAX} à illimité ; pour en ajouter au-delà, on passe au forfait suivant depuis l’espace.`,
  },
  {
    question: 'Faut-il un mot de passe ?',
    réponse:
      'Non. Chaque lecteur accède à l’espace par un lien personnel. Perdu, il se redemande en saisissant son adresse sur la page de connexion.',
  },
  {
    question: 'Que couvrent les frais de mise en place ?',
    réponse: `Ils sont facturés une seule fois, à l’inscription, et offerts aux early adopters, pour toute inscription jusqu’au ${finDuTarifEarlyAdopter()}, puis de ${enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT. La création du référentiel et les ${HEURES_DE_PRISE_EN_MAIN} h de prise en main sont comprises dans l’abonnement.`,
  },
  {
    question: 'Que se passe-t-il si je résilie ?',
    réponse:
      'La résiliation se fait depuis « Mon abonnement ». Vos lettres restent lisibles jusqu’à la fin de la période déjà payée, puis l’espace est suspendu.',
  },
]

/**
 * Les données structurées de la page (schema.org, 6 novembre 2026, reliées le
 * 16 novembre à l'éditeur et à la foire aux questions) : le service et ses
 * offres, tirés des mêmes constantes que la page (`nœudService`), et les
 * frais de mise en place early adopter, offerts jusqu'à la fin de la période.
 */
function donnéesStructurées() {
  const service = nœudService()
  return graphe([
    nœudOrganisation(),
    {
      ...service,
      offers: [
        ...service.offers,
        {
          '@type': 'Offer',
          name: 'Frais de mise en place, early adopter',
          url: absolue('/tarifs'),
          priceCurrency: 'EUR',
          price: 0,
          priceValidUntil: FIN_DU_TARIF_EARLY_ADOPTER,
        },
      ],
    },
    nœudFAQ('/tarifs', QUESTIONS_DES_TARIFS),
  ])
}

/**
 * « Tarifs » (23 octobre 2026, offre revue le 6 novembre 2026, annuelle
 * revenue le 7) : les abonnements mensuel et annuel, les frais de mise en place et le déroulé de l'essai. Les montants viennent tous de `lib/domaine/offre.ts` ;
 * le tarif fondateur n'est pas public, il est réservé par l'opératrice à
 * une organisation nommée.
 */
export default function Tarifs() {
  return (
    <CoquilleVitrine courante="tarifs">
      <OuvertureVitrine
        surtitre="Tarifs"
        titre="Un forfait par nombre de lecteurs, tout compris."
        chapeau={`Une lettre par semaine, l’espace et toutes ses archives, la création de votre référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main. Le forfait ne dépend que du nombre de lecteurs : ${LECTEURS_ACTIFS_MAX}, 10, 100 ou illimité.`}
      />
      <DonnéesStructurées données={donnéesStructurées()} />

      <section className="flex flex-col gap-4 border-b border-gris-ligne px-6 py-12 lg:px-12">
        <Panneau ton="rose">
          <p className="label-mono text-ardoise">Early adopter</p>
          <p className="mt-2 text-encre">
            <strong className="font-medium">Frais de mise en place offerts</strong> aux organisations
            qui s’inscrivent jusqu’au {finDuTarifEarlyAdopter()}. Pour les inscriptions suivantes, ils
            sont de {enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT, facturés une seule fois.
          </p>
        </Panneau>
        <CartesDeTarifs />
      </section>

      <SectionVitrine
        surtitre="Où se place ce prix"
        titre="Le prix d’un outil, le travail d’un analyste"
        chapeau={`Au prix des outils d’alerte haut de gamme, et loin sous les plateformes de veille, même en illimité. Par lecteur et par mois, il revient à ${prixParLecteurEnPhrase()}, référentiel et prise en main compris.`}
      >
        <GraphiqueRepèresDeMarché />
        <p className="max-w-3xl text-encre">
          La différence de nature compte plus que le prix : un outil vous livre des alertes à trier,
          une plateforme un logiciel à exploiter. Nous vous livrons l’analyse écrite, hiérarchisée par
          impact, prête à être lue.
        </p>
      </SectionVitrine>

      <SectionVitrine surtitre="Inclus" titre="Ce que couvre l’abonnement">
        <ListeCarrée
          éléments={[
            'Une organisation, une lettre par semaine, le jour convenu.',
            'La création de votre référentiel : vos axes, vos sources, vos acteurs.',
            `${HEURES_DE_PRISE_EN_MAIN} h de prise en main, pour vos lecteurs et votre espace.`,
            'L’espace en ligne, toutes les lettres et toutes les archives.',
            `De ${LECTEURS_ACTIFS_MAX} lecteurs actifs à un nombre illimité selon le forfait, chacun avec son lien personnel. Pour en ajouter au-delà du forfait, on passe au suivant depuis l’espace.`,
          ]}
        />
      </SectionVitrine>

      <SectionVitrine
        surtitre="Essai"
        titre={`${PARUTIONS_D_ESSAI} parutions complètes, sans carte bancaire`}
        chapeau="L’essai commence à votre première lettre publiée. Aucun moyen de paiement n’est demandé pour le commencer."
      >
        <Grille colonnes={3} étiquette="Le déroulé de l’essai">
          <Case accent>
            <p className="label-mono text-ardoise">Semaines 1 à {PARUTIONS_D_ESSAI}</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">La veille complète</h3>
            <p className="text-ardoise">
              Chaque lettre en entier, et l’espace avec tous ses écrans.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Semaine {PARUTIONS_D_ESSAI + 1}</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">L’essentiel seulement</h3>
            <p className="text-ardoise">
              Sans abonnement, la lettre se réduit à sa rubrique « L’essentiel ». Vous êtes
              prévenu une semaine avant.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Ensuite</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Suspension</h3>
            <p className="text-ardoise">
              Sans abonnement, l’espace est suspendu. Il rouvre dès que vous vous abonnez.
            </p>
          </Case>
        </Grille>
      </SectionVitrine>

      <SectionVitrine surtitre="Questions fréquentes" titre="Avant de vous lancer">
        <QuestionsFréquentes questions={QUESTIONS_DES_TARIFS} />
      </SectionVitrine>

      <AppelFinal
        titre="Voir une lettre avant de décider"
        chapeau="Nous vous montrons une lettre et l’espace qui l’accompagne, puis nous préparons votre référentiel."
        primaire
      />
    </CoquilleVitrine>
  )
}
