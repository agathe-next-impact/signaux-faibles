import { Case, Grille } from '@/components/coquille'
import {
  ADRESSE_D_ABONNEMENT,
  DÉFINITIONS_DES_FORFAITS,
  enEuros,
  finDuTarifEarlyAdopter,
  FORFAITS,
  FRAIS_DE_MISE_EN_PLACE_HT,
  HEURES_DE_PRISE_EN_MAIN,
  prixAnnuelDuForfaitHT,
  prixTTC,
  TAUX_DE_TVA,
  équivalentMensuelDuForfait,
} from '@/lib/domaine/offre'

/**
 * Les forfaits et les frais de mise en place (7 novembre 2026, forfaits par
 * nombre de lecteurs depuis le 19 novembre 2026) : les mêmes sur l'accueil et
 * sur « Tarifs », pour qu'un prix ne soit mis en page qu'une fois. Une case par
 * forfait, avec son prix mensuel et son annuel ; tous les montants viennent de
 * `lib/domaine/offre.ts`.
 */
export function CartesDeTarifs() {
  const tva = Math.round(TAUX_DE_TVA * 100)
  return (
    <div className="flex flex-col gap-4">
      <Grille colonnes={4} étiquette="Les forfaits par nombre de lecteurs">
        {FORFAITS.map((forfait, rang) => {
          const définition = DÉFINITIONS_DES_FORFAITS[forfait]
          return (
            <Case key={forfait} accent={rang === 0}>
              <p className="label-mono text-ardoise">{définition.libellé}</p>
              <p className="font-titre text-h1 font-bold text-encre">
                {enEuros(définition.prixMensuelHT)} €{' '}
                <span className="block text-h3 font-semibold">HT par mois</span>
              </p>
              <p className="label-mono text-ardoise">soit {enEuros(prixTTC(définition.prixMensuelHT))} € TTC</p>
              <p className="text-ardoise">
                Ou {enEuros(prixAnnuelDuForfaitHT(forfait))} € HT par an, deux mois offerts, soit{' '}
                {enEuros(équivalentMensuelDuForfait(forfait))} € HT par mois.
              </p>
            </Case>
          )
        })}
      </Grille>
      <Grille colonnes={1} étiquette="La mise en place">
        <Case>
          <p className="label-mono text-ardoise">Frais de mise en place · une seule fois</p>
          <p className="font-titre text-h3 font-semibold text-encre">
            Offerts jusqu’au {finDuTarifEarlyAdopter()}, puis {enEuros(FRAIS_DE_MISE_EN_PLACE_HT)} € HT, soit{' '}
            {enEuros(prixTTC(FRAIS_DE_MISE_EN_PLACE_HT))} € TTC
          </p>
          <p className="text-ardoise">
            Création du référentiel et {HEURES_DE_PRISE_EN_MAIN} h de prise en main comprises dans chaque
            forfait. Mensuel sans engagement, résiliable à tout moment.
          </p>
        </Case>
      </Grille>
      <p className="text-label text-ardoise">
        Prix par organisation, TVA de {tva} % en sus. Le forfait fixe le nombre de lecteurs actifs à
        la fois ; on en change depuis son espace. Paiement par carte en ligne, depuis votre espace.
        Pour un bon de commande ou un virement, écrivez à{' '}
        <a href={`mailto:${ADRESSE_D_ABONNEMENT}`} className="underline underline-offset-2">
          {ADRESSE_D_ABONNEMENT}
        </a>
        .
      </p>
    </div>
  )
}
