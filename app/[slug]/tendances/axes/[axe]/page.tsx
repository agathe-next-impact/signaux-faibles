import { notFound } from 'next/navigation'
import { exigerAccès } from '@/lib/auth/appartenance'
import { BadgeImpact } from '@/components/badge-impact'
import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { RenduBlocs } from '@/components/document'
import { TitreAxe } from '@/components/titre-axe'
import { axesDuDocument } from '@/lib/domaine/document'
import { enSlug } from '@/lib/domaine/slug'
import { dernièresNotes, LETTRES_SUIVIES, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Un axe, suivi sur les dernières lettres.
 *
 * C'est le seul écran qui lit plusieurs corps de notes d'affilée : quatre, le
 * plafond posé par `LETTRES_SUIVIES`. Remonter toute l'archive serait une
 * requête Notion par édition, et le débit de trois par seconde ne le permet
 * pas. Ces quatre lectures sont les mêmes entrées de cache que celles des
 * autres écrans, qui lisent déjà les lettres récentes.
 *
 * L'axe est retrouvé par le segment d'URL, comparé aux axes des lettres **déjà
 * filtrées** de l'organisation. Un segment inconnu est introuvable ; aucun
 * identifiant venu de l'URL n'atteint Notion.
 */
export default async function UnAxe({
  params,
}: {
  params: Promise<{ slug: string; axe: string }>
}) {
  const { slug, axe: segment } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const notes = await dernièresNotes(semaines)

  const passages = notes.flatMap(({ lettre, document }) => {
    const axe = axesDuDocument(document).find(
      (candidat) => enSlug(candidat.titre) === segment,
    )
    return axe ? [{ lettre, axe }] : []
  })

  const premier = passages[0]
  if (!premier) notFound()

  return (
    <>
      <EntêteÉcran
        surtitre="axe suivi"
        titre={<TitreAxe axe={premier.axe} />}
        état={`${passages.length} lettre${passages.length > 1 ? 's' : ''} sur ${LETTRES_SUIVIES}`}
      />

      <p className="mt-5">
        <LienFlèche href={`/${accès.slug}/tendances`}>Retour aux tendances</LienFlèche>
      </p>

      {passages.length < LETTRES_SUIVIES ? (
        <div className="mt-6">
          <Panneau ton="ardoise">
            <p className="text-encre">
              Cet axe n’apparaît pas dans toutes les lettres récentes. Une lettre qui ne
              l’ouvre pas n’est pas une absence de signal : c’est un sujet que la semaine
              n’a pas eu à traiter.
            </p>
          </Panneau>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
        {passages.map(({ lettre, axe }) => (
          <section key={lettre.édition.pageId} className="flex flex-col gap-4 py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="label-mono text-ardoise">
                  {lettre.édition.veille ?? 'veille'}
                  {lettre.édition.numéro !== null ? ` · n° ${lettre.édition.numéro}` : ''}
                </p>
                <h2 className="font-titre text-h3 font-semibold text-encre">
                  {lettre.semaine.libellé}
                </h2>
              </div>
              <BadgeImpact niveau={axe.niveau} />
            </div>

            {axe.blocs.length > 0 ? (
              <RenduBlocs blocs={axe.blocs} />
            ) : (
              <p className="text-ardoise">
                L’axe est ouvert cette semaine-là, sans développement.
              </p>
            )}

            <p>
              <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                Lire la lettre entière
              </LienFlèche>
            </p>
          </section>
        ))}
      </div>
    </>
  )
}
