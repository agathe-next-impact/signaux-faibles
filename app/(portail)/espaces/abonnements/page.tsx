import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { lireLaSantéDesEspaces, listerLesAbonnements } from '@/lib/auth/appartenance'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import type { LigneDAbonnement } from '@/lib/base/situation'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours, type Étape } from '@/lib/domaine/parcours'
import { grouperParStatut, statutDAbonnement } from '@/lib/domaine/statut-d-abonnement'
import type { SantéDesEspaces } from '@/lib/portail/gestion'

export const metadata: Metadata = { title: 'Abonnements — signauxfaibles' }

/**
 * Le tableau des abonnements de l'opératrice (19 octobre 2026).
 *
 * Une ligne par organisation : son état, son étape calculée (la même fonction
 * que l'espace client), J0, l'abonnement Stripe qui fait foi, ses lecteurs
 * actifs, la relecture des courriers. Et les deux réglages qu'elle a déjà par
 * la route `PATCH /api/veille/organisations` : prolonger l'essai, basculer la
 * relecture. L'abonnement lui-même ne se modifie pas ici : le lien mène à
 * Stripe, seule source de vérité, et le portail n'en tient qu'une copie.
 *
 * Comme le sélecteur, la garde est dans `listerLesAbonnements`, avant toute
 * lecture ; la page vit hors de `/[slug]` et n'emprunte pas la coquille.
 *
 * Du 29 octobre au 12 novembre 2026, les synthèses stratégiques du pilote
 * vivaient sous le tableau ; elles ont désormais leur écran,
 * `/espaces/syntheses`, auquel l'en-tête renvoie.
 *
 * Depuis le 31 octobre 2026, une colonne « santé » (les défauts du contrôle du
 * soir, `lireLaSantéDesEspaces`) et, par organisation, le lien « Gérer » vers
 * `/espaces/abonnements/[slug]` : pilote, espace, grille, fiche de veille,
 * lecteurs, décision et journal des courriers.
 *
 * Depuis le 12 novembre 2026, à sa demande, les lignes sont groupées par statut
 * d'abonnement (`grouperParStatut`, `lib/domaine/statut-d-abonnement.ts`), lu
 * dans l'étape calculée de chaque ligne : un en-tête par groupe, avec le nombre
 * d'organisations, et le nom pour ordre dans chaque groupe.
 */
export const instant = false

const MESSAGES: Record<string, string> = {
  prolongé: 'Essai prolongé : J0 est décalé.',
  'relecture-réglée': 'Relecture des courriers réglée.',
  inconnue: 'Organisation inconnue.',
  'pas-en-essai': 'Cette organisation n’est pas en essai : rien à prolonger.',
  'sans-j0': 'J0 n’est pas encore posé : rien à prolonger.',
  'au-delà-d-aujourdhui': 'Ce décalage mettrait J0 après aujourd’hui : refusé.',
  'offre-posée': 'Offre posée.',
  'parutions-réglées': 'Nombre de parutions complètes réglé.',
  'mis-en-parcours': 'Entrée dans le parcours : J0 est posé, la mécanique de fin d’essai suit.',
  'abonnée-stripe': 'Un abonnement Stripe est ouvert : cette organisation n’entre pas dans le parcours.',
  'parutions-invalides': 'Nombre de parutions hors bornes (1 à 8, et pas plus de restantes que de parutions).',
  'date-invalide': 'Date de prochaine lettre invalide.',
  échec: 'La base n’a pas répondu : réglage non appliqué.',
}

const COLONNES = ['organisation', 'santé', 'état', 'étape', 'j0', 'offre', 'stripe', 'lecteurs', 'courriers'] as const

/** Le lundi de la semaine prochaine, valeur par défaut du champ « prochaine lettre ». */
function lundiProchain(aujourdHui: string): string {
  const date = new Date(`${aujourdHui}T00:00:00Z`)
  const jour = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + (8 - jour))
  return date.toISOString().slice(0, 10)
}

export default async function Abonnements({
  searchParams,
}: {
  searchParams: Promise<{ reglage?: string | string[]; slug?: string | string[] }>
}) {
  const { accès, lignes } = await listerLesAbonnements()
  // La santé arrive en flux, cellule par cellule : le contrôle des espaces
  // dépasse souvent quatre secondes, et l'attendre figeait le tableau et ses
  // boutons (31 octobre 2026). Une seule lecture, partagée par les lignes.
  const santé = lireLaSantéDesEspaces().then((r) => r.santé)
  const paramètres = await searchParams
  const réglage = typeof paramètres.reglage === 'string' ? paramètres.reglage : undefined
  const slugRéglé = typeof paramètres.slug === 'string' ? paramètres.slug : undefined
  const message = réglage ? MESSAGES[réglage] : undefined
  const aujourdHui = aujourdHuiÀParis()
  // L'étape est calculée une fois par ligne : elle donne le groupe et la
  // colonne « étape », qui ne peuvent donc pas se contredire.
  const groupes = grouperParStatut(
    (lignes ?? []).map((ligne) => ({ ligne, étape: étapeDeLaLigne(ligne, aujourdHui) })),
    ({ ligne, étape }) => statutDAbonnement(étape, ligne.état),
  )

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Abonnements</h1>
        <p className="text-ardoise">
          Une ligne par organisation, groupées par statut d’abonnement. L’étape est calculée comme dans l’espace du client ;
          les réglages se font sur la fiche de chaque organisation (« Gérer »), et
          l’abonnement chez Stripe.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
          {' · '}
          <Link href="/espaces/syntheses" className="text-encre underline underline-offset-2">
            Synthèses stratégiques
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
            `notion`, ou `DATABASE_URL` est absente) : aucun abonnement à montrer.
          </p>
        </Panneau>
      ) : lignes.length === 0 ? (
        <p className="text-ardoise">Aucune organisation en base.</p>
      ) : (
        <div className="overflow-x-auto border border-gris-ligne">
          <table className="w-full border-collapse text-corps">
            <thead>
              <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                {COLONNES.map(
                  (entête) => (
                    <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                      {entête}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            {groupes.map((groupe) => (
              <tbody key={groupe.statut} aria-labelledby={`statut-${groupe.statut}`}>
                <tr className="border-b border-gris-ligne bg-fond-ardoise">
                  <th
                    id={`statut-${groupe.statut}`}
                    scope="rowgroup"
                    colSpan={COLONNES.length}
                    className="px-4 py-2 text-left font-medium text-encre"
                  >
                    {groupe.libellé}
                    <span className="label-mono ml-3 font-normal text-ardoise">
                      {groupe.éléments.length} organisation{groupe.éléments.length > 1 ? 's' : ''}
                    </span>
                  </th>
                </tr>
                {groupe.éléments.map(({ ligne, étape }) => (
                  <Ligne key={ligne.slug} ligne={ligne} étape={étape} santé={santé} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

    </main>
  )
}

const LIBELLÉS_D_OFFRE: Record<LigneDAbonnement['offre'], string> = {
  standard: 'standard',
  fondateur: 'tarif fondateur',
  gratuite: 'accès offert',
}

/** L'étape d'une ligne, par la même fonction que l'espace du client. */
function étapeDeLaLigne(ligne: LigneDAbonnement, aujourdHui: string): Étape {
  return étapeDuParcours({
    organisation: {
      état: ligne.état,
      activéeLe: ligne.activéeLe,
      offre: ligne.offre,
      parutionsDEssai: ligne.parutionsDEssai,
    },
    abonnement: ligne.abonnement,
    aujourdHui,
  })
}

/**
 * Une ligne du tableau : des données seulement, et le lien « Gérer » pour seul
 * geste (31 octobre 2026, décision de l'opératrice). Les réglages du parcours
 * vivent sur la fiche de l'organisation, section « Abonnement ».
 */
function Ligne({
  ligne,
  étape,
  santé,
}: {
  ligne: LigneDAbonnement
  étape: Étape
  santé: Promise<SantéDesEspaces | null>
}) {
  const auPlafond = ligne.lecteursActifs >= LECTEURS_ACTIFS_MAX

  return (
    <tr className="border-b border-gris-ligne align-top">
      <td className="px-4 py-3">
        <p className="text-encre">{ligne.nom}</p>
        <p className="label-mono text-ardoise">{ligne.slug}</p>
        <Link href={`/espaces/abonnements/${ligne.slug}`} className="text-label text-encre underline underline-offset-2">
          Gérer
        </Link>
      </td>
      <td className="label-mono px-4 py-3 text-ardoise">
        <Suspense fallback="lecture…">
          <SantéDeLaLigne slug={ligne.slug} santé={santé} />
        </Suspense>
      </td>
      <td className="label-mono px-4 py-3 text-ardoise">{ligne.état}</td>
      <td className="label-mono px-4 py-3 text-ardoise">{libelléDÉtape(étape)}</td>
      <td className="label-mono px-4 py-3 text-ardoise">
        {ligne.activéeLe ? dateLongueDeParis(ligne.activéeLe) : '·'}
        {ligne.essaiOuvertLe && !ligne.activéeLe ? (
          <>
            <br />
            essai ouvert le {dateLongueDeParis(ligne.essaiOuvertLe)}
          </>
        ) : null}
      </td>
      <td className="label-mono px-4 py-3 text-ardoise">{LIBELLÉS_D_OFFRE[ligne.offre]}</td>
      <td className="label-mono px-4 py-3 text-ardoise">
        {ligne.abonnement
          ? `${ligne.abonnement.état}${ligne.abonnement.formule ? ` · ${ligne.abonnement.formule}` : ''}${
              ligne.abonnement.périodeFin ? ` · ${dateLongueDeParis(ligne.abonnement.périodeFin)}` : ''
            }`
          : 'aucun'}
      </td>
      <td className={`label-mono px-4 py-3 ${auPlafond ? 'text-rose-texte' : 'text-ardoise'}`}>
        {ligne.lecteursActifs} sur {LECTEURS_ACTIFS_MAX}
      </td>
      <td className="label-mono px-4 py-3 text-ardoise">{ligne.relectureRequise ? 'à la relecture' : 'au client'}</td>
    </tr>
  )
}

/** La cellule « santé » d'une ligne, lue en flux sur la lecture partagée du contrôle. */
async function SantéDeLaLigne({ slug, santé }: { slug: string; santé: Promise<SantéDesEspaces | null> }) {
  const parSlug = await santé
  if (parSlug === null) return 'non lue'
  const défauts = parSlug.get(slug) ?? []
  if (défauts.length === 0) return 'rien à signaler'
  return (
    <span className="text-rose-texte" title={défauts.map((d) => d.code).join(', ')}>
      {défauts.length} défaut{défauts.length > 1 ? 's' : ''}
    </span>
  )
}
