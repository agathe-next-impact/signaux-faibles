import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { AnneauDuCorpus } from '@/components/graphiques-strategie'
import { segmentDEntité } from '@/lib/domaine/fiche-veille'
import { ficheDeLEspace } from '@/lib/portail/fiche-veille'
import { vocabulaireDuMarché } from '@/lib/domaine/sujets-du-marche'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/** Une liste de noms en colonnes ; chaque nom mène à sa fiche de présentation (6 novembre 2026). */
function Liste({ noms, slug }: { noms: readonly string[]; slug: string }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
      {noms.map((nom) => (
        <li key={nom} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 bg-ardoise" />
          <Link href={`/${slug}/veille/corpus/${segmentDEntité(nom)}`} className="text-encre underline decoration-gris-ligne underline-offset-2 hover:decoration-encre">
            {nom}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * Corpus (lot 6, 30 octobre 2026) : qui suivez-vous. Les entités de la grille,
 * concurrents et acteurs de l'écosystème, les parties prenantes, chaque nom
 * menant à sa fiche de présentation (`/[slug]/veille/corpus/[entite]`, 6 novembre 2026), et les variables qui placent les concurrents sur la carte. Tout
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
  const partiesPrenantes = grille ? grille.partiesPrenantes.map((p) => p.nom) : []
  const marché = espace?.marché ?? vocabulaireDuMarché(null)

  return (
    <>
      <EntêteÉcran surtitre="votre veille" titre="Qui nous suivons" état={grille ? `${grille.entités.length} entités` : undefined} />
      {!grille ? (
        <p className="mt-6 text-ardoise">Le corpus de votre veille ne peut pas être affiché pour l’instant. Réessayez dans quelques minutes.</p>
      ) : (
        <>
          <p className="mt-6 max-w-[68ch] text-ardoise">Les entités que votre veille suit nommément, et les parties prenantes dont elle lit le pouvoir et l’intérêt. Chaque nom ouvre sa fiche de présentation.</p>
          <div className="mt-6">
            <AnneauDuCorpus concurrents={concurrents.length} écosystème={écosystème.length} partiesPrenantes={grille.partiesPrenantes.length} libelléDesConcurrents={marché.écran} />
          </div>
          <section className="mt-8 flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">{marché.corpus}</h2>
            {concurrents.length > 0 ? <Liste noms={concurrents} slug={accès.slug} /> : <p className="text-ardoise">{marché.aucun}</p>}
          </section>
          {grille.axesGroupes.length > 0 ? (
            <section className="mt-8 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Ce qui les place sur la carte</h2>
              <dl className="grid grid-cols-1 border-t border-l border-gris-ligne sm:grid-cols-2">
                {grille.axesGroupes.map((a) => (
                  <div key={a.clé} className="flex flex-col gap-2 border-r border-b border-gris-ligne p-4">
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
              <Liste noms={écosystème.map((e) => e.nom)} slug={accès.slug} />
            </section>
          ) : null}
          {partiesPrenantes.length > 0 ? (
            <section className="mt-8 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Parties prenantes</h2>
              <Liste noms={partiesPrenantes} slug={accès.slug} />
              <p>
                <LienFlèche href={`/${accès.slug}/acteurs`}>Voir leur pouvoir et leur intérêt</LienFlèche>
              </p>
            </section>
          ) : null}
        </>
      )}
      <p className="mt-12">
        <LienFlèche href={`/${accès.slug}/concurrents`}>{marché.voir}</LienFlèche>
      </p>
    </>
  )
}
