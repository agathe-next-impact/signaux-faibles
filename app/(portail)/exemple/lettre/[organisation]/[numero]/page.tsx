import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { courrielDeDémonstration, paramètresDesLettresDeDémonstration } from '@/lib/vitrine/courriel-demonstration'
import { LettreReçue } from '../lettre-recue'

/**
 * Une lettre de la série d'une organisation de démonstration, par son numéro,
 * telle que reçue par courriel (`../lettre-recue.tsx`) : c'est par là que
 * « Exemples » mène à la lettre de la semaine précédente, et que la page va de
 * semaine en semaine. Toutes les lettres sont connues au build et pré-rendues ;
 * un numéro qu'aucune lettre ne porte rend `notFound`. Le segment `courriel`,
 * frère de `[numero]` sous l'organisation, est statique : Next.js le sert avant
 * le segment variable, et aucune lettre ne porte ce numéro.
 */
export function generateStaticParams(): Array<{ organisation: string; numero: string }> {
  return paramètresDesLettresDeDémonstration()
}

export async function generateMetadata({ params }: { params: Promise<{ organisation: string; numero: string }> }): Promise<Metadata> {
  const { organisation, numero } = await params
  const courriel = courrielDeDémonstration(organisation, numero)
  return {
    title: courriel ? `${courriel.objet} — exemple de lettre — signauxfaibles` : 'Exemple de lettre — signauxfaibles',
    robots: { index: false, follow: true },
  }
}

export default async function LettreReçueParNuméro({ params }: { params: Promise<{ organisation: string; numero: string }> }) {
  const { organisation, numero } = await params
  const courriel = courrielDeDémonstration(organisation, numero)
  if (!courriel) notFound()
  return <LettreReçue courriel={courriel} source={`/exemple/lettre/${courriel.slug}/${courriel.numéro}/courriel`} />
}
