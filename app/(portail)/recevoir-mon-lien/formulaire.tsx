'use client'

import { useActionState } from 'react'
import { envoyerMonLien, type RésultatEnvoi } from './actions'

const DÉPART: RésultatEnvoi = { état: 'repos' }

export function Formulaire() {
  const [résultat, action, enCours] = useActionState(envoyerMonLien, DÉPART)

  if (résultat.état === 'envoyé') {
    return (
      <p className="bg-fond-ardoise px-4 py-3 text-encre">
        Si cette adresse a un accès actif, le lien vient d’y être envoyé.
        Regardez votre boîte, et vos indésirables.
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-corps text-ardoise">
        Votre adresse professionnelle
      </label>

      {/* Champ et action côte à côte, comme la brique « champ + action » de la
          charte ; empilés sous 480 px, où la ligne ne tient plus. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="prenom@organisation.fr"
          className="min-w-0 flex-1 rounded-douce border border-gris-ligne bg-blanc px-4 py-3 text-corps text-encre outline-none placeholder:text-ardoise focus:border-ardoise"
        />
        {/* Le seul bouton primaire de l'écran : fond encre, texte blanc. */}
        <button
          type="submit"
          disabled={enCours}
          className="shrink-0 rounded-douce bg-encre px-5 py-3 font-medium text-blanc disabled:opacity-60"
        >
          {enCours ? 'Envoi…' : 'Recevoir'}
        </button>
      </div>

      {résultat.état === 'erreur' ? (
        <p className="text-label text-rose">
          L’envoi n’a pas abouti. Réessayez dans un moment.
        </p>
      ) : null}
    </form>
  )
}
