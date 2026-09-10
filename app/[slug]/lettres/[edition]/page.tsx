import { notFound } from 'next/navigation'
import { exigerAccès } from '@/lib/auth/appartenance'
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
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const lettre = lettresPubliées(semaines).find(({ édition }) => édition.pageId === pageId)

  if (!lettre) notFound()

  return (
    <>
      <EntêteÉcran
        surtitre={lettre.édition.veille ?? 'lettre'}
        titre={lettre.semaine.libellé}
        état={lettre.édition.numéro !== null ? `n° ${lettre.édition.numéro}` : undefined}
      />

      <p className="mt-5">
        <LienFlèche href={`/${accès.slug}/lettres`}>Retour à toutes les lettres</LienFlèche>
      </p>

      <div className="mt-8">
        <Note édition={lettre.édition} />
      </div>
    </>
  )
}
