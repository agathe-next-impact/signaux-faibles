'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LigneDeMarché } from '@/lib/domaine/marches'
import {
  BORNES_DES_HYPOTHÈSES,
  LIBELLÉS_DE_VERDICT,
  arbreDeDécision,
  bornerLesHypothèses,
  lectureDuSegment,
  lireLesHypothèses,
  matriceDeDécision,
  simulerLesLignes,
  écrireLesHypothèses,
  type Hypothèses,
  type HypothèsesDeSegment,
} from '@/lib/domaine/marches-decision'

/**
 * « Et si » (16 novembre 2026, lot 1 des simulations de scénarios) : le lecteur
 * déplace une hypothèse sur un segment et voit le verdict que la règle rendrait.
 * Composant client : il ne lit rien, les lignes viennent de la page, la règle
 * du domaine est rejouée telle quelle. Rien n'est enregistré : les hypothèses
 * vivent dans l'adresse (`?si=`), pour pouvoir être transmises dans l'espace.
 * Le verdict simulé s'affiche à côté du verdict mesuré, jamais à sa place.
 */
const champ = 'rounded-douce border border-gris-ligne bg-blanc px-2 py-1 text-corps text-encre'

const DÉPENSES = [50, 75, 100, 150, 200] as const

function nombreSaisi(valeur: string, max: number): number | undefined {
  if (valeur.trim() === '') return undefined
  const n = Number(valeur)
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined
}

export function SimulationDesMarchés({ lignes, initial }: { lignes: readonly LigneDeMarché[]; initial: string | null }) {
  const segments = useMemo(() => lignes.filter((l) => l.niveau !== 'marche'), [lignes])
  const [hypothèses, poser] = useState<Hypothèses>(() => lireLesHypothèses(initial, lignes))
  const [clé, choisir] = useState<string>(() => Object.keys(lireLesHypothèses(initial, lignes))[0] ?? segments[0]?.clé ?? '')

  const texte = écrireLesHypothèses(hypothèses)
  useEffect(() => {
    const adresse = new URL(window.location.href)
    if (texte) adresse.searchParams.set('si', texte)
    else adresse.searchParams.delete('si')
    window.history.replaceState(window.history.state, '', adresse)
  }, [texte])

  const simulées = useMemo(() => simulerLesLignes(lignes, hypothèses), [lignes, hypothèses])
  const mesurée = segments.find((l) => l.clé === clé)
  const simulée = simulées.find((l) => l.clé === clé)
  if (!mesurée || !simulée) return null

  const h: HypothèsesDeSegment = hypothèses[clé] ?? {}
  const régler = (plus: HypothèsesDeSegment) => {
    const suivante = bornerLesHypothèses({ ...h, ...plus })
    poser((avant) => {
      const { [clé]: _retirée, ...reste } = avant
      return Object.keys(suivante).length > 0 ? { ...reste, [clé]: suivante } : reste
    })
  }

  const avant = lectureDuSegment(mesurée, arbreDeDécision(lignes))
  const après = lectureDuSegment(simulée, arbreDeDécision(simulées))
  const actives = Object.keys(hypothèses).length
  const verdictsMesurés = new Map(matriceDeDécision(lignes).cases.flatMap((c) => c.segments.map((s) => [s.clé, c.verdict] as const)))
  const matrice = matriceDeDécision(simulées)

  return (
    <section aria-labelledby="et-si" className="mt-12 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="et-si" className="font-titre text-h2 font-bold text-encre">
          Et si
        </h2>
        <p className="label-mono text-ardoise">hypothèses · rien n’est enregistré</p>
      </div>
      <p className="max-w-[68ch] text-sm text-ardoise">
        Déplacez une hypothèse sur un segment : la règle de la matrice est rejouée telle quelle, ses seuils ne changent pas. C’est la sensibilité d’une règle, pas une prévision. Vos hypothèses
        tiennent dans l’adresse de cette page : la transmettre à un lecteur de votre espace lui montre le même essai.
      </p>

      <div className="flex flex-col gap-6 border border-gris-ligne bg-blanc p-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="label-mono text-ardoise">segment</span>
            <select value={clé} onChange={(e) => choisir(e.target.value)} className={champ}>
              {segments.map((l) => (
                <option key={l.clé} value={l.clé}>
                  {l.libellé}
                  {hypothèses[l.clé] ? ' (hypothèse)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono text-ardoise">faits du trimestre · mesuré {mesurée.faits}</span>
            <input
              type="number"
              min={0}
              max={BORNES_DES_HYPOTHÈSES.faitsMax}
              value={h.faits ?? ''}
              placeholder={String(mesurée.faits)}
              onChange={(e) => régler({ faits: nombreSaisi(e.target.value, BORNES_DES_HYPOTHÈSES.faitsMax) })}
              className={`${champ} w-full`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono text-ardoise">concurrents présents · {mesurée.présents === null ? 'non mesuré' : `mesuré ${mesurée.présents.length}`}</span>
            <input
              type="number"
              min={0}
              max={BORNES_DES_HYPOTHÈSES.concurrentsMax}
              value={h.concurrents ?? ''}
              placeholder={mesurée.présents === null ? '' : String(mesurée.présents.length)}
              onChange={(e) => régler({ concurrents: nombreSaisi(e.target.value, BORNES_DES_HYPOTHÈSES.concurrentsMax) })}
              className={`${champ} w-full`}
            />
          </label>
          {mesurée.potentiel ? (
            <label className="flex flex-col gap-1">
              <span className="label-mono text-ardoise">dépense par cible</span>
              <select value={h.dépense ?? 100} onChange={(e) => régler({ dépense: Number(e.target.value) })} className={champ}>
                {DÉPENSES.map((d) => (
                  <option key={d} value={d}>
                    {d === 100 ? 'hypothèse de l’arbre' : `${d} % de l’hypothèse`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-encre">
            <input type="checkbox" checked={h.recul === true} onChange={(e) => régler({ recul: e.target.checked })} />
            en recul depuis deux trimestres
          </label>
        </div>

        <div aria-live="polite" className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="label-mono text-ardoise">mesuré · {LIBELLÉS_DE_VERDICT[avant.verdict]}</p>
            <p className="text-sm text-encre">{avant.raison}</p>
          </div>
          <div className="flex flex-col gap-2 border-l-2 border-turquoise pl-4">
            <p className="label-mono text-encre">
              hypothèse · {LIBELLÉS_DE_VERDICT[après.verdict]}
              {hypothèses[clé] && après.verdict === avant.verdict ? ' · verdict inchangé' : ''}
            </p>
            <p className="text-sm text-encre">{hypothèses[clé] ? après.raison : 'Aucune hypothèse sur ce segment : le verdict est celui de la mesure.'}</p>
          </div>
        </div>

        {actives > 0 ? (
          <div className="flex flex-col gap-3 border-t border-gris-ligne pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="label-mono text-ardoise">
                la matrice sous {actives > 1 ? `vos ${actives} hypothèses` : 'votre hypothèse'}
              </p>
              <button type="button" onClick={() => poser({})} className="rounded-douce border border-encre px-3 py-1 text-label font-medium text-encre">
                Revenir aux mesures
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {matrice.cases.map((c) => (
                <li key={c.verdict} className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-encre first-letter:uppercase">
                    {LIBELLÉS_DE_VERDICT[c.verdict]} · {c.segments.length}
                  </p>
                  {c.segments.length > 0 ? (
                    <ul className="flex flex-col gap-1 text-sm text-encre">
                      {c.segments.map((s) => {
                        const origine = verdictsMesurés.get(s.clé)
                        return (
                          <li key={s.clé}>
                            {s.libellé}
                            {origine && origine !== c.verdict ? <span className="label-mono text-turquoise-texte"> · mesuré {LIBELLÉS_DE_VERDICT[origine]}</span> : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-ardoise">Aucun segment.</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
