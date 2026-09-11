import { exigerAccès } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { enSlug } from '@/lib/domaine/slug'
import { suivreLesDossiers } from '@/lib/domaine/tendances'
import { semainesPubliées } from '@/lib/portail/semaine'

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
export default async function LesActeurs({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  const semaines = await semainesPubliées(accès.organisationId)
  const suivis = suivreLesDossiers(semaines)
  const enMouvement = suivis.filter((dossier) => dossier.aBougé).length

  return (
    <>
      <EntêteÉcran
        surtitre="acteurs et concurrents"
        titre="Qui bouge, qui dort"
        état={`${suivis.length} dossier${suivis.length > 1 ? 's' : ''} suivi${suivis.length > 1 ? 's' : ''}`}
      />

      <p className="mt-5 text-ardoise">
        Les concurrents, administrations et organisations du secteur que la veille rouvre
        d’une lettre à l’autre.{' '}
        {suivis.length > 0
          ? enMouvement > 0
            ? `${enMouvement} ${enMouvement > 1 ? 'ont bougé' : 'a bougé'} cette semaine.`
            : 'Aucun n’a bougé cette semaine.'
          : ''}
      </p>

      <section className="mt-8 flex flex-col gap-4">
        {suivis.length === 0 ? (
          <p className="text-ardoise">
            Aucun dossier n’est suivi pour l’instant. Ils apparaîtront dès que les notes en
            ouvriront.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {suivis.map((dossier) => (
              <li key={dossier.nom} className="flex flex-col gap-3 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-titre text-h3 font-semibold text-encre">
                    <LienFlèche href={`/${accès.slug}/acteurs/${enSlug(dossier.nom)}`}>
                      {dossier.nom}
                    </LienFlèche>
                  </h2>
                  <p className="label-mono text-ardoise">
                    {dossier.aBougé
                      ? 'a bougé cette semaine'
                      : dossier.semainesSansMouvement === 0
                        ? 'ouvert cette semaine'
                        : `${dossier.semainesSansMouvement} semaine${dossier.semainesSansMouvement > 1 ? 's' : ''} sans mouvement`}
                  </p>
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
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8">
        <LienFlèche href={`/${accès.slug}/axes`}>Voir les axes de l’écosystème</LienFlèche>
      </p>
    </>
  )
}
