import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import { Repliable } from '@/components/repliable'
import { FriseDOnboarding, libelléDuRun, MétaDOnboarding, MotifDeBlocage, résuméDeLÉtape } from '@/components/onboarding-operatrice'
import { listerLesOnboardings } from '@/lib/auth/appartenance'
import { formaterDollars, type DécisionDeBudget } from '@/lib/domaine/onboarding'
import type { VueDOnboarding } from '@/lib/portail/onboarding'

export const metadata: Metadata = { title: 'Onboardings — signauxfaibles' }

/**
 * Les onboardings suivis par le portail, pour l'opératrice (lot 1 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026).
 *
 * Lecture seule : un onboarding apparaît au premier run `balayage` ou
 * `premiere-lettre` lancé sur une organisation par le workflow « Tâches
 * planifiées (API Claude) », que le harnais rapporte au portail. Les gestes
 * (lancer, relancer, ouvrir l'espace) viennent aux lots suivants ; d'ici là, ils
 * se font dans GitHub Actions et par les commandes `/onboarding-*`.
 *
 * Comme les autres tableaux, la garde est dans `listerLesOnboardings`, avant
 * toute lecture. Aucune adresse, aucune lettre.
 */
export const instant = false

/** Les plafonds du harnais (`scripts/taches/executer.ts`), rappelés à côté du budget. */
const PLAFONDS = 'balayage 30 $, premiere-lettre 40 $'

export default async function Onboardings() {
  const { accès, tableau } = await listerLesOnboardings()

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Onboardings</h1>
        <p className="text-ardoise">
          Les onboardings lancés sur l’API, tels que les tâches les rapportent. Le registre Notion reste la source du statut.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
        </p>
      </header>

      {tableau === null ? (
        <Panneau ton="rose">
          <p className="text-encre">
            La base Postgres n’est pas en service sur cet environnement (`SOURCE_ACCES` vaut `notion`, ou `DATABASE_URL` est
            absente) : aucun onboarding à montrer.
          </p>
        </Panneau>
      ) : (
        <>
          <Budget mois={tableau.mois} budget={tableau.budget} />
          {tableau.enCours.length === 0 ? (
            <p className="text-ardoise">
              Aucun onboarding en cours. Un onboarding apparaît ici au premier run `balayage` ou `premiere-lettre` lancé sur une
              organisation.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {tableau.enCours.map((vue) => (
                <Onboarding key={vue.onboarding.id} vue={vue} />
              ))}
            </div>
          )}
          {tableau.clos.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-titre text-h3 font-semibold text-encre">Terminés</h2>
              <p className="text-ardoise">Espace ouvert depuis plus de quatorze jours.</p>
              <Repliable reste={tableau.clos.length} nom="onboardings terminés">
                <ul className="flex flex-col gap-2">
                  {tableau.clos.map((vue) => (
                    <li key={vue.onboarding.id} className="text-encre">
                      <Link href={`/espaces/abonnements/${vue.onboarding.slug}#onboarding`} className="underline underline-offset-2">
                        {vue.onboarding.organisation?.nom ?? vue.onboarding.nom ?? vue.onboarding.slug}
                      </Link>{' '}
                      <span className="label-mono text-ardoise">{formaterDollars(vue.coûtTotalUsd)}</span>
                    </li>
                  ))}
                </ul>
              </Repliable>
            </section>
          ) : null}
        </>
      )}
    </main>
  )
}

function Budget({ mois, budget }: { mois: string; budget: DécisionDeBudget }) {
  if (budget.sorte === 'sans-budget') {
    return (
      <p className="text-ardoise">
        <span className="label-mono">{mois}</span> · {formaterDollars(budget.dépenséUsd)} dépensés ce mois. Aucun budget posé
        (`ONBOARDING_BUDGET_MENSUEL_USD`) : aucun run n’est refusé.
      </p>
    )
  }
  const reste = Math.max(0, budget.budgetUsd - budget.dépenséUsd)
  return (
    <Panneau ton={budget.sorte === 'refusé' ? 'rose' : 'neutre'}>
      <p className="text-encre">
        <span className="label-mono">{mois}</span> · {formaterDollars(budget.dépenséUsd)} dépensés sur un budget de{' '}
        {formaterDollars(budget.budgetUsd)}, reste {formaterDollars(reste)}. Un run n’est accepté que si son plafond tient dans
        ce reste ({PLAFONDS}) ; sinon le harnais s’arrête avant d’ouvrir la session.
      </p>
    </Panneau>
  )
}

function Onboarding({ vue }: { vue: VueDOnboarding }) {
  const o = vue.onboarding
  const nom = o.organisation?.nom ?? o.nom ?? o.slug
  return (
    <section className="flex flex-col gap-4 border border-gris-ligne p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-titre text-h3 font-semibold text-encre">
          {o.organisation ? (
            <Link href={`/espaces/abonnements/${o.slug}#onboarding`} className="underline underline-offset-2">
              {nom}
            </Link>
          ) : (
            nom
          )}
        </h2>
        <p className="label-mono text-ardoise">
          {o.slug} · {o.exécuteur} · {résuméDeLÉtape(vue)}
          {vue.dernierRun ? ` · ${libelléDuRun(vue.dernierRun)}` : ''}
        </p>
      </div>
      <MotifDeBlocage vue={vue} />
      <FriseDOnboarding vue={vue} />
      <MétaDOnboarding vue={vue} />
      {o.organisation ? null : (
        <p className="text-ardoise">L’organisation n’est pas encore dans le portail : elle y entre à l’étape B, à la première lettre.</p>
      )}
    </section>
  )
}
