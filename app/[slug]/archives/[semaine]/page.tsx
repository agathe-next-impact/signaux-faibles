import { notFound } from 'next/navigation'
import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { Note } from '@/components/note'
import { semainesPubliées } from '@/lib/portail/semaine'

/**
 * Une semaine archivée, avec les notes qu'elle porte.
 *
 * La semaine demandée est cherchée dans la liste **déjà filtrée** de
 * l'organisation : une clé qui n'y figure pas est introuvable, y compris quand
 * elle existe chez un autre client.
 */
export default async function UneSemaine({
  params,
}: {
  params: Promise<{ slug: string; semaine: string }>
}) {
  const { slug, semaine: clé } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const semaine = semaines.find((candidate) => candidate.clé === clé)

  if (!semaine) notFound()

  return (
    <>
      <EntêteÉcran
        surtitre="archives"
        titre={semaine.libellé}
        état={`${semaine.éditions.length} note${semaine.éditions.length > 1 ? 's' : ''}`}
      />

      <p className="mt-5">
        <LienFlèche href={`/${accès.slug}/archives`}>Retour à toutes les semaines</LienFlèche>
      </p>

      <div className="mt-8 flex flex-col gap-12">
        {semaine.éditions.map((édition) => (
          <Note key={édition.pageId} édition={édition} />
        ))}
      </div>
    </>
  )
}
