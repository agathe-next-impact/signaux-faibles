import type { Metadata } from 'next'
import Link from 'next/link'
import { BoutonDémo, CoquilleVitrine, OuvertureVitrine } from '@/components/vitrine'
import { cléDeCloisonnementDeDémonstration, SLUGS_DE_DÉMONSTRATION } from '@/lib/domaine/demonstration'
import { DÉMONSTRATIONS, type Démonstration } from '@/lib/vitrine/demonstrations'
import { éditionsDeDémonstration } from '@/lib/vitrine/espace-demonstration'
import { lettreDeLaSemaine, QUALIFICATIF_DE_LA_VEILLE, VEILLES_DE_DÉMONSTRATION } from '@/lib/vitrine/lettres-par-veille'

export const metadata: Metadata = {
  title: 'Exemples — signauxfaibles',
  description:
    'Trois organisations fictives, un cabinet de conseil, une PME industrielle et une entreprise de l’ESS : leur espace client ouvert en lecture seule et leurs deux lettres de la semaine, écosystème et concurrentielle.',
  robots: { index: true, follow: true },
}

/**
 * « Exemples » (24 octobre 2026 ; refonte du 7 novembre 2026, à la demande de
 * l'opératrice) : trois cartouches en lignes, une par organisation fictive
 * (`lib/vitrine/demonstrations.ts`), chacune sur deux colonnes : l'accès à
 * l'**espace de démonstration** (`/lisiere-conseil`, `/tolmen-mecanique`,
 * `/atelier-passerelle`, le vrai espace client ouvert sans identifiant, en
 * lecture seule) et les **deux lettres de la dernière semaine**, écosystème et
 * concurrentielle, montrées telles que le client les reçoit par courriel
 * (`/exemple/lettre/[organisation]/[veille]`, gabarit des courriels de
 * production ; 8 novembre 2026, à la demande de l'opératrice : rien d'autre,
 * ni lettre de la semaine précédente ni lecture dans l'espace).
 * Les éditions de l'espace viennent de la source qu'il sert (`éditionsDeDémonstration`),
 * les deux lettres de `lib/vitrine/lettres-par-veille.ts`.
 * La page ne lit ni Notion ni Postgres ; ouverte par le proxy à l'adresse
 * exacte (`PUBLICS_EXACTS`). Les onglets tableau de bord et lettre d'avant
 * sont retirés : l'espace montre les deux.
 */
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

/** Un bouton d'accès de cartouche : filet encre, angles droits comme les boutons de la vitrine ; le primaire de la page reste dans l'ouverture. */
function BoutonDAccès({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="self-start border border-encre px-4 py-2 font-medium text-encre hover:bg-fond-ardoise">
      {children}
    </Link>
  )
}

function Cartouche({ démonstration }: { démonstration: Démonstration }) {
  const slug = SLUGS_DE_DÉMONSTRATION[démonstration.clé]
  const éditions = éditionsDeDémonstration(cléDeCloisonnementDeDémonstration(démonstration.clé))
  const lettres = VEILLES_DE_DÉMONSTRATION.map((veille) => lettreDeLaSemaine(démonstration.clé, veille))
  const dernière = lettres[0]
  return (
    <article id={démonstration.clé} className="flex scroll-mt-24 flex-col border border-gris-ligne bg-blanc">
      <div className="flex flex-col gap-1 border-b border-gris-ligne p-6">
        <p className="label-mono text-ardoise">{démonstration.onglet} · organisation fictive</p>
        <h2 className="font-titre text-h2 font-bold text-encre">{démonstration.organisation}</h2>
        <p className="max-w-3xl text-ardoise">{démonstration.portrait}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col gap-3 border-b border-gris-ligne p-6 lg:border-r lg:border-b-0">
          <p className="label-mono text-ardoise">L’espace client</p>
          <p className="text-encre">
            Le même espace que celui de nos clients, ouvert sans identifiant, en lecture seule : vue d’ensemble, axes, acteurs,
            archives, sur {éditions.length} lettres.
          </p>
          <BoutonDAccès href={`/${slug}`}>Ouvrir l’espace de démonstration</BoutonDAccès>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <p className="label-mono text-ardoise">Les dernières lettres</p>
          {dernière ? (
            <>
              <p className="label-mono text-encre">{DATE.format(new Date(dernière.dateÉdition))}</p>
              <p className="text-encre">
                Les deux lettres de la semaine {dernière.périodeCouverte}, l’écosystème et la concurrence, telles qu’elles arrivent
                dans la boîte du client.
              </p>
              <div className="flex flex-wrap gap-3">
                {lettres.map((lettre) => (
                  <BoutonDAccès key={lettre.veille} href={`/exemple/lettre/${slug}/${lettre.veille}`}>
                    Lire la lettre {QUALIFICATIF_DE_LA_VEILLE[lettre.veille]}
                  </BoutonDAccès>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function Exemples() {
  return (
    <CoquilleVitrine courante="exemple">
      <OuvertureVitrine
        surtitre="Exemples"
        titre="Ce que vous recevez chaque semaine."
        chapeau="Trois organisations, une par profil de client, avec leur espace et leurs deux lettres de la semaine, l’écosystème et la concurrence. Elles sont fictives, comme leurs concurrents et les faits relevés ; la forme est exactement celle que reçoivent nos clients."
      >
        <BoutonDémo libellé="Demander la vôtre" />
      </OuvertureVitrine>

      <section aria-label="Organisations d’exemple" className="flex flex-col gap-6 border-b border-gris-ligne px-6 py-12 lg:px-12">
        {DÉMONSTRATIONS.map((démonstration) => (
          <Cartouche key={démonstration.clé} démonstration={démonstration} />
        ))}
      </section>
    </CoquilleVitrine>
  )
}
