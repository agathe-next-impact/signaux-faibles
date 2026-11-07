import { Case, Grille } from '@/components/coquille'
import {
  ADRESSE_D_ABONNEMENT,
  enEuros,
  finDuTarifEarlyAdopter,
  FRAIS_DE_MISE_EN_PLACE_HT,
  HEURES_DE_PRISE_EN_MAIN,
  PRIX_ANNUEL_HT,
  PRIX_MENSUEL_HT,
  prixTTC,
  TAUX_DE_TVA,
  équivalentMensuelDeLAnnuel,
} from '@/lib/domaine/offre'

/**
 * Les deux formules et les frais de mise en place, en trois cases (7 novembre
 * 2026) : les mêmes sur l'accueil et sur « Tarifs », pour qu'un prix ne soit
 * mis en page qu'une fois. Tous les montants viennent de `lib/domaine/offre.ts`.
 */
export function CartesDeTarifs() {
  const tva = Math.round(TAUX_DE_TVA * 100)
  return (
    <div className="flex flex-col gap-4">
      <Grille colonnes={3} étiquette="Les deux formules et la mise en place">
        <Case accent>
          <p className="label-mono text-ardoise">Abonnement mensuel</p>
          <p className="font-titre text-h1 font-bold text-encre">
            {enEuros(PRIX_MENSUEL_HT)} € <span className="text-h3 font-semibold">HT par mois</span>
          </p>
          <p className="label-mono text-ardoise">soit {enEuros(prixTTC(PRIX_MENSUEL_HT))} € TTC</p>
          <p className="text-ardoise">
            Création du référentiel et {HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises. Sans
            engagement, résiliable à tout moment.
          </p>
        </Case>
        <Case>
          <p className="label-mono text-ardoise">Abonnement annuel · deux mois offerts</p>
          <p className="font-titre text-h1 font-bold text-encre">
            {enEuros(PRIX_ANNUEL_HT)} € <span className="text-h3 font-semibold">HT par an</span>
          </p>
          <p className="label-mono text-ardoise">soit {enEuros(prixTTC(PRIX_ANNUEL_HT))} € TTC</p>
          <p className="text-ardoise">
            Soit {enEuros(équivalentMensuelDeLAnnuel())} € HT par mois. Création du référentiel et{' '}
            {HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises.
          </p>
        </Case>
        <Case>
          <p className="label-mono text-ardoise">Frais de mise en place · une seule fois</p>
          <p className="font-titre text-h1 font-bold text-encre">
            Offerts <span className="text-h3 font-semibold">jusqu’au {finDuTarifEarlyAdopter()}</span>
          </p>
          <p className="label-mono text-ardoise">
            puis {enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT, soit {enEuros(prixTTC(FRAIS_DE_MISE_EN_PLACE_HT))} € TTC
          </p>
          <p className="text-ardoise">
            Offerts aux early adopters, pour toute inscription jusqu’au {finDuTarifEarlyAdopter()}.
          </p>
        </Case>
      </Grille>
      <p className="text-label text-ardoise">
        Prix par organisation, TVA de {tva} % en sus. Paiement par carte en ligne, depuis votre
        espace. Pour un bon de commande ou un virement, écrivez à{' '}
        <a href={`mailto:${ADRESSE_D_ABONNEMENT}`} className="underline underline-offset-2">
          {ADRESSE_D_ABONNEMENT}
        </a>
        .
      </p>
    </div>
  )
}
