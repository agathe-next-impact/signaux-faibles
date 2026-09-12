'use client'

import { useActionState } from 'react'
import { resynchroniser, type RésultatSynchro } from '@/lib/portail/resynchroniser'

const DÉPART: RésultatSynchro = { état: 'repos' }

/**
 * Le geste manuel de relecture de Notion, réservé à l'opérateur.
 *
 * Un vrai formulaire, comme « quitter » : l'action serveur porte le contrôle,
 * et le bouton fonctionne sans JavaScript. Le slug voyage en champ caché — il
 * est vérifié côté serveur, pas cru sur parole.
 */
export function Resynchroniser({ slug }: { slug: string }) {
  const [résultat, action, enCours] = useActionState(resynchroniser, DÉPART)

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={enCours}
        className="self-start text-label text-ardoise underline decoration-gris-ligne underline-offset-2 disabled:opacity-60"
      >
        {enCours ? 'Relecture de Notion…' : 'Resynchroniser depuis Notion'}
      </button>

      {résultat.état === 'fait' ? (
        // Zéro ne veut pas dire « rien à faire » : il veut dire « cet espace n'a
        // aucune lettre publiée ». Les deux se disaient « à jour · 0 lettres »,
        // et on cherchait la panne du côté de la synchro. Konica, 12/09/2026.
        <p className={`label-mono ${résultat.lettres === 0 ? 'text-rose' : 'text-ardoise'}`}>
          {résultat.lettres === 0
            ? 'aucune lettre publiée · rien à relire dans notion'
            : `à jour · ${résultat.lettres} lettre${résultat.lettres > 1 ? 's' : ''}`}
        </p>
      ) : null}

      {résultat.état === 'erreur' ? (
        <p className="label-mono text-rose">notion n’a pas répondu · espace inchangé</p>
      ) : null}
    </form>
  )
}
