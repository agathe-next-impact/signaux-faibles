import type { Metadata } from 'next'
import { LigneDeSignaux } from '@/components/ligne-de-signaux'
import { Logo } from '@/components/logo'
import { Formulaire } from './formulaire'

/**
 * Le motif signature, employé ici comme la charte l'emploie sur sa couverture :
 * à l'entrée, jamais derrière du texte, et sept impulsions au plus.
 */
const MOTIF = [
  { position: 0.16, force: 'secondaire' as const },
  { position: 0.31, force: 'fort' as const },
  { position: 0.45, force: 'fort' as const },
  { position: 0.6, force: 'secondaire' as const },
  { position: 0.75, force: 'fort' as const },
]

export const metadata: Metadata = { title: 'Recevoir mon lien — signauxfaibles' }

export default function RecevoirMonLien() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Logo />
        <LigneDeSignaux impulsions={MOTIF} />
        <h1 className="font-titre text-h1 font-bold text-encre">Recevoir mon lien</h1>
        {/* L'italique Lora est la voix éditoriale : la baseline y a sa place. */}
        <p className="voix text-h3">Votre veille, rédigée.</p>
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
