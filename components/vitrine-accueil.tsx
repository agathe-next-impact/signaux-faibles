import Link from 'next/link'
import { AperçuAxes, AperçuEspace, AperçuEssentiel, AperçuSources, ExtraitDeLettre } from '@/components/apercu-vitrine'
import { BadgeImpact } from '@/components/badge-impact'
import { BandeauLogos } from '@/components/bandeau-logos'
import { Case, Grille, LienFlèche } from '@/components/coquille'
import { CarteDuMarché, GraphiqueTempsDeVeille } from '@/components/graphiques-vitrine'
import { Onglets } from '@/components/onglets'
import {
  AppelFinal,
  BoutonDémo,
  ChiffresClés,
  CoquilleVitrine,
  OuvertureVitrine,
  Question,
  SectionVitrine,
  TêteDeSection,
} from '@/components/vitrine'
import { CartesDeTarifs } from '@/components/vitrine-tarifs'
import { ESSENTIEL_LIGNES_MAX } from '@/lib/domaine/texte'
import { enEuros, finDuTarifEarlyAdopter, HEURES_DE_PRISE_EN_MAIN, LECTEURS_ACTIFS_MAX, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import { PARUTIONS_D_ESSAI } from '@/lib/domaine/parcours'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'
import { COÛT_HORAIRE_ILLUSTRATIF, coûtDeLaVeilleInterne, coûtDUneHeureParSemaine, prixParLecteur } from '@/lib/vitrine/marche'

/**
 * L'accueil des visiteurs sans session (23 octobre 2026, refondu le
 * 7 novembre 2026). La racine le rend au lieu de rediriger vers « recevoir mon
 * lien » ; une session valide mène toujours à son espace, sans voir cette page.
 *
 * Déroulé de la refonte : l'ouverture montre le produit (le haut d'une lettre
 * fictive) ; les logos ; « Ce que vous recevez » en quatre onglets, chacun avec
 * son aperçu ; la valeur, chiffrée ; les trois niveaux d'impact ; l'espace ; le
 * marché ; les tarifs en cartes ; les questions ; l'appel final. Les aperçus
 * sont calculés sur une lettre fictive par le code de l'espace client
 * (`components/apercu-vitrine.tsx`), jamais sur la lettre d'un client.
 *
 * La lettre décrite est la lettre unique du programme du 22 octobre 2026
 * (`docs/programme-lettre-unique.md`) : ses seuils viennent du validateur
 * (`LETTRE_UNIQUE`), pas d'un texte recopié.
 */
export function AccueilVitrine() {
  return (
    <CoquilleVitrine courante="accueil">
      <OuvertureVitrine
        surtitre="Veille hebdomadaire rédigée"
        titre="La veille stratégique écrite pour votre seule organisation"
        chapeau="Réglementation, financements, marchés, concurrents : chaque semaine, nous les surveillons pour vous et vous écrivons l’essentiel."
        aperçu={<ExtraitDeLettre />}
        ton="encre"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <BoutonDémo négatif />
          <Link href="/exemple" className="group inline-flex items-center gap-1 text-blanc">
            Voir des exemples
            <span aria-hidden="true" className="text-rose transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
        <ChiffresClés
          négatif
          chiffres={[
            { valeur: '1', libellé: 'lettre par semaine' },
            { valeur: `${LETTRE_UNIQUE.axesMin}–${LETTRE_UNIQUE.axesMax}`, libellé: 'axes pour vous' },
            { valeur: `${PARUTIONS_D_ESSAI}`, libellé: 'parutions d’essai' },
          ]}
        />
        <p className="text-label text-gris-ligne">
          Essai sans carte bancaire. Mise en place offerte jusqu’au {finDuTarifEarlyAdopter()}.
        </p>
      </OuvertureVitrine>

      <BandeauLogos />

      <section aria-labelledby="ce-que-vous-recevez" className="border-b border-gris-ligne">
        <div className="px-6 py-12 lg:px-12">
          <TêteDeSection
            surtitre="Ce que vous recevez"
            titre="Une lettre, trois niveaux de lecture, un espace"
            disposition="pile"
            id="ce-que-vous-recevez"
          />
        </div>
        <Onglets
          étiquette="Ce que vous recevez"
          forme="cases"
          panneaux={[
            {
              clé: 'essentiel',
              libellé: 'L’essentiel',
              description: `${ESSENTIEL_LIGNES_MAX} lignes · 30 secondes`,
              contenu: <AperçuEssentiel />,
            },
            {
              clé: 'axes',
              libellé: 'Les axes',
              description: `${LETTRE_UNIQUE.axesMin} à ${LETTRE_UNIQUE.axesMax} axes · 5 minutes`,
              contenu: <AperçuAxes />,
            },
            {
              clé: 'espace',
              libellé: 'Votre espace',
              description: 'Archives, axes, acteurs',
              contenu: <AperçuEspace />,
            },
            {
              clé: 'sources',
              libellé: 'Les sources',
              description: 'Chaque fait daté et lié',
              contenu: <AperçuSources />,
            },
          ]}
        />
      </section>

      <SectionVitrine
        surtitre="Ce que vous gagnez"
        titre="Moins cher que le temps que vous y passeriez"
        disposition="côte"
        chapeau={`Une heure de veille interne par semaine vaut ${enEuros(coûtDUneHeureParSemaine())} € par mois, à ${COÛT_HORAIRE_ILLUSTRATIF} € de l’heure.`}
      >
        <ChiffresClés
          chiffres={[
            { valeur: `${enEuros(coûtDUneHeureParSemaine())} €`, libellé: '1 h par semaine, en interne' },
            { valeur: `${enEuros(coûtDeLaVeilleInterne()[1]!.parMois)} €`, libellé: '2 h par semaine, en interne' },
            { valeur: `${enEuros(PRIX_MENSUEL_HT)} €`, libellé: 'signauxfaibles, HT par mois' },
          ]}
        />
        <GraphiqueTempsDeVeille />
      </SectionVitrine>

      <SectionVitrine
        surtitre="L’impact"
        titre="Trois niveaux, pas plus"
        ton="neutre"
      >
        <Grille colonnes={3} étiquette="Les trois niveaux d’impact">
          <Case>
            <p className="self-start">
              <BadgeImpact niveau="FORT" />
            </p>
            <p className="text-h3 text-encre">Une décision à prendre.</p>
          </Case>
          <Case>
            <p className="self-start">
              <BadgeImpact niveau="MOYEN" />
            </p>
            <p className="text-h3 text-encre">Un mouvement à suivre.</p>
          </Case>
          <Case>
            <p className="self-start">
              <BadgeImpact niveau="RAS" />
            </p>
            <p className="text-h3 text-encre">Vérifié, rien de neuf.</p>
          </Case>
        </Grille>
      </SectionVitrine>

      <SectionVitrine
        surtitre="Le marché"
        titre="Un outil vous livre des alertes. Nous vous livrons l’analyse."
        chapeau="L’un des outils de votre tableau de bord, appliqué à notre propre marché."
        disposition="côte"
      >
        <CarteDuMarché />
      </SectionVitrine>

      <SectionVitrine
        surtitre="Tarifs"
        titre="Un prix par organisation, tout compris"
        chapeau={`${LECTEURS_ACTIFS_MAX} lecteurs, référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main compris : ${enEuros(prixParLecteur())} € HT par lecteur et par mois.`}
        disposition="côte"
        ton="neutre"
      >
        <CartesDeTarifs />
        <LienFlèche href="/tarifs">Tout sur les tarifs et l’essai</LienFlèche>
      </SectionVitrine>

      <SectionVitrine surtitre="Questions fréquentes" titre="Avant de demander une démo" disposition="côte">
        <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
          <Question titre="Quand arrive la lettre ?">
            Le même jour chaque semaine, par courriel, à chacun de vos lecteurs. Elle reste ensuite
            dans votre espace, avec toutes les précédentes.
          </Question>
          <Question titre="Comment se déroule l’essai ?">
            Il commence à votre première lettre publiée et dure {PARUTIONS_D_ESSAI} parutions
            complètes. Aucun moyen de paiement n’est demandé pour le commencer.
          </Question>
          <Question titre="Faut-il un mot de passe ?">
            Non. Chaque lecteur accède à l’espace par un lien personnel. Perdu, il se redemande en
            saisissant son adresse sur la page de connexion.
          </Question>
          <Question titre="Puis-je résilier à tout moment ?">
            Oui, en formule mensuelle, depuis « Mon abonnement » dans votre espace. Vos lettres
            restent lisibles jusqu’à la fin de la période déjà payée.
          </Question>
        </div>
      </SectionVitrine>

      <AppelFinal
        titre="Voir une lettre écrite pour vous"
        chapeau="Nous vous montrons une lettre et l’espace, puis nous préparons votre référentiel."
      />
    </CoquilleVitrine>
  )
}
