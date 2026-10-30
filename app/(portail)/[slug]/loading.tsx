import { SqueletteDÉcran } from '@/components/squelette'

/**
 * Pendant qu'un écran de l'espace lit ses données (Notion par le cache,
 * Postgres borné à 1 500 ms pour les écrans stratégiques), le rail reste en
 * place et la zone de l'écran montre sa forme. Aucune lecture ici : ce fichier
 * ne voit ni la session ni l'organisation.
 */
export default function ChargementDeLÉcran() {
  return <SqueletteDÉcran />
}
