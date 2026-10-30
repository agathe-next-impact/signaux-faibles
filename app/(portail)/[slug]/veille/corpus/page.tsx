import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { enSlug } from '@/lib/domaine/slug'
import { ficheDeLEspace } from '@/lib/portail/fiche-veille'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/** Une liste de noms en colonnes ; `slug` donné, chaque nom mène à la fiche du concurrent. */
function Liste({ noms, slug }: { noms: readonly string[]; slug?: string }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {noms.map((nom) => (
        <li key={nom} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 bg-ardoise" />
          {slug ? (
            <Link href={`/${slug}/concurrents/${enSlug(nom)}`} className="text-encre underline decoration-gris-ligne underline-offset-2 hover:decoration-encre">
              {nom}
            </Link>
          ) : (
            <span className="text-encre">{nom}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Corpus (lot 6, 30 octobre 2026) : qui suivez-vous. Les entités de la grille,
 * concurrents (chacun menant à sa fiche) et acteurs de l'écosystème, les parties
 * prenantes, et les variables qui placent les concurrents sur la carte. Tout
 * vient de la grille, déjà en base : rien n'attend la fiche de veille. Aucune
 * lecture Notion ; 404 hors de l'espace réorganisé.
 */
export default async function Corpus({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const lue = espace ? await ficheDeLEspace({ registre: accès.organisationId }) : null
  const grille = lue?.grille ?? null
  // Les concurrents de la grille, l'organisation exclue : `espaceDeLOrganisation` les a déjà.
  const concurrents = grille ? (espace?.concurrents ?? []) : []
  const écosystème = grille ? grille.entités.filter((e) => e.veille === 'ecosysteme') : []

  return (
    <>
      <EntêteÉcran surtitre="votre veille" titre="Qui nous suivons" état={grille ? `${grille.entités.length} entités` : undefined} />
      {!grille ? (
        <p className="mt-5 text-ardoise">Le corpus de votre veille ne peut pas être affiché pour l’instant. Réessayez dans quelques minutes.</p>
      ) : (
        <>
          <p className="mt-5 max-w-[68ch] text-ardoise">Les entités que votre veille suit nommément, et les parties prenantes dont elle lit le pouvoir et l’intérêt. Un concurrent mène à sa fiche.</p>
          <section className="mt-8 flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">Concurrents suivis</h2>
            {concurrents.length > 0 ? <Liste noms={concurrents} slug={accès.slug} /> : <p className="text-ardoise">Aucun concurrent nommé dans votre veille.</p>}
          </section>
          {grille.axesGroupes.length > 0 ? (
            <section className="mt-8 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Ce qui les place sur la carte</h2>
              <dl className="grid grid-cols-1 border-t border-l border-gris-ligne sm:grid-cols-2">
                {grille.axesGroupes.map((a) => (
                  <div key={a.clé} className="flex flex-col gap-1.5 border-r border-b border-gris-ligne p-4">
                    <dt className="label-mono text-encre">{a.libellé}</dt>
                    <dd className="text-sm text-ardoise">{a.crans.map((c, i) => `${i + 1} · ${c}`).join('  ·  ')}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          {écosystème.length > 0 ? (
            <section className="mt-8 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Acteurs de votre environnement</h2>
              <Liste noms={écosystème.map((e) => e.nom)} />
            </section>
          ) : null}
          {grille.partiesPrenantes.length > 0 ? (
            <section className="mt-8 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Parties prenantes</h2>
              <Liste noms={grille.partiesPrenantes.map((p) => p.nom)} />
              <p>
                <LienFlèche href={`/${accès.slug}/acteurs`}>Voir leur pouvoir et leur intérêt</LienFlèche>
              </p>
            </section>
          ) : null}
        </>
      )}
      <p className="mt-10">
        <LienFlèche href={`/${accès.slug}/concurrents`}>Voir la carte des concurrents</LienFlèche>
      </p>
    </>
  )
}
