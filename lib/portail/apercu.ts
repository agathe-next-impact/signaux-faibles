import { baseConfigurée } from '@/lib/base/client'
import { aperçuAvantEnvoiDuRegistre } from '@/lib/base/organisations'

/**
 * L'aperçu avant envoi, lu là où un envoi automatique partirait (1er novembre
 * 2026) : `POST /api/acces/ouvrir` et la remise d'une lettre par le moteur
 * (`POST /api/veille/editions`). Réglé par l'opératrice sur la fiche de
 * l'organisation, vrai par défaut.
 *
 * **Dans le doute, l'aperçu tient** : base absente ou injoignable, organisation
 * hors de Postgres. Le réglage existe pour que rien ne parte sans l'opératrice ;
 * un envoi qui part parce que la base n'a pas répondu le trahirait. L'envoi de
 * l'opératrice, lui, ne passe pas par ici : ses gestes sont la décision.
 */
export async function aperçuAvantEnvoi(registre: string): Promise<boolean> {
  if (!baseConfigurée()) return true
  try {
    return (await aperçuAvantEnvoiDuRegistre(registre)) ?? true
  } catch (erreur) {
    console.warn(`[aperçu] réglage non lu, l'aperçu tient (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    return true
  }
}
