import Link from 'next/link'
import { Logo, MarqueIcone } from '@/components/marque'
import { ADRESSE_DE_CONTACT } from '@/lib/email/gabarit'

/**
 * Les pages vitrines (23 octobre 2026) : l'accueil des visiteurs sans session,
 * « L'offre », « Exemples » et « Tarifs ». Elles ne lisent ni Notion ni Postgres : tout ce
 * qu'elles disent de l'offre vient de `lib/domaine/offre.ts` et des seuils du
 * contrat de la lettre, pour qu'un prix ou une règle ne soit écrit qu'une fois.
 *
 * Charte tenue ici : `BoutonDémo` posé une fois par la page, jamais par
 * l'en-tête ; « Se connecter » sur fond encre dans l'en-tête, à la demande de
 * l'opératrice (23 octobre 2026), ce qui fait deux boutons sur fond encre là
 * où la charte n'en veut qu'un ; les autres liens en flèche rose ; sentence
 * case, capitales réservées aux labels mono.
 */
export type PageVitrine = 'accueil' | 'offre' | 'exemple' | 'tarifs'

const LIENS: ReadonlyArray<{ href: string; libellé: string; page: PageVitrine }> = [
  { href: '/offre', libellé: 'L’offre', page: 'offre' },
  { href: '/exemple', libellé: 'Exemples', page: 'exemple' },
  { href: '/tarifs', libellé: 'Tarifs', page: 'tarifs' },
]

export function EnTêteVitrine({ courante }: { courante: PageVitrine }) {
  return (
    <header className="border-b border-gris-ligne">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <Link href="/" aria-label="signauxfaibles, accueil" aria-current={courante === 'accueil' ? 'page' : undefined}>
          <Logo />
        </Link>
        <nav aria-label="Pages de présentation" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LIENS.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              aria-current={courante === lien.page ? 'page' : undefined}
              className={`text-corps ${
                courante === lien.page
                  ? 'text-encre underline decoration-rose decoration-2 underline-offset-8'
                  : 'text-ardoise hover:text-encre'
              }`}
            >
              {lien.libellé}
            </Link>
          ))}
          {/* Fond encre, texte blanc : décision de l'opératrice du 23 octobre 2026. */}
          <Link
            href="/recevoir-mon-lien"
            className="rounded-douce bg-encre px-4 py-2 text-corps font-medium text-blanc hover:bg-encre/90"
          >
            Se connecter
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function PiedVitrine() {
  return (
    <footer className="mt-12 border-t border-gris-ligne">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Logo className="text-corps" />
          <p className="voix">Votre veille, rédigée.</p>
        </div>
        <nav aria-label="Pied de page" className="flex flex-col gap-2 text-corps">
          <Link href="/offre" className="text-ardoise hover:text-encre">L’offre</Link>
          <Link href="/exemple" className="text-ardoise hover:text-encre">Exemples</Link>
          <Link href="/tarifs" className="text-ardoise hover:text-encre">Tarifs</Link>
          <Link href="/demo" className="text-ardoise hover:text-encre">Demander une démo</Link>
          <Link href="/recevoir-mon-lien" className="text-ardoise hover:text-encre">Recevoir mon lien d’accès</Link>
        </nav>
        <p className="text-corps text-ardoise">
          <a href={`mailto:${ADRESSE_DE_CONTACT}`} className="underline underline-offset-2 hover:text-encre">
            {ADRESSE_DE_CONTACT}
          </a>
        </p>
      </div>
    </footer>
  )
}

/** La coquille d'une page vitrine : en-tête, contenu centré, pied. */
export function CoquilleVitrine({ courante, children }: { courante: PageVitrine; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <EnTêteVitrine courante={courante} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 pt-12 sm:pt-12">{children}</main>
      <PiedVitrine />
    </div>
  )
}

/** Une section : surtitre mono, titre H2, puis son contenu. */
export function SectionVitrine({
  surtitre,
  titre,
  chapeau,
  children,
}: {
  surtitre: string
  titre: string
  chapeau?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex max-w-3xl flex-col gap-2">
        <p className="label-mono text-ardoise">{surtitre}</p>
        <h2 className="font-titre text-h2 font-bold text-encre">{titre}</h2>
        {chapeau ? <p className="text-ardoise">{chapeau}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** Le bouton primaire des pages vitrines : un seul par page, fond encre. */
export function BoutonDémo({ libellé = 'Demander une démo' }: { libellé?: string }) {
  return (
    <Link href="/demo" className="self-start rounded-douce bg-encre px-6 py-3 font-medium text-blanc hover:bg-encre/90">
      {libellé}
    </Link>
  )
}

/** L'ouverture d'une page : le motif, un surtitre, le titre H1 et son chapeau. */
export function OuvertureVitrine({
  surtitre,
  titre,
  chapeau,
  children,
}: {
  surtitre: string
  titre: string
  chapeau: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <MarqueIcone className="h-10 w-10" />
      <p className="label-mono text-ardoise">{surtitre}</p>
      <h1 className="font-titre text-h1 font-bold text-encre">{titre}</h1>
      <p className="text-h3 leading-relaxed text-ardoise">{chapeau}</p>
      {children}
    </section>
  )
}

/** Une liste à puces carrées, comme les cases d'axes. */
export function ListeCarrée({ éléments }: { éléments: readonly React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {éléments.map((élément, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-encre" />
          <span>{élément}</span>
        </li>
      ))}
    </ul>
  )
}
