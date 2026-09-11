import { notFound } from 'next/navigation'
import { exigerAccès } from '@/lib/auth/appartenance'
import { BadgeImpact } from '@/components/badge-impact'
import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { SurtitreAxe } from '@/components/titre-axe'
import { mentionsDe } from '@/lib/domaine/mentions'
import { enSlug } from '@/lib/domaine/slug'
import { suivreLesDossiers } from '@/lib/domaine/tendances'
import { dernièresNotes, LETTRES_SUIVIES, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Un acteur suivi, et ce que les lettres en disent.
 *
 * Un dossier ouvert n'a pas de contenu propre dans Notion : c'est une entrée
 * texte, un nom et un compteur. Cette page l'assemble à partir de deux sources
 * de coûts très différents. Le **suivi** ne lit aucun corps de note — il vient
 * de la propriété texte des éditions, et couvre toute l'archive pour la seule
 * requête de liste. Les **mentions** demandent le corps des quatre dernières
 * lettres, les mêmes entrées de cache que la page d'un axe.
 *
 * L'acteur est retrouvé par le segment d'URL, comparé aux dossiers des lettres
 * **déjà filtrées** de l'organisation. Un segment inconnu est introuvable ;
 * aucun identifiant venu de l'URL n'atteint Notion.
 */
export default async function UnActeur({
  params,
}: {
  params: Promise<{ slug: string; acteur: string }>
}) {
  const { slug, acteur: segment } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const suivi = suivreLesDossiers(semaines).find((dossier) => enSlug(dossier.nom) === segment)

  if (!suivi) notFound()

  const notes = await dernièresNotes(semaines)
  const lettres = notes.flatMap(({ lettre, document }) => {
    const mentions = mentionsDe(suivi.nom, document)
    return mentions.length > 0 ? [{ lettre, mentions }] : []
  })

  // Du plus récent au plus ancien : c'est l'ordre dans lequel on relit un suivi.
  const relevés = [...suivi.points].reverse()

  return (
    <>
      <EntêteÉcran
        surtitre="acteur suivi"
        titre={suivi.nom}
        état={
          suivi.aBougé
            ? 'a bougé cette semaine'
            : suivi.semainesSansMouvement === 0
              ? 'ouvert cette semaine'
              : `${suivi.semainesSansMouvement} semaine${suivi.semainesSansMouvement > 1 ? 's' : ''} sans mouvement`
        }
      />

      <p className="mt-5">
        <LienFlèche href={`/${accès.slug}/acteurs`}>Retour aux acteurs</LienFlèche>
      </p>

      {suivi.précisionActuelle ? (
        <div className="mt-6">
          <Panneau ton="ardoise">
            <h2 className="label-mono text-ardoise">Où en est ce dossier</h2>
            <p className="mt-3 text-encre">{suivi.précisionActuelle}</p>
          </Panneau>
        </div>
      ) : null}

      <section className="mt-10 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Ce que les lettres en disent</h2>
        <p className="text-ardoise">
          Les passages des {LETTRES_SUIVIES} dernières lettres qui nomment cet acteur.
        </p>

        {lettres.length === 0 ? (
          // Sans passage à citer, la page ne doit pas laisser le lecteur sans
          // issue : on lui ouvre les lettres de la période, à lui de juger.
          <div className="flex flex-col gap-4">
            <p className="text-ardoise">
              Aucune des dernières lettres ne le nomme en toutes lettres. Le dossier reste
              ouvert : il est suivi, et son état figure ci-dessous.
            </p>
            {notes.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {notes.map(({ lettre }) => (
                  <li key={lettre.édition.pageId}>
                    <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                      {lettre.semaine.libellé}
                      {lettre.édition.veille ? ` · ${lettre.édition.veille}` : ''}
                    </LienFlèche>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {lettres.map(({ lettre, mentions }) => (
              <section key={lettre.édition.pageId} className="flex flex-col gap-4 py-6">
                <div className="flex flex-col gap-1">
                  <p className="label-mono text-ardoise">
                    {lettre.édition.veille ?? 'veille'}
                    {lettre.édition.numéro !== null ? ` · n° ${lettre.édition.numéro}` : ''}
                  </p>
                  <h3 className="font-titre text-h3 font-semibold text-encre">
                    {lettre.semaine.libellé}
                  </h3>
                </div>

                {mentions.map((mention, rang) => (
                  <div key={`${mention.titre}-${rang}`} className="flex flex-col gap-2">
                    {/* Un passage venu du chapeau n'a pas de titre : on ne pose
                        pas de surtitre vide pour autant. */}
                    {mention.titre ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <SurtitreAxe axe={{ titre: mention.titre, numéro: mention.numéro }} />
                        <BadgeImpact niveau={mention.niveau} />
                      </div>
                    ) : null}
                    <ul className="flex flex-col gap-2">
                      {mention.passages.map((passage) => (
                        <li key={passage} className="flex gap-2.5">
                          <span
                            aria-hidden="true"
                            className="mt-[0.5em] size-1.5 shrink-0 bg-ardoise"
                          />
                          <span className="text-encre">{passage}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <p>
                  <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                    Lire la lettre entière
                  </LienFlèche>
                </p>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Le suivi</h2>
        <p className="text-ardoise">
          Chaque semaine où le dossier a été rouvert, et l’état où il était alors. Ce relevé
          couvre toute l’archive.
        </p>

        <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
          {relevés.map((point) => (
            <li
              key={point.semaine}
              className="flex flex-wrap items-baseline justify-between gap-3 py-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-encre">{point.libellé}</span>
                {point.précision ? (
                  <span className="text-ardoise">{point.précision}</span>
                ) : null}
              </div>
              <span className="label-mono text-ardoise">
                {point.compteur === null
                  ? 'suivi'
                  : point.compteur === 0
                    ? 'mouvement'
                    : `${point.compteur} sem. sans mouvement`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
