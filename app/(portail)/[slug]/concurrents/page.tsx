import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { CarteDesGroupes, ListeDesConcurrents } from '@/components/strategie-ecrans'
import { enSlug } from '@/lib/domaine/slug'
import { normaliserTitre } from '@/lib/domaine/strategie'
import { libelléDePériode } from '@/lib/domaine/strategie-vues'
import { suivreLesDossiers } from '@/lib/domaine/tendances'
import { semainesPubliées } from '@/lib/portail/semaine'
import { concurrentsDeLEspace, espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Les concurrents (lot 2 de `docs/proposition-reorganisation-espace.md`,
 * 30 octobre 2026) : qui dispute ses clients à l'organisation. La carte des
 * groupes stratégiques de la dernière synthèse publiée, puis une case par
 * concurrent de la grille, qui mène à sa fiche.
 *
 * **Seulement pour un espace réorganisé** (pilote sur L'Hermitage) : ailleurs,
 * l'écran n'existe pas (404) et la carte reste sur « Acteurs ». Dans le doute
 * (base lente ou absente), l'écran le dit au lieu de répondre 404.
 *
 * Aucune lecture Notion de plus que la liste des éditions, déjà faite par le
 * rail : la carte, les crans et les comptes de faits viennent de Postgres, par
 * le registre de la session (règle 2).
 */
export default async function LesConcurrents({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const lus = espace ? await concurrentsDeLEspace({ registre: accès.organisationId }) : null

  const segments = new Map((lus?.vue.concurrents ?? []).map((c) => [normaliserTitre(c.nom), c.segment]))
  const dossiers = suivreLesDossiers(semaines).filter((d) => segments.has(normaliserTitre(d.nom)))
  const nombre = lus?.vue.concurrents.length ?? 0

  return (
    <>
      <EntêteÉcran
        surtitre="le marché"
        titre="Qui vous dispute vos clients"
        état={lus ? `${nombre} concurrent${nombre > 1 ? 's' : ''} suivi${nombre > 1 ? 's' : ''}` : undefined}
      />

      {!lus ? (
        <p className="mt-5 text-ardoise">
          Les concurrents ne peuvent pas être affichés pour l’instant. Réessayez dans quelques minutes ; les
          lettres et les autres écrans restent ouverts.
        </p>
      ) : (
        <>
          <p className="mt-5 max-w-[68ch] text-ardoise">
            Les concurrents que votre veille suit, placés sur les deux axes retenus avec vous
            {lus.période ? `, synthèse ${libelléDePériode(lus.période)}` : ''}.{' '}
            {lus.vue.mouvements.length > 0
              ? `${lus.vue.mouvements.length} ${lus.vue.mouvements.length > 1 ? 'ont changé de case' : 'a changé de case'} depuis la synthèse précédente.`
              : 'Aucun n’a changé de case depuis la synthèse précédente.'}
            {lus.vue.nonPlacés > 0 ? ` ${lus.vue.nonPlacés} ne sont pas encore placés, faute de capacité ou de récit connus.` : ''}
          </p>

          {lus.carte && lus.carte.placés > 0 ? (
            <section className="mt-8 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Carte des groupes stratégiques</h2>
              <CarteDesGroupes
                carte={lus.carte}
                lien={(sujet) => {
                  const segment = segments.get(normaliserTitre(sujet))
                  return segment ? `/${accès.slug}/concurrents/${segment}` : null
                }}
              />
            </section>
          ) : null}

          <section className="mt-10 flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">Les concurrents suivis</h2>
            <p className="max-w-[68ch] text-ardoise">
              Ce qui a bougé d’abord, puis ceux dont les lettres parlent le plus. Chaque fiche réunit sa position,
              ses faits datés et ses chiffres publiés.
            </p>
            <ListeDesConcurrents slug={accès.slug} concurrents={lus.vue.concurrents} />
          </section>

          {dossiers.length > 0 ? (
            <section className="mt-10 flex flex-col gap-3">
              <h2 className="font-titre text-h2 font-bold text-encre">Dossiers ouverts sur un concurrent</h2>
              <ul className="flex flex-col gap-2">
                {dossiers.map((d) => (
                  <li key={d.nom} className="flex flex-wrap items-baseline gap-x-3">
                    <LienFlèche href={`/${accès.slug}/acteurs/${enSlug(d.nom)}`}>{d.nom}</LienFlèche>
                    {d.précisionActuelle ? <span className="text-ardoise">{d.précisionActuelle}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <div className="mt-10 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/acteurs`}>Voir les autres acteurs : institutions, réseaux, parties prenantes</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/axes`}>Voir les axes de la veille</LienFlèche>
        </p>
      </div>
    </>
  )
}
