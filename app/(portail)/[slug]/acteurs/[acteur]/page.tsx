import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { exigerLÉcran } from '@/lib/portail/ecrans'
import { BadgeImpact } from '@/components/badge-impact'
import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { Texte } from '@/components/document'
import { Fraicheur } from '@/components/fraicheur'
import { fraîcheurDUnDossier } from '@/lib/domaine/fraicheur'
import { SurtitreAxe } from '@/components/titre-axe'
import { mentionsDe } from '@/lib/domaine/mentions'
import { enSlug } from '@/lib/domaine/slug'
import { suivreLesDossiers } from '@/lib/domaine/tendances'
import { dernièresNotes, LETTRES_SUIVIES, lettresPubliées, semainesDeLEspace } from '@/lib/portail/semaine'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { ficheDeLActeur } from '@/lib/portail/fiche-veille'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'
import { faitsDeLaLettre } from '@/lib/domaine/strategie'
import { formesDuNom, rattacherAuxActeurs } from '@/lib/domaine/dossiers-des-acteurs'
import { FicheDUnActeur, type PassagesDUneLettre } from '@/components/fiche-acteur'

/**
 * L'écran d'un acteur, ou à défaut celui d'un dossier ouvert.
 *
 * **Un acteur** (18 novembre 2026, demande de l'opératrice) est un sujet placé
 * par une synthèse publiée, Mendelow ou carte des groupes, ou un nom de la
 * grille. Son écran réunit sa présentation, sa position et son historique, ses
 * faits datés, les énoncés des synthèses qui le concernent, les dossiers qui le
 * nomment et les passages des dernières lettres qui le nomment
 * (`ficheDeLActeur`, `lib/domaine/fiche-acteur.ts`). Le segment n'est comparé
 * qu'aux noms de l'organisation de la session. Hors du pilote des outils, ou si
 * la lecture n'aboutit pas, l'écran retombe sur le dossier de même nom.
 *
 * **Un dossier** ouvert n'a pas de contenu propre dans Notion : c'est une entrée
 * texte, un nom et un compteur. Cette page l'assemble à partir de deux sources
 * de coûts très différents. Le **suivi** ne lit aucun corps de note — il vient
 * de la propriété texte des éditions, et couvre toute l'archive pour la seule
 * requête de liste. Les **mentions** demandent le corps des quatre dernières
 * lettres, les mêmes entrées de cache que la page d'un axe.
 *
 * L'acteur est retrouvé par le segment d'URL, comparé aux dossiers des lettres
 * **déjà filtrées** de l'organisation. Un segment inconnu est introuvable ;
 * aucun identifiant venu de l'URL n'atteint Notion.
 */
export default async function UnActeur({
  params,
}: {
  params: Promise<{ slug: string; acteur: string }>
}) {
  const { slug, acteur: segment } = await params
  const accès = await exigerLectureComplète(slug)
  await exigerLÉcran(accès, 'acteurs')

  const [semaines, espace] = await Promise.all([semainesDeLEspace(accès), espaceDeLOrganisation(accès.organisationId)])
  const dossiers = suivreLesDossiers(semaines)
  const suivi = dossiers.find((dossier) => enSlug(dossier.nom) === segment)

  // Les numéros des lettres déjà listées pour l'organisation, par identifiant normalisé (règle 2).
  const lettres = lettresPubliées(semaines)
  const numéros = new Map(lettres.flatMap((l) => (l.édition.numéro !== null ? [[normaliserIdentifiant(l.édition.pageId), l.édition.numéro] as const] : [])))
  const lue = await ficheDeLActeur({ registre: accès.organisationId, segment, numéros })

  if (lue?.sorte === 'fiche') {
    const { fiche } = lue
    const notes = await dernièresNotes(semaines)
    // Les phrases-titres des faits, relues dans les lettres que l'écran lit déjà, par empreinte.
    const titres = new Map(
      notes.flatMap(({ lettre, document }) =>
        faitsDeLaLettre(document).map((f) => [`${normaliserIdentifiant(lettre.édition.pageId)}:${f.empreinte}`, f.titre] as const),
      ),
    )
    // Un nom d'acteur se cherche sous ses formes courtes : « Sénat, examen du PLF 2027 » se lit « Sénat » dans une lettre.
    const formes = formesDuNom(fiche.nom)
    const passages: PassagesDUneLettre[] = notes.flatMap(({ lettre, document }) => {
      const vus = new Set<string>()
      const extraits = formes
        .flatMap((forme) => mentionsDe(forme, document))
        .flatMap((m) => m.passages)
        .filter((p) => (vus.has(p.texte) ? false : (vus.add(p.texte), true)))
      return extraits.length > 0
        ? [{ pageId: lettre.édition.pageId, libellé: lettre.semaine.libellé, numéro: lettre.édition.numéro, veille: lettre.édition.veille ?? null, passages: extraits }]
        : []
    })
    const hrefs = new Map(lettres.map((l) => [normaliserIdentifiant(l.édition.pageId), `/${accès.slug}/lettres/${l.édition.pageId}`]))
    return (
      <FicheDUnActeur
        slug={accès.slug}
        fiche={fiche}
        réorganisé={espace?.réorganisé ?? false}
        dossiers={rattacherAuxActeurs(dossiers, [fiche.nom]).rattachés.map((r) => r.dossier)}
        titres={titres}
        lettres={hrefs}
        passages={passages}
        lettresLues={LETTRES_SUIVIES}
      />
    )
  }

  if (!suivi) notFound()

  const notes = await dernièresNotes(semaines)
  const lettresQuiLeNomment = notes.flatMap(({ lettre, document }) => {
    const mentions = mentionsDe(suivi.nom, document)
    return mentions.length > 0 ? [{ lettre, mentions }] : []
  })

  // Du plus récent au plus ancien : c'est l'ordre dans lequel on relit un suivi.
  const relevés = [...suivi.points].reverse()

  return (
    <>
      <EntêteÉcran
        surtitre="acteur suivi"
        titre={suivi.nom}
        état={`${suivi.points.length} relevé${suivi.points.length > 1 ? 's' : ''}`}
      />

      {/* Le même code couleur que la liste : la page d'un acteur doit se lire
          dans la continuité de l'écran d'où l'on vient. */}
      <div className="mt-6">
        <Fraicheur
          fraîcheur={fraîcheurDUnDossier(suivi)}
          libellé={
            suivi.aBougé
              ? 'a bougé cette semaine'
              : suivi.semainesSansMouvement === 0
                ? 'ouvert cette semaine'
                : `${suivi.semainesSansMouvement} semaine${suivi.semainesSansMouvement > 1 ? 's' : ''} sans mouvement`
          }
        />
      </div>

      <p className="mt-6">
        <LienFlèche href={`/${accès.slug}/acteurs`}>Retour aux acteurs</LienFlèche>
      </p>

      {suivi.précisionActuelle ? (
        <div className="mt-6">
          <Panneau ton="ardoise">
            <h2 className="label-mono text-ardoise">Où en est ce dossier</h2>
            <p className="mt-3 text-encre">{suivi.précisionActuelle}</p>
          </Panneau>
        </div>
      ) : null}

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Ce que les lettres en disent</h2>
        <p className="text-ardoise">
          Les passages des {LETTRES_SUIVIES} dernières lettres qui nomment cet acteur.
        </p>

        {lettresQuiLeNomment.length === 0 ? (
          // Sans passage à citer, la page ne doit pas laisser le lecteur sans
          // issue : on lui ouvre les lettres de la période, à lui de juger.
          <div className="flex flex-col gap-4">
            <p className="text-ardoise">
              Aucune des dernières lettres ne le nomme en toutes lettres. Le dossier reste
              ouvert : il est suivi, et son état figure ci-dessous.
            </p>
            {notes.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {notes.map(({ lettre }) => (
                  <li key={lettre.édition.pageId}>
                    <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                      {lettre.semaine.libellé}
                      {lettre.édition.veille ? ` · ${lettre.édition.veille}` : ''}
                    </LienFlèche>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {lettresQuiLeNomment.map(({ lettre, mentions }) => (
              <section key={lettre.édition.pageId} className="flex flex-col gap-4 py-6">
                <div className="flex flex-col gap-1">
                  <p className="label-mono text-ardoise">
                    {lettre.édition.veille ?? 'veille'}
                    {lettre.édition.numéro !== null ? ` · n° ${lettre.édition.numéro}` : ''}
                  </p>
                  <h3 className="font-titre text-h3 font-semibold text-encre">
                    {lettre.semaine.libellé}
                  </h3>
                </div>

                {mentions.map((mention, rang) => (
                  <div key={`${mention.titre}-${rang}`} className="flex flex-col gap-2">
                    {/* Un passage venu du chapeau n'a pas de titre : on ne pose
                        pas de surtitre vide pour autant. */}
                    {mention.titre ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <SurtitreAxe axe={{ titre: mention.titre, numéro: mention.numéro }} />
                        <BadgeImpact niveau={mention.niveau} />
                      </div>
                    ) : null}
                    <ul className="flex flex-col gap-2">
                      {mention.passages.map((passage) => (
                        <li key={passage.texte} className="flex gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-[0.5em] size-1.5 shrink-0 bg-ardoise"
                          />
                          {/* Les segments, pas le texte nu : un gras, un lien ou
                              un italique de la lettre se lit ici comme dans
                              Notion. */}
                          <span className="text-encre">
                            <Texte segments={passage.segments} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <p>
                  <LienFlèche href={`/${accès.slug}/lettres/${lettre.édition.pageId}`}>
                    Lire la lettre entière
                  </LienFlèche>
                </p>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-titre text-h2 font-bold text-encre">Le suivi</h2>
        <p className="text-ardoise">
          Chaque semaine où le dossier a été rouvert, et l’état où il était alors. Ce relevé
          couvre toute l’archive.
        </p>

        <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
          {relevés.map((point) => (
            <li
              key={point.semaine}
              className="flex flex-wrap items-baseline justify-between gap-3 py-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-encre">{point.libellé}</span>
                {point.précision ? (
                  <span className="text-ardoise">{point.précision}</span>
                ) : null}
              </div>
              <span className="label-mono text-ardoise">
                {point.compteur === null
                  ? 'suivi'
                  : point.compteur === 0
                    ? 'mouvement'
                    : `${point.compteur} sem. sans mouvement`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
