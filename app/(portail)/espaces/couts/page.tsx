import type { Metadata } from 'next'
import Link from 'next/link'
import { listerLesCoûts } from '@/lib/auth/appartenance'
import { Panneau } from '@/components/coquille'
import { ChoixDuMois, CoûtsParOrganisation, CoûtsParTâche, RunsDuMois, TotauxDesCoûts } from '@/components/couts-operatrice'
import { Logo } from '@/components/marque'
import { libelléDuMois, moisDeParis } from '@/lib/domaine/couts'

export const metadata: Metadata = { title: 'Coûts — signauxfaibles' }

/**
 * Le coût des tâches, mois par mois (16 novembre 2026, demande de l'opératrice).
 *
 * Chaque run d'une tâche sur l'API rapporte ce qu'il a coûté
 * (`POST /api/veille/couts`, depuis le harnais) : le total du mois, par tâche,
 * par organisation, puis run par run, avec le lien du job. Le coût par
 * organisation est imputé en entier quand le run n'en a traité qu'une, réparti
 * à parts égales sinon, et l'écran distingue les deux.
 *
 * Comme le sélecteur, la garde est dans `listerLesCoûts`, avant toute lecture ;
 * la page vit hors de `/[slug]` et n'emprunte pas la coquille. Rien ne se règle
 * ici.
 */
export const instant = false

export default async function Coûts({ searchParams }: { searchParams: Promise<{ mois?: string | string[] }> }) {
  const paramètres = await searchParams
  const { accès, mois, coûts } = await listerLesCoûts(typeof paramètres.mois === 'string' ? paramètres.mois : undefined)

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Coûts, {libelléDuMois(mois)}</h1>
        <p className="text-ardoise">
          Ce que chaque run d’une tâche a coûté sur l’API, tel que le rapporte son exécution, en dollars. Les runs lancés depuis
          Cowork consomment l’abonnement et ne sont pas mesurés ici.{' '}
          <Link href="/espaces/abonnements" className="text-encre underline underline-offset-2">
            Abonnements
          </Link>
          {' · '}
          <Link href="/espaces/onboardings" className="text-encre underline underline-offset-2">
            Onboardings
          </Link>
        </p>
        <ChoixDuMois mois={mois} moisEnCours={moisDeParis(new Date())} />
      </header>

      {coûts === null ? (
        <Panneau ton="rose">
          <p className="text-encre">
            La base Postgres n’est pas en service sur cet environnement (`SOURCE_ACCES` vaut `notion`, ou `DATABASE_URL` est
            absente) : aucun coût à montrer.
          </p>
        </Panneau>
      ) : coûts.runs.length === 0 ? (
        <p className="text-ardoise">Aucun run mesuré en {libelléDuMois(mois)}.</p>
      ) : (
        <>
          <TotauxDesCoûts totaux={coûts.totaux} />

          <section className="flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">Par tâche</h2>
            <CoûtsParTâche totaux={coûts.totaux} />
            <p className="text-ardoise">
              Un run sans réussite (plafond atteint, erreur) a dépensé quand même : son coût est compté. Les plafonds cumulés
              disent ce que ces runs pouvaient coûter au plus.
            </p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">Par organisation</h2>
            <CoûtsParOrganisation totaux={coûts.totaux} noms={coûts.noms} />
            <p className="text-ardoise">
              « Imputé en entier » : les runs qui n’ont traité que cette organisation (onboarding, étiquetage). « Part
              estimée » : sa part égale des runs qui en ont traité plusieurs, comme les lettres du jour ; c’est une convention,
              la dépense n’est pas mesurée organisation par organisation. Les runs qui n’en nomment aucune restent hors de ce
              tableau, dans « non attribué ».
            </p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-titre text-h2 font-bold text-encre">Run par run</h2>
            <RunsDuMois runs={coûts.runs} />
          </section>
        </>
      )}
    </main>
  )
}
