import type { Metadata } from 'next'
import Link from 'next/link'
import { lireLaSantéDesEspaces, listerLesAbonnements, listerLesSynthèses } from '@/lib/auth/appartenance'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import type { LigneDAbonnement } from '@/lib/base/situation'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours } from '@/lib/domaine/parcours'
import { mettreEnParcours, poserLOffre, prolongerLEssai, réglerLaRelecture, réglerLesParutions } from '@/lib/portail/reglages'
import { lienTableauDeBordStripe } from '@/lib/stripe/souscription'
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
  const [{ accès, lignes }, { organisations }, { santé }] = await Promise.all([listerLesAbonnements(), listerLesSynthèses(), lireLaSantéDesEspaces()])
  const paramètres = await searchParams
  const réglage = typeof paramètres.reglage === 'string' ? paramètres.reglage : undefined
  const slugRéglé = typeof paramètres.slug === 'string' ? paramètres.slug : undefined
  const synthèse = typeof paramètres.synthese === 'string' ? paramètres.synthese : undefined
  const périodeRéglée = typeof paramètres.periode === 'string' ? paramètres.periode : undefined
  const message = réglage ? MESSAGES[réglage] : synthèse ? MESSAGES_DE_SYNTHÈSE[synthèse] : undefined
  const aujourdHui = aujourdHuiÀParis()
  const modeRéel = process.env['STRIPE_MODE'] === 'reel'

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Abonnements</h1>
        <p className="text-ardoise">
          Une ligne par organisation. L’étape est calculée comme dans l’espace du client ;
          l’abonnement se modifie chez Stripe, jamais ici.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
        </p>
      </header>

      {message ? (
        <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
          {slugRéglé ? `${slugRéglé}${synthèse && périodeRéglée ? `, ${périodeRéglée}` : ''} : ` : ''}
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
                {['organisation', 'santé', 'état', 'étape', 'j0', 'offre', 'stripe', 'lecteurs', 'courriers', 'réglages'].map(
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
                <Ligne key={ligne.slug} ligne={ligne} aujourdHui={aujourdHui} modeRéel={modeRéel} santé={santé} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Synthèses organisations={organisations} />
    </main>
  )
}

function Synthèses({ organisations }: { organisations: SynthèsesDUneOrganisation[] | null }) {
  if (organisations === null) return null
  const bouton = 'rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc'
  return (
    <section id="syntheses" className="flex flex-col gap-4">
      <h2 className="font-titre text-h2 font-bold text-encre">Synthèses stratégiques</h2>
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
                            <button type="submit" className="text-label text-ardoise underline decoration-gris-ligne underline-offset-2">
                              Retirer
                            </button>
                          </>
                        ) : (
                          <>
                            <input type="hidden" name="etat" value="publie" />
                            <button type="submit" className={bouton}>
                              Publier
                            </button>
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

function Ligne({
  ligne,
  aujourdHui,
  modeRéel,
  santé,
}: {
  ligne: LigneDAbonnement
  aujourdHui: string
  modeRéel: boolean
  santé: SantéDesEspaces | null
}) {
  const défauts = santé?.get(ligne.slug) ?? []
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
  const prolongeable = ligne.état === 'essai' && ligne.activéeLe !== null
  const abonnéStripe = étape.étape === 'abonnee' && étape.source === 'stripe'
  const peutEntrer = (ligne.état === 'essai' || ligne.état === 'abonnee') && !abonnéStripe && ligne.offre !== 'gratuite'
  const champ = 'rounded-douce border border-gris-ligne bg-blanc px-2 py-1 text-corps text-encre'
  const bouton = 'rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc'
  const auPlafond = ligne.lecteursActifs >= LECTEURS_ACTIFS_MAX

  return (
    <tr className="border-b border-gris-ligne align-top">
      <td className="px-4 py-3">
        <p className="text-encre">{ligne.nom}</p>
        <Link href={`/${ligne.slug}/abonnement`} className="label-mono text-ardoise underline underline-offset-2">
          {ligne.slug}
        </Link>
        <br />
        <Link href={`/espaces/abonnements/${ligne.slug}`} className="text-label text-encre underline underline-offset-2">
          Gérer
        </Link>
      </td>
      <td className={`label-mono px-4 py-3 ${défauts.length > 0 ? 'text-rose-texte' : 'text-ardoise'}`}>
        {santé === null ? (
          'non lue'
        ) : défauts.length === 0 ? (
          'rien à signaler'
        ) : (
          <Link href={`/espaces/abonnements/${ligne.slug}#sante`} className="underline underline-offset-2" title={défauts.map((d) => d.code).join(', ')}>
            {défauts.length} défaut{défauts.length > 1 ? 's' : ''}
          </Link>
        )}
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
      <td className="px-4 py-3">
        <form action={poserLOffre} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="slug" value={ligne.slug} />
          <select name="offre" defaultValue={ligne.offre} className={champ} aria-label="Offre">
            <option value="standard">standard</option>
            <option value="fondateur">tarif fondateur</option>
            <option value="gratuite">accès offert</option>
          </select>
          <button type="submit" className={bouton}>
            Poser
          </button>
        </form>
      </td>
      <td className="label-mono px-4 py-3 text-ardoise">
        {ligne.abonnement ? (
          <>
            {ligne.abonnement.état}
            {ligne.abonnement.formule ? ` · ${ligne.abonnement.formule}` : ''}
            {ligne.abonnement.périodeFin ? ` · ${dateLongueDeParis(ligne.abonnement.périodeFin)}` : ''}
            <br />
            <a
              href={lienTableauDeBordStripe(ligne.abonnement.abonnementStripe, modeRéel)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ouvrir dans stripe
            </a>
          </>
        ) : (
          'aucun'
        )}
      </td>
      <td className={`label-mono px-4 py-3 ${auPlafond ? 'text-rose-texte' : 'text-ardoise'}`}>
        {ligne.lecteursActifs} sur {LECTEURS_ACTIFS_MAX}
      </td>
      <td className="px-4 py-3">
        <form action={réglerLaRelecture} className="flex flex-col gap-1">
          <input type="hidden" name="slug" value={ligne.slug} />
          <input type="hidden" name="requise" value={ligne.relectureRequise ? 'non' : 'oui'} />
          <p className="label-mono text-ardoise">{ligne.relectureRequise ? 'à la relecture' : 'au client'}</p>
          <button type="submit" className="self-start text-label text-ardoise underline decoration-gris-ligne underline-offset-2">
            {ligne.relectureRequise ? 'Envoyer au client' : 'Envoyer à la relecture'}
          </button>
        </form>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-3">
          <form action={réglerLesParutions} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="slug" value={ligne.slug} />
            <label className="label-mono text-ardoise">
              parutions complètes{' '}
              <select name="parutions" defaultValue={String(ligne.parutionsDEssai)} className={champ}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={bouton}>
              Régler
            </button>
          </form>
          {prolongeable ? (
            <form action={prolongerLEssai} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="slug" value={ligne.slug} />
              <label className="label-mono text-ardoise">
                prolonger de{' '}
                <select name="semaines" defaultValue="1" className={champ}>
                  <option value="1">1 semaine</option>
                  <option value="2">2 semaines</option>
                  <option value="3">3 semaines</option>
                </select>
              </label>
              <button type="submit" className={bouton}>
                Appliquer
              </button>
            </form>
          ) : null}
          {peutEntrer ? (
            <form action={mettreEnParcours} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="slug" value={ligne.slug} />
              <label className="label-mono text-ardoise">
                prochaine lettre le{' '}
                <input type="date" name="prochaineLettre" defaultValue={lundiProchain(aujourdHui)} className={champ} />
              </label>
              <label className="label-mono text-ardoise">
                encore{' '}
                <select name="restantes" defaultValue="1" className={champ}>
                  {Array.from({ length: ligne.parutionsDEssai }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} complète{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={bouton}>
                Mettre en parcours
              </button>
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
