'use client'

import { useEffect, useMemo, useState } from 'react'
import { LIBELLÉS_DE_VERDICT } from '@/lib/domaine/marches-decision'
import {
  BORNES_DE_SIMULATION,
  ENGAGEMENTS,
  LIBELLÉS_DE_GESTE,
  LIBELLÉS_DE_PILIER,
  PILIERS,
  cartesDuTirage,
  comparerDeuxStratégies,
  jouerLaPartie,
  lireLaPartie,
  prévisionDuTour,
  refusDeLAction,
  écrireLaPartie,
  type BilanDeTour,
  type CarteDuTirage,
  type DonnéeDeSimulation,
  type Effets,
  type Fourchette,
  type Partie,
  type Pilier,
  type RésultatDeStratégie,
} from '@/lib/domaine/simulation'

/**
 * L'écran « Simulation » (16 novembre 2026, lot 3b des simulations de
 * scénarios). Composant client : il ne lit rien, la donnée vient de la page, et
 * le domaine joue la partie telle quelle. Rien n'est enregistré : la graine et
 * les actions jouées tiennent dans l'adresse (`?p=`), la stratégie gardée pour
 * la comparaison aussi (`?a=`). Chaque mouvement cite la ligne de la table
 * d'effets qui l'a causé ; rien n'est présenté comme une prévision.
 */
const BOUTON = 'rounded-douce bg-encre px-3 py-2 text-label font-medium text-blanc disabled:opacity-40'
const BOUTON_SECOND = 'rounded-douce border border-encre px-3 py-2 text-label font-medium text-encre disabled:opacity-40'

const signé = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')
const enClair = (effets: Effets | null | undefined) =>
  PILIERS.flatMap((p) => (effets?.[p] ? [`${LIBELLÉS_DE_PILIER[p]} ${signé(effets[p] ?? 0)}`] : [])).join(', ') || 'aucun effet'
const jour = (iso: string) => {
  const [a, m, j] = iso.split('-')
  return a && m && j ? `${Number(j)}/${m}/${a}` : iso
}
const hôte = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.slice(0, 40)
  }
}

type Tours = readonly (readonly string[])[]

export function Simulateur({
  donnée,
  initial,
  référenceInitiale,
  graineDuJour,
}: {
  donnée: DonnéeDeSimulation
  initial: string | null
  référenceInitiale: string | null
  graineDuJour: number
}) {
  const [partie, poser] = useState<Partie>(() => lireLaPartie(initial, donnée.table) ?? { graine: graineDuJour, tours: [] })
  const [choix, choisir] = useState<readonly string[]>([])
  const [référence, garder] = useState<Tours | null>(() => (référenceInitiale ? (lireLaPartie(`0;${référenceInitiale}`, donnée.table)?.tours ?? null) : null))
  const [comparaison, comparer] = useState<{ readonly parties: number; readonly a: RésultatDeStratégie; readonly b: RésultatDeStratégie } | null>(null)

  const texte = partie.tours.length > 0 || partie.graine !== graineDuJour ? écrireLaPartie(partie, donnée.table) : ''
  const texteDeRéférence = référence ? écrireLaPartie({ graine: 0, tours: référence }, donnée.table).slice(2) : ''
  useEffect(() => {
    const adresse = new URL(window.location.href)
    if (texte) adresse.searchParams.set('p', texte)
    else adresse.searchParams.delete('p')
    if (référence) adresse.searchParams.set('a', texteDeRéférence)
    else adresse.searchParams.delete('a')
    window.history.replaceState(window.history.state, '', adresse)
  }, [texte, texteDeRéférence, référence])

  const { état, bilans } = useMemo(() => jouerLaPartie(donnée, partie), [donnée, partie])
  const cartes = useMemo(() => cartesDuTirage(donnée), [donnée])
  const prévision = useMemo(() => prévisionDuTour(donnée, état, choix), [donnée, état, choix])
  const finie = état.tour >= BORNES_DE_SIMULATION.tours
  const budgetRestant = BORNES_DE_SIMULATION.budgetParTour - prévision.budgetDépensé
  const libellés = new Map(donnée.segments.map((s) => [s.clé, s.libellé]))

  const jouer = () => {
    poser((p) => ({ ...p, tours: [...p.tours, prévision.jouées] }))
    choisir([])
    comparer(null)
  }
  const recommencer = (graine: number) => {
    poser({ graine, tours: [] })
    choisir([])
    comparer(null)
  }
  const basculer = (clé: string) => choisir((c) => (c.includes(clé) ? c.filter((x) => x !== clé) : [...c, clé]))

  return (
    <div className="mt-8 flex flex-col gap-12">
      <p className="max-w-[68ch] text-sm text-ardoise">
        Une année jouée en quatre trimestres depuis l’état mesuré de votre marché. Vous choisissez vos actions ; les événements sont tirés à la fréquence où votre veille les a
        relevés. Les effets sont des hypothèses écrites, relues avant publication, et chaque mouvement cite la sienne. C’est un atelier pour comparer des choix, pas une prévision.
      </p>

      <section aria-labelledby="piliers" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="piliers" className="font-titre text-h2 font-bold text-encre">
            {finie ? 'Fin de l’année' : état.tour === 0 ? 'Point de départ' : `Après le trimestre ${état.tour}`}
          </h2>
          <p className="label-mono text-ardoise">
            partie n° {partie.graine} · trimestre {Math.min(état.tour + 1, BORNES_DE_SIMULATION.tours)} sur {BORNES_DE_SIMULATION.tours}
          </p>
        </div>
        <ul className="grid grid-cols-1 border-l border-t border-gris-ligne md:grid-cols-2 xl:grid-cols-4">
          {PILIERS.map((p) => {
            const départ = donnée.départ.valeurs[p]
            const écart = état.piliers[p] - départ
            return (
              <li key={p} className="flex flex-col gap-2 border-b border-r border-gris-ligne bg-blanc p-4">
                <p className="label-mono text-ardoise">{LIBELLÉS_DE_PILIER[p]}</p>
                <p className="font-titre text-h2 font-bold text-encre">
                  {état.piliers[p]}
                  {écart !== 0 ? <span className="label-mono ml-2 text-turquoise-texte">{signé(écart)} depuis le départ</span> : null}
                </p>
                <div aria-hidden="true" className="h-2 w-full bg-fond-neutre">
                  <div className="h-2 bg-turquoise" style={{ width: `${état.piliers[p]}%` }} />
                </div>
                <p className="text-sm text-ardoise">Départ {départ} : {donnée.départ.bases[p]}.</p>
              </li>
            )
          })}
        </ul>
      </section>

      {!finie ? (
        <section aria-labelledby="tour" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="tour" className="font-titre text-h2 font-bold text-encre">
              Vos actions du trimestre {état.tour + 1}
            </h2>
            <p className="label-mono text-ardoise">
              budget restant {budgetRestant} sur {BORNES_DE_SIMULATION.budgetParTour} · {BORNES_DE_SIMULATION.actionsParTour} actions au plus
            </p>
          </div>
          <ul className="flex flex-col border-t border-gris-ligne">
            {donnée.table.actions.map((a) => {
              const cochée = choix.includes(a.clé)
              const refus =
                refusDeLAction(a, état) ??
                (!cochée && a.coût > budgetRestant ? 'budget du trimestre dépassé' : !cochée && choix.length >= BORNES_DE_SIMULATION.actionsParTour ? 'nombre d’actions atteint' : null)
              return (
                <li key={a.clé} className="border-b border-gris-ligne bg-blanc p-4">
                  <label className={`flex items-start gap-3 ${refus && !cochée ? 'opacity-60' : ''}`}>
                    <input type="checkbox" className="mt-1" checked={cochée} disabled={refus !== null && !cochée} onChange={() => basculer(a.clé)} />
                    <span className="flex flex-col gap-1">
                      <span className="text-corps font-medium text-encre">{a.libellé}</span>
                      <span className="label-mono text-ardoise">
                        {LIBELLÉS_DE_GESTE[a.geste]}
                        {a.segment ? ` · ${libellés.get(a.segment) ?? a.segment}` : a.partiePrenante ? ` · ${a.partiePrenante}` : ''} · coût {a.coût}
                      </span>
                      <span className="text-sm text-encre">
                        Hypothèse : {enClair(a.effets)}
                        {a.condition && a.effetsSousCondition ? ` ; sous condition, ${enClair(a.effetsSousCondition)}` : ''}. <span className="text-ardoise">Source : {a.référence}.</span>
                      </span>
                      {refus && !cochée ? <span className="text-sm text-ardoise">Indisponible : {refus}.</span> : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div aria-live="polite" className="flex flex-col gap-3 border-l-2 border-turquoise pl-4">
            <p className="label-mono text-encre">effet attendu de vos actions, avant tout événement</p>
            {prévision.mouvements.length > 0 ? (
              <p className="text-sm text-encre">
                {PILIERS.map((p) => `${LIBELLÉS_DE_PILIER[p]} ${état.piliers[p]} → ${prévision.après[p]}`).join(' · ')}
              </p>
            ) : (
              <p className="text-sm text-ardoise">Aucune action choisie : le trimestre se joue sur les seuls événements.</p>
            )}
            <div>
              <button type="button" onClick={jouer} className={BOUTON}>
                Jouer le trimestre {état.tour + 1}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {bilans.length > 0 ? (
        <section aria-labelledby="bilans" className="flex flex-col gap-4">
          <h2 id="bilans" className="font-titre text-h2 font-bold text-encre">
            Ce qui s’est passé
          </h2>
          {[...bilans].reverse().map((b) => (
            <Bilan key={b.tour} bilan={b} donnée={donnée} historique={donnée.historique} />
          ))}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => recommencer(partie.graine)} className={BOUTON_SECOND}>
              Rejouer avec les mêmes événements
            </button>
            <button type="button" onClick={() => recommencer(1 + Math.floor(Math.random() * 999_999))} className={BOUTON_SECOND}>
              Nouvelle partie
            </button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="comparer" className="flex flex-col gap-4">
        <h2 id="comparer" className="font-titre text-h2 font-bold text-encre">
          Comparer deux stratégies
        </h2>
        <p className="max-w-[68ch] text-sm text-ardoise">
          Une partie est un tirage parmi d’autres. Gardez les actions jouées comme stratégie A, rejouez autrement, puis comparez : les deux suites d’actions sont jouées sur les mêmes
          1 000 tirages d’événements. Le résultat est une fourchette par pilier, jamais un seul chiffre.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={partie.tours.length === 0} onClick={() => (garder(partie.tours), comparer(null))} className={BOUTON_SECOND}>
            Garder cette partie comme stratégie A
          </button>
          <button type="button" disabled={partie.tours.length === 0} onClick={() => comparer(comparerDeuxStratégies(donnée, référence ?? [], partie.tours, 1000))} className={BOUTON}>
            Comparer sur 1 000 parties
          </button>
          {référence ? (
            <button type="button" onClick={() => (garder(null), comparer(null))} className="text-label text-ardoise underline underline-offset-2">
              Oublier la stratégie A
            </button>
          ) : null}
        </div>
        <p className="label-mono text-ardoise">
          stratégie a : {référence ? résumé(référence, donnée) : 'ne rien faire (aucune action sur l’année)'} · stratégie b : {partie.tours.length > 0 ? résumé(partie.tours, donnée) : 'la partie en cours, à jouer'}
        </p>
        {comparaison ? (
          <div aria-live="polite" className="overflow-x-auto border border-gris-ligne">
            <table className="w-full border-collapse text-corps">
              <thead>
                <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                  {['pilier', 'stratégie a', 'stratégie b'].map((e) => (
                    <th key={e} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                      {e}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PILIERS.map((p) => (
                  <tr key={p} className="border-b border-gris-ligne align-top">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-encre">
                      {LIBELLÉS_DE_PILIER[p]}
                    </th>
                    <td className="px-4 py-3">
                      <Étendue f={comparaison.a[p]} />
                    </td>
                    <td className="px-4 py-3">
                      <Étendue f={comparaison.b[p]} accent />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-4 text-sm text-ardoise">
              Sur {comparaison.parties} parties : la barre va du premier au neuvième décile (huit parties sur dix), le trait marque la médiane, les chiffres entre parenthèses le minimum et le
              maximum. Deux fourchettes qui se recouvrent largement ne départagent pas les stratégies.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="base" className="flex flex-col gap-4">
        <h2 id="base" className="font-titre text-h2 font-bold text-encre">
          La base de la veille
        </h2>
        <p className="max-w-[68ch] text-sm text-ardoise">
          {donnée.historique < BORNES_DE_SIMULATION.historiqueMin
            ? `Votre veille compte ${donnée.historique} semaine${donnée.historique > 1 ? 's' : ''} de faits étiquetés : sous ${BORNES_DE_SIMULATION.historiqueMin} semaines, aucun événement n’est tiré, la fréquence ne serait pas fiable. Vos actions jouent seules.`
            : `Chaque événement est une catégorie de faits de votre veille. Sa fréquence est le nombre de semaines où un fait de cette catégorie a été relevé, sur ${donnée.historique} semaines d’historique. Une à trois cartes sont tirées par trimestre.`}
        </p>
        <div className="overflow-x-auto border border-gris-ligne">
          <table className="w-full border-collapse text-corps">
            <thead>
              <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                {['événement', 'relevé par la veille', 'dernier fait', 'part du tirage', 'hypothèse d’effet'].map((e) => (
                  <th key={e} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                    {e}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cartes.map((c) => (
                <tr key={c.carte.clé} className="border-b border-gris-ligne align-top">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-encre">
                    {c.carte.libellé}
                  </th>
                  <td className="label-mono px-4 py-3 text-ardoise">{fréquence(c, donnée.historique)}</td>
                  <td className="label-mono px-4 py-3 text-ardoise">{c.observation?.dernier ? `${jour(c.observation.dernier.date)} · ${hôte(c.observation.dernier.source)}` : 'aucun'}</td>
                  <td className="label-mono px-4 py-3 text-encre">
                    {c.écartée === 'historique-court' ? 'hors tirage : historique court' : c.écartée === 'jamais-observée' ? 'hors tirage : jamais relevé' : `${Math.round(c.part * 100)} %`}
                  </td>
                  <td className="px-4 py-3 text-sm text-encre">
                    {enClair(c.carte.effets)}
                    {c.carte.condition && c.carte.effetsSousCondition ? ` ; sous condition, ${enClair(c.carte.effetsSousCondition)}` : ''}. <span className="text-ardoise">Source : {c.carte.référence}.</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="label-mono text-ardoise">votre engagement de départ par segment</h3>
        <ul className="flex flex-col gap-1 text-sm text-encre">
          {donnée.table.engagements.map((e) => {
            const segment = donnée.segments.find((s) => s.clé === e.segment)
            return (
              <li key={e.segment}>
                {segment?.libellé ?? e.segment} : {ENGAGEMENTS[e.cran] ?? e.cran}
                {segment?.verdict ? `, segment ${LIBELLÉS_DE_VERDICT[segment.verdict]}` : ', segment non mesuré'}
                {état.engagements[e.segment] !== undefined && état.engagements[e.segment] !== e.cran ? ` ; dans cette partie : ${ENGAGEMENTS[état.engagements[e.segment] ?? 0]}` : ''}.{' '}
                <span className="text-ardoise">Déduit de : {e.référence}.</span>
              </li>
            )
          })}
        </ul>
        <p className="max-w-[68ch] text-sm text-ardoise">
          Ce que la simulation ne sait pas : votre trésorerie, vos équipes, ni ce que la veille ne suit pas. Les quatre piliers sont des repères de 0 à 100, sans unité.
        </p>
      </section>
    </div>
  )
}

function fréquence(c: CarteDuTirage, historique: number): string {
  const semaines = c.observation?.semaines ?? 0
  const faits = c.observation?.faits ?? 0
  return `${semaines} semaine${semaines > 1 ? 's' : ''} sur ${historique} · ${faits} fait${faits > 1 ? 's' : ''}`
}

function résumé(tours: Tours, donnée: DonnéeDeSimulation): string {
  const libellés = new Map(donnée.table.actions.map((a) => [a.clé, a.libellé]))
  const jouées = tours.flatMap((t, i) => t.map((clé) => `T${i + 1} ${libellés.get(clé) ?? clé}`))
  return jouées.length > 0 ? jouées.join(', ') : 'aucune action'
}

function Bilan({ bilan, donnée, historique }: { bilan: BilanDeTour; donnée: DonnéeDeSimulation; historique: number }) {
  const références = new Map([...donnée.table.actions, ...donnée.table.cartes].map((l) => [l.clé, l.référence]))
  const parPilier = (p: Pilier) => bilan.après[p] - bilan.avant[p]
  return (
    <article className="flex flex-col gap-3 border border-gris-ligne bg-blanc p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-titre text-h3 font-bold text-encre">Trimestre {bilan.tour}</h3>
        <p className="label-mono text-ardoise">{PILIERS.map((p) => `${LIBELLÉS_DE_PILIER[p]} ${signé(parPilier(p))}`).join(' · ')}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="label-mono text-ardoise">événements tirés</p>
        {bilan.cartes.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-encre">
            {bilan.cartes.map((c) => (
              <li key={c.carte.clé}>
                <span className="font-medium">{c.carte.libellé}</span>
                <span className="text-ardoise">
                  {' '}
                  · relevé {fréquence(c, historique)}
                  {c.observation?.dernier ? `, dernier fait le ${jour(c.observation.dernier.date)} (${hôte(c.observation.dernier.source)})` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ardoise">Aucun événement ce trimestre.</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="label-mono text-ardoise">chaque mouvement et sa cause</p>
        {bilan.mouvements.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-encre">
            {bilan.mouvements.map((m, i) => (
              <li key={`${m.clé}:${m.pilier}:${m.cause}:${i}`}>
                {LIBELLÉS_DE_PILIER[m.pilier]} {signé(m.delta)} · {m.libellé}{' '}
                <span className="text-ardoise">
                  ({m.cause === 'action' ? 'votre action' : m.cause === 'carte' ? 'événement' : 'réallocation de l’effort'}
                  {m.sousCondition ? ', effet sous condition' : ''}
                  {m.cause !== 'effort' && références.get(m.clé) ? ` ; source : ${références.get(m.clé)}` : ''})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ardoise">Aucun pilier n’a bougé.</p>
        )}
      </div>
      {bilan.écartées.length > 0 ? <p className="text-sm text-ardoise">Non jouées : {bilan.écartées.map((e) => `${e.clé} (${e.raison})`).join(', ')}.</p> : null}
    </article>
  )
}

function Étendue({ f, accent = false }: { f: Fourchette; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div role="img" aria-label={`de ${f.bas} à ${f.haut}, médiane ${f.médiane}`} className="relative h-3 w-full bg-fond-neutre">
        <div className={`absolute top-0 h-3 ${accent ? 'bg-turquoise' : 'bg-ardoise'}`} style={{ left: `${f.bas}%`, width: `${Math.max(1, f.haut - f.bas)}%` }} />
        <div className="absolute top-0 h-3 w-px bg-encre" style={{ left: `${f.médiane}%` }} />
      </div>
      <p className="label-mono text-ardoise">
        {f.bas} à {f.haut} · médiane {f.médiane} ({f.min} à {f.max})
      </p>
    </div>
  )
}
