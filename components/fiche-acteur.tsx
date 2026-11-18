import { EntêteÉcran, LienFlèche, Panneau } from '@/components/coquille'
import { Texte } from '@/components/document'
import { Fraicheur } from '@/components/fraicheur'
import type { Extrait } from '@/lib/domaine/document'
import { LIBELLÉS_DES_SORTES_D_ACTEUR, type FicheDeLActeur, type ÉnoncéQuiLeConcerne } from '@/lib/domaine/fiche-acteur'
import { fraîcheurDUnDossier } from '@/lib/domaine/fraicheur'
import { enSlug } from '@/lib/domaine/slug'
import { dateCourte } from '@/lib/domaine/strategie-vues'
import type { suivreLesDossiers } from '@/lib/domaine/tendances'

type Dossier = ReturnType<typeof suivreLesDossiers>[number]

/** Les passages d'une lettre qui nomment l'acteur. */
export type PassagesDUneLettre = {
  readonly pageId: string
  readonly libellé: string
  readonly numéro: number | null
  readonly veille: string | null
  readonly passages: readonly Extrait[]
}

/** Une section de l'écran : un titre, une phrase qui dit d'où vient ce qu'elle montre, puis son contenu. */
function Section({ titre, chapeau, children }: { titre: string; chapeau?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 flex flex-col gap-4">
      <h2 className="font-titre text-h2 font-bold text-encre">{titre}</h2>
      {chapeau ? <p className="max-w-[68ch] text-ardoise">{chapeau}</p> : null}
      {children}
    </section>
  )
}

function Vide({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[68ch] border border-gris-ligne bg-fond-neutre p-4 text-ardoise">{children}</p>
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** L'écran qui montre un énoncé de synthèse : « Diagnostic », « Options », « Scénarios », ou « Recommandations » hors de l'espace réorganisé. */
function lienDeLÉnoncé(slug: string, é: ÉnoncéQuiLeConcerne, réorganisé: boolean): string {
  if (!réorganisé) return `/${slug}/recommandations`
  if (é.outil === 'swot') return `/${slug}/diagnostic${é.code ? `#${é.code}` : ''}`
  if (é.outil === 'scenario') return `/${slug}/scenarios`
  return `/${slug}/recommandations`
}

/**
 * L'écran d'un acteur (`/[slug]/acteurs/[acteur]`) : ce que le dispositif sait
 * de lui, section par section, sans rien lire de plus que ce que la page lui
 * passe. Rien n'est rédigé ici : chaque phrase est un libellé, un énoncé publié
 * ou un passage de lettre.
 */
export function FicheDUnActeur({
  slug,
  fiche,
  réorganisé,
  dossiers,
  titres,
  lettres,
  passages,
  lettresLues,
}: {
  slug: string
  fiche: FicheDeLActeur
  réorganisé: boolean
  dossiers: readonly Dossier[]
  /** La phrase-titre d'un fait, par `édition:empreinte`, quand l'écran a lu sa lettre. */
  titres: ReadonlyMap<string, string>
  /** L'adresse de chaque lettre listée pour l'organisation, par identifiant normalisé. */
  lettres: ReadonlyMap<string, string>
  passages: readonly PassagesDUneLettre[]
  lettresLues: number
}) {
  const [actuelle, ...précédentes] = fiche.historique
  const état = actuelle?.mendelow
    ? `pouvoir ${actuelle.mendelow.pouvoir} · intérêt ${actuelle.mendelow.intérêt}`
    : pluriel(fiche.faits.length, 'fait daté')

  return (
    <>
      <EntêteÉcran surtitre={LIBELLÉS_DES_SORTES_D_ACTEUR[fiche.sorte]} titre={fiche.nom} état={état} />

      {actuelle ? (
        <div className="mt-6">
          <Fraicheur
            fraîcheur={actuelle.aBougé ? 'nouveau' : fiche.faits.length > 0 ? 'suivi' : 'dormant'}
            libellé={
              actuelle.aBougé
                ? `a changé de case dans la synthèse ${actuelle.libellé}`
                : actuelle.déclaratif
                  ? 'position déclarative'
                  : fiche.faits.length > 0
                    ? 'position inchangée'
                    : 'aucun fait daté'
            }
          />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${slug}/acteurs`}>Retour aux acteurs</LienFlèche>
        </p>
        {fiche.sorte === 'concurrent' && réorganisé ? (
          <p>
            <LienFlèche href={`/${slug}/concurrents/${fiche.segment}`}>Voir sa fiche dans les concurrents</LienFlèche>
          </p>
        ) : null}
      </div>

      <Section titre="Qui c’est">
        {fiche.présentation ? (
          <p className="max-w-[68ch] text-encre">{fiche.présentation}</p>
        ) : (
          <Vide>Sa présentation n’est pas encore publiée. Elle est rédigée à la revue du mois avec la fiche de votre veille, relue, puis publiée ici.</Vide>
        )}
        {fiche.siren ? <p className="label-mono text-ardoise">SIREN {fiche.siren}</p> : null}
      </Section>

      <Section
        titre="Sa position"
        chapeau="Sa place dans les synthèses publiées : pouvoir et intérêt sur la matrice de Mendelow, crans sur la carte des groupes. La plus récente d’abord."
      >
        {actuelle ? (
          <>
            <Panneau ton="ardoise">
              <p className="label-mono text-ardoise">
                {actuelle.déclaratif ? 'déclaratif · votre veille' : `synthèse ${actuelle.libellé}`}
              </p>
              <dl className="mt-3 flex flex-col gap-1">
                {actuelle.mendelow ? (
                  <>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-ardoise">Pouvoir :</dt>
                      <dd className="text-encre">{actuelle.mendelow.pouvoir}</dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-ardoise">Intérêt :</dt>
                      <dd className="text-encre">{actuelle.mendelow.intérêt}</dd>
                    </div>
                    {actuelle.mendelow.coin ? (
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ardoise">Conduite :</dt>
                        <dd className="text-encre">{actuelle.mendelow.coin}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {actuelle.crans.map((c) => (
                  <div key={c.axe} className="flex flex-wrap gap-x-2">
                    <dt className="text-ardoise">{c.axe} :</dt>
                    <dd className="text-encre">{c.libellé}</dd>
                  </div>
                ))}
              </dl>
            </Panneau>
            {précédentes.length > 0 ? (
              <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne" aria-label="Positions précédentes">
                {précédentes.map((p) => (
                  <li key={p.période} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                    <span className="text-encre">Synthèse {p.libellé}</span>
                    <span className="label-mono text-ardoise">
                      {[
                        p.mendelow ? `pouvoir ${p.mendelow.pouvoir} · intérêt ${p.mendelow.intérêt}` : null,
                        ...p.crans.map((c) => `${c.axe} : ${c.libellé}`),
                        p.aBougé ? 'a changé de case' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <Vide>Aucune synthèse publiée ne le place encore.</Vide>
        )}
      </Section>

      <Section
        titre="Ses faits datés"
        chapeau="Les faits des lettres que ses positions citent, et ceux que l’étiquetage rattache à son nom. Chacun mène à sa lettre."
      >
        {fiche.faits.length === 0 ? (
          <Vide>Aucun fait daté ne le concerne pour l’instant.</Vide>
        ) : (
          <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {fiche.faits.map((f) => {
              const titre = f.empreinte ? titres.get(`${f.édition}:${f.empreinte}`) : undefined
              const href = lettres.get(f.édition)
              const repère = `Fait du ${dateCourte(f.date)}${f.numéro !== null ? ` · lettre n° ${f.numéro}` : ''}`
              return (
                <li key={`${f.édition}:${f.empreinte ?? f.date}`} className="flex flex-col gap-1 py-4">
                  <p className="label-mono text-ardoise">
                    {repère} ·{' '}
                    {f.raisons.map((r) => (r === 'position' ? 'fonde sa position' : 'le nomme')).join(' · ')}
                  </p>
                  {titre ? <p className="text-encre">{titre}</p> : null}
                  {href ? (
                    <p>
                      <LienFlèche href={href}>Lire la lettre</LienFlèche>
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section
        titre="Dans les synthèses"
        chapeau="Les énoncés des dernières synthèses publiées, du mois et du trimestre, qui le nomment ou citent l’un de ses faits."
      >
        {fiche.synthèses.length === 0 ? (
          <Vide>Aucun énoncé des dernières synthèses publiées ne le concerne.</Vide>
        ) : (
          <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {fiche.synthèses.map((é, rang) => (
              <li key={`${é.période}:${rang}`} className="flex flex-col gap-2 py-4">
                <p className="label-mono text-ardoise">
                  {é.rubrique} · synthèse {é.libellé} · {é.par === 'nom' ? 'le nomme' : 'cite un de ses faits'}
                </p>
                <p className="max-w-[68ch] text-encre">{é.énoncé}</p>
                <p>
                  <LienFlèche href={lienDeLÉnoncé(slug, é, réorganisé)}>Voir dans son écran</LienFlèche>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre="Les dossiers qui le nomment" chapeau="Les dossiers ouverts des lettres dont le nom ou l’état actuel le nomme.">
        {dossiers.length === 0 ? (
          <Vide>Aucun dossier ouvert ne le nomme.</Vide>
        ) : (
          <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {dossiers.map((dossier) => (
              <li key={dossier.nom} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  {/* Un dossier du même nom que l'acteur aurait la même adresse : son état se lit ici. */}
                  {enSlug(dossier.nom) === fiche.segment ? (
                    <span className="text-encre">{dossier.nom}</span>
                  ) : (
                    <LienFlèche href={`/${slug}/acteurs/${enSlug(dossier.nom)}`}>{dossier.nom}</LienFlèche>
                  )}
                  <Fraicheur
                    fraîcheur={fraîcheurDUnDossier(dossier)}
                    libellé={
                      dossier.aBougé
                        ? 'a bougé cette semaine'
                        : dossier.semainesSansMouvement === 0
                          ? 'ouvert cette semaine'
                          : `${pluriel(dossier.semainesSansMouvement, 'semaine')} sans mouvement`
                    }
                  />
                </div>
                {dossier.précisionActuelle ? <p className="text-ardoise">{dossier.précisionActuelle}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre="Ce que les lettres en disent" chapeau={`Les passages des ${lettresLues} dernières lettres qui le nomment.`}>
        {passages.length === 0 ? (
          <Vide>Aucune des dernières lettres ne le nomme en toutes lettres.</Vide>
        ) : (
          <div className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {passages.map((lettre) => (
              <section key={lettre.pageId} className="flex flex-col gap-3 py-6">
                <p className="label-mono text-ardoise">
                  {lettre.veille ?? 'veille'}
                  {lettre.numéro !== null ? ` · n° ${lettre.numéro}` : ''} · {lettre.libellé}
                </p>
                <ul className="flex flex-col gap-2">
                  {lettre.passages.map((passage) => (
                    <li key={passage.texte} className="flex gap-3">
                      <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 bg-ardoise" />
                      <span className="text-encre">
                        <Texte segments={passage.segments} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p>
                  <LienFlèche href={`/${slug}/lettres/${lettre.pageId}`}>Lire la lettre</LienFlèche>
                </p>
              </section>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
