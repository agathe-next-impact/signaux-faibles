import { notFound } from 'next/navigation'
import { exigerLectureComplète } from '@/lib/auth/appartenance'
import { EntêteÉcran, LienFlèche } from '@/components/coquille'
import { Simulateur } from '@/components/simulation-ecran'
import { semainesDeLEspace } from '@/lib/portail/semaine'
import { simulationDeLEspace } from '@/lib/portail/simulation'
import { espaceDeLOrganisation } from '@/lib/portail/strategie'

/**
 * Simulation (16 novembre 2026, lot 3b des simulations de scénarios) : une
 * année jouée en quatre trimestres depuis l'état mesuré du marché du client.
 * L'écran lit, en une lecture bornée et Postgres seul, la table d'effets
 * publiée de l'organisation, les mesures publiées de ses marchés et les comptes
 * de sa veille (`simulationDeLEspace`) ; le jeu se joue ensuite dans le
 * navigateur, par le domaine, et rien n'est enregistré : la partie tient dans
 * l'adresse (`?p=`). L'écran n'est ouvert au client qu'une fois la table
 * publiée par l'opératrice, dont la session (`accès.aperçu`) joue aussi la
 * version proposée, sous un bandeau. Seulement pour un espace réorganisé :
 * ailleurs, 404 avant toute lecture.
 */
export default async function Simulation({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string | string[]; a?: string | string[] }> }) {
  const { slug } = await params
  const { p, a } = await searchParams
  const accès = await exigerLectureComplète(slug)

  const [semaines, espace] = await Promise.all([semainesDeLEspace(accès), espaceDeLOrganisation(accès.organisationId)])
  if (espace && !espace.réorganisé) notFound()
  const fin = semaines[0]?.éditions.map((é) => é.dateÉdition).sort().at(-1)
  const simulation = espace && fin ? await simulationDeLEspace({ registre: accès.organisationId, aperçu: accès.aperçu, fin }) : null
  // La partie proposée par défaut : la même pour tous les lecteurs d'une même semaine, sans tirage au rendu.
  const graineDuJour = fin ? Number(fin.replaceAll('-', '')) % 1_000_000 : 1

  return (
    <>
      <EntêteÉcran surtitre="stratégie" titre="Simulation" état={simulation?.sorte === 'jouable' ? `table d’effets, version ${simulation.version}` : undefined} />
      {simulation?.sorte === 'jouable' && simulation.nonPublié ? (
        <p role="note" className="mt-6 border border-gris-ligne bg-fond-ardoise p-4 text-encre">
          <span className="label-mono text-ardoise">aperçu</span> Cette table d’effets n’est pas publiée : vous seule la voyez. Le client ne voit l’écran « Simulation » qu’une fois la
          table publiée, depuis « Synthèses stratégiques ».
        </p>
      ) : null}
      {simulation?.sorte === 'jouable' ? (
        <Simulateur donnée={simulation.donnée} initial={typeof p === 'string' ? p : null} référenceInitiale={typeof a === 'string' ? a : null} graineDuJour={graineDuJour} />
      ) : simulation?.sorte === 'périmée' ? (
        <div className="mt-6 flex flex-col gap-2 text-ardoise">
          <p>La table d’effets de cet espace ne correspond plus à l’arbre de vos marchés ou à votre grille de veille : elle sera mise à jour à la prochaine revue trimestrielle.</p>
          {accès.aperçu ? (
            <ul className="list-disc pl-6 text-sm">
              {simulation.refus.slice(0, 12).map((r, i) => (
                <li key={i}>
                  {r.cible ? `${r.cible} : ` : ''}
                  {r.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 text-ardoise">La simulation n’est pas encore ouverte pour votre espace. Elle paraît quand sa table d’effets, écrite avec la revue du trimestre, a été relue et publiée.</p>
      )}
      <div className="mt-12 flex flex-col gap-2">
        <p>
          <LienFlèche href={`/${accès.slug}/scenarios`}>Voir les scénarios du trimestre et leurs signaux</LienFlèche>
        </p>
        <p>
          <LienFlèche href={`/${accès.slug}/marches`}>Voir où porter l’effort, segment par segment</LienFlèche>
        </p>
      </div>
    </>
  )
}
