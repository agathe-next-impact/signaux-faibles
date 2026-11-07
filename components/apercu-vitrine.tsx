import { AnimerÀLEntrée } from '@/components/anime-a-l-entree'
import { BadgeImpact } from '@/components/badge-impact'
import { CaseAxe } from '@/components/case-axe'
import { Case, Grille } from '@/components/coquille'
import { Texte } from '@/components/document'
import { SurtitreAxe } from '@/components/titre-axe'
import {
  axesDuDocument,
  construireDocument,
  type Document,
  fusionnerLesAxes,
  type Segment,
  segmenterLesFaits,
  écourter,
} from '@/lib/domaine/document'
import { trierParImpact } from '@/lib/domaine/impact'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { mentionsDe } from '@/lib/domaine/mentions'
import { synthétiser } from '@/lib/domaine/synthese'
import { DÉMONSTRATIONS, type Démonstration } from '@/lib/vitrine/demonstrations'
import { lectureDeDémonstration } from '@/lib/vitrine/lecture-demonstration'

/**
 * Les aperçus du produit sur l'accueil de la vitrine (7 novembre 2026).
 *
 * Tous lus dans la lettre **fictive** du cabinet de conseil de « Exemples »
 * (`lib/vitrine/demonstrations.ts`), par le parseur et les calculs de l'espace
 * client : ce que montre l'accueil est ce que montre l'espace, jamais une
 * image retouchée, et jamais la lettre d'un client. Chaque aperçu le dit
 * (« organisation fictive »).
 */

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

export function démonstration(): Démonstration {
  const conseil = DÉMONSTRATIONS.find((d) => d.clé === 'conseil')
  if (!conseil) throw new Error('démonstration « conseil » absente')
  return conseil
}

export function documentDe(d: Démonstration): Document {
  return construireDocument(markdownVersBlocs(d.markdown))
}

/** Les lignes de « L'essentiel » : la liste qui ouvre la lettre. */
function lignesDeLEssentiel(document: Document): (readonly Segment[])[] {
  const rubrique = document.rubriques.find((r) => /essentiel/i.test(r.titre))
  const liste = rubrique?.introduction.find((b) => b.type === 'liste')
  return liste && liste.type === 'liste' ? [...liste.éléments] : []
}

function MentionFictive() {
  return <p className="label-mono text-ardoise">Organisation fictive · forme réelle</p>
}

/** L'en-tête d'une lettre : veille, numéro, date. */
function EnTêteDeLettre({ d }: { d: Démonstration }) {
  return (
    <p className="label-mono text-ardoise">
      {d.veille} · n° {d.numéro} · {DATE.format(new Date(d.dateÉdition))}
    </p>
  )
}

/** Onglet « L'essentiel » : la rubrique entière, telle qu'elle ouvre la lettre. */
export function AperçuEssentiel() {
  const d = démonstration()
  const lignes = lignesDeLEssentiel(documentDe(d))
  return (
    <div className="flex flex-col gap-4 border border-gris-ligne bg-blanc p-6">
      <EnTêteDeLettre d={d} />
      <h3 className="font-titre text-h2 font-bold text-encre">L’essentiel</h3>
      <ul className="flex flex-col gap-3">
        {lignes.map((ligne, i) => (
          <li key={i} className="flex gap-3 text-encre">
            <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 bg-encre" />
            <span>
              <Texte segments={ligne} />
            </span>
          </li>
        ))}
      </ul>
      <MentionFictive />
    </div>
  )
}

/**
 * Onglet « L'écosystème » : les axes de la grille qui suivent une dimension
 * PESTEL (l'environnement, et non la concurrence), les quatre premiers par
 * impact, en cases. Même sélection que l'écran « PESTEL » de l'espace.
 */
export function AperçuÉcosystème({ d = démonstration(), combien = 4 }: { d?: Démonstration; combien?: number } = {}) {
  const axes = trierParImpact(fusionnerLesAxes([documentDe(d)], 2))
    .filter((axe) => axe.numéro !== null && 'pestel' in (d.grille.axes[axe.numéro] ?? {}))
    .slice(0, combien)
  return (
    <div className="flex flex-col gap-3">
      <Grille colonnes={2} étiquette="Axes de l’environnement, organisation fictive">
        {axes.map((axe) => (
          <CaseAxe key={axe.titre} axe={axe} points={axe.points} />
        ))}
      </Grille>
      <MentionFictive />
    </div>
  )
}

/** Les concurrents montrés dans l'onglet : deux rangées de trois (8 novembre 2026, demande de l'opératrice). */
const CONCURRENTS_MONTRÉS = 6

/**
 * Onglet « Les concurrents » : les concurrents de la grille (vingt au moins
 * par démonstration), chacun avec le dossier ouvert qui le suit, sinon la
 * phrase de la lettre qui le nomme, sinon sa présentation du référentiel.
 * Six sont montrés, ceux qui ont bougé d'abord, puis ceux que la lettre cite,
 * et le compte des concurrents suivis est dit sous la grille, calculé sur la
 * grille et jamais écrit en dur. Même lecture que « Concurrents » dans l'espace.
 */
export function AperçuConcurrents({ d = démonstration() }: { d?: Démonstration } = {}) {
  const document = documentDe(d)
  const dossiers = synthétiser([document], [d.dossiers]).dossiers
  const suivis = d.grille.entités.filter((e) => e.concurrent)
  const rang = (c: { dossier: { compteur: number | null } | null; mention: boolean }) =>
    c.dossier?.compteur === 0 ? 0 : c.dossier ? 1 : c.mention ? 2 : 3
  const concurrents = suivis
    .map((e) => {
      const dossier = dossiers.find((dossier) => contientLeMot(dossier.nom, e.nom)) ?? null
      const mention = mentionsDe(e.nom, document).flatMap((m) => m.passages).at(0) ?? null
      return {
        nom: e.nom,
        dossier,
        mention: mention !== null,
        extrait: dossier?.précision ?? (mention ? écourter(mention.texte, 130) : (e.présentation ?? null)),
      }
    })
    .sort((a, b) => rang(a) - rang(b))
    .slice(0, CONCURRENTS_MONTRÉS)
  return (
    <div className="flex flex-col gap-3">
      <Grille colonnes={3} étiquette={`${concurrents.length} des ${suivis.length} concurrents suivis, organisation fictive`}>
        {concurrents.map((c) => (
          <Case key={c.nom} accent={c.dossier?.compteur === 0}>
            <h4 className="font-titre text-h3 font-semibold text-encre">{c.nom}</h4>
            {c.extrait ? <p className="text-ardoise">{c.extrait}</p> : null}
            <p className="label-mono mt-auto pt-1 text-ardoise">
              {c.dossier === null
                ? c.mention
                  ? 'cité cette semaine'
                  : 'suivi'
                : c.dossier.compteur === 0
                  ? 'a bougé cette semaine'
                  : c.dossier.compteur === null
                    ? 'suivi'
                    : `${c.dossier.compteur} semaine${c.dossier.compteur > 1 ? 's' : ''} sans mouvement`}
            </p>
          </Case>
        ))}
      </Grille>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="label-mono text-encre">
          {suivis.length} concurrents suivis · {concurrents.length} montrés
        </p>
        <MentionFictive />
      </div>
    </div>
  )
}

/** « Cap Territoires » est dans « Cap Territoires (0, …) », mots entiers, casse ignorée. */
function contientLeMot(texte: string, mot: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu').test(texte)
}

function BarreDeCompte({
  libellé,
  faits,
  plafond,
  rang,
  enAvant,
  détail,
}: {
  libellé: string
  faits: number
  plafond: number
  rang: number
  enAvant: boolean
  détail?: string
}) {
  return (
    <li className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
        <span className="text-encre">{libellé}</span>
        <span className="flex items-center gap-2">
          {faits > 0 ? (
            <span
              aria-hidden="true"
              className={`anime-etire h-2.5 rounded-r-[4px] ${enAvant ? 'bg-turquoise' : 'bg-ardoise'}`}
              style={{ width: `${(faits / plafond) * 75}%`, '--i': rang } as React.CSSProperties}
            />
          ) : null}
          <span className="label-mono text-encre">{faits}</span>
        </span>
      </div>
      {détail ? <p className="text-label text-ardoise">{détail}</p> : null}
    </li>
  )
}

/**
 * Section « Le marché » de l'accueil (7 novembre 2026, à la demande de
 * l'opératrice) : un exemple d'analyse plutôt que la carte du marché. C'est la
 * lecture stratégique de la lettre fictive du cabinet de conseil, calculée par
 * `lectureDeDémonstration` comme sur « Exemples » : les faits classés par
 * dimension PESTEL et par force de Porter, en barres, et les ruptures. Des
 * comptes, jamais une analyse rédigée par la page.
 */
export function AperçuLectureStratégique({ d = démonstration() }: { d?: Démonstration } = {}) {
  const lecture = lectureDeDémonstration(d, documentDe(d))
  const plafondPestel = Math.max(1, ...lecture.pestel.map((p) => p.faits))
  const plafondForces = Math.max(1, ...lecture.forces.map((f) => f.faits))
  return (
    <div className="flex flex-col gap-3">
      <AnimerÀLEntrée>
        <div className="border border-gris-ligne bg-blanc">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gris-ligne px-6 py-4">
            <p className="label-mono text-encre">Lecture stratégique · {d.organisation}</p>
            <p className="label-mono text-ardoise">{lecture.total} faits classés</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3">
            <figure className="flex flex-col gap-4 border-b border-gris-ligne p-6 lg:border-r lg:border-b-0">
              <figcaption className="label-mono text-ardoise">Environnement · PESTEL</figcaption>
              <ul className="flex flex-col gap-2">
                {lecture.pestel.map((p, i) => (
                  <BarreDeCompte
                    key={p.clé}
                    libellé={p.libellé}
                    faits={p.faits}
                    plafond={plafondPestel}
                    rang={i}
                    enAvant={p.faits === plafondPestel}
                  />
                ))}
              </ul>
            </figure>
            <figure className="flex flex-col gap-4 border-b border-gris-ligne p-6 lg:border-r lg:border-b-0">
              <figcaption className="label-mono text-ardoise">Concurrence · cinq forces</figcaption>
              <ul className="flex flex-col gap-2">
                {lecture.forces.map((f, i) => (
                  <BarreDeCompte
                    key={f.clé}
                    libellé={f.libellé}
                    faits={f.faits}
                    plafond={plafondForces}
                    rang={i}
                    enAvant={f.faits === plafondForces}
                    détail={f.entités.length > 0 ? f.entités.join(', ') : undefined}
                  />
                ))}
              </ul>
            </figure>
            <div className="flex flex-col gap-4 p-6">
              <p className="label-mono text-ardoise">Ruptures</p>
              {lecture.ruptures.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {lecture.ruptures.map((r, i) => (
                    <li key={`${r.date}:${r.titre}`} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="anime-apparait mt-[0.5em] size-2 shrink-0 bg-encre"
                        style={{ '--i': i } as React.CSSProperties}
                      />
                      <span className="text-encre">{r.titre}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ardoise">Aucun fait ne change la position surveillée.</p>
              )}
            </div>
          </div>
        </div>
      </AnimerÀLEntrée>
      <MentionFictive />
    </div>
  )
}
