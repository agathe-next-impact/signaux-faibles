import { ÀRetenir } from '@/components/a-retenir'
import { AperçuConcurrents, AperçuLectureStratégique, AperçuÉcosystème } from '@/components/apercu-vitrine'
import { Grille, Panneau, Tuile } from '@/components/coquille'
import { RenduDocument } from '@/components/document'
import { construireDocument } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { synthétiser } from '@/lib/domaine/synthese'
import { axesÀRetenir, suivreLesAxes } from '@/lib/domaine/tendances'
import type { Démonstration } from '@/lib/vitrine/demonstrations'

/**
 * Le tableau de bord et la lettre d'une organisation fictive, pour la vitrine.
 *
 * Mêmes calculs que la vue d'ensemble de l'espace client (`synthétiser`,
 * `axesÀRetenir`) pour les cartouches ; puis trois accordéons, l'écosystème,
 * les concurrents et l'analyse, rendus par les aperçus de l'accueil sur la
 * même organisation (refonte du 7 novembre 2026, à la demande de
 * l'opératrice) ; et même rendu de la lettre
 * (`RenduDocument`), sur une lettre écrite dans le code au lieu d'une édition
 * lue dans Notion. Les cases ne mènent nulle part : il n'y a pas d'espace
 * derrière une démonstration.
 */

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

function documentDe(démonstration: Démonstration) {
  return construireDocument(markdownVersBlocs(démonstration.markdown))
}

export function TableauDeBordDeDémonstration({ démonstration }: { démonstration: Démonstration }) {
  const document = documentDe(démonstration)
  const synthèse = synthétiser([document], [démonstration.dossiers])
  // Les points forts : les axes FORT de la lettre, sans lettre précédente (une seule lettre fictive).
  const pointsForts = axesÀRetenir(suivreLesAxes([document], []), { avecPrécédent: false })

  return (
    <div className="flex flex-col gap-6">
      <Grille étiquette="Chiffres de la semaine" colonnes={4}>
        <Tuile intitulé="axes suivis" valeur={synthèse.axesTotal} />
        <Tuile intitulé="signal fort" valeur={synthèse.parNiveau.FORT} accent={synthèse.parNiveau.FORT > 0} />
        <Tuile intitulé="acteurs suivis" valeur={synthèse.dossiers.length} />
        <Tuile intitulé="sans mouvement" valeur={synthèse.dossiersEnAttente} mention={`sur ${synthèse.dossiers.length} acteurs`} />
      </Grille>

      <Panneau ton="ardoise">
        <h3 className="label-mono text-ardoise">Action de la semaine</h3>
        <p className="mt-3 text-encre">{démonstration.actionDeLaSemaine}</p>
      </Panneau>

      <ÀRetenir titre="Points forts de la semaine" mention="signal fort" axes={pointsForts} lien={() => `#${démonstration.clé}`} />

      <div className="mt-6 flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
        <Accordéon titre="L’écosystème" mention="les axes de votre environnement, par impact" ouvert>
          <AperçuÉcosystème d={démonstration} combien={6} />
        </Accordéon>
        <Accordéon titre="Les concurrents" mention="chacun suivi, semaine après semaine">
          <AperçuConcurrents d={démonstration} />
        </Accordéon>
        <Accordéon titre="L’analyse" mention="chaque fait classé, votre position lue">
          <AperçuLectureStratégique d={démonstration} />
        </Accordéon>
      </div>
    </div>
  )
}

/**
 * Une section dépliable du tableau de bord de démonstration (7 novembre 2026,
 * demande de l'opératrice) : un `details` natif, sans script, comme les
 * rubriques du rail de l'espace. Le titre reste lisible fermé ; ouvert, la
 * section montre l'aperçu entier.
 */
function Accordéon({ titre, mention, ouvert = false, children }: { titre: string; mention: string; ouvert?: boolean; children: React.ReactNode }) {
  return (
    <details className="group" open={ouvert}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-3 py-4 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-3">
          <span aria-hidden="true" className="text-rose transition-transform group-open:rotate-90">→</span>
          <span className="font-titre text-h2 font-bold text-encre">{titre}</span>
        </span>
        <span className="label-mono text-ardoise">{mention}</span>
      </summary>
      <div className="pb-6">{children}</div>
    </details>
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
