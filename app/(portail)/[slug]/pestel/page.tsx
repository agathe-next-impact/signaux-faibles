import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { VuePestel } from '@/components/strategie-ecrans'
import { notesDeLaSemaine, semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, pestelDeLEspace } from '@/lib/portail/strategie'

/**
 * PESTEL (lot 3 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : quelles dimensions bougent. L'onglet PESTEL de « Les
 * axes », en écran : les faits étiquetés des treize dernières semaines, comptés
 * par dimension et par mois, et cités quand leur lettre est déjà lue.
 *
 * Seulement pour un espace réorganisé : ailleurs, 404 avant toute lecture. Coût
 * Notion : les corps de la semaine et de la précédente, les mêmes entrées de
 * cache que « Les axes » et la vue d'ensemble.
 */
export default async function Pestel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const fin = semaines[0]?.éditions.map((é) => é.dateÉdition).sort().at(-1)
  const [notes, notesPrécédentes] = espace && fin ? await Promise.all([notesDeLaSemaine(semaines[0]), notesDeLaSemaine(semaines[1])]) : [[], []]
  const pestel =
    espace && fin
      ? await pestelDeLEspace({
          registre: accès.organisationId,
          fin,
          lettres: [...notes, ...notesPrécédentes].map((n) => ({ pageId: n.édition.pageId, document: n.document })),
        })
      : null

  return (
    <>
      <EntêteÉcran surtitre="l’environnement" titre="Quelles dimensions bougent" état="treize semaines" />
      {pestel ? (
        <div className="mt-8">
          <VuePestel vue={pestel} />
        </div>
      ) : (
        <p className="mt-5 text-ardoise">Aucun fait étiqueté sur les treize dernières semaines, ou la lecture n’a pas abouti. Réessayez dans quelques minutes.</p>
      )}
      <div className="mt-10">
        <LienFlèche href={`/${accès.slug}/axes`}>Voir les axes de la veille</LienFlèche>
      </div>
    </>
  )
}
