import Link from 'next/link'
import { exigerAccès } from '@/lib/auth/appartenance'
import { listerÉditionsPubliées } from '@/lib/notion/editions'
import { regrouperParSemaine } from '@/lib/domaine/semaines'

/**
 * L'archive liste des semaines, pas des éditions.
 *
 * Une semaine qui n'a reçu qu'une note s'affiche telle quelle, sans
 * emplacement vide ; une semaine qui en a reçu trois les montre toutes. Les
 * semaines de juillet 2026, où le rythme était quasi quotidien, sont donc plus
 * fournies : c'est fidèle à ce qui a été envoyé.
 */
export default async function Archives({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = regrouperParSemaine(await listerÉditionsPubliées(accès.organisationId))

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-titre text-h1 font-bold text-encre">Archives</h1>

      {semaines.length === 0 ? (
        <p className="text-ardoise">Aucune édition archivée pour l’instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gris-ligne">
          {semaines.map((semaine) => (
            <li key={semaine.clé} className="py-3">
              <Link
                href={`/${accès.slug}/semaines/${semaine.clé}`}
                className="flex flex-col gap-1"
              >
                <span className="text-encre">{semaine.libellé}</span>
                <span className="font-mono text-label text-ardoise">
                  {semaine.éditions
                    .map((édition) => édition.veille ?? 'veille')
                    .join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
