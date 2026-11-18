import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { ListeDesAppels } from '@/components/appels-ecran'
import { Repliable } from '@/components/repliable'
import { FriseDesÉchéances } from '@/components/votre-veille'
import { dateCourte } from '@/lib/domaine/strategie-vues'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import { appelsDeLEspace } from '@/lib/portail/appels'
import { semainesDeLEspace } from '@/lib/portail/semaine'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Les appels à projets (18 novembre 2026, décision de l'opératrice, option A) :
 * ce que l'organisation peut instruire maintenant. Les appels relevés **en
 * code** dans les lettres d'appels conformes (`appels_a_projets`), suivis
 * d'une lettre à l'autre à la lecture, sur les seules lettres que le lecteur
 * peut lire (règle 3). Aucune lecture Notion de plus que la liste des
 * éditions ; 404 hors de l'espace réorganisé.
 */
const OUVERTS_VISIBLES = 8

export default async function Appels({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesDeLEspace(accès), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const vue = espace ? await appelsDeLEspace({ registre: accès.organisationId, semaines, aujourdhui }) : null
  const n = vue?.ouverts.length ?? 0
  const frise = (vue?.mois ?? []).map((m) => ({
    mois: m.mois,
    libellé: m.libellé,
    échéances: m.appels.map((a) => ({ date: a.clôture, libellé: a.intitulé, famille: a.financeur })),
  }))
  // L'adresse d'une lettre porte son identifiant tel que Notion le rend ; la table, la forme normalisée.
  const pages = new Map(semaines.flatMap((s) => s.éditions).map((é) => [normaliserIdentifiant(é.pageId), é.pageId]))
  const dansLaFrise = frise.reduce((t, m) => t + m.échéances.length, 0)

  return (
    <>
      <EntêteÉcran surtitre="stratégie" titre="Appels à projets" état={vue ? `${n} appel${n > 1 ? 's' : ''} à instruire` : undefined} />
      {!vue ? (
        <p className="mt-6 text-ardoise">Les appels à projets ne peuvent pas être affichés pour l’instant. Réessayez dans quelques minutes.</p>
      ) : vue.lettres === 0 ? (
        <p className="mt-6 max-w-[68ch] border border-gris-ligne bg-fond-neutre p-4 text-ardoise">
          Aucune lettre d’appels à projets publiée ne porte encore d’appel. Ils apparaîtront ici dès la prochaine parution.
        </p>
      ) : (
        <>
          {vue.dernière?.actionDeLaSemaine ? (
            <section className="mt-8 border-l-2 border-rose bg-fond-neutre p-4">
              <p className="label-mono text-ardoise">Action de la quinzaine · lettre du {dateCourte(vue.dernière.dateÉdition)}</p>
              <p className="mt-2 max-w-[68ch] text-encre">{vue.dernière.actionDeLaSemaine}</p>
            </section>
          ) : null}

          <section className="mt-12 flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">À instruire</h2>
            <p className="max-w-[68ch] text-ardoise">
              Les appels ouverts relevés dans vos lettres, de la clôture la plus proche à la plus lointaine. Un appel « à vérifier » demande de confirmer votre éligibilité avant d’engager le dossier.
            </p>
            {n === 0 ? (
              <p className="text-ardoise">Aucun appel relevé n’est encore ouvert.</p>
            ) : (
              <>
                <ListeDesAppels appels={vue.ouverts.slice(0, OUVERTS_VISIBLES)} slug={accès.slug} pages={pages} />
                <Repliable reste={n - OUVERTS_VISIBLES} nom="appels ouverts">
                  <ListeDesAppels appels={vue.ouverts.slice(OUVERTS_VISIBLES)} slug={accès.slug} pages={pages} />
                </Repliable>
              </>
            )}
          </section>

          <section className="mt-12 flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">Les clôtures des six prochains mois</h2>
            <p className="max-w-[68ch] text-ardoise">
              {dansLaFrise < n
                ? `${n - dansLaFrise} appel${n - dansLaFrise > 1 ? 's clôturent' : ' clôture'} au-delà de six mois et n’${n - dansLaFrise > 1 ? 'y figurent' : 'y figure'} pas.`
                : 'Un mois sans repère ne porte aucune clôture d’appel relevé.'}
            </p>
            <FriseDesÉchéances mois={frise} étiquette="Clôtures des appels des six prochains mois" />
          </section>

          {vue.clos.length > 0 ? (
            <section className="mt-12 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Clos</h2>
              <p className="max-w-[68ch] text-ardoise">Les appels dont la clôture est passée, gardés pour mémoire.</p>
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-corps text-encre [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Voir {vue.clos.length > 1 ? `les ${vue.clos.length} appels clos` : 'l’appel clos'}</span>
                  <span className="hidden group-open:inline">Replier</span>
                  <span aria-hidden="true" className="text-rose transition-transform group-open:rotate-90">→</span>
                </summary>
                <div className="mt-4">
                  <ListeDesAppels appels={vue.clos} slug={accès.slug} pages={pages} clos />
                </div>
              </details>
            </section>
          ) : null}
        </>
      )}
      <p className="mt-12 flex flex-col gap-2">
        <LienFlèche href={`/${accès.slug}/lettres`}>Lire les lettres</LienFlèche>
        <LienFlèche href={`/${accès.slug}/veille/calendrier`}>Voir le calendrier de votre veille</LienFlèche>
      </p>
    </>
  )
}
