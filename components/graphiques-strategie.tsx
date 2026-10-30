import type { CSSProperties, ReactNode } from 'react'
import { AireDActivité, Anneau, BarresCouchées, BarresDuMois, BarresGroupées, BarresHorizontales, BarresVerticales, Bulles, MiniAire, RadarDeValeurs, type Barre, type Bulle } from '@/components/graphiques-recharts'
import { lundiDeLaSemaine } from '@/lib/domaine/semaines'
import { CASES_SWOT } from '@/lib/domaine/strategie'
import {
  dateCourte,
  LIBELLÉS_SWOT,
  semainesJusquÀ,
  TYPES_DE_TOWS,
  type ActivitéDeRubrique,
  type VueDeLaCarte,
  type VueDeLaSwot,
  type VueDeLaTows,
  type VueDeMendelow,
  type CarteDeChaleur,
  type DimensionDuPestel,
  type SemaineDActivité,
  type VueDesIndicateurs,
} from '@/lib/domaine/strategie-vues'

/**
 * Les graphiques de l'espace réorganisé (lot 5 de
 * `docs/proposition-reorganisation-espace.md`, 30 octobre 2026), rendus côté
 * serveur. Depuis le même jour, les courbes, barres et radars sont des
 * graphiques Recharts (`components/graphiques-recharts.tsx`, composants
 * client) ; ces enveloppes leur passent des données déjà calculées et posent le
 * texte que lisent les lecteurs d'écran, le graphique lui-même étant masqué
 * pour eux. La carte de chaleur et les crans des forces restent en HTML.
 *
 * Charte tenue ici : angles droits ; marques en ardoise, la série mise en avant
 * en turquoise, l'organisation en encre ; le rose n'apparaît que dans la carte
 * de chaleur, où il est le fond du badge FORT, et l'ardoise celui du badge
 * MOYEN : aucune couleur d'impact nouvelle. Chaque marque porte son chiffre en
 * texte : la couleur ne porte jamais seule l'information.
 *
 * Mouvement (charte §05) : la carte de chaleur et les crans portent une classe
 * `anime-…` de `app/globals.css` et leur rang dans `--i` ; les graphiques
 * Recharts s'animent eux-mêmes, aux mêmes règles.
 */

/** Le rang d'une marque dans la cascade, plafonné pour qu'une longue liste n'attende pas. */
const rang = (i: number, plafond = 12): CSSProperties => ({ '--i': Math.min(i, plafond) }) as CSSProperties

/**
 * L'infobulle chiffrée (30 octobre 2026) : la valeur exacte et sa date, en mono,
 * au survol et au clavier (la marque qui la porte est `group relative` et
 * focalisable). Elle double le texte `sr-only` de la marque, d'où `aria-hidden`.
 * Elle apparaît sans animation : le mouvement signale une arrivée de donnée,
 * pas un survol. Aux bords, elle s'aligne sur la marque pour ne pas déborder.
 */
function Infobulle({ bord, children }: { bord?: 'gauche' | 'droite'; children: ReactNode }) {
  const place = bord === 'gauche' ? 'left-0' : bord === 'droite' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap bg-encre px-2 py-1 font-mono text-label text-blanc group-hover:block group-focus-visible:block ${place}`}
    >
      {children}
    </span>
  )
}

const bordDe = (i: number, n: number) => (i === 0 ? 'gauche' : i === n - 1 ? 'droite' : undefined)


// ── PESTEL : les faits par mois d'une dimension, zéro compris ────────────────

export function BarresMensuelles({ dimension, max }: { dimension: DimensionDuPestel; max: number }) {
  return (
    <figure className="flex flex-col gap-1">
      <BarresDuMois points={dimension.parMois.map((m) => ({ mois: m.mois, faits: m.faits }))} max={max} />
      <figcaption className="sr-only">
        {dimension.libellé}, faits par mois : {dimension.parMois.map((m) => `${m.mois} ${m.faits}`).join(', ')}
      </figcaption>
    </figure>
  )
}

/** Les six dimensions en radar (30 octobre 2026) : la forme de l'environnement lu sur la fenêtre. */
export function RadarDuPestel({ dimensions }: { dimensions: readonly DimensionDuPestel[] }) {
  const max = Math.max(...dimensions.map((d) => d.faits), 0)
  return (
    <figure className="flex flex-col gap-2">
      <RadarDeValeurs branches={dimensions.map((d) => ({ libellé: d.libellé, valeur: d.faits }))} max={max} unité="Faits" />
      <figcaption className="text-center font-mono text-label text-ardoise">
        Faits par dimension : {dimensions.map((d) => `${d.libellé} ${d.faits}`).join(' · ')}
      </figcaption>
    </figure>
  )
}

// ── Forces du marché : trois crans et la tendance ───────────────────────────

const FLÈCHES: Readonly<Record<string, { signe: string; libellé: string }>> = {
  hausse: { signe: '↗', libellé: 'en hausse' },
  stable: { signe: '→', libellé: 'stable' },
  baisse: { signe: '↘', libellé: 'en baisse' },
}

export function CransDeForce({ cran, tendance }: { cran: number | null; tendance: string | null }) {
  const flèche = tendance ? FLÈCHES[tendance] : undefined
  return (
    <div className="flex items-center gap-3">
      <span role="img" aria-label={cran === null ? 'non suivie' : `cran ${cran} sur 3`} className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-2.5 w-8 ${cran === null ? 'outline-1 -outline-offset-1 outline-dashed outline-ardoise' : n <= cran ? 'anime-remplit bg-encre' : 'bg-gris-ligne'}`}
            style={rang(n - 1)}
          />
        ))}
      </span>
      {flèche ? (
        <span className="font-mono text-label text-encre" title={flèche.libellé}>
          <span aria-hidden="true">{flèche.signe} </span>
          {flèche.libellé}
        </span>
      ) : null}
    </div>
  )
}

/** Les cinq forces en radar (30 octobre 2026), en crans de 0 à 3 ; une force non suivie est posée à zéro et dite telle. */
export function RadarDesForces({ forces }: { forces: readonly { readonly libellé: string; readonly cran: number | null }[] }) {
  return (
    <figure className="flex flex-col gap-2">
      <RadarDeValeurs branches={forces.map((f) => ({ libellé: f.libellé, valeur: f.cran ?? 0 }))} max={3} unité="Cran" />
      <figcaption className="text-center font-mono text-label text-ardoise">
        Cran de 1 à 3 : {forces.map((f) => `${f.libellé} ${f.cran ?? 'non suivie'}`).join(' · ')}
      </figcaption>
    </figure>
  )
}

// ── Les axes : la carte de chaleur, axes × semaines ─────────────────────────

const FOND_DE_NIVEAU = { FORT: 'bg-fond-rose', MOYEN: 'bg-fond-ardoise' } as const
const LETTRE_DE_NIVEAU = { FORT: 'F', MOYEN: 'M' } as const

export function CarteDeChaleurDesAxes({ chaleur }: { chaleur: CarteDeChaleur }) {
  return (
    <div className="flex flex-col gap-4">
      {/* `relative` : les libellés `sr-only` des cases vides, positionnés en absolu, restent dans la zone qui défile. */}
      <div className="relative overflow-x-auto border-t border-l border-gris-ligne">
        <table className="w-full min-w-[640px] border-collapse" aria-label="Niveau des axes sur les huit dernières semaines">
          <thead>
            <tr>
              <th scope="col" className="border-r border-b border-gris-ligne px-3 py-2 text-left font-normal label-mono text-ardoise">
                Axe
              </th>
              {chaleur.semaines.map((s) => (
                <th key={s} scope="col" className="border-r border-b border-gris-ligne px-1 py-2 text-center font-normal label-mono text-ardoise">
                  {dateCourte(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chaleur.lignes.map((l) => (
              <tr key={l.clé}>
                <th scope="row" className="border-r border-b border-gris-ligne px-3 py-2 text-left font-normal">
                  <span className="mr-2 font-mono text-label font-medium text-ardoise">{l.numéro}</span>
                  <span className="text-sm text-encre">{l.nom}</span>
                </th>
                {l.cases.map((c, i) => (
                  <td
                    key={c.lundi}
                    className={`group relative h-9 w-14 border-r border-b border-gris-ligne text-center font-mono text-label ${c.niveau ? `anime-decouvre ${FOND_DE_NIVEAU[c.niveau]} text-encre` : 'bg-blanc'}`}
                    style={c.niveau ? rang(i) : undefined}
                    tabIndex={c.niveau ? 0 : undefined}
                  >
                    {c.niveau ? (
                      <>
                        {LETTRE_DE_NIVEAU[c.niveau]}
                        <span className="sr-only">
                          {c.niveau}, {c.faits} fait{c.faits > 1 ? 's' : ''}, semaine du {dateCourte(c.lundi)}
                        </span>
                        <Infobulle bord={bordDe(i, l.cases.length) === 'droite' ? 'droite' : undefined}>
                          Sem. du {dateCourte(c.lundi)} · {c.niveau} · {c.faits} fait{c.faits > 1 ? 's' : ''}
                        </Infobulle>
                      </>
                    ) : (
                      <span className="sr-only">RAS ou sans lettre</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Légende de la carte de chaleur">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 bg-fond-rose" /><span className="label-mono text-ardoise">F · Fort</span></li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 bg-fond-ardoise" /><span className="label-mono text-ardoise">M · Moyen</span></li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 border border-gris-ligne bg-blanc" /><span className="label-mono text-ardoise">RAS ou sans lettre</span></li>
      </ul>
    </div>
  )
}

// ── Tableau de bord : le mini graphique d'une carte de rubrique ─────────────

/** Huit semaines, la dernière en encre : la carte dit si son sujet s'anime avant d'être ouverte. */
export function MiniActivité({ activité }: { activité: ActivitéDeRubrique }) {
  const total = activité.semaines.reduce((n, s) => n + s.faits, 0)
  const dernière = activité.semaines.at(-1)
  return (
    <figure className="flex flex-col gap-1">
      <MiniAire points={activité.semaines.map((s) => ({ libellé: dateCourte(s.lundi), faits: s.faits }))} />
      <figcaption className="font-mono text-label text-ardoise">
        {total} {total > 1 ? activité.libellé : activité.singulier} en {activité.semaines.length} semaines
        {dernière ? `, ${dernière.faits} la dernière` : ''}
      </figcaption>
    </figure>
  )
}

// ── Tableau de bord : l'activité de la veille ───────────────────────────────

export function ActivitéDesSemaines({ activité }: { activité: readonly SemaineDActivité[] }) {
  const max = Math.max(...activité.map((s) => s.faits), 0)
  const total = activité.reduce((n, s) => n + s.faits, 0)
  return (
    <figure className="flex flex-col gap-2">
      <AireDActivité points={activité.map((s) => ({ libellé: dateCourte(s.lundi), faits: s.faits }))} />
      <ul className="sr-only" aria-label={`Faits relevés par semaine, ${total} sur ${activité.length} semaines`}>
        {activité.map((s) => (
          <li key={s.lundi}>
            Semaine du {dateCourte(s.lundi)} : {s.faits} fait{s.faits > 1 ? 's' : ''}
          </li>
        ))}
      </ul>
      <figcaption className="text-center font-mono text-label text-ardoise">
        {total} fait{total > 1 ? 's' : ''} sur {activité.length} semaines, {max} au plus en une semaine
      </figcaption>
    </figure>
  )
}

// ── Indicateurs : entrées et sorties, benchmark ─────────────────────────────

const nombre = (x: number | null) => (x === null ? 'n.d.' : new Intl.NumberFormat('fr-FR').format(x))
const euros = (x: number | null) => (x === null ? 'n.d.' : `${new Intl.NumberFormat('fr-FR').format(x)} €`)
const période = (p: { readonly du: string; readonly au: string }) => `${dateCourte(p.du)}/${p.du.slice(2, 4)} au ${dateCourte(p.au)}/${p.au.slice(2, 4)}`

export function EntréesEtSorties({ indice }: { indice: NonNullable<VueDesIndicateurs['indice']>['valeurs'] }) {
  const lignes = [
    { libellé: 'Douze mois précédents', dates: indice.périodePrécédente, entrées: indice.entréesAvant, sorties: indice.sortiesAvant },
    { libellé: 'Douze derniers mois', dates: indice.période, entrées: indice.entrées, sorties: indice.sorties },
  ]
  return (
    <div className="flex flex-col gap-4">
      <figure className="flex flex-col gap-2">
        <BarresGroupées périodes={lignes.map((l) => ({ période: période(l.dates), entrées: l.entrées, procédures: l.sorties }))} />
        <figcaption className="sr-only">
          {lignes.map((l) => `${l.libellé}, du ${période(l.dates)} : ${nombre(l.entrées)} entrées, ${nombre(l.sorties)} procédures.`).join(' ')}
        </figcaption>
      </figure>
      <dl className="grid grid-cols-1 gap-3 border-y border-gris-ligne py-4 sm:grid-cols-2">
        {lignes.map((l) => (
          <div key={l.libellé} className="flex flex-col gap-1">
            <dt className="text-encre">
              {l.libellé} <span className="font-mono text-label text-ardoise">{période(l.dates)}</span>
            </dt>
            <dd className="font-mono text-label text-encre">
              {nombre(l.entrées)} entrées · {nombre(l.sorties)} procédures
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-ardoise">
        Départements {indice.départements.join(', ')}, activité « {indice.texte} ». Solde {nombre(indice.solde)}
        {indice.ratio !== null ? `, ${indice.ratio.toLocaleString('fr-FR')} entrées pour une procédure` : ''}.
      </p>
    </div>
  )
}

export function BarresDuBenchmark({ benchmark }: { benchmark: NonNullable<VueDesIndicateurs['benchmark']>['valeurs'] }) {
  // Les entités qui publient un chiffre d'affaires d'abord, du plus élevé au plus bas ; puis les autres, n.d.
  const lignes = [...benchmark.lignes].sort((a, b) => (b.chiffreDAffaires ?? -1) - (a.chiffreDAffaires ?? -1))
  const publiées = lignes.filter((l) => l.chiffreDAffaires !== null)
  const autres = lignes.filter((l) => l.chiffreDAffaires === null)
  return (
    <div className="flex flex-col gap-4">
      {publiées.length > 0 ? (
        <figure className="flex flex-col gap-2">
          <BarresHorizontales lignes={publiées.map((l) => ({ nom: l.organisation ? `${l.nom} (vous)` : l.nom, chiffreDAffaires: l.chiffreDAffaires!, organisation: l.organisation }))} />
          <figcaption className="sr-only">
            Chiffre d’affaires publié : {publiées.map((l) => `${l.nom}${l.organisation ? ' (vous)' : ''} ${euros(l.chiffreDAffaires)}${l.année ? ` en ${l.année}` : ''}`).join(', ')}.
          </figcaption>
        </figure>
      ) : null}
      <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne" aria-label="Chiffre d’affaires publié, par entité">
        {lignes.map((l) => (
          <li key={l.siren} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span className={l.organisation ? 'font-medium text-encre' : 'text-encre'}>
              {l.nom}
              {l.organisation ? <span className="label-mono text-ardoise"> · vous</span> : null}
            </span>
            <span className="font-mono text-label text-encre">
              {euros(l.chiffreDAffaires)}
              {l.année && l.chiffreDAffaires !== null ? <span className="text-ardoise"> · {l.année}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {autres.length > 0 ? <p className="text-ardoise">{autres.length} entité{autres.length > 1 ? 's' : ''} sans chiffre d’affaires publié.</p> : null}
    </div>
  )
}

// ── Les autres écrans (30 octobre 2026) : un graphique en tête, le détail dessous ─

/** Une figure dont le graphique est masqué aux lecteurs d'écran, qui lisent sa légende. */
function Figure({ légende, visible = false, children }: { légende: string; visible?: boolean; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      {children}
      <figcaption className={visible ? 'text-center font-mono text-label text-ardoise' : 'sr-only'}>{légende}</figcaption>
    </figure>
  )
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** La carte des groupes en bulles : une bulle par case occupée ; encre pour vous, rose pour un mouvement. */
export function BullesDeLaCarte({ carte }: { carte: VueDeLaCarte }) {
  const bulles: Bulle[] = [...carte.cases.entries()].flatMap(([clé, occupants]) => {
    if (occupants.length === 0) return []
    const [ligne, colonne] = clé.split(':').map(Number)
    const teinte = occupants.some((o) => o.organisation) ? 'encre' : occupants.some((o) => o.aBougé) ? 'rose' : 'ardoise'
    return [{ x: colonne!, y: ligne!, n: occupants.length, teinte, libellé: occupants.map((o) => (o.organisation ? `${o.sujet} (vous)` : o.sujet)).join(', ') }]
  })
  if (bulles.length === 0) return null
  return (
    <Figure légende={`La carte en bulles, ${pluriel(carte.placés, 'sujet')} placé${carte.placés > 1 ? 's' : ''} ; le tableau qui suit la détaille case par case.`}>
      <Bulles bulles={bulles} axeX={carte.colonnes} axeY={carte.lignes} />
    </Figure>
  )
}

const NIVEAUX_MENDELOW = ['faible', 'moyen', 'fort'] as const

/** Mendelow en bulles : intérêt en abscisse, pouvoir en ordonnée ; rose pour un mouvement. */
export function BullesDeMendelow({ mendelow }: { mendelow: VueDeMendelow }) {
  const bulles: Bulle[] = [...mendelow.cases.entries()].flatMap(([clé, sujets]) => {
    if (sujets.length === 0) return []
    const [pouvoir, intérêt] = clé.split(':').map(Number)
    return [{ x: intérêt!, y: pouvoir!, n: sujets.length, teinte: sujets.some((s) => s.aBougé) ? 'rose' : 'ardoise', libellé: sujets.map((s) => s.sujet).join(', ') }]
  })
  if (bulles.length === 0) return null
  return (
    <Figure légende={`Les parties prenantes en bulles, ${pluriel(mendelow.placés, 'sujet')} placé${mendelow.placés > 1 ? 's' : ''} ; la matrice qui suit les détaille case par case.`}>
      <Bulles bulles={bulles} axeX={{ libellé: 'Intérêt', crans: NIVEAUX_MENDELOW }} axeY={{ libellé: 'Pouvoir', crans: NIVEAUX_MENDELOW }} />
    </Figure>
  )
}

export function ComptesDeLaSwot({ swot }: { swot: VueDeLaSwot }) {
  const barres: Barre[] = CASES_SWOT.map((c) => ({ libellé: LIBELLÉS_SWOT[c], valeur: swot[c].length }))
  if (barres.every((b) => b.valeur === 0)) return null
  return (
    <Figure légende={`Éléments du diagnostic : ${barres.map((b) => `${b.libellé} ${b.valeur}`).join(', ')}.`}>
      <BarresCouchées barres={barres} unité="Éléments" />
    </Figure>
  )
}

/** Les options par croisement de la TOWS ; celui de l'option retenue en turquoise. */
export function ComptesDeLaTows({ tows }: { tows: VueDeLaTows }) {
  const barres: Barre[] = TYPES_DE_TOWS.map((t) => ({
    libellé: t.type,
    valeur: tows.parType[t.type].length,
    teinte: tows.candidate && tows.parType[t.type].some((o) => o.candidate) ? 'turquoise' : 'ardoise',
  }))
  if (barres.every((b) => b.valeur === 0)) return null
  return (
    <Figure visible légende={`Options par croisement : ${TYPES_DE_TOWS.map((t) => `${t.type} ${tows.parType[t.type].length}`).join(' · ')}${tows.candidate ? ' ; en turquoise, celui de l’option retenue' : ''}.`}>
      <BarresVerticales barres={barres} unité="Options" hauteur="h-40" />
    </Figure>
  )
}

/** Les faits d'un axe par semaine de parution, sur treize semaines ; la dernière en turquoise. */
export function FaitsParSemaine({ faits, fin }: { faits: readonly { readonly date: string }[]; fin: string }) {
  const semaines = semainesJusquÀ(fin, 13)
  const barres: Barre[] = semaines.map((lundi, i) => ({
    libellé: dateCourte(lundi),
    valeur: faits.filter((f) => lundiDeLaSemaine(f.date) === lundi).length,
    teinte: i === semaines.length - 1 ? 'turquoise' : 'ardoise',
  }))
  return (
    <Figure visible légende={`${pluriel(faits.length, 'fait')} sur treize semaines, semaine par semaine`}>
      <BarresVerticales barres={barres} unité="Faits" hauteur="h-40" />
    </Figure>
  )
}

/** Les faits d'un concurrent par mois, du plus ancien au plus récent ; le dernier mois en turquoise. */
export function FaitsParMois({ faits }: { faits: readonly { readonly date: string }[] }) {
  if (faits.length === 0) return null
  const parMois = new Map<string, number>()
  for (const f of faits) parMois.set(f.date.slice(0, 7), (parMois.get(f.date.slice(0, 7)) ?? 0) + 1)
  const mois = [...parMois.keys()].sort()
  const nom = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  const barres: Barre[] = mois.map((m, i) => ({ libellé: nom(m), valeur: parMois.get(m)!, teinte: i === mois.length - 1 ? 'turquoise' : 'ardoise' }))
  return (
    <Figure visible légende={`${pluriel(faits.length, 'fait')} daté${faits.length > 1 ? 's' : ''}, mois par mois : ${barres.map((b) => `${b.libellé} ${b.valeur}`).join(', ')}`}>
      <BarresVerticales barres={barres} unité="Faits" hauteur="h-36" />
    </Figure>
  )
}

/** Les sources de la veille par thème, en barres couchées. */
export function SourcesParThème({ familles }: { familles: readonly { readonly nom: string; readonly sources: readonly unknown[] }[] }) {
  if (familles.length === 0) return null
  const barres: Barre[] = familles.map((f) => ({ libellé: f.nom, valeur: f.sources.length }))
  return (
    <Figure légende={`Sources par thème : ${barres.map((b) => `${b.libellé} ${b.valeur}`).join(', ')}.`}>
      <BarresCouchées barres={barres} unité="Sources" />
    </Figure>
  )
}

/** Les échéances des douze prochains mois, en barres ocre : l'ocre est la couleur du temps. */
export function ÉchéancesParMois({ mois }: { mois: readonly { readonly libellé: string; readonly échéances: readonly unknown[] }[] }) {
  const barres: Barre[] = mois.map((m) => ({ libellé: m.libellé, valeur: m.échéances.length, teinte: 'ocre' }))
  return (
    <Figure visible légende={`${pluriel(barres.reduce((n, b) => n + b.valeur, 0), 'échéance')} sur douze mois, mois par mois ; le détail suit`}>
      <BarresVerticales barres={barres} unité="Échéances" hauteur="h-40" />
    </Figure>
  )
}

/** Le corpus en anneau : concurrents, acteurs de l'environnement, parties prenantes. */
export function AnneauDuCorpus({ concurrents, écosystème, partiesPrenantes }: { concurrents: number; écosystème: number; partiesPrenantes: number }) {
  const parts: Barre[] = [
    { libellé: 'Concurrents', valeur: concurrents, teinte: 'encre' },
    { libellé: 'Environnement', valeur: écosystème, teinte: 'ardoise' },
    { libellé: 'Parties prenantes', valeur: partiesPrenantes, teinte: 'turquoise' },
  ].filter((p) => p.valeur > 0) as Barre[]
  const total = concurrents + écosystème + partiesPrenantes
  if (total === 0) return null
  return (
    <figure className="flex flex-col items-center gap-3 sm:flex-row sm:gap-8">
      <div className="w-full max-w-60">
        <Anneau parts={parts} total={total} unité="suivis" />
      </div>
      <figcaption>
        <ul className="flex flex-col gap-2" aria-label="Le corpus de votre veille">
          {parts.map((p) => (
            <li key={p.libellé} className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-3 ${p.teinte === 'encre' ? 'bg-encre' : p.teinte === 'turquoise' ? 'bg-turquoise' : 'bg-ardoise'}`} />
              <span className="text-encre">{p.libellé}</span>
              <span className="font-mono text-label text-ardoise">{p.valeur}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
