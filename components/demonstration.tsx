import { CaseAxe } from '@/components/case-axe'
import { LectureStratégique } from '@/components/lecture-strategique'
import { Case, Grille, Panneau, Tuile } from '@/components/coquille'
import { RenduDocument } from '@/components/document'
import { construireDocument, fusionnerLesAxes } from '@/lib/domaine/document'
import { ordonnerLesDossiers } from '@/lib/domaine/dossiers'
import { trierParImpact } from '@/lib/domaine/impact'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { acteursEnVue } from '@/lib/domaine/mentions'
import { synthétiser } from '@/lib/domaine/synthese'
import type { Démonstration } from '@/lib/vitrine/demonstrations'
import { lectureDeDémonstration } from '@/lib/vitrine/lecture-demonstration'

/**
 * Le tableau de bord et la lettre d'une organisation fictive, pour la vitrine.
 *
 * Mêmes calculs que la vue d'ensemble de l'espace client (`synthétiser`,
 * `fusionnerLesAxes`, `acteursEnVue`) et même rendu de la lettre
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
  const axes = trierParImpact(fusionnerLesAxes([document]))
  const acteurs = ordonnerLesDossiers(acteursEnVue(synthèse.dossiers, [document]))

  return (
    <div className="flex flex-col gap-12">
      <Grille étiquette="Chiffres de la semaine" colonnes={4}>
        <Tuile intitulé="axes suivis" valeur={synthèse.axesTotal} />
        <Tuile intitulé="signal fort" valeur={synthèse.parNiveau.FORT} accent={synthèse.parNiveau.FORT > 0} />
        <Tuile intitulé="acteurs suivis" valeur={synthèse.dossiers.length} />
        <Tuile
          intitulé="sans mouvement"
          valeur={synthèse.dossiersEnAttente}
          mention={`sur ${synthèse.dossiers.length} acteurs`}
        />
      </Grille>

      <Panneau ton="ardoise">
        <h3 className="label-mono text-ardoise">Action de la semaine</h3>
        <p className="mt-3 text-encre">{démonstration.actionDeLaSemaine}</p>
      </Panneau>

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
        <h3 className="font-titre text-h2 font-bold text-encre">L’écosystème</h3>
        <p className="text-ardoise">Les axes de la semaine, du signal le plus fort au plus calme.</p>
        <Grille étiquette="Axes de la semaine">
          {axes.map((axe) => (
            <CaseAxe key={axe.titre} axe={axe} points={axe.points} />
          ))}
        </Grille>
      </section>

      <LectureStratégique lecture={lectureDeDémonstration(démonstration, document)} lettres={1} niveauDeTitre={3} />
    </div>
  )
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
