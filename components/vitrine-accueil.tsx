import { AperçuAxes, AperçuEspace, AperçuEssentiel, AperçuSources, ExtraitDeLettre } from '@/components/apercu-vitrine'
import { BadgeImpact } from '@/components/badge-impact'
import { BandeauLogos } from '@/components/bandeau-logos'
import { Case, Grille, LienFlèche } from '@/components/coquille'
import { CarteDuMarché, GraphiqueTempsDeVeille } from '@/components/graphiques-vitrine'
import { Onglets } from '@/components/onglets'
import {
  AppelFinal,
  BoutonDémo,
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
        chapeau={
          <>
            Vous n’avez pas le temps de surveiller la réglementation, les financements, les
            marchés et vos concurrents. Chaque semaine, nous le faisons pour vous et vous
            écrivons une lettre : {LETTRE_UNIQUE.axesMin} à {LETTRE_UNIQUE.axesMax} axes propres
            à votre organisation, chaque fait daté, sourcé, et son impact pour vous qualifié.
          </>
        }
        aperçu={<ExtraitDeLettre />}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <BoutonDémo />
          <LienFlèche href="/exemple">Voir des exemples</LienFlèche>
        </div>
        <p className="text-label text-ardoise">
          Essai de {PARUTIONS_D_ESSAI} parutions complètes, sans carte bancaire ni engagement. Frais
          de mise en place offerts pour toute inscription jusqu’au {finDuTarifEarlyAdopter()}.
        </p>
      </OuvertureVitrine>

      <BandeauLogos />

      <section aria-labelledby="ce-que-vous-recevez" className="border-b border-gris-ligne">
        <div className="px-6 py-12 lg:px-12">
          <TêteDeSection
            surtitre="Ce que vous recevez"
            titre="Une lettre, trois niveaux de lecture, un espace"
            chapeau="La même lettre se lit en trente secondes, en cinq minutes, ou en suivant ses sources. Elle arrive par courriel et reste dans votre espace."
            disposition="côte"
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
              description: `${ESSENTIEL_LIGNES_MAX} lignes au plus, en tête de lettre. Trente secondes.`,
              contenu: <AperçuEssentiel />,
            },
            {
              clé: 'axes',
              libellé: 'Les axes',
              description: `${LETTRE_UNIQUE.axesMin} à ${LETTRE_UNIQUE.axesMax} axes, ${LETTRE_UNIQUE.faitsParAxeMax} faits au plus par axe. Cinq minutes.`,
              contenu: <AperçuAxes />,
            },
            {
              clé: 'espace',
              libellé: 'Votre espace',
              description: 'Les chiffres de la semaine, les archives, les acteurs suivis.',
              contenu: <AperçuEspace />,
            },
            {
              clé: 'sources',
              libellé: 'Les sources',
              description: 'Chaque fait porte sa date et le lien de la page d’où il vient.',
              contenu: <AperçuSources />,
            },
          ]}
        />
      </section>

      <SectionVitrine
        surtitre="Ce que vous gagnez"
        titre="Moins cher que le temps que vous y passeriez"
        disposition="côte"
        chapeau={`Une veille faite en interne prend des heures chaque semaine. Comptée à ${COÛT_HORAIRE_ILLUSTRATIF} € de l’heure, une seule heure par semaine vaut déjà ${enEuros(coûtDUneHeureParSemaine())} € par mois, et deux heures ${enEuros(coûtDeLaVeilleInterne()[1]!.parMois)} €, plus que l’abonnement.`}
      >
        <GraphiqueTempsDeVeille />
        <p className="max-w-3xl text-encre">
          Le temps n’est que le plancher de la valeur. Ce qui compte, c’est le fait qui appelait
          une décision et que vous auriez manqué : un appel d’offres à viser, un concurrent qui
          s’installe, une aide qui ferme dans trois semaines.
        </p>
      </SectionVitrine>

      <SectionVitrine
        surtitre="L’impact"
        titre="Trois niveaux, pas plus"
        chapeau="Chaque axe reçoit un niveau. Pas d’échelle à dix crans : ce qui compte, ce qui est à surveiller, et ce qui n’a pas bougé."
        disposition="côte"
        ton="neutre"
      >
        <Grille colonnes={3} étiquette="Les trois niveaux d’impact">
          <Case>
            <p className="self-start">
              <BadgeImpact niveau="FORT" />
            </p>
            <p className="text-encre">Un fait qui appelle une décision ou une action de votre part.</p>
          </Case>
          <Case>
            <p className="self-start">
              <BadgeImpact niveau="MOYEN" />
            </p>
            <p className="text-encre">Un mouvement qui vous concerne, à suivre dans les semaines qui viennent.</p>
          </Case>
          <Case>
            <p className="self-start">
              <BadgeImpact niveau="RAS" />
            </p>
            <p className="text-encre">
              Rien de nouveau. La lettre le dit et nomme ce qui a été vérifié : le silence est un
              constat, pas un oubli.
            </p>
          </Case>
        </Grille>
      </SectionVitrine>

      <SectionVitrine
        surtitre="Votre espace"
        titre="Une veille qui se consulte, pas un courriel qui se perd"
        chapeau="La lettre arrive par courriel et reste dans un espace réservé à votre organisation."
        disposition="côte"
      >
        <Grille colonnes={4} étiquette="Ce que l’espace donne à lire">
          <Case>
            <p className="label-mono text-ardoise">Archives</p>
            <p className="text-encre">Toutes les lettres archivées, semaine par semaine.</p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Axes</p>
            <p className="text-encre">Chaque axe suivi sur les quatre dernières lettres : ce qui monte et ce qui retombe.</p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Acteurs</p>
            <p className="text-encre">Les acteurs et dossiers suivis d’une édition à l’autre : qui bouge, qui s’enlise.</p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Accès</p>
            <p className="text-encre">
              Un lien personnel par lecteur, sans mot de passe, {LECTEURS_ACTIFS_MAX} lecteurs par organisation.
            </p>
          </Case>
        </Grille>
        <LienFlèche href="/exemple">Voir un tableau de bord complet</LienFlèche>
      </SectionVitrine>

      <SectionVitrine
        surtitre="Le marché"
        titre="Un outil vous livre des alertes. Nous vous livrons l’analyse."
        chapeau="La carte des groupes stratégiques est l’un des outils de votre tableau de bord. La voici appliquée au marché de la veille."
        disposition="côte"
      >
        <CarteDuMarché />
      </SectionVitrine>

      <SectionVitrine
        surtitre="Tarifs"
        titre={`${enEuros(PRIX_MENSUEL_HT)} € HT par mois, référentiel et prise en main compris`}
        chapeau={`Une lettre par semaine, l’espace et ses archives, ${LECTEURS_ACTIFS_MAX} lecteurs, la création de votre référentiel et ${HEURES_DE_PRISE_EN_MAIN} h de prise en main : soit ${enEuros(prixParLecteur())} € HT par lecteur et par mois.`}
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
        chapeau="Nous vous montrons une lettre et l’espace qui l’accompagne, puis nous préparons votre référentiel."
      />
    </CoquilleVitrine>
  )
}
