import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SLUGS_DE_DÉMONSTRATION } from '@/lib/domaine/demonstration'
import { courrielDeDémonstration } from '@/lib/vitrine/courriel-demonstration'
import { LettreReçue } from './lettre-recue'

/**
 * « La dernière lettre » d'une organisation de démonstration, telle que reçue
 * par courriel (`lettre-recue.tsx`). Les trois organisations sont connues au
 * build : la page est pré-rendue pour chacune (rien n'y est lu) ; tout autre
 * segment rend `notFound`. Sans cette liste, `cacheComponents` refuse de
 * pré-rendre une page qui lit `params` hors d'un `Suspense` (`dynamicParams`
 * n'est pas admis avec `cacheComponents`). Une lettre précise de la série est
 * sous `[numero]`.
 */
export function generateStaticParams(): Array<{ organisation: string }> {
  return Object.values(SLUGS_DE_DÉMONSTRATION).map((organisation) => ({ organisation }))
}

export async function generateMetadata({ params }: { params: Promise<{ organisation: string }> }): Promise<Metadata> {
  const { organisation } = await params
  const courriel = courrielDeDémonstration(organisation)
  return {
    title: courriel ? `${courriel.objet} — exemple de lettre — signauxfaibles` : 'Exemple de lettre — signauxfaibles',
    robots: { index: false, follow: true },
  }
}

export default async function DernièreLettreReçue({ params }: { params: Promise<{ organisation: string }> }) {
  const { organisation } = await params
  const courriel = courrielDeDémonstration(organisation)
  if (!courriel) notFound()
  return <LettreReçue courriel={courriel} source={`/exemple/lettre/${courriel.slug}/courriel`} />
}
