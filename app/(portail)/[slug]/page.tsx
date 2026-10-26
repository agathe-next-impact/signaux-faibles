import { exigerLecture } from '@/lib/auth/appartenance'
import { FinDEssai } from '@/components/fin-d-essai'
import { LigneDEssai, OffreDEssai, RetourDAbonnement } from '@/components/abonnement'
import { Case, EntêteÉcran, Grille, LienFlèche, Panneau, Tuile } from '@/components/coquille'
import { CaseAxe } from '@/components/case-axe'
import { LectureStratégique } from '@/components/lecture-strategique'
import { fusionnerLesAxes } from '@/lib/domaine/document'
import { enSlug } from '@/lib/domaine/slug'
import { ordonnerLesDossiers } from '@/lib/domaine/dossiers'
import { acteursEnVue } from '@/lib/domaine/mentions'
import { trierParImpact } from '@/lib/domaine/impact'
import { écart, synthétiser } from '@/lib/domaine/synthese'
import {
  dernièresNotes,
  documentsDeLaSemaine,
  LETTRES_POUR_ACTUALITÉ,
  semainesPubliées,
} from '@/lib/portail/semaine'
import { contrôlerLeContrat, journaliserLeContrat } from '@/lib/portail/contrat'
import { lectureStratégiqueDeLEspace } from '@/lib/portail/strategie'

/**
 * Vue d'ensemble : ce que la semaine dit, en un écran.
 *
 * Deux angles, et les deux lettres de la semaine réunies dans chacun. La
 * séparation ne se fait pas par lettre — le lecteur n'a pas à savoir laquelle
 * a relevé quoi — mais par nature de ce qui est suivi : des **acteurs**
 * nommés d'un côté, les **axes** de l'écosystème de l'autre.
 *
 * Les chiffres se déduisent des mêmes lectures, jamais d'une donnée inventée.
 * La comparaison porte sur la semaine précédente, deux lectures de blocs de
 * plus — c'est ce qui fait la valeur d'un tableau de bord, et le cache
 * l'absorbe.
 */

/** Au-delà, la page s'allonge sans rien apprendre : le suivi complet est sur l'écran Acteurs. */
const ACTEURS_EN_ACCUEIL = 6

export default async function VueDEnsemble({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ abonnement?: string | string[] }>
}) {
  const { slug } = await params
  const { accès, lecture, étape, offre } = await exigerLecture(slug)
  const brut = (await searchParams).abonnement
  const retour = typeof brut === 'string' ? brut : undefined
  const essai = étape?.étape === 'essai' ? étape : null

  // Fin d'essai (palier 1c) : le tableau de bord assemble des passages de
  // plusieurs lettres, il n'est donc montré qu'en lecture complète.
  if (lecture !== 'complète') {
    return (
      <FinDEssai
        slug={accès.slug}
        lecture={lecture}
        suspenduAlaMain={étape?.étape === 'suspendue' && étape.manuelle}
        retour={retour}
        offre={offre ?? 'standard'}
      />
    )
  }

  const semaines = await semainesPubliées(accès.organisationId)
  const courante = semaines[0]

  if (!courante) {
    return (
      <>
        <EntêteÉcran surtitre="veille personnalisée" titre="Vue d’ensemble" />
        <p className="mt-8 text-ardoise">
          Dès que la première lettre sera envoyée, elle apparaîtra ici. Si vous en avez
          déjà reçu, dites-le nous : votre espace n’est peut-être pas encore relié à vos
          éditions.
        </p>
      </>
    )
  }

  // Les trois dernières lettres servent à filtrer les acteurs. Ce sont les
  // mêmes pages que les deux appels voisins pour l'essentiel : le cache les
  // sert, aucune requête Notion de plus.
  const [documents, documentsPrécédents, récentes] = await Promise.all([
    documentsDeLaSemaine(courante),
    documentsDeLaSemaine(semaines[1]),
    dernièresNotes(semaines, LETTRES_POUR_ACTUALITÉ),
  ])

  const synthèse = synthétiser(
    documents,
    courante.éditions.map((édition) => édition.dossiersOuvertsBruts),
  )
  const précédente = semaines[1]
    ? synthétiser(
        documentsPrécédents,
        semaines[1].éditions.map((édition) => édition.dossiersOuvertsBruts),
      )
    : null

  // Les deux lettres réunies : un axe ouvert par les deux ne fait qu'une case.
  const axes = trierParImpact(fusionnerLesAxes(documents))

  // Un dossier qui dort n'occupe pas une case de l'accueil pour ne rien
  // apprendre. Il n'est pas perdu : l'écran Acteurs porte le suivi entier.
  const acteurs = ordonnerLesDossiers(
    acteursEnVue(
      synthèse.dossiers,
      récentes.map((note) => note.document),
    ),
  )
  const dormants = synthèse.dossiers.length - acteurs.length

  // Les outils stratégiques (pilote du 26 octobre 2026) : les étiquettes des
  // lettres que l'écran vient de lire, sans lecture Notion de plus. Hors du
  // pilote, ou dans le moindre doute sur la base, la section n'existe pas.
  const stratégie = await lectureStratégiqueDeLEspace({
    registre: accès.organisationId,
    lettres: récentes.map((note) => ({ pageId: note.lettre.édition.pageId, document: note.document })),
  })

  // Le portail ne devine pas un format qu'il ne reconnaît pas — mais il ne doit
  // pas se taire non plus. Deux lettres complètes et publiées peuvent donner un
  // tableau de bord vide sans que rien ne casse : c'est arrivé le 11 septembre
  // 2026 sur le Pays de Mauriac. Ces lignes de journal nomment l'écart ;
  // l'écran, lui, ne change pas.
  journaliserLeContrat(
    accès.slug,
    contrôlerLeContrat({
      axes: axes.length,
      notes: documents.length,
      dossiers: synthèse.dossiers,
    }),
  )

  const actions = courante.éditions
    .map((édition) => édition.actionDeLaSemaine)
    .filter((action) => action.length > 0)

  return (
    <>
      <EntêteÉcran
        surtitre="veille personnalisée"
        titre="Vue d’ensemble"
        état={`à jour · ${courante.libellé}`}
      />

      {essai ? (
        <div className="mt-2">
          <LigneDEssai parution={essai.parution} parutions={essai.parutions} />
        </div>
      ) : null}
      {retour ? (
        <div className="mt-6 max-w-prose">
          <RetourDAbonnement motif={retour} />
        </div>
      ) : null}

      <div className="mt-6">
        <Grille étiquette="Chiffres de la semaine" colonnes={4}>
          <Tuile
            intitulé="axes suivis"
            valeur={synthèse.axesTotal}
            mention={écart(synthèse.axesTotal, précédente?.axesTotal ?? null)}
          />
          <Tuile
            intitulé="signal fort"
            valeur={synthèse.parNiveau.FORT}
            mention={écart(synthèse.parNiveau.FORT, précédente?.parNiveau.FORT ?? null)}
            accent={synthèse.parNiveau.FORT > 0}
          />
          <Tuile
            intitulé="acteurs suivis"
            valeur={synthèse.dossiers.length}
            mention={écart(synthèse.dossiers.length, précédente?.dossiers.length ?? null)}
          />
          <Tuile
            intitulé="sans mouvement"
            valeur={synthèse.dossiersEnAttente}
            mention={`sur ${synthèse.dossiers.length} acteurs`}
          />
        </Grille>
      </div>

      {actions.length > 0 ? (
        <div className="mt-6">
          <Panneau ton="ardoise">
            <h2 className="label-mono text-ardoise">Action de la semaine</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {actions.map((action) => (
                <li key={action} className="text-encre">
                  {action}
                </li>
              ))}
            </ul>
          </Panneau>
        </div>
      ) : null}

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">À la une</h2>
          <LienFlèche href={`/${accès.slug}/acteurs`}>Voir tout le suivi</LienFlèche>
        </div>
        <p className="text-ardoise">
          Les concurrents et les organisations du secteur dont les {LETTRES_POUR_ACTUALITÉ}{' '}
          dernières lettres ont quelque chose à dire.
        </p>
        {dormants > 0 ? (
          // Ce qui est écarté doit se dire : un compte muet laisserait croire
          // que la veille a cessé de suivre ces dossiers.
          <p className="label-mono text-ardoise">
            {dormants > 1
              ? `${dormants} autres acteurs sont suivis sans actualité récente`
              : '1 autre acteur est suivi sans actualité récente'}
          </p>
        ) : null}

        {acteurs.length === 0 ? (
          // Une section vide doit dire où aller. Une lettre peut nommer
          // beaucoup d'organisations sans qu'aucune soit ouverte comme dossier
          // suivi : c'est le cas des lettres reprises d'un dispositif
          // antérieur, dont la propriété de suivi est vide.
          <div className="flex flex-col gap-3">
            <p className="text-ardoise">
              {synthèse.dossiers.length === 0
                ? 'Aucun dossier n’est ouvert cette semaine. Les organisations citées par vos lettres y restent lisibles.'
                : 'Aucun acteur suivi n’a d’actualité dans les dernières lettres. Le suivi complet reste sur l’écran Acteurs.'}
            </p>
            <p>
              <LienFlèche href={`/${accès.slug}/lettres`}>Lire les lettres</LienFlèche>
            </p>
          </div>
        ) : (
          <Grille étiquette="Acteurs suivis" colonnes={3}>
            {acteurs.slice(0, ACTEURS_EN_ACCUEIL).map((acteur) => (
              // Aucun badge d'impact ici : le fond accentué est donc permis, et
              // signale l'acteur qui vient de bouger.
              <Case key={acteur.nom} accent={acteur.compteur === 0}>
                <h3 className="font-titre text-h3 font-semibold text-encre">{acteur.nom}</h3>
                {/* La précision du dossier d'abord — c'est la formule de la
                    veille. À défaut, la phrase de la lettre qui le nomme : la
                    moitié des dossiers réels n'ont pas de précision, et leur
                    case n'apprenait rien. */}
                {acteur.précision ?? acteur.extrait ? (
                  <p className="text-ardoise">{acteur.précision ?? acteur.extrait}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="label-mono text-ardoise">
                    {acteur.compteur === null
                      ? 'suivi'
                      : acteur.compteur === 0
                        ? 'a bougé cette semaine'
                        : `${acteur.compteur} semaine${acteur.compteur > 1 ? 's' : ''} sans mouvement`}
                  </p>
                  <LienFlèche
                    href={`/${accès.slug}/acteurs/${enSlug(acteur.nom)}`}
                    étendu
                  >
                    Détail
                  </LienFlèche>
                </div>
              </Case>
            ))}
          </Grille>
        )}
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-titre text-h2 font-bold text-encre">L’écosystème</h2>
          <LienFlèche href={`/${accès.slug}/axes`}>Voir tous les axes</LienFlèche>
        </div>
        <p className="text-ardoise">
          Les axes de la semaine, les deux lettres réunies, du signal le plus fort au plus
          calme.
        </p>

        {axes.length === 0 ? (
          <p className="text-ardoise">Les notes de cette semaine ne portent pas d’axe.</p>
        ) : (
          <Grille étiquette="Axes de la semaine">
            {axes.map((axe) => (
              <CaseAxe
                key={axe.titre}
                axe={axe}
                points={axe.points}
                href={`/${accès.slug}/axes/${enSlug(axe.titre)}`}
              />
            ))}
          </Grille>
        )}
      </section>

      {stratégie ? <LectureStratégique lecture={stratégie} lettres={récentes.length} /> : null}

      {essai ? (
        <OffreDEssai slug={accès.slug} parution={essai.parution} parutions={essai.parutions} offre={offre ?? 'standard'} />
      ) : null}
    </>
  )
}
