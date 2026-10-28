import { Case, Grille } from '@/components/coquille'
import {
  dateCourte,
  LIBELLÉS_MENDELOW,
  LIBELLÉS_SWOT,
  libelléDePériode,
  STRATÉGIES_MENDELOW,
  TYPES_DE_TOWS,
  type ForceLue,
  type ScénarioLu,
  type VueDeLaCarte,
  type VueDeLaSwot,
  type VueDeLaTows,
  type VueDeMendelow,
  type VueDuPestel,
} from '@/lib/domaine/strategie-vues'
import { CASES_SWOT } from '@/lib/domaine/strategie'

/**
 * Les outils stratégiques sur les écrans du client (lot 11), selon les
 * maquettes validées le 26 octobre 2026 : la carte des groupes stratégiques et
 * la matrice de Mendelow sur « Acteurs », la recommandation, la TOWS, la SWOT et
 * la lecture du trimestre sur « Recommandations », l'onglet PESTEL de « Les
 * axes ». Rien ici n'est lu : les vues arrivent calculées
 * (`lib/domaine/strategie-vues.ts`), et seule une synthèse publiée par
 * l'opératrice en produit.
 *
 * Les cases sont à angle droit et sans gouttière ; les pastilles sont carrées,
 * rose pour ce qui a bougé, encre pour l'organisation, ardoise sinon ; aucun
 * badge d'impact, aucune couleur nouvelle. Les numéros d'axes sont composés en
 * mono : ni Lora ni Public Sans ne dessinent les chiffres cerclés.
 */

function Pastille({ couleur, pointillé = false }: { couleur: 'rose' | 'encre' | 'ardoise' | 'filet'; pointillé?: boolean }) {
  const fond = pointillé ? 'bg-transparent outline-1 -outline-offset-1 outline-dashed outline-ardoise' : { rose: 'bg-rose', encre: 'bg-encre', ardoise: 'bg-ardoise', filet: 'bg-gris-ligne' }[couleur]
  return <span aria-hidden="true" className={`mt-[0.5em] inline-block h-1.5 w-1.5 shrink-0 ${fond}`} />
}

function TitreDeSection({ titre, mention }: { titre: string; mention: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-titre text-h2 font-bold text-encre">{titre}</h2>
      <p className="label-mono text-ardoise">{mention}</p>
    </div>
  )
}

function Numéro({ n }: { n: number }) {
  return <span className="mr-1.5 font-mono text-label font-medium text-ardoise">{n}</span>
}

// ── Acteurs ──────────────────────────────────────────────────────────────────

export function CarteDesGroupes({ carte }: { carte: VueDeLaCarte }) {
  const lignes = carte.lignes.crans.map((libellé, i) => ({ cran: i + 1, libellé })).reverse()
  const colonnes = carte.colonnes.crans.map((libellé, i) => ({ cran: i + 1, libellé }))
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto border-t border-l border-gris-ligne">
        <div
          role="table"
          aria-label={`Carte des groupes stratégiques : ${carte.lignes.libellé} en lignes, ${carte.colonnes.libellé} en colonnes`}
          className="grid min-w-[720px]"
          style={{ gridTemplateColumns: `150px repeat(${colonnes.length}, minmax(140px, 1fr))` }}
        >
          <div role="row" className="contents">
            <div role="columnheader" className="border-r border-b border-gris-ligne p-3">
              <p className="label-mono text-ardoise">
                {carte.lignes.libellé} ↓ · {carte.colonnes.libellé} →
              </p>
            </div>
            {colonnes.map((c) => (
              <div key={c.cran} role="columnheader" className="border-r border-b border-gris-ligne p-3">
                <p className="label-mono text-encre">
                  {c.cran} · {c.libellé}
                </p>
              </div>
            ))}
          </div>
          {lignes.map((l) => (
            <div key={l.cran} role="row" className="contents">
              <div role="rowheader" className="border-r border-b border-gris-ligne p-3">
                <p className="label-mono text-encre">
                  {l.cran} · {l.libellé}
                </p>
              </div>
              {colonnes.map((c) => {
                const occupants = carte.cases.get(`${l.cran}:${c.cran}`) ?? []
                const anciens = carte.anciennes.get(`${l.cran}:${c.cran}`) ?? []
                const vous = occupants.some((o) => o.organisation)
                const mouvement = occupants.some((o) => o.aBougé)
                return (
                  <div
                    key={c.cran}
                    role="cell"
                    className={`flex min-h-[104px] flex-col gap-1.5 border-r border-b border-gris-ligne p-3 ${vous ? 'bg-fond-ardoise' : mouvement ? 'bg-fond-rose' : 'bg-blanc'}`}
                  >
                    {occupants.map((o) => (
                      <div key={o.sujet} className="flex flex-col gap-1">
                        <p className="flex gap-2 leading-snug">
                          <Pastille couleur={o.organisation ? 'encre' : o.aBougé ? 'rose' : 'ardoise'} />
                          <span className={o.organisation || o.aBougé ? 'font-medium text-encre' : 'text-encre'}>{o.sujet}</span>
                        </p>
                        {o.organisation ? <p className="label-mono text-ardoise">Vous</p> : null}
                        {o.venuDe ? (
                          <p className="text-sm leading-snug text-encre">
                            Venu de {o.venuDe.ligne} · {o.venuDe.colonne}
                            {o.fait ? <span className="label-mono text-ardoise"> · fait du {dateCourte(o.fait.date)}</span> : null}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {anciens.map((sujet) => (
                      <p key={`avant-${sujet}`} className="flex gap-2 leading-snug text-ardoise">
                        <Pastille couleur="ardoise" pointillé />
                        <span>{sujet}, avant</span>
                      </p>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Légende de la carte">
        <li className="flex items-center gap-2"><Pastille couleur="encre" /><span className="label-mono text-ardoise">Votre position</span></li>
        <li className="flex items-center gap-2"><Pastille couleur="rose" /><span className="label-mono text-ardoise">A bougé</span></li>
        <li className="flex items-center gap-2"><Pastille couleur="ardoise" /><span className="label-mono text-ardoise">Sans mouvement</span></li>
        <li className="flex items-center gap-2"><Pastille couleur="ardoise" pointillé /><span className="label-mono text-ardoise">Position précédente</span></li>
      </ul>
    </div>
  )
}

export function MatriceDeMendelow({ mendelow }: { mendelow: VueDeMendelow }) {
  return (
    <div className="overflow-x-auto border-t border-l border-gris-ligne">
      <div role="table" aria-label="Matrice de Mendelow : pouvoir en lignes, intérêt en colonnes" className="grid min-w-[680px] grid-cols-[150px_repeat(3,minmax(170px,1fr))]">
        <div role="row" className="contents">
          <div role="columnheader" className="border-r border-b border-gris-ligne p-3"><p className="label-mono text-ardoise">Pouvoir ↓ · Intérêt →</p></div>
          {[1, 2, 3].map((i) => (
            <div key={i} role="columnheader" className="border-r border-b border-gris-ligne p-3"><p className="label-mono text-encre">Intérêt {LIBELLÉS_MENDELOW[i - 1]}</p></div>
          ))}
        </div>
        {[3, 2, 1].map((p) => (
          <div key={p} role="row" className="contents">
            <div role="rowheader" className="border-r border-b border-gris-ligne p-3"><p className="label-mono text-encre">Pouvoir {LIBELLÉS_MENDELOW[p - 1]}</p></div>
            {[1, 2, 3].map((i) => {
              const sujets = mendelow.cases.get(`${p}:${i}`) ?? []
              const coin = STRATÉGIES_MENDELOW[`${p}:${i}`]
              return (
                <div key={i} role="cell" className={`flex min-h-[120px] flex-col gap-1.5 border-r border-b border-gris-ligne p-3 ${p === 3 && i === 3 ? 'bg-fond-ardoise' : 'bg-blanc'}`}>
                  {coin ? <p className="label-mono text-ardoise">{coin}</p> : null}
                  {sujets.map((s) => (
                    <div key={s.sujet} className="flex flex-col gap-0.5">
                      <p className="flex gap-2 leading-snug"><Pastille couleur={s.aBougé ? 'rose' : 'ardoise'} /><span className="text-encre">{s.sujet}</span></p>
                      {s.aBougé && s.fait ? <p className="label-mono text-ardoise">Fait du {dateCourte(s.fait.date)}</p> : null}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Les deux outils de la synthèse publiée, en tête de l'écran « Acteurs ». */
export function SynthèseDesActeurs({ période, carte, mendelow }: { période: string; carte: VueDeLaCarte | null; mendelow: VueDeMendelow }) {
  return (
    <div className="mt-8 flex flex-col gap-10">
      {carte && carte.placés > 0 ? (
        <section className="flex flex-col gap-4">
          <TitreDeSection titre="Carte des groupes stratégiques" mention="Outil en test" />
          <p className="max-w-[68ch] text-ardoise">
            Vos concurrents placés sur les deux axes que votre veille a retenus avec vous, synthèse {libelléDePériode(période)}. Une position ne bouge que sur un fait daté d’une lettre.
          </p>
          <CarteDesGroupes carte={carte} />
        </section>
      ) : null}
      {mendelow.placés > 0 ? (
        <section className="flex flex-col gap-4">
          <TitreDeSection titre="Parties prenantes" mention="Matrice de Mendelow" />
          <p className="max-w-[68ch] text-ardoise">
            {mendelow.placés} partie{mendelow.placés > 1 ? 's' : ''} prenante{mendelow.placés > 1 ? 's' : ''}, placée{mendelow.placés > 1 ? 's' : ''} selon leur pouvoir sur votre activité et l’intérêt qu’elles y portent. Trois crans de chaque côté : bas, intermédiaire, élevé.
          </p>
          <MatriceDeMendelow mendelow={mendelow} />
        </section>
      ) : null}
    </div>
  )
}

// ── Recommandations ──────────────────────────────────────────────────────────

function Références({ codes }: { codes: readonly string[] }) {
  if (codes.length === 0) return null
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      {codes.map((c) => (
        <span key={c} className="rounded-full border border-gris-ligne px-2 py-0.5 font-mono text-label text-ardoise">{c}</span>
      ))}
    </p>
  )
}

export function SynthèseDesRecommandations({ période, swot, tows }: { période: string; swot: VueDeLaSwot; tows: VueDeLaTows }) {
  return (
    <div className="mt-8 flex flex-col gap-10">
      {tows.candidate ? (
        <section className="flex flex-col gap-3 border border-gris-ligne bg-fond-rose p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="label-mono text-ardoise">Option retenue, synthèse {libelléDePériode(période)}</h2>
            <p className="label-mono text-ardoise">{tows.candidate.libellé}</p>
          </div>
          <p className="max-w-[60ch] font-titre text-h3 font-bold leading-snug text-encre">{tows.candidate.énoncé}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-mono text-ardoise">Croise</span>
            <Références codes={tows.candidate.croise} />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <TitreDeSection titre="Options stratégiques" mention="Matrice TOWS · outil en test" />
        <p className="max-w-[68ch] text-ardoise">Chaque option croise un élément de votre situation et un élément de votre environnement, lus plus bas. Les codes renvoient aux éléments de l’analyse.</p>
        <Grille étiquette="Matrice TOWS" colonnes={2}>
          {TYPES_DE_TOWS.map((t) => {
            const options = tows.parType[t.type]
            return (
              <Case key={t.type} accent={options.some((o) => o.candidate)}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="label-mono text-encre">{t.type} · {t.libellé}</p>
                  <p className="label-mono text-ardoise">{t.verbe}</p>
                </div>
                {options.length === 0 ? <p className="text-ardoise">Aucune option ce mois-ci.</p> : null}
                {options.map((o) => (
                  <div key={o.énoncé} className="flex flex-col gap-1.5">
                    {o.candidate ? <p className="flex items-center gap-2 label-mono text-encre"><Pastille couleur="rose" />Option retenue</p> : null}
                    <p className="text-encre">{o.énoncé}</p>
                    <Références codes={o.croise} />
                  </div>
                ))}
              </Case>
            )
          })}
        </Grille>
      </section>

      <section className="flex flex-col gap-4">
        <TitreDeSection titre="Votre situation" mention="Matrice SWOT" />
        <p className="max-w-[68ch] text-ardoise">Les opportunités et les menaces viennent des faits de vos lettres, datés. Les forces et les faiblesses peuvent venir de ce que vous nous avez déclaré : elles sont marquées comme telles.</p>
        <Grille étiquette="Matrice SWOT" colonnes={2}>
          {CASES_SWOT.map((c) => (
            <Case key={c}>
              <p className="label-mono text-encre">{LIBELLÉS_SWOT[c]}</p>
              {swot[c].length === 0 ? <p className="text-ardoise">Rien de daté ce mois-ci.</p> : null}
              {swot[c].map((é) => (
                <div key={é.code} className="flex gap-3">
                  <span className="w-7 shrink-0 pt-0.5 font-mono text-label text-ardoise">{é.code}</span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-encre">{é.énoncé}</span>
                    <span className="label-mono text-ardoise">{é.source}</span>
                  </span>
                </div>
              ))}
            </Case>
          ))}
        </Grille>
      </section>
    </div>
  )
}

export function LectureDuTrimestre({ période, forces, scénarios }: { période: string; forces: readonly ForceLue[]; scénarios: readonly ScénarioLu[] }) {
  if (forces.length === 0 && scénarios.length === 0) return null
  return (
    <div className="mt-10 flex flex-col gap-10">
      {forces.length > 0 ? (
        <section className="flex flex-col gap-4">
          <TitreDeSection titre="Intensité des cinq forces" mention={`Trimestre ${libelléDePériode(période)} · outil en test`} />
          <p className="max-w-[68ch] text-ardoise">Trois crans par force, et la tendance sur le trimestre. Une force qu’aucune famille de votre veille ne suit est dite non suivie : elle n’est pas faible pour autant.</p>
          <Grille étiquette="Cinq forces" colonnes={3}>
            {forces.map((f) => (
              <Case key={f.force}>
                <p className="label-mono text-encre">{f.libellé}</p>
                <p className={f.nonSuivi ? 'text-ardoise' : 'font-medium text-encre'}>{f.lecture}</p>
              </Case>
            ))}
          </Grille>
        </section>
      ) : null}
      {scénarios.length > 0 ? (
        <section className="flex flex-col gap-4">
          <TitreDeSection titre="Trois scénarios" mention="Indicateurs datables, aucune probabilité" />
          <p className="max-w-[68ch] text-ardoise">Ce ne sont pas des prévisions. Chaque scénario porte les indicateurs qui le confirmeraient ; votre lettre signalera celui qui bascule.</p>
          <Grille étiquette="Scénarios" colonnes={3}>
            {scénarios.map((s, i) => (
              <Case key={s.titre}>
                <p className="label-mono text-ardoise">Scénario {String.fromCharCode(65 + i)}</p>
                <h3 className="font-titre text-h3 font-bold text-encre">{s.titre}</h3>
                <p className="text-encre">{s.énoncé}</p>
                <div className="flex flex-col gap-1">
                  <p className="label-mono text-ardoise">Indicateurs</p>
                  {s.indicateurs.map((ind) => (
                    <p key={`${ind.famille}-${ind.signal}`} className="flex gap-2 leading-snug">
                      <Pastille couleur="ardoise" />
                      <span><Numéro n={ind.famille} />{ind.signal}</span>
                    </p>
                  ))}
                </div>
              </Case>
            ))}
          </Grille>
        </section>
      ) : null}
    </div>
  )
}

// ── Les axes, onglet PESTEL ──────────────────────────────────────────────────

const LIMITE_DES_FAITS = 40

export function VuePestel({ vue }: { vue: VueDuPestel }) {
  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="max-w-[68ch] text-ardoise">
          Les {vue.total} faits étiquetés de vos lettres du {dateCourte(vue.fenêtre.début)} au {dateCourte(vue.fenêtre.fin)}, rangés dans les six dimensions de votre environnement. Une dimension sans fait reste affichée : c’est un trou de couverture, pas un calme.
        </p>
        <p className="label-mono text-ardoise">Outil en test</p>
      </div>

      <Grille étiquette="Les six dimensions">
        {vue.dimensions.map((d) => (
          <Case key={d.lettre}>
            <div className="flex flex-col gap-0.5">
              <p className="label-mono text-encre">{d.initiale} · {d.libellé}</p>
              <p className="label-mono text-ardoise">{d.parMois.map((m) => `${m.mois} ${m.faits}`).join(' · ')}</p>
            </div>
            <p className="font-titre text-h2 font-bold text-encre">
              {d.faits}{' '}
              <span className="font-sans text-base font-normal text-ardoise">
                fait{d.faits > 1 ? 's' : ''}{d.ruptures > 0 ? `, dont ${d.ruptures} rupture${d.ruptures > 1 ? 's' : ''}` : ''}
              </span>
            </p>
            {d.trou ? (
              <p className="text-ardoise">Aucune famille de votre veille ne suit cette dimension.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                <p className="label-mono text-ardoise">Suivie par</p>
                {d.suiviePar.map((a) => (
                  <span key={a.numéro} className="text-encre"><Numéro n={a.numéro} />{a.nom}</span>
                ))}
              </div>
            )}
            {d.suiviePar.length === 1 ? <p className="flex items-center gap-2 label-mono text-ardoise"><Pastille couleur="rose" />Une seule famille</p> : null}
          </Case>
        ))}
      </Grille>

      {vue.trous.length > 0 ? (
        <section className="flex flex-col gap-2.5 border border-gris-ligne bg-fond-neutre p-5">
          <h2 className="label-mono text-ardoise">Trous de couverture</h2>
          {vue.trous.map((t) => (
            <p key={t.libellé} className="flex gap-2.5">
              <Pastille couleur="ardoise" />
              <span>
                <strong className="font-medium">{t.libellé}.</strong>{' '}
                {t.familles === 0 ? 'Aucune famille ne suit cette dimension.' : `Une seule famille, ${t.nom}, suit cette dimension.`}
              </span>
            </p>
          ))}
          <p className="text-ardoise">Ces trous se règlent dans le périmètre de votre veille.</p>
        </section>
      ) : null}

      {vue.faits.length > 0 ? (
        <section className="flex flex-col gap-4">
          <TitreDeSection titre="Faits des dernières lettres" mention="Du plus récent au plus ancien" />
          <div className="overflow-x-auto border-t border-gris-ligne">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  {['Date', 'Dimension', 'Fait', 'Axe'].map((t) => (
                    <th key={t} className="border-b border-gris-ligne px-4 py-2.5 text-left font-normal label-mono text-ardoise">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vue.faits.slice(0, LIMITE_DES_FAITS).map((f) => (
                  <tr key={`${f.date}-${f.titre}`}>
                    <td className="border-b border-gris-ligne px-4 py-3.5 align-top label-mono text-ardoise">{dateCourte(f.date)}</td>
                    <td className="border-b border-gris-ligne px-4 py-3.5 align-top">{f.dimension}</td>
                    <td className="border-b border-gris-ligne px-4 py-3.5 align-top">
                      <span className="flex flex-col gap-1">
                        <span>{f.titre}</span>
                        {f.rupture ? <span className="flex items-center gap-2 label-mono text-encre"><Pastille couleur="rose" />Rupture</span> : null}
                      </span>
                    </td>
                    <td className="border-b border-gris-ligne px-4 py-3.5 align-top text-ardoise">{f.axe ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-ardoise">Les faits plus anciens se relisent dans leurs lettres ; ils restent comptés dans les dimensions ci-dessus.</p>
        </section>
      ) : null}
    </div>
  )
}
