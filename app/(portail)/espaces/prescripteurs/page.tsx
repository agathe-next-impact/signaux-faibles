import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import { listerLesPrescripteurs } from '@/lib/auth/appartenance'
import type { LigneDePrescripteur, TypePrescripteur } from '@/lib/base/prescripteurs'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours } from '@/lib/domaine/parcours'
import { PARAMÈTRE_DU_PRESCRIPTEUR } from '@/lib/domaine/prescripteurs'
import { racineDuPortail } from '@/lib/email/gabarit'
import { env } from '@/lib/env'
import { réglerLePartageAvecLePrescripteur } from '@/lib/portail/partage'

export const metadata: Metadata = { title: 'Prescripteurs — signauxfaibles' }

/**
 * Le tableau des prescripteurs de l'opératrice (24 octobre 2026,
 * `docs/prescripteurs.md`).
 *
 * Par prescripteur : son code, le lien de recommandation à lui donner, et les
 * organisations qu'il a recommandées avec leur étape, calculée comme dans
 * l'espace du client. Un seul réglage s'y fait : l'accord de partage, que
 * l'opératrice pose après l'accord du client, et qui fait apparaître
 * l'organisation sur l'écran « Vos recommandations » du prescripteur
 * (`lib/portail/partage.ts`). Un prescripteur se crée par
 * `POST /api/veille/prescripteurs` ; son accès offert et les réglages de ses
 * organisations passent par le tableau des abonnements.
 *
 * Comme les autres tableaux, la garde est dans `listerLesPrescripteurs`, avant
 * toute lecture. Le tableau ne montre aucune lettre : un prescripteur ne lit
 * jamais celles de ses clients, et l'opératrice les lit dans leur espace.
 */
export const instant = false

const TYPES: Record<TypePrescripteur, string> = {
  conseil: 'conseil',
  expertise_comptable: 'expertise comptable',
  juridique: 'juridique',
  chambre_consulaire: 'chambre consulaire',
  developpement_economique: 'développement économique',
  cluster_federation: 'cluster ou fédération',
  ess_financeur: 'ess ou financeur',
  autre: 'autre',
}

const MESSAGES: Record<string, string> = {
  'partage-réglé': 'Accord de partage enregistré.',
  inconnue: 'Organisation inconnue.',
  'non-recommandée': 'Cette organisation n’a pas de prescripteur : rien à partager.',
  échec: 'La base n’a pas répondu : rien n’a été modifié.',
}

export default async function Prescripteurs({
  searchParams,
}: {
  searchParams: Promise<{ partage?: string | string[]; slug?: string | string[] }>
}) {
  const { accès, lignes } = await listerLesPrescripteurs()
  const paramètres = await searchParams
  const message = typeof paramètres.partage === 'string' ? MESSAGES[paramètres.partage] : undefined
  const slugRéglé = typeof paramètres.slug === 'string' ? paramètres.slug : undefined
  const aujourdHui = aujourdHuiÀParis()
  const portail = racineDuPortail(env().PORTAIL_URL)

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Prescripteurs</h1>
        <p className="text-ardoise">
          Les prescripteurs recommandent des clients et ne reçoivent jamais de prospection. Leurs
          organisations recommandées n’en reçoivent pas non plus.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
        </p>
      </header>

      {message ? (
        <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
          {slugRéglé ? `${slugRéglé} : ` : ''}
          {message}
        </p>
      ) : null}

      {lignes === null ? (
        <Panneau ton="rose">
          <p className="text-encre">
            La base Postgres n’est pas en service sur cet environnement (`SOURCE_ACCES` vaut
            `notion`, ou `DATABASE_URL` est absente) : aucun prescripteur à montrer.
          </p>
        </Panneau>
      ) : lignes.length === 0 ? (
        <p className="text-ardoise">
          Aucun prescripteur. Un prescripteur se crée par `POST /api/veille/prescripteurs`, une fois
          son espace ouvert.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {lignes.map((ligne) => (
            <Prescripteur key={ligne.code} ligne={ligne} aujourdHui={aujourdHui} portail={portail} />
          ))}
        </div>
      )}
    </main>
  )
}

function Prescripteur({
  ligne,
  aujourdHui,
  portail,
}: {
  ligne: LigneDePrescripteur
  aujourdHui: string
  portail: string
}) {
  const lien = `${portail}/demo?${PARAMÈTRE_DU_PRESCRIPTEUR}=${ligne.code}`
  const abonnées = ligne.recommandées.filter((r) => {
    const étape = étapeDuParcours({ organisation: r, abonnement: r.abonnement, aujourdHui })
    return étape.étape === 'abonnee'
  }).length

  return (
    <section className="flex flex-col gap-4 border border-gris-ligne p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-titre text-h3 font-semibold text-encre">{ligne.nom}</h2>
        <p className="label-mono text-ardoise">
          {TYPES[ligne.type]} · {ligne.actif ? 'actif' : 'inactif'} · {ligne.recommandées.length} recommandée
          {ligne.recommandées.length > 1 ? 's' : ''} · {abonnées} abonnée{abonnées > 1 ? 's' : ''}
        </p>
      </div>
      <p className="text-ardoise">
        Lien de recommandation : <span className="font-mono text-encre select-all">{lien}</span>
      </p>

      {ligne.recommandées.length === 0 ? (
        <p className="text-ardoise">Aucune organisation recommandée pour l’instant.</p>
      ) : (
        <div className="overflow-x-auto border border-gris-ligne">
          <table className="w-full border-collapse text-corps">
            <thead>
              <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                {['organisation', 'recommandée le', 'étape', 'parutions d’essai', 'partage'].map((entête) => (
                  <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                    {entête}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ligne.recommandées.map((r) => (
                <tr key={r.slug} className="border-b border-gris-ligne last:border-b-0">
                  <td className="px-4 py-3 text-encre">
                    <Link href={`/${r.slug}`} className="underline underline-offset-2">
                      {r.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ardoise">{dateLongueDeParis(r.recommandéeLe)}</td>
                  <td className="label-mono px-4 py-3 text-ardoise">
                    {libelléDÉtape(étapeDuParcours({ organisation: r, abonnement: r.abonnement, aujourdHui }))}
                  </td>
                  <td className="px-4 py-3 text-ardoise">{r.parutionsDEssai}</td>
                  <td className="px-4 py-3">
                    <form action={réglerLePartageAvecLePrescripteur} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="slug" value={r.slug} />
                      <input type="hidden" name="partage" value={r.partageAvecPrescripteur ? 'non' : 'oui'} />
                      <span className="label-mono text-ardoise">{r.partageAvecPrescripteur ? 'accepté' : 'non'}</span>
                      <button
                        type="submit"
                        className="text-label text-ardoise underline decoration-gris-ligne underline-offset-2"
                      >
                        {r.partageAvecPrescripteur ? 'Retirer l’accord' : 'Le client a accepté'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
