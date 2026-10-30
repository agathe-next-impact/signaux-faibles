'use client'

import { useSyncExternalStore } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

/**
 * Les graphiques animés de l'espace réorganisé (30 octobre 2026, demande de
 * l'opératrice : des formes plus variées, sur le modèle des « chart cards » de
 * shadcn) : Recharts 3.8 par le composant chart de shadcn/ui
 * (`components/ui/chart.tsx`). Les données arrivent calculées du serveur ; ces
 * composants ne lisent rien.
 *
 * Charte tenue ici :
 * - couleurs des tokens seulement, par leurs variables (le mode sombre suit) :
 *   ardoise pour les séries, turquoise pour la série mise en avant, ocre pour
 *   la seconde série (procédures), encre pour « vous » ;
 * - une animation par graphique, au chargement, 600 ms, départ vif et arrivée
 *   douce, et aucune quand le système demande moins de mouvement (§05) ;
 *   l'infobulle apparaît sans animation ;
 * - chaque graphique double un texte lu par les lecteurs d'écran, posé par son
 *   enveloppe serveur (`components/graphiques-strategie.tsx`) : le graphique
 *   lui-même est `aria-hidden`.
 */

const DURÉE = 600

function abonnerAuMouvement(rappel: () => void) {
  const requête = window.matchMedia('(prefers-reduced-motion: reduce)')
  requête.addEventListener('change', rappel)
  return () => requête.removeEventListener('change', rappel)
}

/** Vrai quand le système du lecteur demande moins de mouvement ; vrai aussi au rendu serveur, où rien ne bouge. */
function useMouvementRéduit(): boolean {
  return useSyncExternalStore(
    abonnerAuMouvement,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  )
}

function useAnimation() {
  const réduit = useMouvementRéduit()
  return { isAnimationActive: !réduit, animationDuration: DURÉE, animationEasing: 'ease-out' as const }
}

const ARDOISE = 'var(--color-ardoise)'
const TURQUOISE = 'var(--color-turquoise)'
const OCRE = 'var(--color-ocre)'
const ENCRE = 'var(--color-encre)'

export type PointDeSemaine = { readonly libellé: string; readonly faits: number }

// ── Activité : une aire sur treize semaines, la dernière marquée en turquoise ─

const CONFIG_ACTIVITÉ = { faits: { label: 'Faits', color: ARDOISE } } satisfies ChartConfig

export function AireDActivité({ points }: { points: readonly PointDeSemaine[] }) {
  const animation = useAnimation()
  const dernier = points.length - 1
  return (
    <ChartContainer config={CONFIG_ACTIVITÉ} className="h-40 w-full" aria-hidden="true">
      <AreaChart data={[...points]} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="aire-activite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ARDOISE} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ARDOISE} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="libellé" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={24} />
        <ChartTooltip cursor isAnimationActive={false} content={<ChartTooltipContent indicator="line" labelFormatter={(v) => `Semaine du ${v}`} />} />
        <Area
          dataKey="faits"
          type="monotone"
          stroke={ARDOISE}
          strokeWidth={2}
          fill="url(#aire-activite)"
          dot={(p: { cx?: number; cy?: number; index?: number }) =>
            p.index === dernier && p.cx !== undefined && p.cy !== undefined ? <circle key="dernier" cx={p.cx} cy={p.cy} r={5} fill={TURQUOISE} stroke="var(--color-blanc)" strokeWidth={2} /> : <g key={`p-${p.index}`} />
          }
          activeDot={{ r: 4, fill: TURQUOISE, stroke: 'var(--color-blanc)' }}
          {...animation}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/** La petite aire d'une carte de rubrique : huit semaines, sans axe, la dernière en turquoise. */
export function MiniAire({ points }: { points: readonly PointDeSemaine[] }) {
  const animation = useAnimation()
  const dernier = points.length - 1
  return (
    <ChartContainer config={CONFIG_ACTIVITÉ} className="h-12 w-full" aria-hidden="true">
      <AreaChart data={[...points]} margin={{ top: 6, right: 6, bottom: 2, left: 6 }}>
        <ChartTooltip cursor={false} isAnimationActive={false} content={<ChartTooltipContent indicator="line" labelFormatter={(v) => `Semaine du ${v}`} />} />
        <Area
          dataKey="faits"
          type="monotone"
          stroke={ARDOISE}
          strokeWidth={1.5}
          fill={ARDOISE}
          fillOpacity={0.12}
          dot={(p: { cx?: number; cy?: number; index?: number }) =>
            p.index === dernier && p.cx !== undefined && p.cy !== undefined ? <circle key="dernier" cx={p.cx} cy={p.cy} r={4} fill={TURQUOISE} /> : <g key={`p-${p.index}`} />
          }
          activeDot={{ r: 3, fill: TURQUOISE }}
          {...animation}
        />
      </AreaChart>
    </ChartContainer>
  )
}

// ── Radars : les cinq forces et les six dimensions PESTEL ───────────────────

export type BrancheDuRadar = { readonly libellé: string; readonly valeur: number }

export function RadarDeValeurs({ branches, max, unité }: { branches: readonly BrancheDuRadar[]; max: number; unité: string }) {
  const animation = useAnimation()
  const config = { valeur: { label: unité, color: TURQUOISE } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="mx-auto aspect-[4/3] w-full max-w-lg" aria-hidden="true">
      <RadarChart data={[...branches]} outerRadius="66%" margin={{ top: 12, right: 96, bottom: 12, left: 96 }}>
        <ChartTooltip cursor={false} isAnimationActive={false} content={<ChartTooltipContent />} />
        <PolarGrid />
        <PolarAngleAxis dataKey="libellé" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, Math.max(max, 1)]} tick={false} axisLine={false} tickCount={Math.min(Math.max(max, 1), 4) + 1} />
        <Radar dataKey="valeur" stroke={TURQUOISE} strokeWidth={2} fill={TURQUOISE} fillOpacity={0.2} dot={{ r: 3, fill: TURQUOISE, fillOpacity: 1 }} {...animation} />
      </RadarChart>
    </ChartContainer>
  )
}

// ── PESTEL : les faits par mois d'une dimension ─────────────────────────────

export type PointDeMois = { readonly mois: string; readonly faits: number }

/** Les mois d'une dimension, une même échelle pour toutes (`max`), le dernier mois en turquoise. */
export function BarresDuMois({ points, max }: { points: readonly PointDeMois[]; max: number }) {
  const animation = useAnimation()
  const dernier = points.length - 1
  return (
    <ChartContainer config={CONFIG_ACTIVITÉ} className="h-20 w-full" aria-hidden="true">
      <BarChart data={[...points]} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="mois" tickLine={false} axisLine={false} tickMargin={4} />
        <YAxis hide domain={[0, Math.max(max, 1)]} />
        <ChartTooltip cursor={false} isAnimationActive={false} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="faits" radius={0} {...animation}>
          {points.map((p, i) => (
            <Cell key={p.mois} fill={i === dernier ? TURQUOISE : ARDOISE} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

// ── Indicateurs : entrées et procédures, deux périodes ──────────────────────

export type PériodeDEntrées = { readonly période: string; readonly entrées: number | null; readonly procédures: number | null }

const CONFIG_ENTRÉES = {
  entrées: { label: 'Entrées', color: ARDOISE },
  procédures: { label: 'Procédures', color: OCRE },
} satisfies ChartConfig

export function BarresGroupées({ périodes }: { périodes: readonly PériodeDEntrées[] }) {
  const animation = useAnimation()
  return (
    <ChartContainer config={CONFIG_ENTRÉES} className="h-64 w-full" aria-hidden="true">
      <BarChart data={périodes.map((p) => ({ ...p }))} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={4}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="période" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis hide />
        <ChartTooltip cursor isAnimationActive={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="entrées" fill={ARDOISE} radius={0} {...animation} />
        <Bar dataKey="procédures" fill={OCRE} radius={0} {...animation} />
      </BarChart>
    </ChartContainer>
  )
}

// ── Indicateurs : le chiffre d'affaires publié, en barres horizontales ──────

export type LigneDeBenchmark = { readonly nom: string; readonly chiffreDAffaires: number; readonly organisation: boolean }

const CONFIG_BENCHMARK = { chiffreDAffaires: { label: 'Chiffre d’affaires', color: ARDOISE } } satisfies ChartConfig
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 })

export function BarresHorizontales({ lignes }: { lignes: readonly LigneDeBenchmark[] }) {
  const animation = useAnimation()
  return (
    <ChartContainer config={CONFIG_BENCHMARK} className="w-full" style={{ height: Math.max(lignes.length * 36 + 24, 96) }} aria-hidden="true">
      <BarChart data={lignes.map((l) => ({ ...l }))} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nom" width={150} tickLine={false} axisLine={false} />
        <ChartTooltip cursor={false} isAnimationActive={false} content={<ChartTooltipContent hideIndicator formatter={(v) => euros.format(Number(v))} />} />
        <Bar dataKey="chiffreDAffaires" radius={0} barSize={18} label={{ position: 'right', formatter: (v: unknown) => euros.format(Number(v)), className: 'fill-encre' }} {...animation}>
          {lignes.map((l) => (
            <Cell key={l.nom} fill={l.organisation ? ENCRE : ARDOISE} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
