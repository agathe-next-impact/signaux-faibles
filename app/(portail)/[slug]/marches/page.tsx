import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { EnBref } from '@/components/strategie-ecrans'
import { LIBELLÉS_DE_NIVEAU, LIBELLÉS_D_ÉTAT, montantCourt, type LigneDeMarché } from '@/lib/domaine/marches'
import { libelléDePériode } from '@/lib/domaine/strategie-vues'
import { marchésDeLEspace } from '@/lib/portail/marches'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Marchés et niches (12 novembre 2026, `docs/plan-marches-et-niches.md`) : que
 * pèse chaque segment, et comment il évolue. L'arbre du marché, de ses offres
 * et de leurs niches, avec les mesures que le portail a calculées pour le
 * dernier trimestre publié : cibles comptées au registre des entreprises,
 * potentiel en fourchette, achat public constaté sur douze mois, offre en
 * place, activité de la veille. L'état de
 * chaque segment est déduit de la suite de ses mesures. Aucune lecture Notion,
 * aucun appel aux registres depuis l'écran. Seulement pour un espace
 * réorganisé : ailleurs, 404 avant toute lecture.
 */
const nombre = (n: number) => n.toLocaleString('fr-FR')

function cibles(l: LigneDeMarché): string {
  if (l.cibles === null) return 'n.d.'
  return l.ciblesPlafonnées ? `plus de ${nombre(l.cibles)}` : nombre(l.cibles)
}

function potentiel(l: LigneDeMarché): string {
  if (!l.potentiel) return 'n.d.'
  return l.potentiel.bas === l.potentiel.haut ? montantCourt(l.potentiel.haut) : `${montantCourt(l.potentiel.bas)} à ${montantCourt(l.potentiel.haut)}`
}

function offre(l: LigneDeMarché): string {
  const parties: string[] = []
  if (l.présents && l.présents.length > 0) parties.push(`${l.présents.length} concurrent${l.présents.length > 1 ? 's' : ''} suivi${l.présents.length > 1 ? 's' : ''}${l.présentsOrigine === 'faits' ? ' d’après les faits' : l.présentsOrigine === 'marches' ? ' titulaires de marchés publics' : ''}`)
  if (l.présents && l.présents.length === 0) parties.push('aucun concurrent suivi')
  if (l.offreurs !== null) parties.push(`${l.offreursPlafonnés ? 'plus de ' : ''}${nombre(l.offreurs)} offreur${l.offreurs > 1 ? 's' : ''} au registre`)
  return parties.length > 0 ? parties.join(', ') : 'non renseignée'
}

function mouvement(l: LigneDeMarché): string {
  if (l.modifié) return 'périmètre modifié'
  const état = LIBELLÉS_D_ÉTAT[l.état]
  return l.état === 'stable' && l.tendance === 'baisse' ? 'stable, en baisse ce trimestre' : état
}

const RETRAIT: Readonly<Record<LigneDeMarché['niveau'], string>> = { marche: '', offre: 'sm:pl-6', niche: 'sm:pl-12' }

function Chiffre({ intitulé, valeur }: { intitulé: string; valeur: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label-mono text-ardoise">{intitulé}</dt>
      <dd className="text-encre">{valeur}</dd>
    </div>
  )
}

export default async function Marchés({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accès = await exigerLectureComplète(slug)

  const espace = await espaceDeLOrganisation(accès.organisationId)
  if (espace && !espace.réorganisé) notFound()
  const vue = espace ? await marchésDeLEspace({ registre: accès.organisationId }) : null
  const racine = vue?.lignes.find((l) => l.niveau === 'marche') ?? null

  return (
    <>
      <EntêteÉcran surtitre="le marché" titre="Marchés et niches" état={vue ? `trimestre ${libelléDePériode(vue.période)}` : undefined} />
      {vue ? (
        <>
          <EnBref
            chiffres={[
              { intitulé: 'Potentiel global', valeur: racine ? potentiel(racine) : 'n.d.', mention: 'par an, hypothèses affichées' },
              { intitulé: 'Segments mesurés', valeur: String(vue.comptes.segments), mention: `${vue.comptes.chiffrés} chiffré${vue.comptes.chiffrés > 1 ? 's' : ''} en euros` },
              { intitulé: 'Segments ouverts', valeur: String(vue.comptes.ouverts), mention: 'sans concurrent ni offreur' },
            ]}
          />

          <section className="mt-12 flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-titre text-h2 font-bold text-encre">Du marché à ses niches</h2>
              <p className="label-mono text-ardoise">Registre des entreprises · outil en test</p>
            </div>
            <p className="max-w-[68ch] text-ardoise">
              Votre marché, vos offres, puis leurs niches. Les cibles sont comptées au registre des entreprises ; le potentiel les multiplie par une dépense annuelle posée en hypothèse. C’est un ordre de
              grandeur : ce qui compte, c’est son évolution d’un trimestre à l’autre. L’achat public, lui, est constaté : la somme des marchés notifiés sur douze mois, quand le segment en relève.
            </p>
            <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
              {vue.lignes.map((l) => (
                <li key={l.clé} id={l.clé} className={`flex scroll-mt-6 flex-col gap-3 py-4 ${RETRAIT[l.niveau]}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className={l.niveau === 'niche' ? 'font-medium text-encre' : 'font-titre text-h3 font-bold text-encre'}>{l.libellé}</h3>
                    <p className="label-mono text-ardoise">
                      {LIBELLÉS_DE_NIVEAU[l.niveau]} · {mouvement(l)}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Chiffre intitulé="Cibles" valeur={cibles(l)} />
                    <Chiffre intitulé="Potentiel par an" valeur={potentiel(l)} />
                    <Chiffre intitulé="Offre en place" valeur={offre(l)} />
                    <Chiffre intitulé="Faits de la veille" valeur={`${l.faits}${l.faitsForts > 0 ? `, dont ${l.faitsForts} signal${l.faitsForts > 1 ? 's' : ''} fort${l.faitsForts > 1 ? 's' : ''}` : ''}`} />
                  </dl>
                  {l.entrées !== null || l.sorties !== null ? (
                    <p className="text-sm text-ardoise">
                      Sur douze mois au BODACC : {l.entrées ?? 'n.d.'} création{(l.entrées ?? 0) > 1 ? 's' : ''}, {l.sorties ?? 'n.d.'} procédure{(l.sorties ?? 0) > 1 ? 's' : ''} collective{(l.sorties ?? 0) > 1 ? 's' : ''}.
                    </p>
                  ) : null}
                  {l.achatPublic ? (
                    <p className="text-sm text-ardoise">
                      Achat public sur douze mois : {montantCourt(l.achatPublic.montant)} en {nombre(l.achatPublic.marchés)} marché{l.achatPublic.marchés > 1 ? 's' : ''} notifié{l.achatPublic.marchés > 1 ? 's' : ''},{' '}
                      {nombre(l.achatPublic.titulaires)} titulaire{l.achatPublic.titulaires > 1 ? 's' : ''}
                      {l.achatPublic.concurrents.length > 0
                        ? `, dont ${l.achatPublic.concurrents
                            .slice(0, 5)
                            .map((c) => `${c.nom} (${montantCourt(c.montant)})`)
                            .join(', ')}${l.achatPublic.concurrents.length > 5 ? ` et ${l.achatPublic.concurrents.length - 5} autre${l.achatPublic.concurrents.length > 6 ? 's' : ''}` : ''}`
                        : ''}
                      .
                      {l.achatPublic.organisation
                        ? l.achatPublic.organisation.marchés > 0
                          ? ` Vous en êtes titulaire pour ${montantCourt(l.achatPublic.organisation.montant)}, en ${nombre(l.achatPublic.organisation.marchés)} marché${l.achatPublic.organisation.marchés > 1 ? 's' : ''}.`
                          : ' Aucun de ces marchés ne vous nomme premier titulaire.'
                        : ''}
                    </p>
                  ) : null}
                  {l.limites.length > 0 || l.sources.length > 0 ? (
                    <details className="text-sm text-ardoise">
                      <summary className="cursor-pointer">Hypothèses et sources</summary>
                      <ul className="mt-2 flex flex-col gap-1">
                        {l.limites.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                        {l.sources.map((s) => (
                          <li key={s} className="break-all">
                            <a href={s} rel="noreferrer" className="underline">
                              {s}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {vue.disparus.length > 0 ? (
            <section className="mt-12 flex flex-col gap-4">
              <h2 className="font-titre text-h2 font-bold text-encre">Retirés depuis le trimestre précédent</h2>
              <ul className="flex flex-col gap-1">
                {vue.disparus.map((d) => (
                  <li key={d.clé} className="text-ardoise">
                    {d.libellé} <span className="label-mono">· {LIBELLÉS_DE_NIVEAU[d.niveau]}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-ardoise">Les mesures de vos marchés ne sont pas encore publiées. Elles paraissent avec la revue de chaque trimestre.</p>
      )}
      <div className="mt-12 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/concurrents`}>Voir {espace?.marché.écran.toLowerCase() ?? 'les concurrents'}</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/forces`}>Voir les forces du marché</LienFlèche>
        </p>
      </div>
    </>
  )
}
