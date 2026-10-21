/** Le coût d'un run, aux tarifs API publiés (dollars par million de jetons, 6 octobre 2026). */
import type { Usage } from '@/lib/moteur/redaction'

export type Tarif = { readonly entrée: number; readonly sortie: number; readonly cacheLecture: number; readonly cacheÉcriture: number; readonly recherche: number }

export const TARIFS: Readonly<Record<string, Tarif>> = {
  'claude-opus-5-5': { entrée: 4, sortie: 20, cacheLecture: 0.2, cacheÉcriture: 5, recherche: 0.01 },
  'claude-sonnet-5-5': { entrée: 2, sortie: 10, cacheLecture: 0.2, cacheÉcriture: 2.5, recherche: 0.01 },
}

export function coûtDe(modèle: string, usage: Usage, recherches = 0, tarif: Tarif = TARIFS[modèle] ?? TARIFS['claude-opus-5-5']!): number {
  return (
    (usage.entrée * tarif.entrée + usage.sortie * tarif.sortie + usage.cacheLecture * tarif.cacheLecture + usage.cacheÉcriture * tarif.cacheÉcriture) / 1_000_000 +
    recherches * tarif.recherche
  )
}
