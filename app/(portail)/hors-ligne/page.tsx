import type { Metadata } from 'next'
import { LogoEmpile } from '@/components/marque'

export const metadata: Metadata = { title: 'Hors ligne — signauxfaibles' }

/**
 * La page servie quand le réseau manque et qu'aucune page n'est en cache.
 *
 * Elle est statique et mise en cache à l'installation du service worker :
 * c'est la seule page dont on soit certain qu'elle réponde toujours.
 */
export default function HorsLigne() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <LogoEmpile />
      <h2 className="font-titre text-h2 font-bold text-encre">Pas de réseau</h2>
      <p className="text-ardoise">
        Les semaines déjà ouvertes restent lisibles hors ligne. Celle-ci ne l’a pas encore
        été, elle reviendra dès que la connexion sera rétablie.
      </p>
      <p className="text-label text-ardoise">
        Rien n’est perdu : le portail ne conserve aucune saisie, il ne fait que lire.
      </p>
    </main>
  )
}
