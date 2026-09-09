'use client'

import { useActionState } from 'react'
import { envoyerMonLien, type RésultatEnvoi } from './actions'

const DÉPART: RésultatEnvoi = { état: 'repos' }

export function Formulaire() {
  const [résultat, action, enCours] = useActionState(envoyerMonLien, DÉPART)

  if (résultat.état === 'envoyé') {
    return (
      <p className="rounded-carte bg-accent-douce px-4 py-3 text-encre">
        Si cette adresse a un accès actif, le lien vient d’y être envoyé.
        Regardez votre boîte, et vos indésirables.
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm text-encre-douce">
        Votre adresse professionnelle
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="prenom@organisation.fr"
        className="rounded-douce border border-trait bg-papier px-3 py-2 text-encre outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={enCours}
        className="rounded-douce bg-encre px-4 py-2 text-papier disabled:opacity-60"
      >
        {enCours ? 'Envoi en cours…' : 'Recevoir mon lien'}
      </button>
      {résultat.état === 'erreur' ? (
        <p className="text-sm text-impact-fort">
          L’envoi n’a pas abouti. Réessayez dans un moment.
        </p>
      ) : null}
    </form>
  )
}
