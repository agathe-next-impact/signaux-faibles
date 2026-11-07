import { ÀRetenir } from '@/components/a-retenir'
import { Case, Grille, Panneau } from '@/components/coquille'
import { RenduDocument } from '@/components/document'
import { construireDocument, type Document, fusionnerLesAxes } from '@/lib/domaine/document'
import { type DossierOuvert, ordonnerLesDossiers } from '@/lib/domaine/dossiers'
import { trierParImpact } from '@/lib/domaine/impact'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { acteursEnVue } from '@/lib/domaine/mentions'
import { faitsDeLaLettre } from '@/lib/domaine/strategie'
import { synthétiser } from '@/lib/domaine/synthese'
import { RUBRIQUES } from '@/lib/domaine/tableau-de-bord'
import { axesÀRetenir, suivreLesAxes } from '@/lib/domaine/tendances'
import type { Démonstration } from '@/lib/vitrine/demonstrations'
import { lectureDeDémonstration } from '@/lib/vitrine/lecture-demonstration'

/**
 * Le tableau de bord et la lettre d'une organisation fictive, pour la vitrine.
 *
 * Mêmes calculs que la vue d'ensemble de l'espace client (`synthétiser`,
 * `acteursEnVue`, `axesÀRetenir`, et les cartes de rubrique du 30 octobre 2026,
 * recalculées sur la seule lettre fictive : refonte du 7 novembre 2026, à la
 * demande de l'opératrice) et même rendu de la lettre
 * (`RenduDocument`), sur une lettre écrite dans le code au lieu d'une édition
 * lue dans Notion. Les cases ne mènent nulle part : il n'y a pas d'espace
 * derrière une démonstration.
 */

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

const ACTEURS_EN_ACCUEIL = 6

function documentDe(démonstration: Démonstration) {
  return construireDocument(markdownVersBlocs(démonstration.markdown))
}

export function TableauDeBordDeDémonstration({ démonstration }: { démonstration: Démonstration }) {
  const document = documentDe(démonstration)
  const synthèse = synthétiser([document], [démonstration.dossiers])
  const acteurs = ordonnerLesDossiers(acteursEnVue(synthèse.dossiers, [document]))
  // Les points forts : les axes FORT de la lettre, sans lettre précédente (une seule lettre fictive).
  const pointsForts = axesÀRetenir(suivreLesAxes([document], []), { avecPrécédent: false })
  const cartes = cartesDeDémonstration(démonstration, document, synthèse.dossiers)

  return (
    <div className="flex flex-col gap-12">
      <Panneau ton="ardoise">
        <h3 className="label-mono text-ardoise">Action de la semaine</h3>
        <p className="mt-3 text-encre">{démonstration.actionDeLaSemaine}</p>
      </Panneau>

      <ÀRetenir titre="Points forts de la semaine" mention="signal fort" axes={pointsForts} lien={() => `#${démonstration.clé}`} />

      <section className="flex flex-col gap-4">
        <h3 className="font-titre text-h2 font-bold text-encre">À la une</h3>
        <p className="text-ardoise">Les acteurs et les dossiers dont la lettre de la semaine a quelque chose à dire.</p>
        <Grille étiquette="Acteurs suivis" colonnes={3}>
          {acteurs.slice(0, ACTEURS_EN_ACCUEIL).map((acteur) => (
            <Case key={acteur.nom} accent={acteur.compteur === 0}>
              <h4 className="font-titre text-h3 font-semibold text-encre">{acteur.nom}</h4>
              {acteur.précision ?? acteur.extrait ? (
                <p className="text-ardoise">{acteur.précision ?? acteur.extrait}</p>
              ) : null}
              <p className="label-mono mt-auto pt-1 text-ardoise">
                {acteur.compteur === null
                  ? 'suivi'
                  : acteur.compteur === 0
                    ? 'a bougé cette semaine'
                    : `${acteur.compteur} semaine${acteur.compteur > 1 ? 's' : ''} sans mouvement`}
              </p>
            </Case>
          ))}
        </Grille>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-titre text-h2 font-bold text-encre">Votre espace</h3>
        <p className="max-w-[68ch] text-ardoise">Quatre rubriques, chacune avec ses écrans et leur chiffre clé.</p>
        <Grille étiquette="Les rubriques de l’espace" colonnes={2}>
          {cartes.map((r) => (
            <Case key={r.titre}>
              <h4 className="font-titre text-h3 font-semibold text-encre">{r.titre}</h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {r.écrans.map((é) => (
                  <div key={é.écran} className="flex flex-col">
                    <dt className="label-mono text-ardoise">{é.écran}</dt>
                    <dd className="text-encre">{é.valeur}</dd>
                    <dd className="font-mono text-label text-ardoise">{é.mention}</dd>
                  </div>
                ))}
              </dl>
            </Case>
          ))}
        </Grille>
      </section>
    </div>
  )
}

const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`

/**
 * Les cartes de rubrique de la vue d'ensemble (lot 4 du 30 octobre 2026),
 * calculées sur la seule lettre fictive et sa grille : ce que l'espace compte
 * sur treize semaines et sur la synthèse publiée n'existe pas ici, et n'est pas
 * inventé ; la carte ne porte que ce que la lettre donne.
 */
function cartesDeDémonstration(d: Démonstration, document: Document, dossiers: readonly DossierOuvert[]) {
  const lecture = lectureDeDémonstration(d, document)
  const axes = trierParImpact(fusionnerLesAxes([document]))
  const forts = axes.filter((a) => a.niveau === 'FORT').length
  const concurrents = d.grille.entités.filter((e) => e.ansoff !== undefined)
  const partiesPrenantes = d.grille.entités.length - concurrents.length
  const estConcurrent = (nom: string) => concurrents.some((c) => nom.toLowerCase().includes(c.nom.toLowerCase()))
  const dossiersHorsConcurrents = dossiers.filter((x) => !estConcurrent(x.nom)).length
  const concurrentsQuiBougent = dossiers.filter((x) => estConcurrent(x.nom) && x.compteur === 0).length
  const pestel = [...lecture.pestel].sort((a, b) => b.faits - a.faits)[0]
  const force = [...lecture.forces].sort((a, b) => b.faits - a.faits)[0]
  const ruptures = lecture.ruptures.length
  const sources = new Set(faitsDeLaLettre(document).flatMap((f) => f.urls)).size
  return [
    {
      titre: RUBRIQUES[0].titre,
      écrans: [
        { écran: 'Concurrents', valeur: pluriel(concurrents.length, 'suivi'), mention: `${pluriel(concurrentsQuiBougent, 'a bougé', 'ont bougé')} cette semaine` },
        { écran: 'Acteurs', valeur: pluriel(dossiersHorsConcurrents, 'dossier'), mention: 'hors concurrents' },
        { écran: 'Forces du marché', valeur: force && force.faits > 0 ? force.libellé.toLowerCase() : 'n.d.', mention: force ? `la plus citée, ${pluriel(force.faits, 'fait')}` : '' },
      ],
    },
    {
      titre: RUBRIQUES[1].titre,
      écrans: [
        { écran: 'Les axes', valeur: pluriel(axes.length, 'axe'), mention: `${pluriel(forts, 'signal fort', 'signaux forts')} cette semaine` },
        { écran: 'PESTEL', valeur: pestel && pestel.faits > 0 ? pestel.libellé.toLowerCase() : 'n.d.', mention: pestel ? `la plus citée, ${pluriel(pestel.faits, 'fait')}` : '' },
      ],
    },
    {
      titre: RUBRIQUES[2].titre,
      écrans: [
        { écran: 'Ruptures', valeur: pluriel(ruptures, 'rupture'), mention: 'ce qui peut changer votre position' },
        { écran: 'Diagnostic et options', valeur: 'à la synthèse', mention: 'chaque mois, sur les lettres du mois' },
        { écran: 'Scénarios', valeur: 'au trimestre', mention: 'trois scénarios, et ce qui les confirmerait' },
      ],
    },
    {
      titre: RUBRIQUES[3].titre,
      écrans: [
        { écran: 'Thèmes suivis', valeur: pluriel(axes.length, 'thème'), mention: 'ce que chacun suit, ce qui le rend fort' },
        { écran: 'Sources', valeur: pluriel(sources, 'source'), mention: 'citées cette semaine' },
        { écran: 'Corpus', valeur: pluriel(d.grille.entités.length, 'entité'), mention: `${pluriel(concurrents.length, 'concurrent')}, ${pluriel(partiesPrenantes, 'partie prenante', 'parties prenantes')}` },
        { écran: 'Archives', valeur: pluriel(1, 'semaine'), mention: 'une entrée par semaine' },
      ],
    },
  ]
}

export function LettreDeDémonstration({ démonstration }: { démonstration: Démonstration }) {
  const document = documentDe(démonstration)
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1 border-b border-gris-ligne pb-4">
        <p className="label-mono text-ardoise">
          {démonstration.veille} · n° {démonstration.numéro} · {DATE.format(new Date(démonstration.dateÉdition))}
        </p>
        <p className="label-mono text-ardoise">Période couverte : {démonstration.périodeCouverte}</p>
      </div>
      <aside className="border border-gris-ligne bg-fond-ardoise p-4">
        <h3 className="label-mono text-ardoise">Action de la semaine</h3>
        <p className="mt-2 text-encre">{démonstration.actionDeLaSemaine}</p>
      </aside>
      <RenduDocument document={document} />
    </article>
  )
}
