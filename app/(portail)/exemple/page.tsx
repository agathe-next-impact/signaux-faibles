import type { Metadata } from 'next'
import { LettreDeDémonstration, TableauDeBordDeDémonstration } from '@/components/demonstration'
import { Onglets } from '@/components/onglets'
import { BoutonDémo, CoquilleVitrine, OuvertureVitrine } from '@/components/vitrine'
import Link from 'next/link'
import { LienFlèche } from '@/components/coquille'
import { cléDeCloisonnementDeDémonstration, SLUGS_DE_DÉMONSTRATION } from '@/lib/domaine/demonstration'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import { éditionsDeDémonstration } from '@/lib/vitrine/espace-demonstration'

export const metadata: Metadata = {
  title: 'Exemples — signauxfaibles',
  description:
    'Le tableau de bord et la lettre de la semaine pour trois organisations fictives : un cabinet de conseil, une PME industrielle et une entreprise de l’ESS.',
  robots: { index: true, follow: true },
}

/**
 * « Exemples » (24 octobre 2026) : une seule page, un onglet par profil de
 * client (cabinet de conseil, PME, entreprise de l'ESS), et dans chacun deux
 * vues, le tableau de bord et la lettre. Les trois organisations sont fictives
 * (`lib/vitrine/demonstrations.ts`) ; la page ne lit ni Notion ni Postgres.
 * Ouverte par le proxy à l'adresse exacte (`PUBLICS_EXACTS`).
 *
 * Depuis le 7 novembre 2026, chaque onglet mène à l'**espace de démonstration**
 * de son organisation (`/lisiere-conseil`, `/tolmen-mecanique`,
 * `/atelier-passerelle`) : le vrai espace client, ouvert sans identifiant, en
 * lecture seule, sur les lettres fictives de `lib/vitrine/lettres-demonstration.ts`,
 * dont la liste est donnée ici, chacune vers sa page dans l'espace.
 */
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })

/**
 * Le lien vers l'espace de démonstration et la liste de ses lettres. Les
 * éditions viennent de la même source que l'espace (`éditionsDeDémonstration`) :
 * une lettre listée ici est une lettre que l'espace sert.
 */
function EspaceDeDémonstration({ démonstration }: { démonstration: (typeof DÉMONSTRATIONS)[number] }) {
  const slug = SLUGS_DE_DÉMONSTRATION[démonstration.clé]
  const éditions = éditionsDeDémonstration(cléDeCloisonnementDeDémonstration(démonstration.clé))
  return (
    <div className="flex flex-col gap-4 border border-gris-ligne bg-blanc p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-titre text-h3 font-semibold text-encre">L’espace de {démonstration.organisation}</h3>
          <p className="text-ardoise">
            Le même espace que celui de nos clients, ouvert sans identifiant, en lecture seule : vue d’ensemble, axes, acteurs,
            archives, sur {éditions.length} lettres.
          </p>
        </div>
        <LienFlèche href={`/${slug}`}>Ouvrir l’espace de démonstration</LienFlèche>
      </div>
      <ul className="flex flex-col gap-1 border-t border-gris-ligne pt-4">
        {éditions.map((édition) => (
          <li key={édition.pageId} className="flex flex-wrap items-baseline gap-x-3">
            <span className="label-mono text-ardoise">{DATE.format(new Date(édition.dateÉdition))}</span>
            <Link href={`/${slug}/lettres/${édition.pageId}`} className="text-encre underline decoration-gris-ligne underline-offset-2">
              {édition.titre}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Exemples() {
  return (
    <CoquilleVitrine courante="exemple">
      <OuvertureVitrine
        surtitre="Exemples"
        titre="Ce que vous recevez chaque semaine."
        chapeau="Le tableau de bord et la lettre de trois organisations, une par profil de client. Elles sont fictives, comme leurs concurrents et les faits relevés ; la forme est exactement celle que reçoivent nos clients."
      >
        <BoutonDémo libellé="Demander la vôtre" />
      </OuvertureVitrine>

      <section className="flex flex-col gap-6 border-b border-gris-ligne px-6 py-12 lg:px-12">
        <Onglets
          étiquette="Profils de client"
          ancre
          panneaux={DÉMONSTRATIONS.map((démonstration) => ({
            clé: démonstration.clé,
            libellé: démonstration.onglet,
            contenu: (
              <div className="flex flex-col gap-6">
                <div className="flex max-w-3xl flex-col gap-1">
                  <h2 className="font-titre text-h2 font-bold text-encre">{démonstration.organisation}</h2>
                  <p className="text-ardoise">{démonstration.portrait}</p>
                  <p className="label-mono text-ardoise">organisation fictive</p>
                </div>
                <EspaceDeDémonstration démonstration={démonstration} />
                <Onglets
                  étiquette={`Vues de ${démonstration.organisation}`}
                  taille="petite"
                  panneaux={[
                    {
                      clé: 'tableau',
                      libellé: 'Tableau de bord',
                      contenu: <TableauDeBordDeDémonstration démonstration={démonstration} />,
                    },
                    {
                      clé: 'lettre',
                      libellé: 'Lettre de la semaine',
                      contenu: <LettreDeDémonstration démonstration={démonstration} />,
                    },
                  ]}
                />
              </div>
            ),
          }))}
        />
      </section>
    </CoquilleVitrine>
  )
}
