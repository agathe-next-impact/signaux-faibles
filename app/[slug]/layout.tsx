import { Suspense } from 'react'
import Link from 'next/link'
import { exigerAccès } from '@/lib/auth/appartenance'
import { Logo } from '@/components/logo'

/**
 * Le cadre du portail d'un client.
 *
 * Le contrôle d'appartenance s'exécute ici, dans `Garde`, avant que le moindre
 * contenu ne soit demandé. Il est isolé sous une frontière `Suspense` parce
 * qu'il lit le cookie : avec `cacheComponents`, le reste de la page peut ainsi
 * rester statique.
 *
 * Les pages appellent la même fonction pour obtenir l'identifiant
 * d'organisation. Ce n'est pas une redite inutile : sans RLS derrière, un
 * écran qui oublierait le contrôle servirait les éditions d'un autre client.
 */
export default function LayoutClient({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  // `params` n'est pas attendu ici : avec `cacheComponents`, c'est une donnée
  // de requête, et l'attendre hors de la frontière empêcherait tout
  // pré-rendu de l'enveloppe. La promesse descend telle quelle dans `Garde`.
  return (
    <Suspense fallback={<Chargement />}>
      <Garde params={params}>{children}</Garde>
    </Suspense>
  )
}

async function Garde({
  params,
  children,
}: {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gris-ligne pb-4">
        <Link href={`/${accès.slug}`} className="flex flex-col gap-1">
          <Logo />
          <span className="label-mono text-ardoise">
            {accès.organisationLibellé || 'votre veille'}
          </span>
        </Link>

        <nav className="flex gap-4 text-corps">
          <Link href={`/${accès.slug}`} className="text-ardoise hover:text-encre">
            Cette semaine
          </Link>
          <Link href={`/${accès.slug}/semaines`} className="text-ardoise hover:text-encre">
            Archives
          </Link>
        </nav>
      </header>

      <main className="flex flex-col gap-10">{children}</main>

      <footer className="mt-auto border-t border-gris-ligne pt-4 font-mono text-label text-ardoise">
        Accès personnel, à ne pas transférer
      </footer>
    </div>
  )
}

function Chargement() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 text-ardoise">
      <p>Chargement…</p>
    </div>
  )
}
