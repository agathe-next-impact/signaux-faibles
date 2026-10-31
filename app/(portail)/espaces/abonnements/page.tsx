import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { lireLaSantéDesEspaces, listerLesAbonnements, listerLesSynthèses } from '@/lib/auth/appartenance'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import type { LigneDAbonnement } from '@/lib/base/situation'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours } from '@/lib/domaine/parcours'
import { publierUnePériode } from '@/lib/portail/publication'
import type { PériodeAPublier, SynthèsesDUneOrganisation } from '@/lib/domaine/strategie-vues'
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
 * Sous le tableau, depuis le 29 octobre 2026, les synthèses stratégiques du
 * pilote, période par période, avec le bouton qui les publie après relecture
 * (`listerLesSynthèses`, même garde, et `publierUnePériode`).
 *
 * Depuis le 31 octobre 2026, une colonne « santé » (les défauts du contrôle du
 * soir, `lireLaSantéDesEspaces`) et, par organisation, le lien « Gérer » vers
 * `/espaces/abonnements/[slug]` : pilote, espace, grille, fiche de veille,
 * lecteurs, décision et journal des courriers.
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

const MESSAGES_DE_SYNTHÈSE: Record<string, string> = {
  publiée: 'Période publiée : les lecteurs la voient à leur prochaine visite.',
  retirée: 'Période retirée : elle n’est plus montrée au client.',
  aucune: 'Aucune synthèse enregistrée pour cette période.',
  'hors-pilote': 'Cette organisation n’est pas dans le pilote des outils stratégiques.',
  'organisation-inconnue': 'Organisation inconnue.',
  échec: 'La base n’a pas répondu : rien n’a changé.',
}

const LIBELLÉS_D_ÉTAT: Record<PériodeAPublier['état'], string> = {
  proposée: 'proposée, non montrée',
  publiée: 'publiée',
  retirée: 'retirée',
  mêlée: 'publiée en partie, non montrée',
}

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
  searchParams: Promise<{ reglage?: string | string[]; slug?: string | string[]; synthese?: string | string[]; periode?: string | string[] }>
}) {
  const [{ accès, lignes }, { organisations }] = await Promise.all([listerLesAbonnements(), listerLesSynthèses()])
  // La santé arrive en flux, cellule par cellule : le contrôle des espaces
  // dépasse souvent quatre secondes, et l'attendre figeait le tableau et ses
  // boutons (31 octobre 2026). Une seule lecture, partagée par les lignes.
  const santé = lireLaSantéDesEspaces().then((r) => r.santé)
  const paramètres = await searchParams
  const réglage = typeof paramètres.reglage === 'string' ? paramètres.reglage : undefined
  const slugRéglé = typeof paramètres.slug === 'string' ? paramètres.slug : undefined
  const synthèse = typeof paramètres.synthese === 'string' ? paramètres.synthese : undefined
  const périodeRéglée = typeof paramètres.periode === 'string' ? paramètres.periode : undefined
  const message = réglage ? MESSAGES[réglage] : synthèse ? MESSAGES_DE_SYNTHÈSE[synthèse] : undefined
  const aujourdHui = aujourdHuiÀParis()

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Abonnements</h1>
        <p className="text-ardoise">
          Une ligne par organisation. L’étape est calculée comme dans l’espace du client ;
          les réglages se font sur la fiche de chaque organisation (« Gérer »), et
          l’abonnement chez Stripe.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
        </p>
      </header>

      {message && !synthèse ? (
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
                {['organisation', 'santé', 'état', 'étape', 'j0', 'offre', 'stripe', 'lecteurs', 'courriers'].map(
                  (entête) => (
                    <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                      {entête}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <Ligne key={ligne.slug} ligne={ligne} aujourdHui={aujourdHui} santé={santé} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Synthèses
        organisations={organisations}
        statut={message && synthèse ? `${slugRéglé ? `${slugRéglé}${périodeRéglée ? `, ${périodeRéglée}` : ''} : ` : ''}${message}` : null}
      />
    </main>
  )
}

function Synthèses({ organisations, statut }: { organisations: SynthèsesDUneOrganisation[] | null; statut: string | null }) {
  if (organisations === null) return null
  const bouton = 'rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc'
  return (
    <section id="syntheses" className="flex scroll-mt-6 flex-col gap-4">
      <h2 className="font-titre text-h2 font-bold text-encre">Synthèses stratégiques</h2>
      {statut ? (
        <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
          {statut}
        </p>
      ) : null}
      <p className="text-ardoise">
        Une période n’est montrée au client qu’une fois publiée en entier, après relecture du
        courriel « [Relecture] » ; « Relire et modifier » permet d’en retoucher les énoncés avant. Publier la rend visible à ses lecteurs dès leur prochaine
        visite, sur « Acteurs » et « Recommandations » ; retirer la leur cache aussitôt.
      </p>
      {organisations.length === 0 ? (
        <p className="text-ardoise">Aucune synthèse enregistrée pour le pilote.</p>
      ) : (
        <div className="overflow-x-auto border border-gris-ligne">
          <table className="w-full border-collapse text-corps">
            <thead>
              <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                {['organisation', 'période', 'lignes', 'état', 'publication'].map((entête) => (
                  <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                    {entête}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {organisations.flatMap((o) =>
                o.périodes.map((p, i) => (
                  <tr key={`${o.slug}:${p.période}`} className="border-b border-gris-ligne align-top">
                    <td className="px-4 py-3">
                      {i === 0 ? (
                        <>
                          <p className="text-encre">{o.nom}</p>
                          <Link href={`/${o.slug}/recommandations`} className="label-mono text-ardoise underline underline-offset-2">
                            {o.slug}
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-encre">{p.granularité === 'trimestre' ? 'Trimestre' : 'Mois'} {p.libellé}</p>
                      <p className="label-mono text-ardoise">{p.période}</p>
                      <Link href={`/espaces/syntheses/${o.slug}/${p.période}`} className="text-label text-encre underline underline-offset-2">
                        {p.état === 'publiée' ? 'Lire' : 'Relire et modifier'}
                      </Link>
                    </td>
                    <td className="label-mono px-4 py-3 text-ardoise">{p.lignes}</td>
                    <td className={`label-mono px-4 py-3 ${p.état === 'publiée' ? 'text-encre' : 'text-ardoise'}`}>{LIBELLÉS_D_ÉTAT[p.état]}</td>
                    <td className="px-4 py-3">
                      <form action={publierUnePériode} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="slug" value={o.slug} />
                        <input type="hidden" name="periode" value={p.période} />
                        {p.état === 'publiée' ? (
                          <>
                            <input type="hidden" name="etat" value="retire" />
                            <BoutonEnvoi className="text-label text-ardoise underline decoration-gris-ligne underline-offset-2">
                              Retirer
                            </BoutonEnvoi>
                          </>
                        ) : (
                          <>
                            <input type="hidden" name="etat" value="publie" />
                            <BoutonEnvoi className={bouton}>
                              Publier
                            </BoutonEnvoi>
                          </>
                        )}
                      </form>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const LIBELLÉS_D_OFFRE: Record<LigneDAbonnement['offre'], string> = {
  standard: 'standard',
  fondateur: 'tarif fondateur',
  gratuite: 'accès offert',
}

/**
 * Une ligne du tableau : des données seulement, et le lien « Gérer » pour seul
 * geste (31 octobre 2026, décision de l'opératrice). Les réglages du parcours
 * vivent sur la fiche de l'organisation, section « Abonnement ».
 */
function Ligne({
  ligne,
  aujourdHui,
  santé,
}: {
  ligne: LigneDAbonnement
  aujourdHui: string
  santé: Promise<SantéDesEspaces | null>
}) {
  const étape = étapeDuParcours({
    organisation: {
      état: ligne.état,
      activéeLe: ligne.activéeLe,
      offre: ligne.offre,
      parutionsDEssai: ligne.parutionsDEssai,
    },
    abonnement: ligne.abonnement,
    aujourdHui,
  })
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
