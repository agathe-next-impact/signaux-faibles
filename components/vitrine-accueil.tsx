import { BadgeImpact } from '@/components/badge-impact'
import { BandeauLogos } from '@/components/bandeau-logos'
import { Case, Grille, LienFlèche } from '@/components/coquille'
import { BoutonDémo, CoquilleVitrine, ListeCarrée, OuvertureVitrine, SectionVitrine } from '@/components/vitrine'
import { ESSENTIEL_LIGNES_MAX } from '@/lib/domaine/texte'
import { enEuros, LECTEURS_ACTIFS_MAX, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import { PARUTIONS_D_ESSAI } from '@/lib/domaine/parcours'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'

/**
 * L'accueil des visiteurs sans session (23 octobre 2026). La racine le rend au
 * lieu de rediriger vers « recevoir mon lien » ; une session valide mène
 * toujours à son espace, sans voir cette page.
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
        titre="La veille stratégique dédiée à votre organisation"
        chapeau={
          <>
            Chaque semaine, une lettre écrite pour vous : réglementation, marché,
            financements, territoire et concurrents, réunis en {LETTRE_UNIQUE.axesMin} à{' '}
            {LETTRE_UNIQUE.axesMax} axes. Chaque fait est daté, sourcé, et son impact pour vous
            est qualifié.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <BoutonDémo />
          <LienFlèche href="/offre">Découvrir l’offre</LienFlèche>
        </div>
        <p className="text-label text-ardoise">
          Essai de {PARUTIONS_D_ESSAI} parutions complètes, sans carte bancaire ni engagement.
        </p>
      </OuvertureVitrine>

      <BandeauLogos />

      <SectionVitrine
        surtitre="Ce que vous recevez"
        titre="Une lettre, trois niveaux de lecture"
        chapeau="La même lettre se lit en trente secondes, en cinq minutes, ou en suivant ses sources."
      >
        <Grille colonnes={3} étiquette="Les trois niveaux de lecture de la lettre">
          <Case>
            <p className="label-mono text-ardoise">30 secondes</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">L’essentiel</h3>
            <p className="text-ardoise">
              {ESSENTIEL_LIGNES_MAX} lignes au plus, en tête de lettre. Chacune se lit seule :
              qui, quoi, quand.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">5 minutes</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Les actualités par axe</h3>
            <p className="text-ardoise">
              {LETTRE_UNIQUE.axesMin} à {LETTRE_UNIQUE.axesMax} axes propres à votre organisation,
              {' '}{LETTRE_UNIQUE.faitsParAxeMax} faits au plus par axe, deux phrases par fait.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Pour aller plus loin</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Les sources</h3>
            <p className="text-ardoise">
              Chaque fait porte sa date et le lien de la page d’où il vient, ouverte au moment
              de la collecte.
            </p>
          </Case>
        </Grille>
      </SectionVitrine>

      <SectionVitrine
        surtitre="L’impact"
        titre="Trois niveaux, pas plus"
        chapeau="Chaque axe reçoit un niveau. Pas d’échelle à dix crans : ce qui compte, ce qui est à surveiller, et ce qui n’a pas bougé."
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
      >
        <ListeCarrée
          éléments={[
            'Toutes les lettres archivées, semaine par semaine.',
            'Chaque axe suivi sur les quatre dernières lettres, pour voir ce qui monte et ce qui retombe.',
            'Les acteurs et dossiers suivis d’une édition à l’autre : qui bouge, qui s’enlise.',
            `Un lien personnel par lecteur, sans mot de passe, ${LECTEURS_ACTIFS_MAX} lecteurs par organisation.`,
          ]}
        />
        <LienFlèche href="/offre">Voir comment cela fonctionne</LienFlèche>
      </SectionVitrine>

      <SectionVitrine surtitre="Tarif" titre={`${enEuros(PRIX_MENSUEL_HT)} € HT par mois, par organisation`}>
        <p className="max-w-3xl text-ardoise">
          Une lettre par semaine, l’espace et ses archives, {LECTEURS_ACTIFS_MAX} lecteurs. Sans
          engagement en formule mensuelle, deux mois offerts en formule annuelle.
        </p>
        <LienFlèche href="/tarifs">Voir les tarifs</LienFlèche>
      </SectionVitrine>
    </CoquilleVitrine>
  )
}
