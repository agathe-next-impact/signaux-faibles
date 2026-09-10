import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { Note } from '@/components/note'
import { semainesPubliées } from '@/lib/portail/semaine'

/**
 * Signaux : les notes de la semaine, en entier.
 *
 * C'est l'écran de lecture. Une entrée par semaine, qui rassemble les notes de
 * la parution — la décision du 9 septembre 2026 — et non deux entrées
 * concurrentes pour les deux veilles.
 */
export default async function Signaux({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const courante = semaines[0]

  return (
    <>
      <EntêteÉcran
        surtitre="signaux"
        titre={courante ? courante.libellé : 'Signaux'}
        état={courante ? `${courante.éditions.length} note${courante.éditions.length > 1 ? 's' : ''}` : undefined}
      />

      {!courante ? (
        <p className="mt-8 text-ardoise">Aucune note publiée pour l’instant.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-12">
          {courante.éditions.map((édition) => (
            <Note key={édition.pageId} édition={édition} />
          ))}
        </div>
      )}

      {semaines.length > 1 ? (
        <p className="mt-10 border-t border-gris-ligne pt-5">
          <LienFlèche href={`/${accès.slug}/archives`}>
            Voir les {semaines.length - 1} semaines précédentes
          </LienFlèche>
        </p>
      ) : null}
    </>
  )
}
