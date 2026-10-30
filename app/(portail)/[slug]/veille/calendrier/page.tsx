import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { PasEncorePubliée } from '@/components/votre-veille'
import { vueDuCalendrier } from '@/lib/domaine/fiche-veille'
import { dateCourte } from '@/lib/domaine/strategie-vues'
import { ficheDeLEspace } from '@/lib/portail/fiche-veille'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Niches et calendrier (lot 6, 30 octobre 2026) : qu'attendez-vous. La frise
 * des échéances des douze prochains mois, mois vides compris, puis les niches
 * surveillées et le signal qui déclencherait un fait. Seulement la fiche de
 * veille publiée ; aucune lecture Notion ; 404 hors de l'espace réorganisé.
 */
export default async function Calendrier({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const lue = espace ? await ficheDeLEspace({ registre: accès.organisationId }) : null
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const mois = lue?.fiche ? vueDuCalendrier(lue.grille, lue.fiche, aujourdhui) : []
  const à = mois.reduce((n, m) => n + m.échéances.length, 0)

  return (
    <>
      <EntêteÉcran surtitre="votre veille" titre="Ce que nous attendons" état={lue?.fiche ? `${à} échéance${à > 1 ? 's' : ''} en douze mois` : undefined} />
      {!lue ? (
        <p className="mt-5 text-ardoise">Le calendrier de votre veille ne peut pas être affiché pour l’instant. Réessayez dans quelques minutes.</p>
      ) : !lue.fiche ? (
        <PasEncorePubliée quoi="Le calendrier de votre veille" />
      ) : (
        <>
          <section className="mt-8 flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">Les douze prochains mois</h2>
            <p className="max-w-[68ch] text-ardoise">Les échéances connues que votre veille suivra. Un mois vide n’est pas un mois calme : rien n’y est encore annoncé.</p>
            <div className="relative overflow-x-auto border-t border-l border-gris-ligne">
              <ol className="grid min-w-[960px] grid-cols-12" aria-label="Échéances des douze prochains mois">
                {mois.map((m) => (
                  <li key={m.mois} className={`flex min-h-[160px] flex-col gap-2 border-r border-b border-gris-ligne p-2.5 ${m.échéances.length > 0 ? 'bg-blanc' : 'bg-fond-neutre'}`}>
                    <p className="label-mono text-encre">{m.libellé}</p>
                    {m.échéances.map((é) => (
                      <div key={`${é.date}-${é.libellé}`} className="flex flex-col gap-0.5 border-t-2 border-ocre pt-1.5">
                        <p className="font-mono text-label text-ocre-texte">{dateCourte(é.date)}</p>
                        <p className="text-sm leading-snug text-encre">{é.libellé}</p>
                        {é.famille ? <p className="font-mono text-label text-ardoise">{é.famille}</p> : null}
                      </div>
                    ))}
                  </li>
                ))}
              </ol>
            </div>
          </section>
          {lue.fiche.niches.length > 0 ? (
            <section className="mt-10 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Niches et signaux</h2>
              <p className="max-w-[68ch] text-ardoise">Ce que votre veille guette au-delà de l’actualité, et le signal qui en ferait un fait.</p>
              <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
                {lue.fiche.niches.map((n) => (
                  <li key={n.énoncé} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-2 sm:gap-6">
                    <p className="text-encre">{n.énoncé}</p>
                    <p className="text-ardoise">
                      <span className="label-mono mr-2 text-ardoise">Signal</span>
                      {n.signal}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
      <p className="mt-10">
        <LienFlèche href={`/${accès.slug}/veille/themes`}>Voir les thèmes de votre veille</LienFlèche>
      </p>
    </>
  )
}
