import { notFound } from 'next/navigation'
import { exigerLecture } from '@/lib/auth/appartenance'
import { EntêteÉcran, Grille, Panneau, Tuile } from '@/components/coquille'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { dateLongueDeParis, étapeDuParcours } from '@/lib/domaine/parcours'
import { PARAMÈTRE_DU_PRESCRIPTEUR, étapeVueDuPrescripteur } from '@/lib/domaine/prescripteurs'
import { racineDuPortail } from '@/lib/email/gabarit'
import { env } from '@/lib/env'
import { espacePrescripteurDe } from '@/lib/portail/prescripteur'

/**
 * Vos recommandations (24 octobre 2026, `docs/prescripteurs.md`) : l'écran du
 * prescripteur, dans son propre espace.
 *
 * Il donne son lien de recommandation, et les organisations recommandées **qui
 * ont accepté** que leur prescripteur les voie : leur nom, la date de la
 * recommandation, et leur étape en quatre mots (`étapeVueDuPrescripteur`). Les
 * autres ne sont ni nommées ni comptées. Aucune lettre, aucun lecteur, aucune
 * formule : un prescripteur ne lit jamais la veille de ses clients.
 *
 * Comme « Mon abonnement », ce n'est pas un écran de veille : il ne lit aucune
 * édition, seulement Postgres, par la clé de cloisonnement de la session, et il
 * reste ouvert quel que soit le droit de lecture (`exigerLecture`). Il n'existe
 * que pour une organisation déclarée prescripteur : ailleurs, `notFound`. On y
 * arrive depuis « Mon abonnement », jamais par un onglet.
 */
export default async function VosRecommandations({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { accès } = await exigerLecture(slug)
  const espace = await espacePrescripteurDe(accès.organisationId)
  if (!espace) notFound()

  const aujourdHui = aujourdHuiÀParis()
  const lien = `${racineDuPortail(env().PORTAIL_URL)}/demo?${PARAMÈTRE_DU_PRESCRIPTEUR}=${espace.code}`
  const lignes = espace.partagées.map((r) => ({
    ...r,
    vue: étapeVueDuPrescripteur(étapeDuParcours({ organisation: r, abonnement: r.abonnement, aujourdHui })),
  }))
  const enEssai = lignes.filter((l) => l.vue === 'en essai').length
  const abonnées = lignes.filter((l) => l.vue === 'abonnée').length

  return (
    <>
      <EntêteÉcran surtitre="prescripteur" titre="Vos recommandations" />

      <div className="mt-8 flex max-w-3xl flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="font-titre text-h3 font-semibold text-encre">Votre lien de recommandation</h2>
          {espace.actif ? (
            <>
              <p className="text-ardoise">
                Une organisation qui demande une démonstration depuis ce lien vous est rattachée, et son
                essai compte quatre parutions complètes au lieu de deux.
              </p>
              <Panneau ton="ardoise">
                <p className="break-all font-mono text-encre select-all">{lien}</p>
              </Panneau>
            </>
          ) : (
            <Panneau ton="rose">
              <p className="text-encre">
                Votre lien de recommandation est suspendu. Les organisations déjà recommandées restent
                ci-dessous.
              </p>
            </Panneau>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-titre text-h3 font-semibold text-encre">Organisations recommandées</h2>
          <p className="text-ardoise">
            Une organisation n’apparaît ici qu’avec son accord. Vous ne lisez jamais sa veille.
          </p>
          {lignes.length === 0 ? (
            <p className="text-ardoise">Aucune organisation à afficher pour l’instant.</p>
          ) : (
            <>
              <Grille étiquette="Recommandations en chiffres" colonnes={3}>
                <Tuile intitulé="affichées" valeur={lignes.length} />
                <Tuile intitulé="en essai" valeur={enEssai} />
                <Tuile intitulé="abonnées" valeur={abonnées} accent={abonnées > 0} />
              </Grille>
              <div className="overflow-x-auto border border-gris-ligne">
                <table className="w-full border-collapse text-corps">
                  <thead>
                    <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                      {['organisation', 'recommandée le', 'étape'].map((entête) => (
                        <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                          {entête}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={`${l.nom}-${l.recommandéeLe.toISOString()}`} className="border-b border-gris-ligne last:border-b-0">
                        <td className="px-4 py-3 text-encre">{l.nom}</td>
                        <td className="px-4 py-3 text-ardoise">{dateLongueDeParis(l.recommandéeLe)}</td>
                        <td className="label-mono px-4 py-3 text-ardoise">{l.vue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
