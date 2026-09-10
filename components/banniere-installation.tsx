'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * La bannière d'installation.
 *
 * Deux chemins, parce que les navigateurs n'en offrent pas un seul. Chrome et
 * Edge émettent `beforeinstallprompt`, que l'on retient pour le déclencher au
 * moment choisi. Safari sur iOS n'émet rien : on y explique le geste, sans quoi
 * un iPhone n'aurait jamais l'information.
 *
 * Le refus est mémorisé sur l'appareil : une bannière qui revient à chaque
 * visite est une nuisance, pas une invitation.
 */
type ÉvénementInstallation = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const CLÉ_REFUS = 'sf-installation-refusee'

function estDéjàInstallée(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari sur iOS n'implémente pas display-mode et pose ce drapeau.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function estIOS(): boolean {
  const agent = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(agent) && !/CriOS|FxiOS/.test(agent)
}

/**
 * Ces deux valeurs n'existent que dans le navigateur et ne changent pas en
 * cours de vie de la page. `useSyncExternalStore` est la façon prévue de les
 * lire sans écart d'hydratation : le serveur reçoit l'instantané neutre
 * (bannière masquée), le client la vraie valeur juste après l'hydratation.
 */
const inerte = () => () => {}

function useRefusMémorisé(): boolean {
  return useSyncExternalStore(
    inerte,
    () => {
      try {
        return window.localStorage.getItem(CLÉ_REFUS) === '1'
      } catch {
        // Navigation privée ou stockage refusé : on se comporte comme si la
        // bannière n'avait jamais été refusée.
        return false
      }
    },
    () => true,
  )
}

function useInvitéIOS(): boolean {
  return useSyncExternalStore(
    inerte,
    () => estIOS() && !estDéjàInstallée(),
    () => false,
  )
}

export function BannièreInstallation() {
  const refusMémorisé = useRefusMémorisé()
  const invitéIOS = useInvitéIOS()
  const [invite, setInvite] = useState<ÉvénementInstallation | null>(null)
  const [masquée, setMasquée] = useState(false)

  useEffect(() => {
    const surInvite = (événement: Event) => {
      événement.preventDefault()
      if (estDéjàInstallée()) return
      setInvite(événement as ÉvénementInstallation)
    }
    window.addEventListener('beforeinstallprompt', surInvite)
    return () => window.removeEventListener('beforeinstallprompt', surInvite)
  }, [])

  const refuser = () => {
    try {
      window.localStorage.setItem(CLÉ_REFUS, '1')
    } catch {
      // Sans stockage, la bannière reviendra : c'est le moindre mal.
    }
    setInvite(null)
    setMasquée(true)
  }

  const installer = async () => {
    if (!invite) return
    await invite.prompt()
    await invite.userChoice
    setInvite(null)
  }

  if (masquée || refusMémorisé) return null
  if (!invite && !invitéIOS) return null

  return (
    <aside
      aria-label="Installer le portail"
      className="fixed inset-x-3 bottom-3 z-40 flex flex-col gap-3 rounded-carte border border-gris-ligne bg-blanc p-4 shadow-sm lg:left-auto lg:right-6 lg:bottom-6 lg:w-96"
    >
      <div className="flex flex-col gap-1">
        <p className="label-mono text-ardoise">installer</p>
        <p className="text-encre">
          Gardez votre veille à portée : le portail s’installe comme une application, et
          les semaines déjà ouvertes restent lisibles hors ligne.
        </p>
      </div>

      {invite ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* Le seul bouton primaire de cette bannière. */}
          <button
            type="button"
            onClick={installer}
            className="rounded-douce bg-encre px-4 py-2 font-medium text-blanc"
          >
            Installer
          </button>
          <button type="button" onClick={refuser} className="text-corps text-ardoise">
            Plus tard
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-label text-ardoise">
            Sur iPhone : bouton Partager, puis « Sur l’écran d’accueil ».
          </p>
          <button type="button" onClick={refuser} className="text-corps text-ardoise">
            Compris
          </button>
        </div>
      )}
    </aside>
  )
}
