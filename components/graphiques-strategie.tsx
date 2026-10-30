import type { CSSProperties } from 'react'
import {
  dateCourte,
  type CarteDeChaleur,
  type DimensionDuPestel,
  type SemaineDActivité,
  type VueDesIndicateurs,
} from '@/lib/domaine/strategie-vues'

/**
 * Les graphiques de l'espace réorganisé (lot 5 de
 * `docs/proposition-reorganisation-espace.md`, 30 octobre 2026). En HTML et
 * CSS, comme ceux de la vitrine (`components/graphiques-vitrine.tsx`), sans
 * bibliothèque : une barre en pourcentage reste nette à toutes les largeurs, et
 * ses libellés restent du texte de la charte.
 *
 * Charte tenue ici : angles droits ; marques en ardoise, l'organisation en
 * encre ; le rose n'apparaît que dans la carte de chaleur, où il est le fond du
 * badge FORT, et l'ardoise celui du badge MOYEN : aucune couleur d'impact
 * nouvelle. Chaque marque porte son chiffre en texte : la couleur ne porte
 * jamais seule l'information.
 *
 * Mouvement (30 octobre 2026, charte §05) : chaque marque porte une classe
 * `anime-…` de `app/globals.css` et son rang dans `--i` ; le CSS fait le
 * reste, au chargement seulement, et rien quand le système demande moins de
 * mouvement. Les marques à zéro ne bougent pas : il n'y a rien à faire arriver.
 */

/** Le rang d'une marque dans la cascade, plafonné pour qu'une longue liste n'attende pas. */
const rang = (i: number, plafond = 12): CSSProperties => ({ '--i': Math.min(i, plafond) }) as CSSProperties

const largeur = (valeur: number, max: number) => `${max > 0 ? Math.max((valeur / max) * 100, valeur > 0 ? 2 : 0) : 0}%`

// ── PESTEL : les faits par mois d'une dimension, zéro compris ────────────────

export function BarresMensuelles({ dimension, max }: { dimension: DimensionDuPestel; max: number }) {
  return (
    <ul className="flex items-end gap-1.5" aria-label={`${dimension.libellé}, faits par mois`}>
      {dimension.parMois.map((m, i) => (
        <li key={m.mois} className="flex flex-1 flex-col items-center gap-1">
          <span className="font-mono text-label text-encre">{m.faits}</span>
          <span aria-hidden="true" className="flex h-10 w-full items-end">
            <span className={`w-full ${m.faits > 0 ? 'anime-monte bg-ardoise' : 'bg-gris-ligne'}`} style={{ ...rang(i), height: m.faits > 0 ? largeur(m.faits, max) : '1px' }} />
          </span>
          <span className="font-mono text-label text-ardoise">{m.mois}</span>
        </li>
      ))}
    </ul>
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
                  <span className="mr-1.5 font-mono text-label font-medium text-ardoise">{l.numéro}</span>
                  <span className="text-sm text-encre">{l.nom}</span>
                </th>
                {l.cases.map((c, i) => (
                  <td
                    key={c.lundi}
                    className={`h-9 w-14 border-r border-b border-gris-ligne text-center font-mono text-label ${c.niveau ? `anime-decouvre ${FOND_DE_NIVEAU[c.niveau]} text-encre` : 'bg-blanc'}`}
                    style={c.niveau ? rang(i) : undefined}
                    title={c.niveau ? `${c.niveau}, ${c.faits} fait${c.faits > 1 ? 's' : ''}` : 'RAS ou sans lettre'}
                  >
                    {c.niveau ? LETTRE_DE_NIVEAU[c.niveau] : <span className="sr-only">RAS ou sans lettre</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Légende de la carte de chaleur">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 bg-fond-rose" /><span className="label-mono text-ardoise">F · Fort</span></li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 bg-fond-ardoise" /><span className="label-mono text-ardoise">M · Moyen</span></li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 border border-gris-ligne bg-blanc" /><span className="label-mono text-ardoise">RAS ou sans lettre</span></li>
      </ul>
    </div>
  )
}

// ── Tableau de bord : l'activité de la veille ───────────────────────────────

export function ActivitéDesSemaines({ activité }: { activité: readonly SemaineDActivité[] }) {
  const max = Math.max(...activité.map((s) => s.faits), 0)
  const total = activité.reduce((n, s) => n + s.faits, 0)
  return (
    <figure className="flex flex-col gap-2">
      <ul className="relative flex h-20 items-end gap-1" aria-label={`Faits relevés par semaine, ${total} sur ${activité.length} semaines`}>
        {activité.map((s, i) => (
          <li key={s.lundi} className="flex h-full flex-1 flex-col justify-end" title={`Semaine du ${dateCourte(s.lundi)} : ${s.faits} fait${s.faits > 1 ? 's' : ''}`}>
            <span className="sr-only">
              Semaine du {dateCourte(s.lundi)} : {s.faits} fait{s.faits > 1 ? 's' : ''}
            </span>
            <span aria-hidden="true" className={`w-full ${s.faits > 0 ? 'anime-monte bg-ardoise' : 'bg-gris-ligne'}`} style={{ ...rang(i, 13), height: s.faits > 0 ? largeur(s.faits, max) : '1px' }} />
          </li>
        ))}
      </ul>
      <figcaption className="flex justify-between font-mono text-label text-ardoise">
        <span>{activité[0] ? dateCourte(activité[0].lundi) : ''}</span>
        <span>
          {total} fait{total > 1 ? 's' : ''} sur {activité.length} semaines, {max} au plus en une semaine
        </span>
        <span>{activité.at(-1) ? dateCourte(activité.at(-1)!.lundi) : ''}</span>
      </figcaption>
    </figure>
  )
}

// ── Indicateurs : entrées et sorties, benchmark ─────────────────────────────

const nombre = (x: number | null) => (x === null ? 'n.d.' : new Intl.NumberFormat('fr-FR').format(x))
const euros = (x: number | null) => (x === null ? 'n.d.' : `${new Intl.NumberFormat('fr-FR').format(x)} €`)
const période = (p: { readonly du: string; readonly au: string }) => `${dateCourte(p.du)}/${p.du.slice(2, 4)} au ${dateCourte(p.au)}/${p.au.slice(2, 4)}`

// L'ocre porte la seconde série (charte §02, amendement du 30 octobre 2026) : l'encre reste la couleur de « vous ».
function Barre({ valeur, max, encre = false, seconde = false, i = 0 }: { valeur: number | null; max: number; encre?: boolean; seconde?: boolean; i?: number }) {
  return (
    <span className="relative block h-4 bg-transparent">
      {valeur !== null && valeur > 0 ? <span aria-hidden="true" className={`anime-etire absolute inset-y-0 left-0 ${encre ? 'bg-encre' : seconde ? 'bg-ocre' : 'bg-ardoise'}`} style={{ ...rang(i, 8), width: largeur(valeur, max) }} /> : null}
    </span>
  )
}

export function EntréesEtSorties({ indice }: { indice: NonNullable<VueDesIndicateurs['indice']>['valeurs'] }) {
  const max = Math.max(indice.entrées ?? 0, indice.sorties ?? 0, indice.entréesAvant ?? 0, indice.sortiesAvant ?? 0)
  const lignes = [
    { libellé: 'Douze derniers mois', dates: indice.période, entrées: indice.entrées, sorties: indice.sorties },
    { libellé: 'Douze mois précédents', dates: indice.périodePrécédente, entrées: indice.entréesAvant, sorties: indice.sortiesAvant },
  ]
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
        {lignes.map((l, n) => (
          <li key={l.libellé} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
            <div className="flex flex-col">
              <span className="text-encre">{l.libellé}</span>
              <span className="font-mono text-label text-ardoise">{période(l.dates)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[8.5rem_minmax(0,1fr)_4rem] items-center gap-3">
                <span className="label-mono text-ardoise">Entrées</span>
                <Barre valeur={l.entrées} max={max} i={n * 2} />
                <span className="text-right font-mono text-label text-encre">{nombre(l.entrées)}</span>
              </div>
              <div className="grid grid-cols-[8.5rem_minmax(0,1fr)_4rem] items-center gap-3">
                <span className="label-mono text-ardoise">Procédures</span>
                <Barre valeur={l.sorties} max={max} seconde i={n * 2 + 1} />
                <span className="text-right font-mono text-label text-encre">{nombre(l.sorties)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
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
  const max = Math.max(...lignes.map((l) => l.chiffreDAffaires ?? 0), 0)
  return (
    <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne" aria-label="Chiffre d’affaires publié, par entité">
      {lignes.map((l, i) => (
        <li key={l.siren} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[14rem_minmax(0,1fr)_9rem] sm:items-center sm:gap-4">
          <span className={l.organisation ? 'font-medium text-encre' : 'text-encre'}>
            {l.nom}
            {l.organisation ? <span className="label-mono text-ardoise"> · vous</span> : null}
          </span>
          <Barre valeur={l.chiffreDAffaires} max={max} encre={l.organisation} i={i} />
          <span className="font-mono text-label text-encre sm:text-right">
            {euros(l.chiffreDAffaires)}
            {l.année && l.chiffreDAffaires !== null ? <span className="text-ardoise"> · {l.année}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}
