import Link from 'next/link'
import { CadreCourriel } from '@/components/cadre-courriel'
import { CoquilleVitrine } from '@/components/vitrine'
import type { CourrielDeDémonstration } from '@/lib/vitrine/courriel-demonstration'

/**
 * Une lettre d'une organisation de démonstration, **telle qu'elle arrive dans
 * la boîte du client** (8 novembre 2026, demande de l'opératrice).
 *
 * La page ne rend pas la lettre : elle montre, dans un cadre de la même
 * origine, le document composé par le gabarit des courriels de production
 * (`…/courriel`), avec son objet et sa date comme dans une messagerie, et les
 * lettres voisines de la série pour aller de semaine en semaine. Rien n'est lu :
 * tout vient du code.
 */
export function LettreReçue({ courriel, source }: { courriel: CourrielDeDémonstration; source: string }) {
  const base = `/exemple/lettre/${courriel.slug}`
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
            {courriel.précédente !== null ? (
              <Link href={`${base}/${courriel.précédente}`} className="text-ardoise underline hover:text-encre">
                Lettre de la semaine précédente (n° {courriel.précédente})
              </Link>
            ) : null}
            {courriel.suivante !== null ? (
              <Link href={`${base}/${courriel.suivante}`} className="text-ardoise underline hover:text-encre">
                Lettre de la semaine suivante (n° {courriel.suivante})
              </Link>
            ) : null}
          </p>
        </div>
        <CadreCourriel src={source} titre={`Courriel : ${courriel.objet}`} />
      </section>
    </CoquilleVitrine>
  )
}
