import type { Metadata } from 'next'
import Link from 'next/link'
import { listerLaFile } from '@/lib/auth/appartenance'
import { Logo } from '@/components/marque'
import { Panneau, Tuile, Grille } from '@/components/coquille'
import type { TravailListé } from '@/lib/base/travaux'
import type { ÉtatTravail, TypeTravail } from '@/lib/base/schema'

export const metadata: Metadata = { title: 'File de travaux — signauxfaibles' }

/**
 * La file de travaux de l'opératrice (décision du 22 octobre 2026).
 *
 * Ce que le portail a décidé de faire produire, et où chaque travail en est :
 * à faire, pris par un run Trigger.dev, accepté et publié, refusé par les
 * portes et remis en file, abandonné après trois tentatives. Les abandons des
 * quatorze derniers jours restent visibles : un abandon silencieux serait une
 * lettre qui manque sans que personne ne le sache.
 *
 * Rien ne se règle ici : un travail se pose par `POST /api/veille/travaux`,
 * et la lettre refusée se relit dans le journal `runs` (portes et rapport).
 * Comme le sélecteur, la garde est dans `listerLaFile`, avant toute lecture ;
 * la page vit hors de `/[slug]` et n'emprunte pas la coquille.
 */
export const instant = false

const LIBELLÉ_D_ÉTAT: Record<ÉtatTravail, string> = {
  a_faire: 'à faire',
  pris: 'pris',
  accepte: 'accepté',
  refuse: 'refusé, à reprendre',
  abandonne: 'abandonné',
}

const LIBELLÉ_DE_TYPE: Record<TypeTravail, string> = {
  referentiel: 'référentiel',
  premiere_lettre: 'première lettre',
  lettre: 'lettre',
  revue: 'revue',
}

const ORDRE_DES_ÉTATS: readonly ÉtatTravail[] = ['pris', 'a_faire', 'refuse', 'abandonne', 'accepte']

const formatDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'medium', timeStyle: 'short' })

export default async function FileDeTravaux() {
  const { accès, file } = await listerLaFile()
  const travaux = file ? [...file.travaux].sort((a, b) => ORDRE_DES_ÉTATS.indexOf(a.état) - ORDRE_DES_ÉTATS.indexOf(b.état) || a.échéance.getTime() - b.échéance.getTime()) : []

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">File de travaux</h1>
        <p className="text-ardoise">
          Ce que le portail a décidé de faire produire, et où chaque lettre en est. Un travail
          refusé revient dans la file ; au troisième refus il est abandonné et reste affiché
          quatorze jours.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
        </p>
      </header>

      {file === null ? (
        <Panneau ton="rose">
          <p className="text-encre">
            La base Postgres n’est pas en service sur cet environnement (`SOURCE_ACCES` vaut
            `notion`, ou `DATABASE_URL` est absente) : aucune file à montrer.
          </p>
        </Panneau>
      ) : (
        <>
          <Grille étiquette="Comptes de la file" colonnes={4}>
            <Tuile intitulé="à faire" valeur={file.comptes.a_faire} />
            <Tuile intitulé="pris" valeur={file.comptes.pris} accent={file.comptes.pris > 0} />
            <Tuile intitulé="refusés" valeur={file.comptes.refuse} accent={file.comptes.refuse > 0} />
            <Tuile intitulé="abandonnés" valeur={file.comptes.abandonne} accent={file.comptes.abandonne > 0} mention={`${file.comptes.accepte} accepté${file.comptes.accepte > 1 ? 's' : ''} en tout`} />
          </Grille>

          {travaux.length === 0 ? (
            <p className="text-ardoise">Aucun travail ouvert. La file se remplit chaque matin pour la semaine qui vient.</p>
          ) : (
            <div className="overflow-x-auto border border-gris-ligne">
              <table className="w-full border-collapse text-corps">
                <thead>
                  <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                    {['organisation', 'travail', 'état', 'échéance', 'tentatives', 'pris par', 'pris le'].map((entête) => (
                      <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                        {entête}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {travaux.map((travail) => (
                    <Ligne key={travail.id} travail={travail} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  )
}

function Ligne({ travail }: { travail: TravailListé }) {
  const alerte = travail.état === 'abandonne' || travail.état === 'refuse'
  return (
    <tr className={`border-b border-gris-ligne align-top ${alerte ? 'bg-fond-rose' : ''}`}>
      <td className="px-4 py-3">
        <Link href={`/${travail.slug}`} className="text-encre underline underline-offset-2">
          {travail.slug}
        </Link>
      </td>
      <td className="px-4 py-3 text-encre">
        {LIBELLÉ_DE_TYPE[travail.type]}
        {travail.veille ? <span className="label-mono text-ardoise"> · {travail.veille}</span> : null}
      </td>
      <td className="px-4 py-3 text-encre">{LIBELLÉ_D_ÉTAT[travail.état]}</td>
      <td className="label-mono px-4 py-3 text-ardoise">{formatDate.format(travail.échéance)}</td>
      <td className="label-mono px-4 py-3 text-ardoise">{travail.tentatives}</td>
      <td className="label-mono px-4 py-3 text-ardoise">{travail.prisPar ?? '·'}</td>
      <td className="label-mono px-4 py-3 text-ardoise">{travail.prisLe ? formatDate.format(travail.prisLe) : '·'}</td>
    </tr>
  )
}
