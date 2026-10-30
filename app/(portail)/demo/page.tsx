import type { Metadata } from 'next'
import Link from 'next/link'
import { LogoEmpile } from '@/components/marque'
import { CHAMP_PIÈGE } from '@/lib/portail/demo'
import { Formulaire } from './formulaire'

export const metadata: Metadata = { title: 'Demander une démo — signauxfaibles' }

/**
 * La page publique de demande de démonstration. Elle ne lit ni Notion ni
 * Postgres : le formulaire fait partir un courrier vers l'opératrice
 * (`lib/portail/demo.ts`), et rien d'autre.
 */
export default function Demo() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col gap-6">
        <LogoEmpile />
        <h2 className="font-titre text-h2 font-bold text-encre">Demander une démo</h2>
        <p className="text-ardoise">
          Laissez vos coordonnées : nous vous écrivons pour convenir d’un
          créneau et vous montrer une lettre de veille et l’espace qui
          l’accompagne.
        </p>
      </header>

      <Formulaire champPiège={CHAMP_PIÈGE} />

      {/* Mention de réassurance : 12 px gris, sous le formulaire, comme la charte. */}
      <p className="text-label text-ardoise">
        Vos coordonnées ne servent qu’à vous répondre. Déjà client ?{' '}
        <Link href="/recevoir-mon-lien" className="underline">
          Recevez votre lien d’accès
        </Link>
        .
      </p>
    </main>
  )
}
