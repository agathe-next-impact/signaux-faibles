import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import { lireLeFormulaireDeDemande } from '@/lib/auth/appartenance'
import { CRÉNEAUX_COWORK_PAR_SEMAINE } from '@/lib/domaine/onboarding'
import { moteurDesOnboardings } from '@/lib/portail/onboarding'
import { FormulaireDeDemande } from './formulaire'

export const metadata: Metadata = { title: 'Nouvelle demande — signauxfaibles' }

/**
 * La demande d'onboarding enregistrée par l'opératrice (lot 3 de
 * `docs/proposition-onboarding-admin.md`, 1er novembre 2026), à la place de
 * `/onboarding-demande` pour l'API. Rien n'est lancé à l'envoi (décision 4) :
 * la demande apparaît sur `/espaces/onboardings` avec le bouton « Générer les
 * référentiels ». Objectifs et lecteur final sont gardés en base jusqu'à ce que
 * la tâche rapporte la ligne du registre, trente jours au plus (décision 1).
 * Garde dans `lireLeFormulaireDeDemande`, avant toute lecture.
 */
export const instant = false

export default async function NouvelleDemande() {
  const { accès, créneaux } = await lireLeFormulaireDeDemande()
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Nouvelle demande</h1>
        <p className="text-ardoise">
          Enregistrer une demande d’onboarding. Rien ne part à l’envoi : la demande apparaît dans les onboardings, avec le bouton
          qui lance les référentiels.{' '}
          <Link href="/espaces/onboardings" className="text-encre underline underline-offset-2">
            Retour aux onboardings
          </Link>
        </p>
      </header>
      {créneaux === null ? (
        <Panneau ton="rose">
          <p className="text-encre">
            La base Postgres n’est pas en service sur cet environnement : la demande se fait par `/onboarding-demande`.
          </p>
        </Panneau>
      ) : (
        <FormulaireDeDemande créneauxCowork={{ pris: créneaux, max: CRÉNEAUX_COWORK_PAR_SEMAINE }} moteur={moteurDesOnboardings()} />
      )}
    </main>
  )
}
