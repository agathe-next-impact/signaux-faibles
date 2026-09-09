import { notFound } from 'next/navigation'
import { exigerAccès } from '@/lib/auth/appartenance'
import { listerÉditionsPubliées } from '@/lib/notion/editions'
import { regrouperParSemaine } from '@/lib/domaine/semaines'
import { Note } from '@/components/note'

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

  const semaines = regrouperParSemaine(await listerÉditionsPubliées(accès.organisationId))
  const semaine = semaines.find((candidate) => candidate.clé === clé)

  if (!semaine) notFound()

  return (
    <>
      <h1 className="font-titre text-2xl text-encre">{semaine.libellé}</h1>
      {semaine.éditions.map((édition) => (
        <Note key={édition.pageId} édition={édition} />
      ))}
    </>
  )
}
