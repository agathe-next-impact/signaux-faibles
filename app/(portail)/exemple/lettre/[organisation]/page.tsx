import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CadreCourriel } from '@/components/cadre-courriel'
import { CoquilleVitrine } from '@/components/vitrine'
import { SLUGS_DE_DÉMONSTRATION } from '@/lib/domaine/demonstration'
import { courrielDeDémonstration } from '@/lib/vitrine/courriel-demonstration'

/**
 * « La dernière lettre » d'une organisation de démonstration, **telle qu'elle
 * arrive dans la boîte du client** (8 novembre 2026, demande de l'opératrice).
 *
 * La page ne rend pas la lettre : elle montre, dans un cadre de la même
 * origine, le document composé par le gabarit des courriels de production
 * (`/exemple/lettre/[organisation]/courriel`), avec son objet et sa date comme
 * dans une messagerie. Rien n'est lu : tout vient du code. Un slug qui n'est pas
 * une démonstration est introuvable.
 */
/**
 * Les trois organisations sont connues au build : la page est pré-rendue pour
 * chacune (rien n'y est lu) ; tout autre segment rend `notFound`. Sans cette
 * liste, `cacheComponents` refuse de pré-rendre une page qui lit `params` hors
 * d'un `Suspense` (`dynamicParams` n'est pas admis avec `cacheComponents`).
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

export default async function LettreReçue({ params }: { params: Promise<{ organisation: string }> }) {
  const { organisation } = await params
  const courriel = courrielDeDémonstration(organisation)
  if (!courriel) notFound()

  return (
    <CoquilleVitrine courante="exemple">
      <section aria-label="Le courriel reçu" className="border-b border-gris-ligne">
        <div className="flex flex-col gap-3 border-b border-gris-ligne px-6 py-8 lg:px-12">
          <p className="label-mono text-ardoise">{courriel.organisation} · organisation fictive · la lettre telle qu’elle est reçue</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-encre">
            <dt className="label-mono text-ardoise">De</dt>
            <dd>signauxfaibles</dd>
            <dt className="label-mono text-ardoise">Objet</dt>
            <dd className="font-medium">{courriel.objet}</dd>
            <dt className="label-mono text-ardoise">Date</dt>
            <dd>{courriel.date}</dd>
          </dl>
          <p className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/exemple" className="text-ardoise underline hover:text-encre">
              Retour aux exemples
            </Link>
            <Link href={`/${courriel.slug}`} className="text-ardoise underline hover:text-encre">
              Ouvrir l’espace de démonstration
            </Link>
          </p>
        </div>
        <CadreCourriel src={`/exemple/lettre/${courriel.slug}/courriel`} titre={`Courriel : ${courriel.objet}`} />
      </section>
    </CoquilleVitrine>
  )
}
