import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { BadgeImpact } from '@/components/badge-impact'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { faitsDeLaLettre } from '@/lib/domaine/strategie'
import { dateCourte } from '@/lib/domaine/strategie-vues'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { dernièresNotes, lettresPubliées, LETTRES_SUIVIES, semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, faitsDeLAxeDeLEspace } from '@/lib/portail/strategie'

/**
 * Les faits d'un axe (30 octobre 2026, demande de l'opératrice), atteint depuis
 * « PESTEL » : tous les faits étiquetés de la famille sur treize semaines, du
 * plus récent au plus ancien, avec leur dimension, leur niveau et leur lettre.
 *
 * L'axe est retrouvé par le segment d'URL **dans la grille de l'organisation de
 * la session** ; un segment inconnu est introuvable. Les faits ne mènent qu'aux
 * lettres déjà listées pour cette organisation (règle 2). Les phrases-titres
 * sont relues dans les {@link LETTRES_SUIVIES} dernières lettres, les mêmes
 * entrées de cache que la page d'un axe ; un fait plus ancien se lit dans sa
 * lettre. Seulement pour un espace réorganisé : ailleurs, 404 avant toute lecture.
 */
export default async function FaitsDUnAxe({ params }: { params: Promise<{ slug: string; axe: string }> }) {
  const { slug, axe: segment } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const fin = semaines[0]?.éditions.map((é) => é.dateÉdition).sort().at(-1)
  const lu = espace && fin ? await faitsDeLAxeDeLEspace({ registre: accès.organisationId, segment, fin }) : null
  if (lu?.sorte === 'inconnu') notFound()

  const retour = (
    <p className="mt-5">
      <LienFlèche href={`/${accès.slug}/pestel`}>Retour au PESTEL</LienFlèche>
    </p>
  )
  if (!lu) {
    return (
      <>
        <EntêteÉcran surtitre="axe de votre veille" titre="Faits indisponibles" />
        <p className="mt-5 text-ardoise">Les faits de cet axe ne peuvent pas être affichés pour l’instant. Réessayez dans quelques minutes.</p>
        {retour}
      </>
    )
  }
  const { vue } = lu

  const notes = await dernièresNotes(semaines)
  const lettres = new Map(lettresPubliées(semaines).map((l) => [normaliserIdentifiant(l.édition.pageId), l]))
  const titres = new Map<string, string>()
  for (const { lettre, document } of notes) {
    for (const f of faitsDeLaLettre(document)) titres.set(`${normaliserIdentifiant(lettre.édition.pageId)}:${f.empreinte}`, f.titre)
  }

  return (
    <>
      <EntêteÉcran
        surtitre={`axe ${vue.numéro}${vue.suit ? ` · ${vue.suit}` : ''}`}
        titre={vue.nom}
        état={`${vue.faits.length} fait${vue.faits.length > 1 ? 's' : ''} en treize semaines`}
      />
      {retour}

      <p className="mt-6 max-w-[68ch] text-ardoise">
        Les faits datés que vos lettres ont relevés pour cet axe, du plus récent au plus ancien
        {vue.forts > 0 ? `, dont ${vue.forts} de niveau fort` : ''}
        {vue.ruptures > 0 ? ` et ${vue.ruptures} rupture${vue.ruptures > 1 ? 's' : ''}` : ''}. Le titre d’un fait plus ancien que les {LETTRES_SUIVIES} dernières lettres se lit dans sa lettre.
      </p>

      <section className="mt-6">
        {vue.faits.length === 0 ? (
          <p className="text-ardoise">Aucun fait étiqueté pour cet axe sur les treize dernières semaines : ses lettres l’ont dit RAS, ou son thème n’a pas paru.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne" aria-label={`Les faits de l’axe ${vue.nom}`}>
            {vue.faits.map((f, rang) => {
              const lettre = lettres.get(f.édition)
              const titre = titres.get(`${f.édition}:${f.empreinte}`)
              return (
                <li key={`${f.édition}-${f.empreinte}-${rang}`} className="flex flex-col gap-2 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="label-mono text-ardoise">
                      Fait du {dateCourte(f.date)}
                      {f.dimension ? ` · ${f.dimension}` : ''}
                      {f.rupture ? ' · rupture' : ''}
                    </p>
                    <BadgeImpact niveau={f.impact === 'FORT' || f.impact === 'MOYEN' ? f.impact : null} />
                  </div>
                  {titre ? <p className="text-encre">{titre}</p> : null}
                  {lettre ? (
                    <p>
                      <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                        {lettre.édition.numéro !== null ? `Lettre n° ${lettre.édition.numéro}` : 'La lettre'}, {lettre.semaine.libellé}
                      </LienFlèche>
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
