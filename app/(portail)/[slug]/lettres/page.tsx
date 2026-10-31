import { redirect } from 'next/navigation'
import { exigerLecture } from '@/lib/auth/appartenance'
import { BadgeImpact } from '@/components/badge-impact'
import { Case, EntêteÉcran, Grille, LienFlèche } from '@/components/coquille'
import { Fraicheur } from '@/components/fraicheur'
import { TitreAxe } from '@/components/titre-axe'
import { axesÀRetenir, suivreLesAxes, type AxeÀRetenir } from '@/lib/domaine/tendances'
import { lettresPubliées, notesDeLaSemaine, semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Lettres : la grille de tout ce qui a été envoyé.
 *
 * Une case par lettre, et non par semaine — c'est la différence avec les
 * archives. Deux lettres paraissent chaque semaine, une par veille ; on trouve
 * ici celle que l'on cherche sans passer par la semaine qui la porte.
 *
 * Cet écran ne lit **aucun corps de note** : tout vient de la liste des
 * éditions, déjà filtrée et cachée. Une grille de cinquante lettres coûte donc
 * exactement autant qu'une grille vide.
 *
 * Dans l'espace réorganisé (31 octobre 2026, demande de l'opératrice), l'écran
 * appartient à la rubrique « Cette semaine » : il ne montre que les lettres de
 * la dernière semaine publiée, une carte par lettre sur une colonne, et renvoie
 * aux archives pour les semaines d'avant. Chaque carte dit, avant qu'on
 * l'ouvre, ses axes FORT et combien d'axes sont nouveaux ou en hausse depuis la
 * lettre de la même veille la semaine d'avant (31 octobre 2026) : les corps des
 * deux semaines, les mêmes entrées de cache que la vue d'ensemble. En lecture
 * réduite (fin d'essai), rien de tout cela : la carte ne doit rien dire de ce
 * que la lettre tronquée ne montre plus.
 */
export default async function Lettres({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { accès, lecture } = await exigerLecture(slug)
  if (lecture === 'aucune') redirect(`/${accès.slug}`)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  const réorganisé = espace?.réorganisé ?? false
  const lettres = lettresPubliées(réorganisé ? semaines.slice(0, 1) : semaines)
  const saillants = réorganisé && lecture === 'complète' ? await saillantsDeLaSemaine(semaines) : null

  return (
    <>
      <EntêteÉcran
        surtitre={réorganisé ? 'cette semaine' : 'lettres'}
        titre={réorganisé ? 'Les lettres de la semaine' : 'Toutes les lettres'}
        état={réorganisé && semaines[0] ? semaines[0].libellé : `${lettres.length} lettre${lettres.length > 1 ? 's' : ''}`}
      />

      {lettres.length === 0 ? (
        <p className="mt-8 text-ardoise">
          Aucune lettre publiée pour l’instant. Si vous en avez déjà reçu, dites-le nous :
          votre espace n’est peut-être pas encore relié à vos éditions.
        </p>
      ) : (
        <div className="mt-8">
          <Grille étiquette={réorganisé ? 'Lettres de la semaine' : 'Lettres publiées'} colonnes={réorganisé ? 1 : 3}>
            {lettres.map(({ édition, semaine }, rang) => (
              <Case key={édition.pageId} accent={!réorganisé && rang === 0}>
                <p className="label-mono text-ardoise">
                  {édition.veille ?? 'veille'}
                  {édition.numéro !== null ? ` · n° ${édition.numéro}` : ''}
                </p>
                <h2 className="font-titre text-h3 font-semibold text-encre">
                  {semaine.libellé}
                </h2>
                {édition.périodeCouverte ? (
                  <p className="text-ardoise">{édition.périodeCouverte}</p>
                ) : null}
                {saillants?.get(édition.pageId) ? <Saillants {...saillants.get(édition.pageId)!} /> : null}
                {lecture === 'complète' && édition.actionDeLaSemaine ? (
                  <p className="text-ardoise">{édition.actionDeLaSemaine}</p>
                ) : null}
                <div className="mt-auto pt-1">
                  <LienFlèche href={`/${accès.slug}/lettres/${édition.pageId}`} étendu>
                    {lecture === 'complète' ? 'Lire' : 'Lire l’essentiel'}
                  </LienFlèche>
                </div>
              </Case>
            ))}
          </Grille>
          {réorganisé && semaines.length > 1 ? (
            <p className="mt-8">
              <LienFlèche href={`/${accès.slug}/archives`}>Voir les semaines précédentes</LienFlèche>
            </p>
          ) : null}
        </div>
      )}
    </>
  )
}

type SaillantsDUneLettre = { readonly forts: readonly AxeÀRetenir[]; readonly nouveautés: number }

/** Pour chaque lettre de la dernière semaine, ses axes FORT et le compte de ce qui est nouveau ou en hausse. */
async function saillantsDeLaSemaine(semaines: Parameters<typeof lettresPubliées>[0]): Promise<ReadonlyMap<string, SaillantsDUneLettre>> {
  const [notes, précédentes] = await Promise.all([notesDeLaSemaine(semaines[0]), notesDeLaSemaine(semaines[1])])
  return new Map(
    notes.map(({ édition, document }) => {
      const avant = précédentes.find((n) => n.édition.veille === édition.veille)?.document ?? null
      const retenus = axesÀRetenir(suivreLesAxes([document], avant ? [avant] : []), { avecPrécédent: avant !== null, combien: 50 })
      return [édition.pageId, { forts: retenus.filter((a) => a.fort), nouveautés: retenus.filter((a) => a.nouveau).length }] as const
    }),
  )
}

/** Les points forts d'une carte : les axes FORT, nommés, puis le compte des nouveautés. */
function Saillants({ forts, nouveautés }: SaillantsDUneLettre) {
  if (forts.length === 0 && nouveautés === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {forts.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Signal fort">
          {forts.slice(0, 3).map((axe) => (
            <li key={axe.titre} className="flex flex-wrap items-center gap-2">
              <BadgeImpact niveau="FORT" />
              <TitreAxe axe={axe} className="text-encre" />
            </li>
          ))}
          {forts.length > 3 ? <li className="label-mono text-ardoise">et {forts.length - 3} autre{forts.length - 3 > 1 ? 's' : ''}</li> : null}
        </ul>
      ) : null}
      {nouveautés > 0 ? (
        <Fraicheur fraîcheur="nouveau" libellé={`${nouveautés} axe${nouveautés > 1 ? 's' : ''} nouveau${nouveautés > 1 ? 'x' : ''} ou en hausse`} />
      ) : null}
    </div>
  )
}
