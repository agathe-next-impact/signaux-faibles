import type { Metadata } from 'next'
import { CoquilleVitrine } from '@/components/vitrine'
import { HéroAvantAprès, HéroChiffres, HéroTroisNiveaux, HéroVidéo } from '@/components/vitrine-heros'

export const metadata: Metadata = {
  title: 'Ouvertures candidates — signauxfaibles',
  // Page de travail, jamais indexée : elle disparaît une fois l'ouverture choisie.
  robots: { index: false, follow: false },
}

const CANDIDATES = [
  { lettre: 'A', nom: 'La vidéo', rendu: <HéroVidéo /> },
  { lettre: 'B', nom: 'Trois chiffres', rendu: <HéroChiffres /> },
  { lettre: 'C', nom: 'Avant, après', rendu: <HéroAvantAprès /> },
  { lettre: 'D', nom: 'Trois niveaux', rendu: <HéroTroisNiveaux /> },
] as const

/**
 * Les quatre ouvertures candidates de l'accueil, à la suite (7 novembre 2026).
 * Page de travail ouverte par le proxy à l'adresse exacte, sans lecture de
 * Notion ni de Postgres, à retirer avec `components/vitrine-heros.tsx` une
 * fois l'ouverture retenue posée sur l'accueil.
 */
export default function Héros() {
  return (
    <CoquilleVitrine courante="accueil">
      {CANDIDATES.map((c) => (
        <div key={c.lettre} id={c.lettre.toLowerCase()}>
          <p className="border-b border-gris-ligne bg-fond-neutre px-6 py-3 label-mono text-ardoise lg:px-12">
            Ouverture {c.lettre} · {c.nom}
          </p>
          {c.rendu}
        </div>
      ))}
    </CoquilleVitrine>
  )
}
