import { enEuros, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import {
  AXES_DE_LA_CARTE,
  COÛT_HORAIRE_ILLUSTRATIF,
  coûtDeLaVeilleInterne,
  FAMILLES_D_OFFRES,
  notreFourchette,
  POSITIONS_SUR_LA_CARTE,
  RELEVÉ_DU_MARCHÉ,
} from '@/lib/vitrine/marche'

/**
 * Les graphiques des pages vitrines (27 octobre 2026). Dessinés en HTML et non
 * en SVG étiré : une barre positionnée en pourcentage reste nette à toutes les
 * largeurs, et ses libellés restent du texte de la charte (mono pour les
 * chiffres, Public Sans pour les noms).
 *
 * Charte tenue ici : le rose ne colore jamais un texte, il est réservé à la
 * marque qui nous désigne (« graphique seul », §02 de la charte) ; les autres
 * marques sont en ardoise ; filets en gris de ligne ; angles droits, sauf les
 * extrémités de barre, arrondies à 4 px. Chaque graphique a son tableau de
 * chiffres, dépliable : la couleur ne porte jamais seule l'information.
 */

const DATE_DU_RELEVÉ = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
  new Date(`${RELEVÉ_DU_MARCHÉ}T12:00:00Z`),
)

function Chiffres({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-gris-ligne pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 label-mono text-ardoise">
        <span aria-hidden="true" className="text-rose transition-transform group-open:rotate-90">
          →
        </span>
        {titre}
      </summary>
      <div className="mt-3 overflow-x-auto">{children}</div>
    </details>
  )
}

// ── Repères de marché : une échelle logarithmique de 10 à 10 000 € par mois ──

const ÉCHELLE_MIN = 10
const ÉCHELLE_MAX = 10_000
const GRADUATIONS = [10, 100, 1000, 10_000]

/** La position d'un montant sur l'échelle, en pourcentage de la largeur. */
export function positionSurLÉchelle(montant: number): number {
  const borné = Math.min(Math.max(montant, ÉCHELLE_MIN), ÉCHELLE_MAX)
  return ((Math.log10(borné) - Math.log10(ÉCHELLE_MIN)) / (Math.log10(ÉCHELLE_MAX) - Math.log10(ÉCHELLE_MIN))) * 100
}

const fourchette = (min: number, max: number) =>
  max === 0 ? 'gratuit' : min === max ? `${enEuros(min)} €` : `${enEuros(min)} à ${enEuros(max)} €`

function LigneDeMarché({
  libellé,
  livre,
  min,
  max,
  nous = false,
}: {
  libellé: string
  livre: string
  min: number
  max: number
  nous?: boolean
}) {
  const gauche = max === 0 ? 0 : positionSurLÉchelle(min)
  const droite = max === 0 ? 0 : positionSurLÉchelle(max)
  return (
    <li className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center sm:gap-6">
      <div className="flex flex-col">
        <span className={nous ? 'font-medium text-encre' : 'text-encre'}>{libellé}</span>
        <span className="text-label text-ardoise">{livre}</span>
      </div>
      <div className="relative h-8" title={`${libellé} : ${fourchette(min, max)} HT par mois`}>
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-gris-ligne" />
        {max === 0 ? (
          <span aria-hidden="true" className="absolute top-1/2 left-0 size-2.5 -translate-y-1/2 border-2 border-ardoise bg-blanc" />
        ) : (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 h-2.5 min-w-2.5 -translate-y-1/2 rounded-[4px] ${nous ? 'bg-rose' : 'bg-ardoise'}`}
            style={{ left: `${gauche}%`, width: `${Math.max(droite - gauche, 0.8)}%` }}
          />
        )}
        <span
          className="absolute top-full -translate-y-1 label-mono whitespace-nowrap text-ardoise"
          style={droite > 70 ? { right: `${100 - droite}%` } : { left: `${gauche}%` }}
        >
          {fourchette(min, max)}
        </span>
      </div>
    </li>
  )
}

/**
 * Où se place notre prix parmi les offres comparables : une ligne par famille
 * d'offres, sa fourchette de prix publics en euros HT par mois, et la nôtre en
 * rose. L'échelle est logarithmique : de la gratuité aux plateformes, le marché
 * couvre trois ordres de grandeur.
 */
export function GraphiqueRepèresDeMarché() {
  const nous = notreFourchette()
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-col gap-1">
        <span className="label-mono text-ardoise">Prix publics, € HT par mois, échelle logarithmique</span>
      </figcaption>
      <ul aria-label="Fourchettes de prix des offres de veille" className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
        {FAMILLES_D_OFFRES.map((f) => (
          <LigneDeMarché key={f.clé} libellé={f.libellé} livre={f.livre} min={f.min} max={f.max} />
        ))}
        <LigneDeMarché
          libellé="signauxfaibles"
          livre="Une lettre écrite pour votre organisation, chaque semaine"
          min={nous.min}
          max={nous.max}
          nous
        />
      </ul>
      <div aria-hidden="true" className="relative ml-0 h-5 sm:ml-[15.5rem]">
        {GRADUATIONS.map((g) => (
          <span
            key={g}
            className="absolute label-mono whitespace-nowrap text-ardoise"
            style={g === ÉCHELLE_MAX ? { right: 0 } : { left: `${positionSurLÉchelle(g)}%` }}
          >
            {enEuros(g)} €
          </span>
        ))}
      </div>
      <Chiffres titre="Voir les chiffres et leurs sources">
        <table className="w-full min-w-[32rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-gris-ligne">
              <th className="py-2 pr-4 label-mono font-normal text-ardoise">Offre</th>
              <th className="py-2 pr-4 label-mono font-normal text-ardoise">€ HT par mois</th>
              <th className="py-2 label-mono font-normal text-ardoise">Sources</th>
            </tr>
          </thead>
          <tbody>
            {FAMILLES_D_OFFRES.map((f) => (
              <tr key={f.clé} className="border-b border-gris-ligne align-top">
                <td className="py-2 pr-4 text-encre">{f.libellé}</td>
                <td className="py-2 pr-4 text-encre">{fourchette(f.min, f.max)}</td>
                <td className="py-2 text-ardoise">
                  {f.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 ? ', ' : null}
                      <a href={s.url} className="underline underline-offset-2 hover:text-encre" rel="noopener">
                        {s.libellé}
                      </a>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
            <tr className="align-top">
              <td className="py-2 pr-4 font-medium text-encre">signauxfaibles</td>
              <td className="py-2 pr-4 text-encre">{fourchette(nous.min, nous.max)}</td>
              <td className="py-2 text-ardoise">Annuel ramené au mois, puis mensuel</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-label text-ardoise">
          Prix publics relevés le {DATE_DU_RELEVÉ}, par famille d’offres. Une lettre professionnelle
          se vend par utilisateur : la fourchette va d’un à trois lecteurs.
        </p>
      </Chiffres>
    </figure>
  )
}

// ── Le temps de veille interne, valorisé ─────────────────────────────────────

/**
 * Ce que coûte chaque mois une veille faite en interne, à une, deux ou trois
 * heures par semaine, face à notre prix mensuel. Échelle linéaire depuis zéro :
 * c'est un rapport de longueurs que le lecteur compare.
 */
export function GraphiqueTempsDeVeille() {
  const lignes = coûtDeLaVeilleInterne()
  // Un sixième de marge à droite : le libellé du plus grand montant tient à côté de sa barre.
  const plafond = Math.max(...lignes.map((l) => l.parMois), PRIX_MENSUEL_HT) * 1.2
  const largeur = (montant: number) => `${(montant / plafond) * 100}%`
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="label-mono text-ardoise">
        € par mois, à {COÛT_HORAIRE_ILLUSTRATIF} € de l’heure (hypothèse)
      </figcaption>
      <ul aria-label="Coût mensuel d’une veille faite en interne, comparé au prix de signauxfaibles" className="flex flex-col gap-3">
        {lignes.map((l) => (
          <li key={l.heures} className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4">
            <span className="text-encre">
              {l.heures} h par semaine
            </span>
            <span className="flex items-center gap-3" title={`${l.heures} h par semaine : ${enEuros(l.parMois)} € par mois`}>
              <span aria-hidden="true" className="h-2.5 rounded-r-[4px] bg-ardoise" style={{ width: largeur(l.parMois) }} />
              <span className="label-mono whitespace-nowrap text-encre">{enEuros(l.parMois)} €</span>
            </span>
          </li>
        ))}
        <li className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-4 border-t border-gris-ligne pt-3">
          <span className="font-medium text-encre">signauxfaibles</span>
          <span className="flex items-center gap-3" title={`signauxfaibles : ${enEuros(PRIX_MENSUEL_HT)} € HT par mois`}>
            <span aria-hidden="true" className="h-2.5 rounded-r-[4px] bg-rose" style={{ width: largeur(PRIX_MENSUEL_HT) }} />
            <span className="label-mono whitespace-nowrap text-encre">{enEuros(PRIX_MENSUEL_HT)} € HT</span>
          </span>
        </li>
      </ul>
      <Chiffres titre="Voir le calcul">
        <p className="text-ardoise">
          Heures par semaine × 52 semaines ÷ 12 mois × {COÛT_HORAIRE_ILLUSTRATIF} € de l’heure,
          arrondi à l’euro. Le coût de l’heure et la durée sont des hypothèses : remplacez-les par
          les vôtres.
        </p>
      </Chiffres>
    </figure>
  )
}

// ── La carte des groupes stratégiques du marché ──────────────────────────────

/**
 * L'outil de l'écran « Acteurs » appliqué au marché de la veille : chaque
 * famille d'offres placée sur deux axes, trois crans chacun, chaque cran avec
 * son critère. Grille à angle droit et sans gouttière, comme toutes les
 * grilles du portail ; notre position porte le fond rose et le carré encre.
 */
export function CarteDuMarché() {
  const { personnalisation, analyse } = AXES_DE_LA_CARTE
  const colonnes = personnalisation.crans.map((cran, i) => ({ cran, rang: i + 1 }))
  // L'analyse la plus poussée en haut : on lit la carte comme une montée.
  const lignes = analyse.crans.map((cran, i) => ({ cran, rang: i + 1 })).reverse()
  return (
    <figure className="flex flex-col gap-4">
      <div className="overflow-x-auto border-t border-l border-gris-ligne">
        <div
          role="table"
          aria-label={`Carte du marché de la veille : ${analyse.libellé.toLowerCase()} en lignes, ${personnalisation.libellé.toLowerCase()} en colonnes`}
          className="grid min-w-[44rem] grid-cols-[11rem_repeat(3,minmax(0,1fr))]"
        >
          <div role="row" className="contents">
            <div role="columnheader" className="border-r border-b border-gris-ligne p-3">
              <p className="label-mono text-ardoise">{personnalisation.court} →</p>
              <p className="label-mono text-ardoise">{analyse.court} ↓</p>
            </div>
            {colonnes.map(({ cran, rang }) => (
              <div key={rang} role="columnheader" className="flex flex-col gap-1 border-r border-b border-gris-ligne p-3">
                <p className="label-mono text-encre">{cran.libellé}</p>
                <p className="text-label text-ardoise">{cran.critère}</p>
              </div>
            ))}
          </div>
          {lignes.map((ligne) => (
            <div key={ligne.rang} role="row" className="contents">
              <div role="rowheader" className="flex flex-col gap-1 border-r border-b border-gris-ligne p-3">
                <p className="label-mono text-encre">{ligne.cran.libellé}</p>
                <p className="text-label text-ardoise">{ligne.cran.critère}</p>
              </div>
              {colonnes.map((colonne) => {
                const ici = POSITIONS_SUR_LA_CARTE.filter(
                  (pos) => pos.analyse === ligne.rang && pos.personnalisation === colonne.rang,
                )
                const nous = ici.some((pos) => pos.clé === 'nous')
                return (
                  <div
                    key={colonne.rang}
                    role="cell"
                    className={`flex min-h-24 flex-col gap-2 border-r border-b border-gris-ligne p-3 ${nous ? 'bg-fond-rose' : 'bg-blanc'}`}
                  >
                    {ici.map((pos) => (
                      <p key={pos.clé} className="flex gap-2 leading-snug">
                        <span
                          aria-hidden="true"
                          className={`mt-[0.45em] size-1.5 shrink-0 ${pos.clé === 'nous' ? 'bg-encre' : 'bg-ardoise'}`}
                        />
                        <span className={pos.clé === 'nous' ? 'font-medium text-encre' : 'text-encre'}>{pos.libellé}</span>
                      </p>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="text-label text-ardoise">
        Un cabinet de veille livre aussi une analyse pour votre organisation, sur devis.
        signauxfaibles la livre chaque semaine, à un prix publié.
      </figcaption>
    </figure>
  )
}
