import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { lireLaSantéDesEspaces, listerLesAbonnements } from '@/lib/auth/appartenance'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import { SynchroDesAccès } from '@/components/synchro-acces'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import { désarchiverLOrganisationDepuisLeTableau } from '@/lib/portail/archivage-actions'
import type { LigneDAbonnement } from '@/lib/base/situation'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours, type EntréeDuParcours, type Étape } from '@/lib/domaine/parcours'
import {
  aperçuDeLaSérie,
  cléDeLot,
  libelléDeLot,
  lireUnLot,
  LOTS_PROPOSÉS,
  prochaineÉchéance,
  semaineDuParcours,
  type Échéance,
} from '@/lib/domaine/placement'
import { champ, bouton } from '@/components/gestion-operatrice'
import { AperçuDeSérie, CetteSemaine, RetourDeSérie } from '@/components/serie-operatrice'
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
 *
 * Depuis le 13 novembre 2026, une organisation sans lecteur actif (accès
 * supprimés) quitte son groupe pour « Sans lecteur actif », sauf abonnement
 * Stripe ouvert ; une organisation archivée (bouton de sa fiche) quitte le
 * tableau pour la liste repliée « Organisations archivées », d'où elle se
 * désarchive.
 *
 * Depuis le 16 novembre 2026 (demande de l'opératrice : gérer les essais plus
 * simplement), le tableau dit **ce qui vient** : une colonne « échéance » (le
 * prochain lundi où le calendrier change l'étape, `prochaineÉchéance`), qui
 * ordonne chaque groupe, et un bandeau « Cette semaine » (`semaineDuParcours` :
 * les courriers de parcours dus et les changements de lundi). Et il **agit en
 * série** : une case par ligne, un geste (placer à une étape, prolonger, régler
 * la relecture), son effet montré organisation par organisation avant de
 * confirmer (`aperçuDeLaSérie`), puis `appliquerEnSérie`. La décision du
 * 31 octobre (« des données seulement » dans le tableau) est levée pour ces
 * seuls gestes de parcours ; tout le reste se règle toujours sur la fiche.
 */
export const instant = false

const MESSAGES: Record<string, string> = {
  prolongé: 'Essai prolongé : J0 est décalé.',
  'relecture-réglée': 'Destinataire des lettres envoyées par le portail réglé.',
  placée: 'Organisation placée à l’étape choisie.',
  'accès-offert': 'Accès offert : pas de fin d’essai, rien à placer.',
  'cible-invalide': 'Cette étape n’existe pas dans son essai.',
  'décision-impossible': 'Décision impossible depuis cet état.',
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
  archivée: 'Organisation archivée : ses lecteurs sont désactivés et ses travaux non pris abandonnés. Elle est sous le tableau, dans « Organisations archivées ».',
  désarchivée: 'Organisation désarchivée : elle revient dans le tableau. Ses lecteurs restent désactivés, à réactiver un par un sur sa fiche.',
  'pas-archivée': 'Cette organisation n’est pas archivée : rien à faire.',
}

const COLONNES = ['', 'organisation', 'santé', 'étape', 'échéance', 'j0', 'offre', 'stripe', 'lecteurs'] as const

/** L'identifiant du formulaire des gestes en série : les cases des lignes s'y rattachent par `form`. */
const FORMULAIRE_DE_SÉRIE = 'serie'

type Élément = { readonly ligne: LigneDAbonnement; readonly étape: Étape; readonly échéance: Échéance | null }

function jourLong(dateISO: string): string {
  return dateLongueDeParis(new Date(`${dateISO}T12:00:00Z`))
}

function chaînes(valeur: string | string[] | undefined): string[] {
  return valeur === undefined ? [] : Array.isArray(valeur) ? valeur : [valeur]
}

export default async function Abonnements({
  searchParams,
}: {
  searchParams: Promise<{
    reglage?: string | string[]
    slug?: string | string[]
    /** Le geste en série dont l'opératrice veut voir l'effet, et les organisations cochées. */
    lot?: string | string[]
    o?: string | string[]
    /** Le retour d'une série appliquée : le geste, les organisations réglées, les refusées avec leur code. */
    serie?: string | string[]
    ok?: string | string[]
    ko?: string | string[]
  }>
}) {
  const { accès, lignes, archivées } = await listerLesAbonnements()
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
  // colonne « étape », qui ne peuvent donc pas se contredire. Dans chaque
  // groupe, ce qui change le plus tôt d'abord, puis le nom (tri stable).
  const éléments: Élément[] = (lignes ?? [])
    .map((ligne) => {
      const entrée = entréeDeLaLigne(ligne, aujourdHui)
      return { ligne, étape: étapeDuParcours(entrée), échéance: prochaineÉchéance(entrée) }
    })
    .sort((a, b) => (a.échéance?.le ?? '9999').localeCompare(b.échéance?.le ?? '9999'))
  const groupes = grouperParStatut(éléments, ({ ligne, étape }) => statutDAbonnement(étape, ligne.état, ligne.lecteursActifs))
  const semaine = semaineDuParcours(lignes ?? [], aujourdHui)

  // Le geste en série en aperçu : rien n'est écrit tant qu'il n'est pas confirmé.
  const lot = lireUnLot(typeof paramètres.lot === 'string' ? paramètres.lot : undefined)
  const cochées = new Set(chaînes(paramètres.o))
  const aperçu = lot ? aperçuDeLaSérie(lot, (lignes ?? []).filter((l) => cochées.has(l.slug)), aujourdHui) : null
  const série = lireUnLot(typeof paramètres.serie === 'string' ? paramètres.serie : undefined)
  const réglées = (typeof paramètres.ok === 'string' ? paramètres.ok : '').split(',').filter(Boolean)
  const refusées = (typeof paramètres.ko === 'string' ? paramètres.ko : '')
    .split(',')
    .filter(Boolean)
    .map((paire) => {
      const [slug, code] = paire.split(':')
      return { slug: slug ?? '', code: code ?? '' }
    })

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Abonnements</h1>
        <p className="text-ardoise">
          Une ligne par organisation, groupées par statut d’abonnement, ce qui change le plus tôt en tête de chaque groupe.
          L’étape est calculée comme dans l’espace du client. Cochez des organisations pour les placer à une étape ou prolonger
          leur essai d’un seul geste ; le reste se règle sur la fiche de chacune (« Gérer »), et l’abonnement chez Stripe.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
          {' · '}
          <Link href="/espaces/syntheses" className="text-encre underline underline-offset-2">
            Synthèses stratégiques
          </Link>
          {' · '}
          <Link href="/espaces/couts" className="text-encre underline underline-offset-2">
            Coûts des tâches
          </Link>
        </p>
      </header>

      {/* L'import de la base Notion « Accès » dans Postgres (13 novembre 2026) : aperçu, puis écriture confirmée. */}
      <SynchroDesAccès />

      {message ? (
        <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
          {slugRéglé ? `${slugRéglé} : ` : ''}
          {message}
        </p>
      ) : null}

      {série ? <RetourDeSérie libellé={libelléDeLot(série)} réglées={réglées} refusées={refusées} messages={MESSAGES} /> : null}

      {lignes && lignes.length > 0 ? <CetteSemaine semaine={semaine} /> : null}

      {lot && aperçu ? <AperçuDeSérie lot={cléDeLot(lot)} libellé={libelléDeLot(lot)} effets={aperçu} /> : null}

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
        <>
        <form id={FORMULAIRE_DE_SÉRIE} method="get" action="/espaces/abonnements" className="flex flex-wrap items-end gap-3">
          <label className="label-mono flex flex-col gap-1 text-ardoise">
            pour les organisations cochées
            <select name="lot" defaultValue={lot ? cléDeLot(lot) : 'placer:tronquee'} className={champ}>
              {LOTS_PROPOSÉS.map((proposé) => (
                <option key={proposé.clé} value={proposé.clé}>
                  {proposé.libellé}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={bouton}>
            Voir l’effet
          </button>
          <p className="text-ardoise">Rien n’est écrit avant la confirmation.</p>
        </form>
        <div className="overflow-x-auto border border-gris-ligne">
          <table className="w-full border-collapse text-corps">
            <thead>
              <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                {COLONNES.map(
                  (entête) => (
                    <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                      {entête === '' ? <span className="sr-only">choisir</span> : entête}
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
                {groupe.éléments.map(({ ligne, étape, échéance }) => (
                  <Ligne key={ligne.slug} ligne={ligne} étape={étape} échéance={échéance} santé={santé} cochée={cochées.has(ligne.slug)} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
        </>
      )}

      {archivées && archivées.length > 0 ? <Archivées archivées={archivées} /> : null}
    </main>
  )
}

const LIBELLÉS_D_OFFRE: Record<LigneDAbonnement['offre'], string> = {
  standard: 'standard',
  fondateur: 'tarif fondateur',
  gratuite: 'accès offert',
}

/** Ce que le parcours lit d'une ligne : l'étape en sort par la même fonction que l'espace du client. */
function entréeDeLaLigne(ligne: LigneDAbonnement, aujourdHui: string): EntréeDuParcours {
  return {
    organisation: {
      état: ligne.état,
      activéeLe: ligne.activéeLe,
      offre: ligne.offre,
      parutionsDEssai: ligne.parutionsDEssai,
    },
    abonnement: ligne.abonnement,
    aujourdHui,
  }
}

/**
 * Une ligne du tableau : sa case pour les gestes en série, ses données, et le
 * lien « Gérer ». Les autres réglages vivent sur la fiche de l'organisation.
 */
function Ligne({
  ligne,
  étape,
  échéance,
  santé,
  cochée,
}: {
  ligne: LigneDAbonnement
  étape: Étape
  échéance: Échéance | null
  santé: Promise<SantéDesEspaces | null>
  cochée: boolean
}) {
  const auPlafond = ligne.lecteursActifs >= LECTEURS_ACTIFS_MAX
  // Un essai sans J0 n'est pas une panne : il attend sa première lettre publiée (la fiche dit la suite en entier).
  const enAttenteDeJ0 = étape.étape === 'hors-parcours' && ligne.état === 'essai' && ligne.activéeLe === null

  return (
    <tr className="border-b border-gris-ligne align-top">
      <td className="px-4 py-3">
        <input
          type="checkbox"
          name="o"
          value={ligne.slug}
          form={FORMULAIRE_DE_SÉRIE}
          defaultChecked={cochée}
          aria-label={`Choisir ${ligne.nom}`}
          className="size-4 accent-encre"
        />
      </td>
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
      <td className="label-mono px-4 py-3 text-ardoise">
        {libelléDÉtape(étape)}
        {enAttenteDeJ0 ? (
          <>
            <br />
            j0 à la première lettre publiée
          </>
        ) : null}
      </td>
      <td className="label-mono px-4 py-3 text-ardoise">
        {échéance ? (
          <>
            {libelléDÉtape(échéance.étape)}
            <br />
            le {jourLong(échéance.le)}
          </>
        ) : (
          '·'
        )}
      </td>
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

/**
 * Les organisations archivées, sous le tableau et repliées : rien n'est effacé,
 * chacune se désarchive ici ou se consulte sur sa fiche (13 novembre 2026).
 */
function Archivées({ archivées }: { archivées: { slug: string; nom: string; archivéeLe: Date }[] }) {
  return (
    <details className="border border-gris-ligne">
      <summary className="cursor-pointer px-4 py-3 font-medium text-encre">
        Organisations archivées
        <span className="label-mono ml-3 font-normal text-ardoise">
          {archivées.length} organisation{archivées.length > 1 ? 's' : ''}
        </span>
      </summary>
      <ul className="flex flex-col divide-y divide-gris-ligne border-t border-gris-ligne">
        {archivées.map((o) => (
          <li key={o.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-encre">{o.nom}</p>
              <p className="label-mono text-ardoise">
                {o.slug} · archivée le {dateLongueDeParis(o.archivéeLe)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/espaces/abonnements/${o.slug}`} className="text-label text-encre underline underline-offset-2">
                Fiche
              </Link>
              <form action={désarchiverLOrganisationDepuisLeTableau}>
                <input type="hidden" name="slug" value={o.slug} />
                <BoutonEnvoi className="text-label text-ardoise underline decoration-gris-ligne underline-offset-2">Désarchiver</BoutonEnvoi>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}
