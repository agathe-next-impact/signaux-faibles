import type { Metadata } from 'next'
import { RenduDocument } from '@/components/document'
import { BoutonDémo, CoquilleVitrine, OuvertureVitrine } from '@/components/vitrine'
import { construireDocument } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { LETTRE_DE_DÉMONSTRATION } from '@/lib/vitrine/lettre-de-demonstration'

export const metadata: Metadata = {
  title: 'Exemple de lettre — signauxfaibles',
  description:
    'Une lettre réelle, en entier : la veille de Next Impact du 21 octobre 2026, telle que ses lecteurs la lisent dans leur espace.',
  robots: { index: true, follow: true },
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

/**
 * « Exemple de lettre » (23 octobre 2026) : une édition réelle rendue comme
 * dans l'espace client, mêmes composants, même parseur. Page publique, ouverte
 * par le proxy à l'adresse exacte (`PUBLICS_EXACTS`) ; elle ne lit ni Notion ni
 * Postgres, la lettre est dans le code (`lib/vitrine/lettre-de-demonstration.ts`).
 */
export default function Exemple() {
  const lettre = LETTRE_DE_DÉMONSTRATION
  const document = construireDocument(markdownVersBlocs(lettre.markdown))
  return (
    <CoquilleVitrine courante="exemple">
      <OuvertureVitrine
        surtitre="Exemple de lettre"
        titre="Une lettre réelle, en entier."
        chapeau={`La veille de ${lettre.organisation}, notre propre entreprise, parue le ${DATE.format(new Date(lettre.dateÉdition))}. C’est ce que lisent ses lecteurs, dans leur boîte de réception et dans leur espace.`}
      >
        <BoutonDémo libellé="Demander la vôtre" />
      </OuvertureVitrine>

      <section className="flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1 border-b border-gris-ligne pb-4">
          <p className="label-mono text-ardoise">
            {lettre.veille} · n° {lettre.numéro}
          </p>
          <p className="label-mono text-ardoise">Période couverte : {lettre.périodeCouverte}</p>
        </div>

        <aside className="border border-gris-ligne bg-fond-ardoise p-4">
          <h2 className="label-mono text-ardoise">Action de la semaine</h2>
          <p className="mt-2 text-encre">{lettre.actionDeLaSemaine}</p>
        </aside>

        <RenduDocument document={document} />
      </section>
    </CoquilleVitrine>
  )
}
