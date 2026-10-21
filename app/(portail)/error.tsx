'use client'

import { useEffect } from 'react'
import { CLASSE_ACTION_DE_SECOURS, PageDeSecours } from '@/components/page-de-secours'

/**
 * La page d'erreur de l'enveloppe du portail.
 *
 * La règle 4 demande un mode dégradé sans page d'erreur côté client : le cache
 * longue durée sert la dernière version connue quand Notion ne répond pas. Ce
 * fichier est ce qui reste quand ce filet est percé (cache expiré depuis plus
 * de trente jours, schéma Notion modifié, environnement invalide) : une page
 * dans la charte, sans trace technique, et un bouton pour réessayer. Avant le
 * 14 octobre 2026, c'était la page d'erreur brute de Next.js.
 *
 * `error.message` n'est jamais affiché : il peut nommer une propriété Notion
 * ou une variable d'environnement. Il va dans les journaux Vercel, où
 * l'opérateur est alerté par le monitoring.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(`[portail] erreur rendue au lecteur (digest ${error.digest ?? 'absent'})`)
  }, [error])

  return (
    <PageDeSecours
      titre="Votre espace est momentanément indisponible"
      action={
        <button type="button" onClick={reset} className={CLASSE_ACTION_DE_SECOURS}>
          Réessayer
        </button>
      }
    >
      <p>
        Le portail n’a pas pu préparer cette page. Rien n’est perdu : vos lettres sont
        conservées, et l’opérateur est prévenu.
      </p>
      <p className="text-label">
        Si le problème persiste, écrivez à l’adresse qui figure en pied de vos lettres.
      </p>
    </PageDeSecours>
  )
}
