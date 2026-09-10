import Link from 'next/link'
import { Logo } from '@/components/marque'
import { MenuBas } from '@/components/menu-bas'
import { NavLatérale } from '@/components/nav-laterale'
import { Quitter } from '@/components/quitter'

/**
 * La coquille de l'espace client : un rail à gauche, le contenu à droite.
 *
 * La structure vient de la maquette du tableau de bord. L'apparence ne lui doit
 * rien : couleurs, typographie, rayons et badges restent ceux de la charte
 * signauxfaibles. Le rail est blanc bordé de gris ligne, pas foncé.
 */
export type Onglet = {
  readonly href: string
  readonly libellé: string
  /**
   * Le libellé du menu de pied, où cinq entrées se partagent la largeur d'un
   * téléphone. C'est le même mot, abrégé : un synonyme ferait croire à deux
   * destinations différentes.
   */
  readonly libelléCourt: string
  /** Nombre affiché en pastille. Omis ou nul, rien n'est affiché. */
  readonly compte?: number | null
}

export function Coquille({
  organisation,
  onglets,
  children,
}: {
  organisation: string
  onglets: readonly Onglet[]
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-gris-ligne lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 p-6 lg:sticky lg:top-0 lg:h-dvh">
          <div className="flex flex-col gap-1">
            <Logo />
            <span className="label-mono text-ardoise">{organisation}</span>
          </div>

          {/* Le rail ne sert que sur grand écran : sous cette largeur, c'est le
              menu de pied qui porte la navigation. */}
          <div className="hidden lg:block">
            <NavLatérale onglets={onglets} />
          </div>

          <div className="mt-auto hidden flex-col gap-2 lg:flex">
            <p className="label-mono text-ardoise">Accès personnel, à ne pas transférer</p>
            <Quitter />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">{children}</main>
        <div className="px-6 pb-6 lg:hidden">
          <Quitter />
        </div>
        <MenuBas onglets={onglets} />
      </div>
    </div>
  )
}

/**
 * L'en-tête d'un écran : surtitre mono, titre, et à droite l'état de la veille.
 */
export function EntêteÉcran({
  surtitre,
  titre,
  état,
}: {
  surtitre: string
  titre: string
  état?: string
}) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-gris-ligne pb-5">
      <div className="flex flex-col gap-1">
        <p className="label-mono text-ardoise">{surtitre}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">{titre}</h1>
      </div>
      {état ? (
        <p className="flex items-center gap-2 rounded-full border border-gris-ligne px-3 py-1.5 label-mono text-ardoise">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rose" />
          {état}
        </p>
      ) : null}
    </header>
  )
}

/** Une tuile de chiffre. La mention secondaire reste en mono, comme les labels. */
export function Tuile({
  intitulé,
  valeur,
  mention,
  accent = false,
}: {
  intitulé: string
  valeur: number | string
  mention?: string | null
  accent?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-carte border p-4 ${
        accent ? 'border-rose bg-fond-rose' : 'border-gris-ligne bg-blanc'
      }`}
    >
      <p className="label-mono text-ardoise">{intitulé}</p>
      <p className="font-titre text-h2 font-bold text-encre">{valeur}</p>
      {mention ? <p className="label-mono text-ardoise">{mention}</p> : null}
    </div>
  )
}

/** Un lien d'action, flèche rose : la seule forme de lien accentué de la charte. */
export function LienFlèche({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-corps text-encre">
      {children}
      <span aria-hidden="true" className="text-rose">
        →
      </span>
    </Link>
  )
}
