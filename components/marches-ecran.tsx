import { Case, Grille } from '@/components/coquille'
import {
  LIBELLÉS_DE_NIVEAU,
  LIBELLÉS_DE_VERDICT,
  RÈGLES_DE_VERDICT,
  lectureDuSegment,
  matriceDeDécision,
  montantCourt,
  type CaseDeDécision,
  type LigneDeMarché,
  type VueDesMarchés,
} from '@/lib/domaine/marches'

/**
 * Le rendu de « Marchés et niches » : la matrice de décision, puis une fiche
 * courte par offre et par niche. Composant serveur pur : il ne lit rien, la
 * page lui passe la vue calculée.
 */
const nombre = (n: number) => n.toLocaleString('fr-FR')

/** Le nombre de cibles, suivi de ce que l'on compte : « 3 614 établissements hospitaliers ». */
function cibles(l: LigneDeMarché): string | null {
  if (l.cibles === null) return null
  const quoi = l.ciblesLibellé ?? (l.ciblesOrigine === 'declare' ? 'cibles déclarées' : 'entreprises et établissements au registre')
  return `${l.ciblesPlafonnées ? 'plus de ' : ''}${nombre(l.cibles)} ${quoi}`
}

function potentiel(l: LigneDeMarché): string | null {
  if (!l.potentiel) return null
  return l.potentiel.bas === l.potentiel.haut ? montantCourt(l.potentiel.haut) : `${montantCourt(l.potentiel.bas)} à ${montantCourt(l.potentiel.haut)}`
}

/** Les trois premiers concurrents du segment : ceux qui sont titulaires de marchés publics d'abord. */
function concurrents(l: LigneDeMarché): string | null {
  if (!l.présents || l.présents.length === 0) return null
  const titulaires = new Set(l.achatPublic?.concurrents.map((c) => c.nom) ?? [])
  const noms = [...l.présents.filter((n) => titulaires.has(n)), ...l.présents.filter((n) => !titulaires.has(n))]
  const reste = noms.length - 3
  return `${noms.slice(0, 3).join(', ')}${reste > 0 ? ` et ${reste} autre${reste > 1 ? 's' : ''}` : ''}`
}

function achatPublic(l: LigneDeMarché): string | null {
  const a = l.achatPublic
  if (!a) return null
  const vous = a.organisation ? (a.organisation.marchés > 0 ? `, dont ${montantCourt(a.organisation.montant)} pour vous` : ', aucun marché pour vous') : ''
  return `${montantCourt(a.montant)} sur douze mois${vous}`
}

function Chiffre({ intitulé, valeur }: { intitulé: string; valeur: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label-mono text-ardoise">{intitulé}</dt>
      <dd className="text-sm text-encre">{valeur}</dd>
    </div>
  )
}

/** Une case de la matrice : le verdict, sa règle, puis ses segments, une barre par segment à la mesure de ses faits. */
function CaseDeLaMatrice({ c, faitsMax }: { c: CaseDeDécision; faitsMax: number }) {
  return (
    <Case>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-titre text-h3 font-bold text-encre first-letter:uppercase">{LIBELLÉS_DE_VERDICT[c.verdict]}</h3>
        <p className="font-titre text-h3 font-bold text-encre">{c.segments.length}</p>
      </div>
      <p className="label-mono text-ardoise">{RÈGLES_DE_VERDICT[c.verdict]}</p>
      {c.segments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {c.segments.map((s) => (
            <li key={s.clé} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <a href={`#${s.clé}`} className="text-encre underline decoration-gris-ligne underline-offset-4 hover:decoration-encre">
                  {s.libellé}
                </a>
                <span className="label-mono shrink-0 text-ardoise">
                  {s.faits} fait{s.faits > 1 ? 's' : ''}
                </span>
              </div>
              <div aria-hidden className="h-1 bg-fond-ardoise">
                <div
                  className={`h-1 ${c.verdict === 'pousser' ? 'bg-turquoise' : 'bg-ardoise'}`}
                  style={{
                    width: `${faitsMax > 0 ? Math.max(2, Math.round((s.faits / faitsMax) * 100)) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ardoise">Aucun segment ce trimestre.</p>
      )}
    </Case>
  )
}

function Fiche({ l }: { l: LigneDeMarché }) {
  const lecture = lectureDuSegment(l)
  const chiffres = [
    { intitulé: 'Cibles', valeur: cibles(l) },
    { intitulé: 'Potentiel par an', valeur: potentiel(l) },
    { intitulé: 'Achat public', valeur: achatPublic(l) },
    { intitulé: 'Concurrents', valeur: concurrents(l) },
  ].filter((c): c is { intitulé: string; valeur: string } => c.valeur !== null)
  return (
    <Case id={l.clé}>
      <p className="label-mono text-encre">
        {LIBELLÉS_DE_NIVEAU[l.niveau]} · {LIBELLÉS_DE_VERDICT[lecture.verdict]}
        {l.modifié ? ' · périmètre modifié' : ''}
      </p>
      <h3 className="font-titre text-h3 font-bold text-encre">{l.libellé}</h3>
      <p className="text-encre">{lecture.raison}</p>
      {chiffres.length > 0 ? (
        <dl className="flex flex-col gap-3">
          {chiffres.map((c) => (
            <Chiffre key={c.intitulé} intitulé={c.intitulé} valeur={c.valeur} />
          ))}
        </dl>
      ) : null}
      {l.limites.length > 0 || l.sources.length > 0 ? (
        <details className="text-sm text-ardoise">
          <summary className="cursor-pointer">Hypothèses et sources</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {l.limites.map((x) => (
              <li key={x}>{x}</li>
            ))}
            {l.sources.map((s) => (
              <li key={s} className="break-all">
                <a href={s} rel="noreferrer" className="underline">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Case>
  )
}

export function ÉcranDesMarchés({ vue }: { vue: VueDesMarchés & { readonly nonPublié: boolean } }) {
  const matrice = matriceDeDécision(vue.lignes)
  const parClé = new Map(vue.lignes.map((l) => [l.clé, l]))
  // Les fiches suivent la matrice : par verdict, puis du segment le plus actif au moins actif.
  const segments = matrice.cases.flatMap((c) => c.segments.map((x) => parClé.get(x.clé))).filter((l): l is LigneDeMarché => l !== undefined)
  return (
    <>
      {vue.nonPublié ? (
        <p role="status" className="mt-6 border-l-2 border-ardoise bg-fond-ardoise px-4 py-3 text-sm text-encre">
          Aperçu : ces mesures sont proposées et ne sont pas publiées. Vos lecteurs ne les voient pas.
        </p>
      ) : null}

      <section className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">Où porter l’effort</h2>
          <p className="label-mono text-ardoise">Activité de la veille × concurrence · outil en test</p>
        </div>
        <Grille colonnes={2} étiquette="Matrice de décision des marchés et des niches">
          {matrice.cases.map((c) => (
            <CaseDeLaMatrice key={c.verdict} c={c} faitsMax={matrice.faitsMax} />
          ))}
        </Grille>
        <p className="max-w-[68ch] text-sm text-ardoise">
          Chaque offre et chaque niche est rangée par règle, sur deux mesures du trimestre : les faits que la veille y rattache et les concurrents suivis qui y sont présents. La barre donne le nombre
          de faits. C’est une aide à la décision, pas une recommandation rédigée.
        </p>
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Segment par segment</h2>
        <Grille colonnes={2} étiquette="Fiches des marchés et des niches">
          {segments.map((l) => (
            <Fiche key={l.clé} l={l} />
          ))}
        </Grille>
      </section>

      {vue.disparus.length > 0 ? (
        <section className="mt-12 flex flex-col gap-4">
          <h2 className="font-titre text-h2 font-bold text-encre">Retirés depuis le trimestre précédent</h2>
          <ul className="flex flex-col gap-1">
            {vue.disparus.map((d) => (
              <li key={d.clé} className="text-ardoise">
                {d.libellé} <span className="label-mono">· {LIBELLÉS_DE_NIVEAU[d.niveau]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
