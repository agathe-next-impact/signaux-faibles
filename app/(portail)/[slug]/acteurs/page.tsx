import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { Fraicheur, LégendeFraicheur } from '@/components/fraicheur'
import { fraîcheurDUnDossier, rangDeFraîcheur } from '@/lib/domaine/fraicheur'
import { enSlug } from '@/lib/domaine/slug'
import { normaliserTitre } from '@/lib/domaine/strategie'
import { suivreLesDossiers } from '@/lib/domaine/tendances'
import { semainesPubliées } from '@/lib/portail/semaine'
import { espaceDeLOrganisation, synthèseDeLEspace } from '@/lib/portail/strategie'
import { Repliable } from '@/components/repliable'
import { EnBref, SynthèseDesActeurs } from '@/components/strategie-ecrans'

/**
 * Les acteurs suivis : concurrents, administrations, organisations du secteur.
 *
 * Un acteur est un **dossier ouvert** — une entité nommée que la veille rouvre
 * d'une lettre à l'autre. L'accueil n'en montre que ceux qui ont de l'actualité ;
 * c'est ici que le suivi entier se lit, y compris les dossiers qui dorment. Un
 * dossier qui s'enlise doit précisément se voir quelque part.
 *
 * Cet écran ne lit **aucun corps de note**. Le suivi vient de la propriété texte
 * des éditions, et couvre toute l'archive pour la seule requête de liste, déjà
 * faite par le rail. C'est ce qui le distingue des axes, et c'est la raison pour
 * laquelle les deux ont été séparés : empilés, l'écran payait le coût du plus
 * cher des deux.
 */
/** Cinq dossiers avant de replier (espace réorganisé). */
const DOSSIERS_VISIBLES = 5

export default async function LesActeurs({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesPubliées(accès.organisationId), espaceDeLOrganisation(accès.organisationId)])
  // L'espace réorganisé (lot 2, pilote sur L'Hermitage) envoie les concurrents
  // de la grille et leur carte sur « Concurrents » : ici restent les
  // institutions, réseaux et parties prenantes, et les dossiers sans entité.
  const réorganisé = espace?.réorganisé ?? false
  const concurrents = new Set((espace?.concurrents ?? []).map(normaliserTitre))
  // `suivreLesDossiers` range du plus enlisé au plus récent — l'ordre d'un
  // journal de bord, pas celui d'une lecture. On regroupe par fraîcheur : ce
  // qui a bougé d'abord, ce qui dort en dernier. Le tri est stable, l'ordre
  // d'origine continue donc de classer à l'intérieur de chaque groupe.
  const suivis = [...suivreLesDossiers(semaines).filter((d) => !concurrents.has(normaliserTitre(d.nom)))].sort(
    (a, b) => rangDeFraîcheur(fraîcheurDUnDossier(a)) - rangDeFraîcheur(fraîcheurDUnDossier(b)),
  )
  // Pilote des outils stratégiques (lot 11) : la carte et Mendelow de la
  // dernière synthèse publiée par l'opératrice. Aucune lecture Notion de plus ;
  // hors du pilote ou sans synthèse publiée, l'écran reste celui d'avant.
  const numéros = new Map(semaines.flatMap((s) => s.éditions).flatMap((é) => (é.numéro !== null ? [[é.pageId, é.numéro] as const] : [])))
  const synthèse = await synthèseDeLEspace({ registre: accès.organisationId, numéros })
  const enMouvement = suivis.filter(
    (dossier) => fraîcheurDUnDossier(dossier) === 'nouveau',
  ).length

  return (
    <>
      <EntêteÉcran
        surtitre={réorganisé ? 'le marché' : 'acteurs et concurrents'}
        titre={réorganisé ? 'Qui pèse sur votre activité' : 'Qui bouge, qui dort'}
        état={`${suivis.length} dossier${suivis.length > 1 ? 's' : ''} suivi${suivis.length > 1 ? 's' : ''}`}
      />

      <p className="mt-6 text-ardoise">
        {réorganisé
          ? 'Les administrations, financeurs, réseaux et organisations du secteur que la veille rouvre d’une lettre à l’autre. Les concurrents ont leur écran.'
          : 'Les concurrents, administrations et organisations du secteur que la veille rouvre d’une lettre à l’autre.'}{' '}
        {suivis.length > 0
          ? enMouvement > 0
            ? `${enMouvement} ${enMouvement > 1 ? 'ont bougé' : 'a bougé'} cette semaine.`
            : 'Aucun n’a bougé cette semaine.'
          : ''}
      </p>

      {réorganisé ? (
        <EnBref
          chiffres={[
            { intitulé: 'Dossiers suivis', valeur: suivis.length, mention: 'hors concurrents' },
            { intitulé: 'Ont bougé', valeur: enMouvement, mention: 'cette semaine' },
            { intitulé: 'Parties prenantes placées', valeur: synthèse?.mois?.mendelow.placés ?? 'n.d.', mention: synthèse?.mois ? 'sur la matrice de Mendelow' : null },
          ]}
        />
      ) : null}

      {synthèse?.mois ? (
        <>
          <SynthèseDesActeurs période={synthèse.mois.période} carte={réorganisé ? null : synthèse.mois.carte} mendelow={synthèse.mois.mendelow} />
          <h2 className="mt-12 font-titre text-h2 font-bold text-encre">Le suivi des dossiers</h2>
        </>
      ) : null}

      <div className="mt-6">
        <LégendeFraicheur />
      </div>

      <section className="mt-8 flex flex-col gap-4">
        {suivis.length === 0 ? (
          <p className="text-ardoise">
            Aucun dossier n’est suivi pour l’instant. Ils apparaîtront dès que les notes en
            ouvriront.
          </p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
              {(réorganisé ? suivis.slice(0, DOSSIERS_VISIBLES) : suivis).map((dossier) => (
                <DossierSuivi key={dossier.nom} slug={accès.slug} dossier={dossier} />
              ))}
            </ul>
            {réorganisé ? (
              <Repliable reste={suivis.length - DOSSIERS_VISIBLES} nom="dossiers">
                <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
                  {suivis.slice(DOSSIERS_VISIBLES).map((dossier) => (
                    <DossierSuivi key={dossier.nom} slug={accès.slug} dossier={dossier} />
                  ))}
                </ul>
              </Repliable>
            ) : null}
          </>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-2">
        {réorganisé ? (
          <p>
            <LienFlèche href={`/${accès.slug}/concurrents`}>Voir les concurrents et leur carte</LienFlèche>
          </p>
        ) : null}
        <p>
          <LienFlèche href={`/${accès.slug}/axes`}>Voir les axes de l’écosystème</LienFlèche>
        </p>
        {/* Le suivi dit où en est chaque dossier ; le périmètre dit pourquoi
            celui-là est suivi, et ce que nous proposons d'y changer. */}
        <p>
          <LienFlèche href={`/${accès.slug}/perimetre`}>
            Voir le périmètre de la veille
          </LienFlèche>
        </p>
      </div>
    </>
  )
}

/** Un dossier suivi : son nom vers sa page, sa fraîcheur, sa précision et ses relevés semaine par semaine. */
function DossierSuivi({ slug, dossier }: { slug: string; dossier: ReturnType<typeof suivreLesDossiers>[number] }) {
  return (
    <li className="flex flex-col gap-3 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-titre text-h3 font-semibold text-encre">
          <LienFlèche href={`/${slug}/acteurs/${enSlug(dossier.nom)}`}>
            {dossier.nom}
          </LienFlèche>
        </h2>
        <Fraicheur
          fraîcheur={fraîcheurDUnDossier(dossier)}
          libellé={
            dossier.aBougé
              ? 'a bougé cette semaine'
              : dossier.semainesSansMouvement === 0
                ? 'ouvert cette semaine'
                : `${dossier.semainesSansMouvement} semaine${dossier.semainesSansMouvement > 1 ? 's' : ''} sans mouvement`
          }
        />
      </div>

      {dossier.précisionActuelle ? (
        <p className="text-ardoise">{dossier.précisionActuelle}</p>
      ) : null}

      {/* Le suivi reprend le motif de la charte : une ligne, des
          impulsions. Rose quand le dossier a bougé, ardoise sinon. */}
      <ol
        className="flex flex-wrap items-end gap-1"
        aria-label="Suivi semaine par semaine"
      >
        {dossier.points.map((point) => {
          const compteur = point.compteur ?? 0
          const hauteur = Math.min(4 + compteur * 6, 34)
          return (
            <li key={point.semaine} className="flex flex-col items-center gap-1">
              <span
                title={`${point.libellé} — ${compteur} semaine(s) sans mouvement`}
                className={`w-[3px] rounded-full ${compteur === 0 ? 'bg-rose' : 'bg-ardoise'}`}
                style={{ height: `${hauteur}px` }}
              />
            </li>
          )
        })}
        <li className="ml-2 label-mono text-ardoise">
          {dossier.points.length} relevé{dossier.points.length > 1 ? 's' : ''}
        </li>
      </ol>
    </li>
  )
}
