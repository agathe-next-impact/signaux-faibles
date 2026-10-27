import type { Metadata } from 'next'
import { Case, Grille, LienFlèche, Panneau } from '@/components/coquille'
import { BoutonDémo, CoquilleVitrine, ListeCarrée, OuvertureVitrine, SectionVitrine } from '@/components/vitrine'
import { ESSENTIEL_LIGNES_MAX } from '@/lib/domaine/texte'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { PARUTIONS_D_ESSAI } from '@/lib/domaine/parcours'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'

export const metadata: Metadata = {
  title: 'L’offre — signauxfaibles',
  description:
    'Une veille hebdomadaire rédigée pour votre organisation : une lettre par semaine, des faits datés et sourcés, un espace pour les retrouver.',
  // Page vitrine : la seule famille de pages du portail que l'on veut voir indexée.
  robots: { index: true, follow: true },
}

/**
 * « L'offre » (23 octobre 2026) : ce que contient la lettre, comment la veille
 * se met en place, ce que l'espace donne à lire. Page publique, ouverte par le
 * proxy à l'adresse exacte (`PUBLICS_EXACTS`), sans lecture de Notion ni de
 * Postgres.
 */
export default function Offre() {
  return (
    <CoquilleVitrine courante="offre">
      <OuvertureVitrine
        surtitre="L’offre"
        titre="Une veille écrite pour votre organisation, chaque semaine."
        chapeau="Nous suivons pour vous l’écosystème et la concurrence, et nous en tirons une lettre courte, datée et sourcée. Vous la lisez dans votre boîte de réception, et vous la retrouvez dans votre espace."
      >
        <BoutonDémo />
      </OuvertureVitrine>

      <SectionVitrine
        surtitre="Mise en place"
        titre="De votre site à votre première lettre"
      >
        <Grille colonnes={3} étiquette="Les étapes de mise en place">
          <Case>
            <p className="label-mono text-ardoise">Étape 1</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Votre référentiel</h3>
            <p className="text-ardoise">
              À partir de votre site et des sources publiques de votre secteur, nous dressons la
              liste de ce qui vous concerne : {LETTRE_UNIQUE.axesMin} à {LETTRE_UNIQUE.axesMax} axes,
              les sources nommées de chacun, les acteurs à suivre.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Étape 2</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Votre première lettre</h3>
            <p className="text-ardoise">
              Elle paraît dans votre espace, et vos lecteurs reçoivent leur lien d’accès
              personnel. L’essai commence avec elle.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Chaque semaine</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Une parution</h3>
            <p className="text-ardoise">
              Le même jour chaque semaine, une nouvelle lettre : ce qui s’est passé depuis la
              précédente, et l’avancement des dossiers ouverts.
            </p>
          </Case>
        </Grille>
      </SectionVitrine>

      <SectionVitrine
        surtitre="La lettre"
        titre="Ce qu’elle contient"
        chapeau={`${LETTRE_UNIQUE.motsMax.toLocaleString('fr-FR')} mots au plus, lettre entière : tout ce qui compte, rien pour remplir.`}
      >
        <Grille colonnes={2} étiquette="Les rubriques de la lettre">
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">L’essentiel</h3>
            <p className="text-ardoise">
              {ESSENTIEL_LIGNES_MAX} lignes au plus en tête de lettre, chacune lisible seule. Si
              vous n’avez que trente secondes, c’est elle qu’il faut lire.
            </p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Les actualités par axe</h3>
            <p className="text-ardoise">
              Réglementation, marché, financements, technologie, territoire, et les familles de
              concurrents qui vous concernent. {LETTRE_UNIQUE.faitsParAxeMax} faits au plus par
              axe, {LETTRE_UNIQUE.phrasesParFaitMax} phrases au plus par fait.
            </p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Un niveau d’impact par axe</h3>
            <p className="text-ardoise">
              Signal fort, à surveiller, ou RAS. Un axe sans nouveauté le dit, et nomme ce qui a
              été vérifié.
            </p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Les dossiers suivis</h3>
            <p className="text-ardoise">
              Les sujets ouverts que la veille suit d’une semaine à l’autre, avec leur
              avancement.
            </p>
          </Case>
        </Grille>
        <Panneau ton="ardoise">
          <div className="flex flex-col gap-3">
            <p className="label-mono text-ardoise">Ce qui n’y figure jamais</p>
            <ListeCarrée
              éléments={[
                'Un fait sans date ni source : chaque fait porte le lien de la page d’où il vient.',
                'Une note de méthode ou un rapport de collecte : c’est notre travail, pas votre lecture.',
                'Du remplissage pour faire nombre : une semaine calme donne une lettre courte.',
              ]}
            />
          </div>
        </Panneau>
      </SectionVitrine>

      <SectionVitrine
        surtitre="Ce qui nous distingue"
        titre="Chaque promesse est tenue par le produit"
        chapeau="Rien de ce qui suit n’est un engagement de principe : chaque point se vérifie dans une lettre ou dans l’espace, en démonstration."
      >
        <Grille colonnes={3} étiquette="Ce qui nous distingue">
          {[
            {
              titre: 'Une veille propre à votre organisation',
              garantie: 'Un périmètre établi pour vous : vos axes, vos sources nommées, vos acteurs.',
              face: 'une newsletter sectorielle, la même pour tous',
            },
            {
              titre: 'Des faits vérifiables',
              garantie: 'Chaque fait porte sa date et le lien de sa source ; la lettre est contrôlée avant l’envoi.',
              face: 'un résumé sans source',
            },
            {
              titre: 'Une hiérarchie claire',
              garantie: 'Trois niveaux d’impact par axe ; un axe sans nouveauté dit ce qui a été vérifié.',
              face: 'une alerte par mot-clé, sans tri',
            },
            {
              titre: 'Une lecture courte',
              garantie: `${ESSENTIEL_LIGNES_MAX} lignes pour l’essentiel, ${LETTRE_UNIQUE.motsMax.toLocaleString('fr-FR')} mots au plus pour la lettre entière.`,
              face: 'un flux d’articles à lire',
            },
            {
              titre: 'Un suivi dans la durée',
              garantie: 'Les dossiers ouverts suivis d’une lettre à l’autre, avec leurs semaines sans mouvement.',
              face: 'une alerte ponctuelle, sans mémoire',
            },
            {
              titre: 'Une archive confidentielle',
              garantie: 'Un espace par organisation, cloisonné ; un lien personnel par lecteur, révocable.',
              face: 'des courriels perdus dans une boîte',
            },
          ].map((argument) => (
            <Case key={argument.titre}>
              <h3 className="font-titre text-h3 font-semibold text-encre">{argument.titre}</h3>
              <p className="text-ardoise">{argument.garantie}</p>
              <p className="label-mono mt-auto pt-1 text-ardoise">Face à {argument.face}</p>
            </Case>
          ))}
        </Grille>
      </SectionVitrine>

      <SectionVitrine
        surtitre="L’espace"
        titre="Ce que vous retrouvez en ligne"
        chapeau="Un espace réservé à votre organisation, accessible par un lien personnel, sans mot de passe. Il s’installe aussi comme une application sur ordinateur et téléphone."
      >
        <Grille colonnes={3} étiquette="Les écrans de l’espace">
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Vue d’ensemble</h3>
            <p className="text-ardoise">Les chiffres de la semaine, l’action recommandée, ce qui est à la une.</p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Lettres et archives</h3>
            <p className="text-ardoise">Toutes les lettres, et une entrée par semaine depuis le début de la veille.</p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Les axes</h3>
            <p className="text-ardoise">Chaque axe suivi sur les quatre dernières lettres : ce qui est nouveau, ce qui dure, ce qui dort.</p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Acteurs</h3>
            <p className="text-ardoise">Chaque dossier ouvert, et les passages des lettres qui le nomment.</p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Recommandations</h3>
            <p className="text-ardoise">Les actions proposées semaine après semaine.</p>
          </Case>
          <Case>
            <h3 className="font-titre text-h3 font-semibold text-encre">Périmètre</h3>
            <p className="text-ardoise">Ce que la veille surveille pour vous : axes, sources et acteurs suivis.</p>
          </Case>
        </Grille>
      </SectionVitrine>

      <SectionVitrine
        surtitre="Lecture stratégique · en test"
        titre="Les outils de l’analyse stratégique, appliqués à vos faits"
        chapeau="Chaque fait de vos lettres est classé dans les cadres que l’on enseigne en stratégie. Le tableau de bord en tire des comptes, jamais une opinion : ce qui bouge dans votre environnement, qui bouge dans votre concurrence, et ce qui pourrait changer votre position."
      >
        <Grille colonnes={2} étiquette="Les outils de la lecture stratégique">
          <Case>
            <p className="label-mono text-ardoise">Environnement</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">PESTEL</h3>
            <p className="text-ardoise">
              Politique, économique, social, technologique, environnemental, légal : les six
              dimensions, y compris celles où rien ne bouge. Un trou se voit.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Concurrence</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Les cinq forces</h3>
            <p className="text-ardoise">
              Rivalité, nouveaux entrants, substituts, pouvoir des clients et des fournisseurs, avec
              les acteurs les plus cités sous chaque force.
            </p>
          </Case>
          <Case>
            <p className="label-mono text-ardoise">Mouvements</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Ce que font vos concurrents</h3>
            <p className="text-ardoise">
              Gagner des parts sur leur marché, lancer une offre, viser un nouveau public : chaque
              geste nommé est rangé dans la matrice d’Ansoff.
            </p>
          </Case>
          <Case accent>
            <p className="label-mono text-ardoise">Ruptures</p>
            <h3 className="font-titre text-h3 font-semibold text-encre">Ce qui change votre position</h3>
            <p className="text-encre">
              Les rares faits qui modifient la situation que la veille surveille pour vous. Une
              lettre en compte zéro, un ou deux ; un événement n’est compté qu’une fois.
            </p>
          </Case>
        </Grille>
        <p className="max-w-3xl text-ardoise">
          En test auprès de nos premiers clients. D’autres outils sont en préparation : la carte des
          groupes stratégiques, la matrice des parties prenantes et la SWOT.
        </p>
        <LienFlèche href="/exemple">Voir une lecture stratégique en exemple</LienFlèche>
      </SectionVitrine>

      <SectionVitrine
        surtitre="Pour qui"
        titre={`Jusqu’à ${LECTEURS_ACTIFS_MAX} lecteurs par organisation`}
        chapeau="Direction, développement, affaires publiques : chaque lecteur a son propre lien, que vous pouvez retirer ou attribuer à quelqu’un d’autre depuis l’espace."
      >
        <Panneau ton="rose">
          <div className="flex flex-col gap-3">
            <p className="label-mono text-ardoise">Essai</p>
            <p className="text-encre">
              {PARUTIONS_D_ESSAI} parutions complètes pour juger sur pièces, sans carte bancaire.
              Vous décidez ensuite de vous abonner, ou non.
            </p>
            <LienFlèche href="/tarifs">Voir les tarifs et le déroulé de l’essai</LienFlèche>
          </div>
        </Panneau>
      </SectionVitrine>
    </CoquilleVitrine>
  )
}
