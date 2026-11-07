import type { Metadata } from 'next'
import { Case, Grille, Panneau } from '@/components/coquille'
import { CartesDeTarifs } from '@/components/vitrine-tarifs'
import { GraphiqueRepèresDeMarché } from '@/components/graphiques-vitrine'
import { AppelFinal, CoquilleVitrine, ListeCarrée, OuvertureVitrine, Question, SectionVitrine } from '@/components/vitrine'
import {
  enEuros,
  FIN_DU_TARIF_EARLY_ADOPTER,
  finDuTarifEarlyAdopter,
  FRAIS_DE_MISE_EN_PLACE_HT,
  HEURES_DE_PRISE_EN_MAIN,
  LECTEURS_ACTIFS_MAX,
  PRIX_ANNUEL_HT,
  PRIX_MENSUEL_HT,
} from '@/lib/domaine/offre'
import { PARUTIONS_D_ESSAI } from '@/lib/domaine/parcours'
import { prixParLecteur } from '@/lib/vitrine/marche'

export const metadata: Metadata = {
  title: 'Tarifs — signauxfaibles',
  description: `${enEuros(PRIX_MENSUEL_HT)} € HT par mois ou ${enEuros(PRIX_ANNUEL_HT)} € HT par an et par organisation, création du référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises. Frais de mise en place offerts jusqu’au ${finDuTarifEarlyAdopter()}, puis ${enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT. Essai de ${PARUTIONS_D_ESSAI} parutions complètes.`,
  robots: { index: true, follow: true },
}

/**
 * Les données structurées de l'offre (schema.org, 6 novembre 2026), tirées des
 * mêmes constantes que la page : l'abonnement mensuel, et les frais de mise en
 * place, offerts jusqu'à la fin de la période early adopter.
 */
function donnéesStructurées() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'signauxfaibles, veille hebdomadaire rédigée',
    serviceType: 'Veille stratégique',
    areaServed: 'FR',
    offers: [
      {
        '@type': 'Offer',
        name: `Abonnement mensuel, création du référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises`,
        priceCurrency: 'EUR',
        price: PRIX_MENSUEL_HT,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: PRIX_MENSUEL_HT,
          priceCurrency: 'EUR',
          valueAddedTaxIncluded: false,
          unitCode: 'MON',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
        },
      },
      {
        '@type': 'Offer',
        name: `Abonnement annuel, deux mois offerts, création du référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises`,
        priceCurrency: 'EUR',
        price: PRIX_ANNUEL_HT,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: PRIX_ANNUEL_HT,
          priceCurrency: 'EUR',
          valueAddedTaxIncluded: false,
          unitCode: 'ANN',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'ANN' },
        },
      },
      {
        '@type': 'Offer',
        name: 'Frais de mise en place, early adopter',
        priceCurrency: 'EUR',
        price: 0,
        priceValidUntil: FIN_DU_TARIF_EARLY_ADOPTER,
      },
      {
        '@type': 'Offer',
        name: 'Frais de mise en place',
        priceCurrency: 'EUR',
        price: FRAIS_DE_MISE_EN_PLACE_HT,
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: FRAIS_DE_MISE_EN_PLACE_HT,
          priceCurrency: 'EUR',
          valueAddedTaxIncluded: false,
        },
      },
    ],
  }
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
        titre="Un prix par organisation, tout compris."
        chapeau={`Une lettre par semaine, l’espace et toutes ses archives, jusqu’à ${LECTEURS_ACTIFS_MAX} lecteurs, la création de votre référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main. Pas d’option, pas de supplément.`}
      />
      <script
        type="application/ld+json"
        // Données de l'offre seulement, sérialisées par JSON.stringify ; « < » échappé pour ne jamais fermer la balise.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donnéesStructurées()).replace(/</g, '\\u003c') }}
      />

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
        chapeau={`Au prix des outils d’alerte haut de gamme, et loin sous les plateformes de veille. Avec ${LECTEURS_ACTIFS_MAX} lecteurs, il revient à ${enEuros(prixParLecteur())} € HT par lecteur et par mois, référentiel et prise en main compris.`}
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
            `Jusqu’à ${LECTEURS_ACTIFS_MAX} lecteurs actifs, chacun avec son lien personnel. Pour en ajouter un quatrième, on en retire un depuis l’espace.`,
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
        <div className="flex max-w-3xl flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
          <Question titre="Où gérer mon abonnement et mes factures ?">
            Dans votre espace, rubrique « Mon abonnement », qui ouvre l’espace de facturation de
            notre prestataire de paiement.
          </Question>
          <Question titre="Comment ajouter ou retirer un lecteur ?">
            Depuis « Mon abonnement », ou en nous écrivant : chaque lecteur reçoit son propre lien
            par courriel. L’abonnement en compte {LECTEURS_ACTIFS_MAX} au plus à la fois.
          </Question>
          <Question titre="Faut-il un mot de passe ?">
            Non. Chaque lecteur accède à l’espace par un lien personnel. Perdu, il se redemande en
            saisissant son adresse sur la page de connexion.
          </Question>
          <Question titre="Que couvrent les frais de mise en place ?">
            Ils sont facturés une seule fois, à l’inscription, et offerts aux
            early adopters, pour toute inscription jusqu’au {finDuTarifEarlyAdopter()}, puis de{' '}
            {enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT. La création du référentiel et les{' '}
            {HEURES_DE_PRISE_EN_MAIN} h de prise en main sont comprises dans l’abonnement.
          </Question>
          <Question titre="Que se passe-t-il si je résilie ?">
            La résiliation se fait depuis « Mon abonnement ». Vos lettres restent lisibles jusqu’à
            la fin de la période déjà payée, puis l’espace est suspendu.
          </Question>
        </div>
      </SectionVitrine>

      <AppelFinal
        titre="Voir une lettre avant de décider"
        chapeau="Nous vous montrons une lettre et l’espace qui l’accompagne, puis nous préparons votre référentiel."
        primaire
      />
    </CoquilleVitrine>
  )
}
