import type { Metadata } from 'next'
import Link from 'next/link'
import { BoutonDémo, CoquilleVitrine, OuvertureVitrine } from '@/components/vitrine'
import { cléDeCloisonnementDeDémonstration, SLUGS_DE_DÉMONSTRATION } from '@/lib/domaine/demonstration'
import { DÉMONSTRATIONS, type Démonstration } from '@/lib/vitrine/demonstrations'
import { éditionsDeDémonstration } from '@/lib/vitrine/espace-demonstration'

export const metadata: Metadata = {
  title: 'Exemples — signauxfaibles',
  description:
    'Trois organisations fictives, un cabinet de conseil, une PME industrielle et une entreprise de l’ESS : leur espace client ouvert en lecture seule et leur dernière lettre.',
  robots: { index: true, follow: true },
}

/**
 * « Exemples » (24 octobre 2026 ; refonte du 7 novembre 2026, à la demande de
 * l'opératrice) : trois cartouches en lignes, une par organisation fictive
 * (`lib/vitrine/demonstrations.ts`), chacune sur deux colonnes : l'accès à
 * l'**espace de démonstration** (`/lisiere-conseil`, `/tolmen-mecanique`,
 * `/atelier-passerelle`, le vrai espace client ouvert sans identifiant, en
 * lecture seule) et l'accès à la **dernière lettre**, montrée telle que le
 * client la reçoit par courriel (`/exemple/lettre/[organisation]`, gabarit des
 * courriels de production ; 8 novembre 2026), avec un second lien vers sa page
 * dans l'espace.
 * Les éditions viennent de la source que l'espace sert (`éditionsDeDémonstration`).
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
  const dernière = éditions[0]
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
          <p className="label-mono text-ardoise">La dernière lettre</p>
          {dernière ? (
            <>
              <p className="label-mono text-encre">{DATE.format(new Date(dernière.dateÉdition))}</p>
              <p className="text-encre">
                {dernière.titre}, {dernière.périodeCouverte}, telle qu’elle arrive dans la boîte du client.
              </p>
              <BoutonDAccès href={`/exemple/lettre/${slug}`}>Lire la dernière lettre</BoutonDAccès>
              <Link href={`/${slug}/lettres/${dernière.pageId}`} className="text-ardoise underline hover:text-encre">
                La lire dans l’espace
              </Link>
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
        chapeau="Trois organisations, une par profil de client, avec leur espace et leur dernière lettre. Elles sont fictives, comme leurs concurrents et les faits relevés ; la forme est exactement celle que reçoivent nos clients."
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
