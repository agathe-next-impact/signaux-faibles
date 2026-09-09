import type { Metadata } from 'next'
import { Formulaire } from './formulaire'

export const metadata: Metadata = { title: 'Recevoir mon lien — signauxfaibles' }

export default function RecevoirMonLien() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-encre-tenue">
          signauxfaibles
        </p>
        <h1 className="font-titre text-2xl text-encre">Recevoir mon lien</h1>
        <p className="text-encre-douce">
          Votre accès tient dans un lien personnel, valable durablement. Indiquez
          l’adresse à laquelle vous recevez la veille, et il vous sera renvoyé.
        </p>
      </header>

      <Formulaire />

      <p className="text-sm text-encre-tenue">
        Il n’y a ni mot de passe ni compte à créer. Le lien vous est propre :
        ne le transférez pas.
      </p>
    </main>
  )
}
