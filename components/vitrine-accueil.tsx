import {
  AperçuConcurrents,
  AperçuEssentiel,
  AperçuÉcosystème,
  AperçuLectureStratégique,
  AperçuSources,
} from '@/components/apercu-vitrine'
import { BandeauLogos } from '@/components/bandeau-logos'
import { Case, Grille, LienFlèche } from '@/components/coquille'
import { GraphiqueTempsDeVeille } from '@/components/graphiques-vitrine'
import { Onglets } from '@/components/onglets'
import { AppelFinal, ChiffresClés, CoquilleVitrine, ListeCarrée, Question, SectionVitrine, TêteDeSection } from '@/components/vitrine'
import { HéroVidéo } from '@/components/vitrine-heros'
import { CartesDeTarifs } from '@/components/vitrine-tarifs'
import { ESSENTIEL_LIGNES_MAX } from '@/lib/domaine/texte'
import { enEuros, HEURES_DE_PRISE_EN_MAIN, LECTEURS_ACTIFS_MAX, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import { PARUTIONS_D_ESSAI } from '@/lib/domaine/parcours'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'
import { COÛT_HORAIRE_ILLUSTRATIF, coûtDeLaVeilleInterne, coûtDUneHeureParSemaine, prixParLecteur } from '@/lib/vitrine/marche'

/**
 * L'accueil des visiteurs sans session (23 octobre 2026, refondu le
 * 7 novembre 2026). La racine le rend au lieu de rediriger vers « recevoir mon
 * lien » ; une session valide mène toujours à son espace, sans voir cette page.
 *
 * Déroulé de la refonte : l'ouverture montre le produit (la vidéo de l'espace,
 * `HéroVidéo`, retenue le 7 novembre 2026 parmi quatre candidates) ; les logos ; « Ce que vous recevez » en quatre onglets, chacun avec
 * son aperçu ; la valeur, chiffrée ; les deux supports (la lettre, l'espace) ;
 * l'analyse ; les tarifs en cartes ; les questions ; l'appel final. Les aperçus
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
      <HéroVidéo titre="La veille stratégique écrite pour votre seule organisation" />

      <BandeauLogos />

      <section aria-labelledby="ce-que-vous-recevez" className="border-b border-gris-ligne">
        <div className="px-6 py-12 lg:px-12">
          <TêteDeSection
            surtitre="Ce que vous recevez"
            titre="Une lettre par semaine, quatre façons de la lire"
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
              clé: 'ecosysteme',
              libellé: 'L’écosystème',
              description: 'Votre environnement, axe par axe',
              contenu: <AperçuÉcosystème />,
            },
            {
              clé: 'concurrents',
              libellé: 'Les concurrents',
              description: 'Chacun suivi, semaine après semaine',
              contenu: <AperçuConcurrents />,
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
        surtitre="Deux supports"
        titre="La lettre dans votre boîte, l’espace sur votre téléphone"
        ton="neutre"
      >
        <Grille colonnes={2} étiquette="La lettre et l’espace">
          <Case>
            <p className="label-mono text-ardoise">Lettre hebdomadaire · courriel</p>
            <p className="font-titre text-h3 font-semibold text-encre">Le même jour chaque semaine, à chacun de vos lecteurs.</p>
            <ListeCarrée
              éléments={[
                `L’essentiel en ${ESSENTIEL_LIGNES_MAX} lignes, puis ${LETTRE_UNIQUE.axesMin} à ${LETTRE_UNIQUE.axesMax} axes classés par impact.`,
                'Chaque fait daté, lié à sa source.',
                `Jusqu’à ${LECTEURS_ACTIFS_MAX} lecteurs par organisation.`,
              ]}
            />
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Espace · web et mobile</p>
            <p className="font-titre text-h3 font-semibold text-encre">Toutes vos lettres, et ce qu’elles disent de votre marché.</p>
            <ListeCarrée
              éléments={[
                'Les archives, semaine par semaine, et chaque axe suivi d’une lettre à l’autre.',
                'Vos concurrents, votre environnement, votre stratégie : un écran par lecture.',
                'Un lien personnel, sans mot de passe ; installable sur votre téléphone, lisible hors ligne.',
              ]}
            />
          </Case>
        </Grille>
      </SectionVitrine>

      <SectionVitrine
        surtitre="L’analyse"
        titre="Un outil vous livre des alertes. Nous vous livrons l’analyse."
        chapeau="Chaque fait de la lettre est classé : ce qui bouge dans votre environnement, qui bouge dans votre concurrence, ce qui peut changer votre position."
        disposition="côte"
      >
        <AperçuLectureStratégique />
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
