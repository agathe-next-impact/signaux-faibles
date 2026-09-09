import Link from 'next/link'
import { exigerAccès } from '@/lib/auth/appartenance'
import { listerÉditionsPubliées } from '@/lib/notion/editions'
import { regrouperParSemaine } from '@/lib/domaine/semaines'
import { Note } from '@/components/note'

/**
 * La semaine la plus récente.
 *
 * Une entrée par semaine, qui rassemble les notes de la semaine — pas deux
 * entrées concurrentes pour les deux veilles. Le regroupement se fait ici,
 * après la requête filtrée, et jamais par une requête Notion par semaine.
 */
export default async function CetteSemaine({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const éditions = await listerÉditionsPubliées(accès.organisationId)
  const semaines = regrouperParSemaine(éditions)
  const dernière = semaines[0]

  if (!dernière) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-titre text-h1 font-bold text-encre">Pas encore d’édition</h1>
        <p className="text-ardoise">
          Dès que la première lettre sera envoyée, elle apparaîtra ici.
        </p>
      </section>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-titre text-h1 font-bold text-encre">{dernière.libellé}</h1>
        {semaines.length > 1 ? (
          <Link
            href={`/${accès.slug}/semaines`}
            className="text-corps text-ardoise hover:text-encre"
          >
            {semaines.length - 1} semaine
            {semaines.length - 1 > 1 ? 's' : ''} en archive
          </Link>
        ) : null}
      </div>

      {dernière.éditions.map((édition) => (
        <Note key={édition.pageId} édition={édition} />
      ))}
    </>
  )
}
