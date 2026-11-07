import Link from 'next/link'
import { GoogleTagManager } from '@/components/google-tag-manager'
import { Logo } from '@/components/marque'
import { ADRESSE_DE_CONTACT } from '@/lib/email/gabarit'

/**
 * Les pages vitrines (23 octobre 2026) : l'accueil des visiteurs sans session,
 * « L'offre », « Exemples » et « Tarifs ». Elles ne lisent ni Notion ni Postgres : tout ce
 * qu'elles disent de l'offre vient de `lib/domaine/offre.ts` et des seuils du
 * contrat de la lettre, pour qu'un prix ou une règle ne soit écrit qu'une fois.
 *
 * **Refonte du 7 novembre 2026** (demande de l'opératrice, structure inspirée
 * d'un modèle de page produit, charte conservée) : la page tient dans un
 * **cadre**, une colonne bordée de deux filets verticaux, et chaque section est
 * une bande fermée par un filet horizontal. C'est la règle des grilles de la
 * charte (angle droit, filets partagés, pas de gouttière) portée à la page
 * entière : en-tête, sections et pied partagent les mêmes filets. Chaque
 * enfant de `CoquilleVitrine` est donc une bande (`OuvertureVitrine`,
 * `SectionVitrine`, `AppelFinal`, `BandeauLogos`), qui pose son filet du bas.
 *
 * Charte tenue ici : un seul bouton primaire par page (`BoutonDémo`), jamais
 * dans l'en-tête ; « Se connecter » sur fond encre dans l'en-tête, à la demande
 * de l'opératrice (23 octobre 2026), écart assumé ; l'appel de fin de page est
 * un bouton secondaire, à filet encre, quand la page a déjà son bouton
 * primaire ; les autres liens en flèche rose ; sentence case, capitales
 * réservées aux labels mono ; fond blanc, le fond neutre seulement pour
 * rythmer une bande.
 */
export type PageVitrine = 'accueil' | 'offre' | 'exemple' | 'tarifs'

const LIENS: ReadonlyArray<{ href: string; libellé: string; page: PageVitrine }> = [
  { href: '/offre', libellé: 'L’offre', page: 'offre' },
  { href: '/exemple', libellé: 'Exemples', page: 'exemple' },
  { href: '/tarifs', libellé: 'Tarifs', page: 'tarifs' },
]

/** La largeur du cadre, commune à l'en-tête, au contenu et au pied. */
const CADRE = 'mx-auto w-full max-w-6xl border-x border-gris-ligne'

function LienSeConnecter() {
  // Fond encre, texte blanc : décision de l'opératrice du 23 octobre 2026.
  return (
    <Link
      href="/recevoir-mon-lien"
      className="rounded-douce bg-encre px-4 py-2 text-corps font-medium whitespace-nowrap text-blanc hover:bg-encre/90"
    >
      Se connecter
    </Link>
  )
}

export function EnTêteVitrine({ courante }: { courante: PageVitrine }) {
  return (
    <header className="sticky top-0 z-40 border-b border-gris-ligne bg-blanc/95 backdrop-blur-sm">
      <div className={`${CADRE} flex h-16 items-center justify-between gap-4 px-6 lg:px-12`}>
        <Link href="/" aria-label="signauxfaibles, accueil" aria-current={courante === 'accueil' ? 'page' : undefined}>
          <Logo />
        </Link>
        <nav aria-label="Pages de présentation" className="hidden items-center gap-6 sm:flex">
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
          <LienSeConnecter />
        </nav>
        {/* Mobile : un menu natif, sans JavaScript, qui se ferme en changeant de page. */}
        <details className="group sm:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-douce border border-gris-ligne px-3 py-2 text-corps text-encre">
            Menu
            <span aria-hidden="true" className="text-rose transition-transform group-open:rotate-90">
              →
            </span>
          </summary>
          <nav
            aria-label="Pages de présentation"
            className="absolute inset-x-0 top-16 flex flex-col gap-4 border-b border-gris-ligne bg-blanc px-6 py-6"
          >
            {LIENS.map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                aria-current={courante === lien.page ? 'page' : undefined}
                className={courante === lien.page ? 'text-h3 text-encre' : 'text-h3 text-ardoise'}
              >
                {lien.libellé}
              </Link>
            ))}
            <p>
              <LienSeConnecter />
            </p>
          </nav>
        </details>
      </div>
    </header>
  )
}

export function PiedVitrine() {
  return (
    <footer>
      <div className={`${CADRE} grid grid-cols-1 sm:grid-cols-3`}>
        <div className="flex flex-col gap-2 border-b border-gris-ligne p-6 sm:border-b-0 lg:p-12">
          <Logo className="text-corps" />
          <p className="voix">Votre veille, rédigée.</p>
        </div>
        <nav
          aria-label="Pied de page"
          className="flex flex-col gap-2 border-b border-gris-ligne p-6 text-corps sm:border-b-0 sm:border-l lg:p-12"
        >
          <p className="label-mono text-ardoise">Découvrir</p>
          <Link href="/offre" className="text-encre hover:text-ardoise">L’offre</Link>
          <Link href="/exemple" className="text-encre hover:text-ardoise">Exemples</Link>
          <Link href="/tarifs" className="text-encre hover:text-ardoise">Tarifs</Link>
          <Link href="/demo" className="text-encre hover:text-ardoise">Demander une démo</Link>
        </nav>
        <div className="flex flex-col gap-2 p-6 text-corps sm:border-l sm:border-gris-ligne lg:p-12">
          <p className="label-mono text-ardoise">Clients</p>
          <Link href="/recevoir-mon-lien" className="text-encre hover:text-ardoise">Recevoir mon lien d’accès</Link>
          <a href={`mailto:${ADRESSE_DE_CONTACT}`} className="text-encre underline underline-offset-2 hover:text-ardoise">
            {ADRESSE_DE_CONTACT}
          </a>
        </div>
      </div>
      <div className="border-t border-gris-ligne">
        <p className={`${CADRE} px-6 py-4 label-mono text-ardoise lg:px-12`}>signauxfaibles · signauxfaibles.io</p>
      </div>
    </footer>
  )
}

/** La coquille d'une page vitrine : en-tête, bandes dans le cadre, pied. */
export function CoquilleVitrine({ courante, children }: { courante: PageVitrine; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <EnTêteVitrine courante={courante} />
      <main className={`${CADRE} flex flex-1 flex-col`}>{children}</main>
      <PiedVitrine />
      <GoogleTagManager />
    </div>
  )
}

/** L'en-tête d'une bande : surtitre mono, titre H2, chapeau. */
export function TêteDeSection({
  surtitre,
  titre,
  chapeau,
  disposition,
  id,
}: {
  surtitre: string
  titre: string
  chapeau?: React.ReactNode
  disposition: 'pile' | 'côte' | 'centre'
  /** L'identifiant du titre, pour une bande qui s'y rattache par `aria-labelledby`. */
  id?: string
}) {
  if (disposition === 'côte') {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col gap-2">
          <p className="label-mono text-ardoise">{surtitre}</p>
          <h2 id={id} className="font-titre text-h2 font-bold text-encre">{titre}</h2>
        </div>
        {chapeau ? <p className="text-ardoise lg:pt-6">{chapeau}</p> : null}
      </div>
    )
  }
  return (
    <div className={`flex max-w-3xl flex-col gap-2 ${disposition === 'centre' ? 'mx-auto items-center text-center' : ''}`}>
      <p className="label-mono text-ardoise">{surtitre}</p>
      <h2 id={id} className="font-titre text-h2 font-bold text-encre">{titre}</h2>
      {chapeau ? <p className="text-ardoise">{chapeau}</p> : null}
    </div>
  )
}

/**
 * Une bande : son en-tête, puis son contenu. `disposition` place l'en-tête :
 * empilé (par défaut), titre à gauche et chapeau à droite (`côte`), ou centré.
 * `ton="neutre"` pose le fond neutre de la charte, pour rythmer la page.
 */
export function SectionVitrine({
  surtitre,
  titre,
  chapeau,
  disposition = 'pile',
  ton = 'blanc',
  id,
  children,
}: {
  surtitre: string
  titre: string
  chapeau?: React.ReactNode
  disposition?: 'pile' | 'côte' | 'centre'
  ton?: 'blanc' | 'neutre'
  id?: string
  children?: React.ReactNode
}) {
  return (
    <section
      id={id}
      className={`flex scroll-mt-16 flex-col gap-8 border-b border-gris-ligne px-6 py-12 lg:px-12 ${
        ton === 'neutre' ? 'bg-fond-neutre' : ''
      }`}
    >
      <TêteDeSection surtitre={surtitre} titre={titre} chapeau={chapeau} disposition={disposition} />
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

/** Le bouton secondaire : filet encre, fond de la page. Pour l'appel de fin d'une page qui a déjà son primaire. */
export function BoutonDémoSecondaire({ libellé = 'Demander une démo' }: { libellé?: string }) {
  return (
    <Link
      href="/demo"
      className="rounded-douce border border-encre px-6 py-3 font-medium text-encre hover:bg-fond-ardoise"
    >
      {libellé}
    </Link>
  )
}

/**
 * L'ouverture d'une page : surtitre, titre H1, chapeau et ses actions. Avec un
 * `aperçu`, l'ouverture passe en deux colonnes sur grand écran : le texte à
 * gauche, l'aperçu du produit à droite sur fond neutre, séparés par un filet.
 */
export function OuvertureVitrine({
  surtitre,
  titre,
  chapeau,
  aperçu,
  children,
}: {
  surtitre: string
  titre: string
  chapeau: React.ReactNode
  aperçu?: React.ReactNode
  children?: React.ReactNode
}) {
  const texte = (
    <div className="flex max-w-3xl flex-col gap-6 px-6 py-12 lg:px-12">
      <p className="label-mono text-ardoise">{surtitre}</p>
      <h1 className="font-titre text-h1 font-bold text-encre">{titre}</h1>
      <p className="text-h3 leading-relaxed text-ardoise">{chapeau}</p>
      {children}
    </div>
  )
  if (!aperçu) return <section className="border-b border-gris-ligne">{texte}</section>
  return (
    <section className="grid grid-cols-1 border-b border-gris-ligne lg:grid-cols-2">
      <div className="flex items-center">{texte}</div>
      <div className="flex min-w-0 items-center border-t border-gris-ligne bg-fond-neutre p-6 lg:border-t-0 lg:border-l lg:p-12">
        {aperçu}
      </div>
    </section>
  )
}

/**
 * L'appel de fin de page : une bande centrée, sur fond neutre. `primaire`
 * seulement si la page n'a pas déjà son bouton primaire.
 */
export function AppelFinal({
  titre,
  chapeau,
  primaire = false,
}: {
  titre: string
  chapeau: string
  primaire?: boolean
}) {
  return (
    <section className="flex flex-col items-center gap-6 border-b border-gris-ligne bg-fond-neutre px-6 py-12 text-center lg:px-12">
      <h2 className="max-w-3xl font-titre text-h2 font-bold text-encre">{titre}</h2>
      <p className="max-w-2xl text-ardoise">{chapeau}</p>
      {primaire ? <BoutonDémo /> : <BoutonDémoSecondaire />}
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

/** Une question dépliable, sans JavaScript. */
export function Question({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-encre">
        <span className="font-medium">{titre}</span>
        <span aria-hidden="true" className="text-rose transition-transform group-open:rotate-90">
          →
        </span>
      </summary>
      <p className="mt-3 text-ardoise">{children}</p>
    </details>
  )
}
