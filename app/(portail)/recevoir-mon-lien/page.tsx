import type { Metadata } from 'next'
import { LogoEmpile } from '@/components/marque'
import { Formulaire } from './formulaire'

export const metadata: Metadata = { title: 'Recevoir mon lien — signauxfaibles' }

export default function RecevoirMonLien() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-6">
        {/* Le verrouillage empilé porte déjà le motif et la baseline : ne pas
            les répéter, la charte n'emploie le motif qu'une fois par écran. */}
        <LogoEmpile />
        <h2 className="font-titre text-h2 font-bold text-encre">Recevoir mon lien</h2>
        <p className="text-ardoise">
          Votre accès tient dans un lien personnel, valable durablement. Indiquez
          l’adresse à laquelle vous recevez la veille, et il vous sera renvoyé.
        </p>
      </header>

      <Formulaire />

      {/* Mention de réassurance : 12 px gris, sous le champ, comme la charte. */}
      <p className="text-label text-ardoise">
        Il n’y a ni mot de passe ni compte à créer. Le lien vous est propre :
        ne le transférez pas.
      </p>
    </main>
  )
}
