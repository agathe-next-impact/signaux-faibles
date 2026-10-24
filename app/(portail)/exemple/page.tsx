import type { Metadata } from 'next'
import { LettreDeDémonstration, TableauDeBordDeDémonstration } from '@/components/demonstration'
import { Onglets } from '@/components/onglets'
import { BoutonDémo, CoquilleVitrine, OuvertureVitrine } from '@/components/vitrine'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'

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
 */
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

      <section className="flex flex-col gap-6">
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
