import { Case, Grille } from '@/components/coquille'
import { écourter } from '@/lib/domaine/document'
import type { LectureDesÉtiquettes } from '@/lib/domaine/strategie'

/**
 * La lecture stratégique des dernières lettres, sur la vue d'ensemble d'une
 * organisation du pilote des outils stratégiques (26 octobre 2026).
 *
 * Trois cases, et rien qui ne vienne des étiquettes posées fait par fait :
 * l'environnement sur les six dimensions PESTEL, la concurrence sur les cinq
 * forces, les ruptures. Ce sont des comptes, pas une analyse : la case ne dit
 * jamais ce qu'il faut en penser, la synthèse relue de la revue le dira.
 *
 * Les dimensions et les forces sans fait restent affichées : dans ce cadre, un
 * trou est une information. Aucun badge d'impact ni aucune couleur nouvelle ;
 * les comptes sont en mono, comme les autres métadonnées.
 */
const LONGUEUR_DE_RUPTURE = 180

const dateCourte = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function Ligne({ libellé, faits }: { libellé: string; faits: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={faits > 0 ? 'text-encre' : 'text-ardoise'}>{libellé}</span>
      <span className="label-mono text-ardoise">{faits > 0 ? `${faits} fait${faits > 1 ? 's' : ''}` : 'aucun fait'}</span>
    </div>
  )
}

export function LectureStratégique({
  lecture,
  lettres,
  niveauDeTitre = 2,
}: {
  lecture: LectureDesÉtiquettes
  lettres: number
  /** 3 dans un tableau de bord de démonstration, dont le titre de niveau 2 est le nom de l'organisation. */
  niveauDeTitre?: 2 | 3
}) {
  const Titre = niveauDeTitre === 3 ? 'h3' : 'h2'
  return (
    <section className="mt-12 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Titre className="font-titre text-h2 font-bold text-encre">Lecture stratégique</Titre>
        <p className="label-mono text-ardoise">outil en test</p>
      </div>
      <p className="text-ardoise">
        Les {lecture.total} faits {lettres > 1 ? `de vos ${lettres} dernières lettres` : 'de votre dernière lettre'}, classés un à un : ce qui
        bouge dans votre environnement, qui bouge dans votre concurrence, et ce qui pourrait
        changer votre position.
      </p>

      <Grille étiquette="Lecture stratégique des dernières lettres">
        <Case>
          <p className="label-mono text-ardoise">Environnement · PESTEL</p>
          <div className="flex flex-col gap-2">
            {lecture.pestel.map((d) => (
              <Ligne key={d.clé} libellé={d.libellé} faits={d.faits} />
            ))}
          </div>
        </Case>

        <Case>
          <p className="label-mono text-ardoise">Concurrence · cinq forces</p>
          <div className="flex flex-col gap-2">
            {lecture.forces.map((f) => (
              <div key={f.clé} className="flex flex-col gap-1">
                <Ligne libellé={f.libellé} faits={f.faits} />
                {f.entités.length > 0 ? <p className="text-ardoise">{f.entités.join(', ')}</p> : null}
              </div>
            ))}
          </div>
          {lecture.mouvements.length > 0 ? (
            <p className="mt-auto pt-1 label-mono text-ardoise">
              Mouvements : {lecture.mouvements.map((m) => `${m.libellé} (${m.faits})`).join(', ')}
            </p>
          ) : null}
        </Case>

        <Case>
          <p className="label-mono text-ardoise">Ruptures</p>
          {lecture.ruptures.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {lecture.ruptures.map((r) => (
                <li key={`${r.date}:${r.titre}`} className="flex gap-3">
                  {/* Puce carrée : la grille est à angle droit, ses puces aussi. */}
                  <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 bg-ardoise" />
                  <span className="flex flex-col gap-1">
                    <span className="text-encre">{écourter(r.titre, LONGUEUR_DE_RUPTURE)}</span>
                    <span className="label-mono text-ardoise">{dateCourte(r.date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ardoise">
              Aucun fait de ces lettres ne change la position que la veille surveille pour vous.
            </p>
          )}
        </Case>
      </Grille>
    </section>
  )
}
