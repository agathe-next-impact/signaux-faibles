import { notFound, redirect } from 'next/navigation'
import { exigerLecture } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { Note } from '@/components/note'
import { lettresPubliées, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Une lettre, en entier.
 *
 * L'identifiant de l'URL n'est jamais donné à Notion tel quel : la lettre est
 * cherchée dans la liste **déjà filtrée** de l'organisation, et le corps n'est
 * lu qu'une fois qu'elle y a été trouvée. Un identifiant qui n'y figure pas est
 * introuvable, y compris quand la page existe chez un autre client.
 */
export default async function UneLettre({
  params,
}: {
  params: Promise<{ slug: string; edition: string }>
}) {
  const { slug, edition: pageId } = await params
  const { accès, lecture } = await exigerLecture(slug)
  if (lecture === 'aucune') redirect(`/${accès.slug}`)

  const semaines = await semainesPubliées(accès.organisationId)
  const lettres = lettresPubliées(semaines)
  const rang = lettres.findIndex(({ édition }) => édition.pageId === pageId)
  const lettre = lettres[rang]

  if (!lettre) notFound()
  // La lettre précédente de la même veille, dans la liste déjà filtrée (du plus récent au plus ancien) :
  // la mise en avant compare à elle, jamais à une page venue d'ailleurs.
  const précédente = lettres.slice(rang + 1).find(({ édition }) => édition.veille === lettre.édition.veille)?.édition ?? null

  return (
    <>
      <EntêteÉcran
        surtitre={lettre.édition.veille ?? 'lettre'}
        titre={lettre.semaine.libellé}
        état={lettre.édition.numéro !== null ? `n° ${lettre.édition.numéro}` : undefined}
      />

      <p className="mt-6">
        <LienFlèche href={`/${accès.slug}/lettres`}>Retour à toutes les lettres</LienFlèche>
      </p>

      <div className="mt-8">
        <Note édition={lettre.édition} lecture={lecture} précédente={précédente} />
      </div>
    </>
  )
}
