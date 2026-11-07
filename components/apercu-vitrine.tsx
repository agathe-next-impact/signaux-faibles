import { AnimerÀLEntrée } from '@/components/anime-a-l-entree'
import { BadgeImpact } from '@/components/badge-impact'
import { CaseAxe } from '@/components/case-axe'
import { Grille, Tuile } from '@/components/coquille'
import { Texte } from '@/components/document'
import { SurtitreAxe } from '@/components/titre-axe'
import {
  axesDuDocument,
  construireDocument,
  type Document,
  fusionnerLesAxes,
  type Segment,
  segmenterLesFaits,
} from '@/lib/domaine/document'
import { trierParImpact } from '@/lib/domaine/impact'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { synthétiser } from '@/lib/domaine/synthese'
import { DÉMONSTRATIONS, type Démonstration } from '@/lib/vitrine/demonstrations'

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

function démonstration(): Démonstration {
  const conseil = DÉMONSTRATIONS.find((d) => d.clé === 'conseil')
  if (!conseil) throw new Error('démonstration « conseil » absente')
  return conseil
}

function documentDe(d: Démonstration): Document {
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

/**
 * L'aperçu de l'ouverture : le haut d'une lettre, son essentiel écourté et
 * ses trois premiers axes par impact, chacun avec son badge et son premier fait.
 */
export function ExtraitDeLettre() {
  const d = démonstration()
  const document = documentDe(d)
  const essentiel = lignesDeLEssentiel(document).slice(0, 3)
  const axes = trierParImpact(fusionnerLesAxes([document], 1)).slice(0, 3)
  return (
    <figure className="flex w-full flex-col gap-3">
      <article
        aria-label={`Extrait de la lettre de ${d.organisation}, organisation fictive`}
        className="flex flex-col border border-gris-ligne bg-blanc"
      >
        <div className="border-b border-gris-ligne px-6 py-4">
          <EnTêteDeLettre d={d} />
        </div>
        {/* Sur mobile, l'essentiel est laissé à son onglet, juste en dessous : l'ouverture garde ses axes. */}
        <div className="hidden flex-col gap-3 border-b border-gris-ligne px-6 py-4 sm:flex">
          <h2 className="font-titre text-h3 font-semibold text-encre">L’essentiel</h2>
          <ul className="flex flex-col gap-2">
            {essentiel.map((ligne, i) => (
              <li key={i} className="flex gap-3 text-encre">
                <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 bg-encre" />
                <span>
                  <Texte segments={ligne} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <ul aria-label="Premiers axes de la lettre" className="flex flex-col divide-y divide-gris-ligne">
          {axes.map((axe) => (
            <li key={axe.titre} className="flex flex-col gap-2 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SurtitreAxe axe={axe} />
                <BadgeImpact niveau={axe.niveau} />
              </div>
              {axe.points[0] ? (
                <p className="text-ardoise">
                  <Texte segments={axe.points[0].segments} />
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </article>
      <figcaption>
        <MentionFictive />
      </figcaption>
    </figure>
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

/** Onglet « Les axes » : les quatre premiers axes par impact, en cases. */
export function AperçuAxes() {
  const axes = trierParImpact(fusionnerLesAxes([documentDe(démonstration())], 2)).slice(0, 4)
  return (
    <div className="flex flex-col gap-3">
      <Grille colonnes={2} étiquette="Axes de la semaine, organisation fictive">
        {axes.map((axe) => (
          <CaseAxe key={axe.titre} axe={axe} points={axe.points} />
        ))}
      </Grille>
      <MentionFictive />
    </div>
  )
}

/**
 * Onglet « Votre espace » : les chiffres de la semaine, et le nombre de faits
 * de chaque axe, en barres. La barre d'un axe FORT est rose : le rose ne porte
 * que le signal fort (charte §02) ; les autres sont ardoise. La barre s'étire à
 * l'entrée dans l'écran ; le nombre est posé à sa valeur.
 */
export function AperçuEspace() {
  const d = démonstration()
  const document = documentDe(d)
  const synthèse = synthétiser([document], [d.dossiers])
  const axes = axesDuDocument(document).map((axe) => ({
    axe,
    faits: axe.niveau === 'RAS' ? 0 : segmenterLesFaits(axe.blocs).length,
  }))
  const plafond = Math.max(1, ...axes.map((a) => a.faits))
  return (
    <div className="flex flex-col gap-6">
      <Grille colonnes={4} étiquette="Chiffres de la semaine, organisation fictive">
        <Tuile intitulé="axes suivis" valeur={synthèse.axesTotal} />
        <Tuile intitulé="signal fort" valeur={synthèse.parNiveau.FORT} accent={synthèse.parNiveau.FORT > 0} />
        <Tuile intitulé="acteurs suivis" valeur={synthèse.dossiers.length} />
        <Tuile intitulé="sans mouvement" valeur={synthèse.dossiersEnAttente} mention={`sur ${synthèse.dossiers.length} acteurs`} />
      </Grille>
      <AnimerÀLEntrée>
        <figure className="flex flex-col gap-4 border border-gris-ligne bg-blanc p-6">
          <figcaption className="label-mono text-ardoise">Faits relevés par axe cette semaine</figcaption>
          <ul aria-label="Faits relevés par axe" className="flex flex-col gap-2">
            {axes.map(({ axe, faits }, i) => (
              <li key={axe.titre} className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-center sm:gap-4">
                <span className="truncate text-encre" title={axe.titre}>
                  {axe.titre}
                </span>
                <span className="flex items-center gap-3">
                  {faits > 0 ? (
                    <span
                      aria-hidden="true"
                      className={`anime-etire h-2.5 rounded-r-[4px] ${axe.niveau === 'FORT' ? 'bg-rose' : 'bg-ardoise'}`}
                      style={{ width: `${(faits / plafond) * 80}%`, '--i': i } as React.CSSProperties}
                    />
                  ) : null}
                  <span className="label-mono whitespace-nowrap text-encre">
                    {faits} {faits > 1 ? 'faits' : 'fait'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 label-mono text-ardoise">
            <span aria-hidden="true" className="size-2.5 bg-rose" /> axe en signal fort
          </p>
        </figure>
      </AnimerÀLEntrée>
      <MentionFictive />
    </div>
  )
}

/** Le domaine d'une adresse, pour la mention mono de la source. */
function domaine(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`
  } catch {
    return url
  }
}

/**
 * Le texte d'un fait sans son lien de source, que l'aperçu pose à part : la
 * lettre écrit « … ([source](url)) », il reste « … ( » et « ) » à retirer.
 */
function sansParenthèsesDeSource(segments: readonly Segment[]): Segment[] {
  return segments
    .filter((s) => s.lien === null)
    .map((s) => ({ ...s, texte: s.texte.replace(/\s*\(\s*$/, '').replace(/^\s*\)/, '') }))
    .filter((s) => s.texte.trim().length > 0)
}

/**
 * Onglet « Les sources » : deux faits de l'axe le plus fort, chacun avec sa
 * date dans la phrase et le lien de sa page. Les sources des démonstrations
 * sont sur le domaine réservé `.example`, qui ne mène nulle part.
 */
export function AperçuSources() {
  const d = démonstration()
  const axe = trierParImpact(axesDuDocument(documentDe(d)))[0]
  const faits = axe ? segmenterLesFaits(axe.blocs).slice(0, 2) : []
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col border border-gris-ligne bg-blanc">
        {axe ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gris-ligne px-6 py-4">
            <SurtitreAxe axe={axe} />
            <BadgeImpact niveau={axe.niveau} />
          </div>
        ) : null}
        <ul className="flex flex-col divide-y divide-gris-ligne">
          {faits.map((fait) => {
            const segments = fait.blocs.flatMap((b) => ('segments' in b ? b.segments : []))
            const liens = segments.map((s) => s.lien).filter((l): l is string => l !== null)
            const texte = sansParenthèsesDeSource(segments)
            return (
              <li key={fait.rang} className="flex flex-col gap-2 px-6 py-4">
                <p className="text-encre">
                  <Texte segments={texte} />
                </p>
                {liens.map((lien) => (
                  <p key={lien} className="label-mono text-ardoise">
                    Source · {domaine(lien)}
                  </p>
                ))}
              </li>
            )
          })}
        </ul>
      </div>
      <MentionFictive />
    </div>
  )
}
