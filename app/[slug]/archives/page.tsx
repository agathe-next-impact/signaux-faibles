import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { semainesPubliées } from '@/lib/portail/semaine'

/**
 * Archives : une entrée par semaine, jamais par édition.
 *
 * Une semaine qui n'a reçu qu'une note s'affiche telle quelle, sans emplacement
 * vide ; une semaine qui en a reçu trois les montre toutes. Les semaines de
 * juillet 2026, où le rythme était quasi quotidien, sont donc plus fournies :
 * c'est fidèle à ce qui a été envoyé.
 */
export default async function Archives({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)

  return (
    <>
      <EntêteÉcran
        surtitre="archives"
        titre="Toutes les semaines"
        état={`${semaines.length} semaine${semaines.length > 1 ? 's' : ''}`}
      />

      {semaines.length === 0 ? (
        <p className="mt-8 text-ardoise">Aucune édition archivée pour l’instant.</p>
      ) : (
        <ul className="mt-8 flex flex-col divide-y divide-gris-ligne">
          {semaines.map((semaine) => (
            <li key={semaine.clé} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
              <div className="flex flex-col gap-1">
                <span className="text-encre">{semaine.libellé}</span>
                <span className="label-mono text-ardoise">
                  {semaine.éditions.map((édition) => édition.veille ?? 'veille').join(' · ')}
                </span>
              </div>
              <LienFlèche href={`/${accès.slug}/archives/${semaine.clé}`}>Relire</LienFlèche>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
