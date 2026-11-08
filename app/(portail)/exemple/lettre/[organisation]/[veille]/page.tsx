import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { courrielDeDémonstration, paramètresDesLettresDeDémonstration } from '@/lib/vitrine/courriel-demonstration'
import { LettreReçue } from '../lettre-recue'

/**
 * La dernière lettre d'une veille (`ecosysteme` ou `concurrentielle`) d'une
 * organisation de démonstration, telle que reçue par courriel
 * (`../lettre-recue.tsx`) : les deux lectures que propose « Exemples »
 * (8 novembre 2026, demande de l'opératrice). Les six pages sont connues au
 * build et pré-rendues (rien n'y est lu) ; tout autre segment rend `notFound`.
 * Sans cette liste, `cacheComponents` refuse de pré-rendre une page qui lit
 * `params` hors d'un `Suspense` (`dynamicParams` n'est pas admis avec
 * `cacheComponents`).
 */
export function generateStaticParams(): Array<{ organisation: string; veille: string }> {
  return paramètresDesLettresDeDémonstration()
}

export async function generateMetadata({ params }: { params: Promise<{ organisation: string; veille: string }> }): Promise<Metadata> {
  const { organisation, veille } = await params
  const courriel = courrielDeDémonstration(organisation, veille)
  return {
    title: courriel ? `${courriel.objet} — exemple de lettre — signauxfaibles` : 'Exemple de lettre — signauxfaibles',
    robots: { index: false, follow: true },
  }
}

export default async function LettreReçueDUneVeille({ params }: { params: Promise<{ organisation: string; veille: string }> }) {
  const { organisation, veille } = await params
  const courriel = courrielDeDémonstration(organisation, veille)
  if (!courriel) notFound()
  return <LettreReçue courriel={courriel} source={`/exemple/lettre/${courriel.slug}/${courriel.veille}/courriel`} />
}
