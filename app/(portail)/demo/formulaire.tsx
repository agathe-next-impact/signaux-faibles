'use client'

import { useActionState } from 'react'
import { codeDePrescripteurValide, PARAMÈTRE_DU_PRESCRIPTEUR } from '@/lib/domaine/prescripteurs'
import type { ChampDeDémo } from '@/lib/portail/demo'
import { demanderUneDémo, type RésultatDemande } from './actions'

const DÉPART: RésultatDemande = { état: 'repos' }

const CHAMP =
  'min-w-0 rounded-douce border border-gris-ligne bg-blanc px-4 py-3 text-corps text-encre outline-none placeholder:text-ardoise focus:border-ardoise'

const MESSAGES_D_ERREUR: Record<ChampDeDémo, string> = {
  nom: 'Indiquez votre nom.',
  email: 'Indiquez une adresse email valide.',
  organisation: 'Indiquez votre organisation.',
  fonction: 'La fonction tient en 120 caractères au plus.',
  message: 'Le message tient en 2 000 caractères au plus.',
}

export function Formulaire({ champPiège }: { readonly champPiège: string }) {
  const [résultat, action, enCours] = useActionState(demanderUneDémo, DÉPART)
  // Le code du prescripteur vient de l'adresse (`/demo?de=<code>`), lu à
  // l'envoi : la page reste statique, sans lecture de `searchParams`.
  function envoyer(données: FormData) {
    const code = new URLSearchParams(window.location.search).get(PARAMÈTRE_DU_PRESCRIPTEUR)?.toLowerCase() ?? ''
    if (codeDePrescripteurValide(code)) données.set(PARAMÈTRE_DU_PRESCRIPTEUR, code)
    action(données)
  }

  if (résultat.état === 'envoyée') {
    return (
      <p className="bg-fond-ardoise px-4 py-3 text-encre">
        Merci, votre demande est partie. Vous recevrez une réponse par email
        pour convenir d’un créneau.
      </p>
    )
  }

  const valeurs = résultat.état === 'repos' ? null : résultat.valeurs
  const enErreur = new Set(résultat.état === 'invalide' ? résultat.champs : [])

  function erreur(champ: ChampDeDémo) {
    return enErreur.has(champ) ? (
      <p id={`${champ}-erreur`} className="text-label text-rose-texte">
        {MESSAGES_D_ERREUR[champ]}
      </p>
    ) : null
  }

  function décrit(champ: ChampDeDémo) {
    return enErreur.has(champ)
      ? { 'aria-invalid': true, 'aria-describedby': `${champ}-erreur` }
      : {}
  }

  return (
    <form action={envoyer} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="nom" className="text-corps text-ardoise">Votre nom</label>
        <input id="nom" name="nom" type="text" required maxLength={120} autoComplete="name"
          defaultValue={valeurs?.nom} className={CHAMP} {...décrit('nom')} />
        {erreur('nom')}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-corps text-ardoise">Votre adresse professionnelle</label>
        <input id="email" name="email" type="email" required autoComplete="email"
          placeholder="prenom@organisation.fr" defaultValue={valeurs?.email} className={CHAMP}
          {...décrit('email')} />
        {erreur('email')}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="organisation" className="text-corps text-ardoise">Votre organisation</label>
        <input id="organisation" name="organisation" type="text" required maxLength={160}
          autoComplete="organization" defaultValue={valeurs?.organisation} className={CHAMP}
          {...décrit('organisation')} />
        {erreur('organisation')}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="fonction" className="text-corps text-ardoise">Votre fonction (facultatif)</label>
        <input id="fonction" name="fonction" type="text" maxLength={120}
          autoComplete="organization-title" defaultValue={valeurs?.fonction} className={CHAMP}
          {...décrit('fonction')} />
        {erreur('fonction')}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-corps text-ardoise">
          Ce que vous aimeriez suivre (facultatif)
        </label>
        <textarea id="message" name="message" rows={4} maxLength={2000}
          defaultValue={valeurs?.message} className={CHAMP} {...décrit('message')} />
        {erreur('message')}
      </div>

      {/* Champ piège : hors de l'écran et de l'ordre de tabulation, ignoré des
          lecteurs d'écran. Une personne ne le voit pas, un robot le remplit. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={champPiège}>Ne pas remplir</label>
        <input id={champPiège} name={champPiège} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Le seul bouton primaire de l'écran : fond encre, texte blanc. */}
      <button
        type="submit"
        disabled={enCours}
        className="self-start rounded-douce bg-encre px-6 py-3 font-medium text-blanc disabled:opacity-60"
      >
        {enCours ? 'Envoi…' : 'Demander une démo'}
      </button>

      {résultat.état === 'erreur' ? (
        <p className="text-label text-rose-texte">
          L’envoi n’a pas abouti. Réessayez dans un moment.
        </p>
      ) : null}
    </form>
  )
}
