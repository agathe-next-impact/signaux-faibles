import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { CaseAxe } from '@/components/case-axe'
import { EntêteÉcran, Grille, LienFlèche } from '@/components/coquille'
import { LégendeFraicheur } from '@/components/fraicheur'
import { fraîcheurDUnAxe, rangDeFraîcheur } from '@/lib/domaine/fraicheur'
import { enSlug } from '@/lib/domaine/slug'
import { libelléDeMouvement, suivreLesAxes } from '@/lib/domaine/tendances'
import { notesDeLaSemaine, semainesPubliées } from '@/lib/portail/semaine'
import { pestelDeLEspace } from '@/lib/portail/strategie'
import { Onglets } from '@/components/onglets'
import { VuePestel } from '@/components/strategie-ecrans'

/**
 * Les axes : où en est chaque axe de la veille, et ce qui a bougé.
 *
 * Cet écran ne porte **que** les axes. Le suivi des dossiers vivait ici aussi,
 * sous le nom de « tendances » ; les deux ont été séparés le 11 septembre 2026.
 * Ils répondent à deux questions différentes — « de quoi parle la veille » et
 * « qui bouge » —, ils se lisent à des moments différents, et surtout leur coût
 * n'a rien à voir : la grille ci-dessous demande les corps de la semaine
 * courante et de la précédente, le suivi des dossiers ne lit aucun corps. Les
 * empiler sur un même écran faisait payer le plus cher des deux à qui ne venait
 * chercher que l'autre.
 *
 * Ces corps sont les mêmes que ceux de la vue d'ensemble : les mêmes entrées de
 * cache, aucune requête Notion supplémentaire.
 */
export default async function LesAxes({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const semaines = await semainesPubliées(accès.organisationId)

  const [notes, notesPrécédentes] = await Promise.all([notesDeLaSemaine(semaines[0]), notesDeLaSemaine(semaines[1])])
  const documents = notes.map((n) => n.document)
  const documentsPrécédents = notesPrécédentes.map((n) => n.document)
  // L'onglet PESTEL (pilote des outils stratégiques, lot 11) : les étiquettes
  // des treize dernières semaines, et les phrases-titres des lettres déjà lues
  // ci-dessus. Aucune lecture Notion de plus ; hors du pilote, pas d'onglet.
  const fin = semaines[0]?.éditions.map((é) => é.dateÉdition).sort().at(-1)
  const pestel = fin
    ? await pestelDeLEspace({
        registre: accès.organisationId,
        fin,
        lettres: [...notes, ...notesPrécédentes].map((n) => ({ pageId: n.édition.pageId, document: n.document })),
      })
    : null
  // `suivreLesAxes` rend les axes triés par impact. On les regroupe par
  // fraîcheur SANS toucher à cet ordre : le tri est stable, l'impact continue
  // donc de classer à l'intérieur de chaque groupe. Ce qui a du neuf d'abord,
  // et à neuf égal, le signal le plus fort.
  const axes = [...suivreLesAxes(documents, documentsPrécédents)].sort(
    (a, b) => rangDeFraîcheur(fraîcheurDUnAxe(a)) - rangDeFraîcheur(fraîcheurDUnAxe(b)),
  )
  const comparable = semaines.length > 1
  const avecNouveauté = axes.filter((axe) => fraîcheurDUnAxe(axe) === 'nouveau').length

  const parAxe = (
    <section className="mt-8 flex flex-col gap-4">
      {axes.length === 0 ? (
        <p className="text-ardoise">
          Les notes de cette semaine ne portent pas d’axe. La grille se remplira à la
          prochaine parution.
        </p>
      ) : (
        <Grille étiquette="Axes de la semaine">
          {axes.map((axe) => (
            <CaseAxe
              key={axe.titre}
              axe={axe}
              points={axe.points}
              // Sans semaine précédente, tout serait « nouveau » : on se tait
              // plutôt que d'annoncer un mouvement qui n'existe pas.
              fraîcheur={
                comparable
                  ? {
                      état: fraîcheurDUnAxe(axe),
                      libellé: libelléDeMouvement(axe.mouvement),
                    }
                  : null
              }
              href={`/${accès.slug}/axes/${enSlug(axe.titre)}`}
            />
          ))}
        </Grille>
      )}
    </section>
  )

  return (
    <>
      <EntêteÉcran
        surtitre="écosystème"
        titre="Les axes"
        état={
          comparable ? 'comparés à la semaine précédente' : 'première semaine observée'
        }
      />

      <p className="mt-5 text-ardoise">
        Les sections thématiques des lettres de la semaine, réunies. Ce qui a du nouveau
        vient en premier, et à fraîcheur égale le signal le plus fort.{' '}
        {axes.length > 0
          ? avecNouveauté > 0
            ? `${avecNouveauté} ${avecNouveauté > 1 ? 'axes ont' : 'axe a'} du nouveau cette semaine.`
            : 'Aucun axe n’a de nouveauté cette semaine.'
          : ''}{' '}
        Chaque case ouvre le suivi de son axe sur les dernières lettres.
      </p>

      <div className="mt-5">
        <LégendeFraicheur />
      </div>

      {pestel ? (
        <div className="mt-8">
          <Onglets
            étiquette="Lecture des axes"
            ancre
            panneaux={[
              { clé: 'par-axe', libellé: 'Par axe', contenu: parAxe },
              { clé: 'pestel', libellé: 'PESTEL', contenu: <VuePestel vue={pestel} /> },
            ]}
          />
        </div>
      ) : (
        parAxe
      )}

      <p className="mt-8">
        <LienFlèche href={`/${accès.slug}/acteurs`}>
          Voir les acteurs et les concurrents suivis
        </LienFlèche>
      </p>
    </>
  )
}
