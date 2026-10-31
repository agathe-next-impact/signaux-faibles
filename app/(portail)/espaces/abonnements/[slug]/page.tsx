import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { lireLaGestionDUneOrganisation, lireLaSantéDesEspaces } from '@/lib/auth/appartenance'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import type { LigneDAbonnement } from '@/lib/base/situation'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours } from '@/lib/domaine/parcours'
import { mettreEnParcours, poserLOffre, prolongerLEssai, réglerLaRelecture, réglerLesParutions } from '@/lib/portail/reglages'
import { lienTableauDeBordStripe } from '@/lib/stripe/souscription'
import { LIBELLÉS_PESTEL, LIBELLÉS_PORTER } from '@/lib/domaine/strategie'
import {
  basculerLEspace,
  basculerLePilote,
  inscrireUnLecteur,
  publierLaFiche,
  réactiverUnLecteur,
  renvoyerLeLien,
  révoquerUnLecteur,
  validerLaGrille,
} from '@/lib/portail/gestion-actions'
import { JOURS_DU_JOURNAL } from '@/lib/portail/gestion'
import { déciderDeLOrganisation } from '@/lib/portail/reglages'

export const metadata: Metadata = { title: 'Gérer une organisation — signauxfaibles' }

/**
 * La gestion d'une organisation par l'opératrice (31 octobre 2026), depuis le
 * tableau des abonnements : son abonnement et les réglages du parcours (la ligne
 * du tableau, reprise ici le même jour), pilote et espace réorganisé, grille stratégique,
 * fiche de veille, lecteurs par leur nom, renvoi du lien d'accès, décision
 * (suspendre, écarter, réactiver), journal des courriers sur trente jours et
 * santé du contrôle du soir. Les gestes sont ceux des routes des tâches, par les
 * mêmes fonctions ; l'abonnement se modifie chez Stripe, jamais ici.
 *
 * La garde est dans `lireLaGestionDUneOrganisation`, avant toute lecture ; un
 * slug inconnu est introuvable. Aucune adresse de lecteur n'atteint le HTML.
 */
export const instant = false

const MESSAGES: Record<string, string> = {
  prolongé: 'Essai prolongé : J0 est décalé.',
  'relecture-réglée': 'Relecture des courriers réglée.',
  'pas-en-essai': 'Cette organisation n’est pas en essai : rien à prolonger.',
  'sans-j0': 'J0 n’est pas encore posé : rien à prolonger.',
  'au-delà-d-aujourdhui': 'Ce décalage mettrait J0 après aujourd’hui : refusé.',
  'offre-posée': 'Offre posée.',
  'parutions-réglées': 'Nombre de parutions complètes réglé.',
  'mis-en-parcours': 'Entrée dans le parcours : J0 est posé, la mécanique de fin d’essai suit.',
  'abonnée-stripe': 'Un abonnement Stripe est ouvert : cette organisation n’entre pas dans le parcours.',
  'parutions-invalides': 'Nombre de parutions hors bornes (1 à 8, et pas plus de restantes que de parutions).',
  'date-invalide': 'Date de prochaine lettre invalide.',
  'pilote-ouvert': 'Pilote des outils stratégiques ouvert.',
  'pilote-fermé': 'Pilote des outils stratégiques fermé : étiquettes et synthèses restent en base.',
  'espace-ouvert': 'Espace réorganisé ouvert.',
  'espace-fermé': 'Espace réorganisé refermé : les sept écrans reviennent.',
  'hors-pilote': 'Hors du pilote des outils stratégiques : ouvrir le pilote d’abord.',
  'organisation-inconnue': 'Organisation inconnue.',
  inconnue: 'Organisation inconnue.',
  'grille-validée': 'Grille validée.',
  'grille-déjà-validée': 'Cette version était déjà validée.',
  'grille-version-dépassée': 'Une version plus récente existe : relire la page et valider celle-là.',
  'grille-aucune': 'Aucune grille enregistrée.',
  'grille-hors-pilote': 'Hors du pilote des outils stratégiques.',
  'grille-organisation-inconnue': 'Organisation inconnue.',
  'fiche-publiée': 'Fiche de veille publiée : ses écrans « Votre veille » la montrent dès la prochaine visite.',
  'fiche-retirée': 'Fiche de veille retirée : ses écrans disent qu’elle n’est pas encore publiée.',
  aucune: 'Aucune fiche enregistrée.',
  'lien-envoyé': 'Lien d’accès envoyé.',
  'lien-non-envoyé': 'Lien non envoyé : le lecteur est introuvable ou révoqué dans la source qui fait foi, ou Gmail n’a pas répondu.',
  débit: 'Lien refusé par la limitation de débit : un envoi par adresse et par dix minutes.',
  'lecteur-inconnu': 'Lecteur inconnu.',
  'notion-fait-foi': 'Notion fait foi pour les accès tant que SOURCE_ACCES ne vaut pas postgres : ce geste se fait dans la base « Accès ».',
  invalide: 'Nom ou adresse invalide.',
  'déjà-inscrit': 'Ce lecteur est déjà inscrit : le réactiver dans la liste.',
  'plafond-atteint': `Plafond atteint : ${LECTEURS_ACTIFS_MAX} lecteurs actifs au plus.`,
  révoqué: 'Lecteur révoqué : son lien ne fonctionne plus.',
  réactivé: 'Lecteur réactivé.',
  inchangé: 'Rien à changer.',
  'décision-appliquée': 'Décision appliquée.',
  'décision-impossible': 'Décision impossible depuis cet état.',
  échec: 'La base n’a pas répondu : rien n’a changé.',
}

const LIBELLÉS_DE_COURRIER: Record<string, string> = {
  lien_acces: 'lien d’accès',
  essai_derniere_parution: 'dernière parution complète',
  essai_tronquee: 'parution réduite',
  alerte_espaces: 'alerte du soir',
  demande_demo: 'demande de démo',
  lettre: 'lettre',
  lettre_filiere: 'lettre de filière',
  essai_rappel_j7: 'rappel J+7',
  essai_suspendu: 'espace suspendu',
  abonnement_confirme: 'abonnement confirmé',
  paiement_echec: 'paiement refusé',
  abonnement_renouvellement: 'renouvellement annuel',
  abonnement_resilie: 'résiliation',
}

const bouton = 'rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc'
const lienDeGeste = 'text-label text-ardoise underline decoration-gris-ligne underline-offset-2'
const champ = 'rounded-douce border border-gris-ligne bg-blanc px-2 py-1 text-corps text-encre'

type Statut = { readonly section: string | null; readonly message: string } | null

/** Le résultat d'un geste, dans la section de son bouton : c'est là que le navigateur revient. */
function MessageDeStatut({ message }: { message: string }) {
  return (
    <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
      {message}
    </p>
  )
}

function Section({ id, titre, statut, children }: { id: string; titre: string; statut: Statut; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4 border-t border-gris-ligne pt-8">
      <h2 className="font-titre text-h2 font-bold text-encre">{titre}</h2>
      {statut && statut.section === id ? <MessageDeStatut message={statut.message} /> : null}
      {children}
    </section>
  )
}

function Interrupteur({ action, slug, actif, libellé }: { action: (d: FormData) => Promise<void>; slug: string; actif: boolean; libellé: string }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="actif" value={actif ? 'non' : 'oui'} />
      <p className="text-encre">
        {libellé} : <span className="label-mono text-ardoise">{actif ? 'ouvert' : 'fermé'}</span>
      </p>
      <BoutonEnvoi className={actif ? lienDeGeste : bouton}>
        {actif ? 'Fermer' : 'Ouvrir'}
      </BoutonEnvoi>
    </form>
  )
}

export default async function GérerUneOrganisation({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ gestion?: string | string[]; reglage?: string | string[]; section?: string | string[] }>
}) {
  const { slug } = await params
  const { accès, gestion, abonnement } = await lireLaGestionDUneOrganisation(slug)
  const paramètres = await searchParams
  const code = typeof paramètres.gestion === 'string' ? paramètres.gestion : typeof paramètres.reglage === 'string' ? paramètres.reglage : undefined
  const message = code ? MESSAGES[code] : undefined
  const section = typeof paramètres.section === 'string' ? paramètres.section : null
  const statut: Statut = message ? { section, message } : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">{gestion?.organisation.nom ?? slug}</h1>
        <p className="text-ardoise">
          <Link href="/espaces/abonnements" className="text-encre underline underline-offset-2">
            Retour aux abonnements
          </Link>{' '}
          ·{' '}
          <Link href={`/${slug}`} className="text-encre underline underline-offset-2">
            Ouvrir l’espace
          </Link>
        </p>
      </header>

      {statut && !statut.section ? <MessageDeStatut message={statut.message} /> : null}

      {!gestion ? (
        <Panneau ton="rose">
          <p className="text-encre">La base Postgres n’est pas en service sur cet environnement : rien à gérer ici.</p>
        </Panneau>
      ) : (
        <>
          {abonnement ? <Abonnement ligne={abonnement} statut={statut} /> : null}
          <Gestion slug={slug} gestion={gestion} statut={statut} />
        </>
      )}
    </main>
  )
}

/** Le lundi de la semaine prochaine, valeur par défaut du champ « prochaine lettre ». */
function lundiProchain(aujourdHui: string): string {
  const date = new Date(`${aujourdHui}T00:00:00Z`)
  const jour = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + (8 - jour))
  return date.toISOString().slice(0, 10)
}

function Donnée({ libellé, children }: { libellé: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label-mono text-ardoise">{libellé}</dt>
      <dd className="text-encre">{children}</dd>
    </div>
  )
}

/**
 * L'abonnement et les réglages du parcours, repris du tableau des abonnements
 * (31 octobre 2026) : les mêmes données, les mêmes actions (`lib/portail/reglages.ts`),
 * qui reviennent ici par le champ `retour`. L'abonnement lui-même se modifie
 * chez Stripe, jamais ici.
 */
function Abonnement({ ligne, statut }: { ligne: LigneDAbonnement; statut: Statut }) {
  const aujourdHui = aujourdHuiÀParis()
  const étape = étapeDuParcours({
    organisation: { état: ligne.état, activéeLe: ligne.activéeLe, offre: ligne.offre, parutionsDEssai: ligne.parutionsDEssai },
    abonnement: ligne.abonnement,
    aujourdHui,
  })
  const prolongeable = ligne.état === 'essai' && ligne.activéeLe !== null
  const abonnéStripe = étape.étape === 'abonnee' && étape.source === 'stripe'
  const peutEntrer = (ligne.état === 'essai' || ligne.état === 'abonnee') && !abonnéStripe && ligne.offre !== 'gratuite'
  const modeRéel = process.env['STRIPE_MODE'] === 'reel'
  const retour = <input type="hidden" name="retour" value="fiche" />

  return (
    <Section id="abonnement" titre="Abonnement" statut={statut}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Donnée libellé="état">{ligne.état}</Donnée>
        <Donnée libellé="étape">{libelléDÉtape(étape)}</Donnée>
        <Donnée libellé="j0">
          {ligne.activéeLe ? dateLongueDeParis(ligne.activéeLe) : 'non posé'}
          {ligne.essaiOuvertLe && !ligne.activéeLe ? `, essai ouvert le ${dateLongueDeParis(ligne.essaiOuvertLe)}` : ''}
        </Donnée>
        <Donnée libellé="stripe">
          {ligne.abonnement ? (
            <>
              {ligne.abonnement.état}
              {ligne.abonnement.formule ? `, ${ligne.abonnement.formule}` : ''}
              {ligne.abonnement.périodeFin ? `, jusqu’au ${dateLongueDeParis(ligne.abonnement.périodeFin)}` : ''}{' '}
              <a
                href={lienTableauDeBordStripe(ligne.abonnement.abonnementStripe, modeRéel)}
                target="_blank"
                rel="noreferrer"
                className="text-label underline underline-offset-2"
              >
                ouvrir dans Stripe
              </a>
            </>
          ) : (
            'aucun abonnement'
          )}
        </Donnée>
        <Donnée libellé="lecteurs actifs">
          {ligne.lecteursActifs} sur {LECTEURS_ACTIFS_MAX}
        </Donnée>
        <Donnée libellé="courriers de fin d’essai">{ligne.relectureRequise ? 'à la relecture' : 'au client'}</Donnée>
      </dl>

      <div className="flex flex-col gap-3">
        <form action={poserLOffre} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="slug" value={ligne.slug} />
          {retour}
          <label className="label-mono text-ardoise">
            offre{' '}
            <select name="offre" defaultValue={ligne.offre} className={champ}>
              <option value="standard">standard</option>
              <option value="fondateur">tarif fondateur</option>
              <option value="gratuite">accès offert</option>
            </select>
          </label>
          <BoutonEnvoi className={bouton}>Poser</BoutonEnvoi>
        </form>
        <form action={réglerLesParutions} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="slug" value={ligne.slug} />
          {retour}
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
          <BoutonEnvoi className={bouton}>Régler</BoutonEnvoi>
        </form>
        {prolongeable ? (
          <form action={prolongerLEssai} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="slug" value={ligne.slug} />
            {retour}
            <label className="label-mono text-ardoise">
              prolonger de{' '}
              <select name="semaines" defaultValue="1" className={champ}>
                <option value="1">1 semaine</option>
                <option value="2">2 semaines</option>
                <option value="3">3 semaines</option>
              </select>
            </label>
            <BoutonEnvoi className={bouton}>Appliquer</BoutonEnvoi>
          </form>
        ) : null}
        {peutEntrer ? (
          <form action={mettreEnParcours} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="slug" value={ligne.slug} />
            {retour}
            <label className="label-mono text-ardoise">
              prochaine lettre le <input type="date" name="prochaineLettre" defaultValue={lundiProchain(aujourdHui)} className={champ} />
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
            <BoutonEnvoi className={bouton}>Mettre en parcours</BoutonEnvoi>
          </form>
        ) : null}
        <form action={réglerLaRelecture} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="slug" value={ligne.slug} />
          {retour}
          <input type="hidden" name="requise" value={ligne.relectureRequise ? 'non' : 'oui'} />
          <BoutonEnvoi className={lienDeGeste}>{ligne.relectureRequise ? 'Envoyer les courriers au client' : 'Envoyer les courriers à la relecture'}</BoutonEnvoi>
        </form>
      </div>
    </Section>
  )
}

/** La santé, lue en flux : la page et ses boutons n'attendent pas le contrôle des espaces. */
async function SantéDeLOrganisation({ slug }: { slug: string }) {
  const { santé: parSlug } = await lireLaSantéDesEspaces()
  const santé = parSlug ? (parSlug.get(slug) ?? []) : null
  if (santé === null) return <p className="text-ardoise">Le contrôle des espaces n’a pas répondu à temps : santé non lue. Recharger la page.</p>
  if (santé.length === 0) return <p className="text-encre">Aucun défaut au contrôle du soir.</p>
  return (
    <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
      {santé.map((d) => (
        <li key={`${d.code}:${d.message}`} className="flex flex-col gap-1 py-3">
          <p className="label-mono text-rose-texte">{d.code}</p>
          <p className="text-encre">{d.message}</p>
        </li>
      ))}
    </ul>
  )
}

function Gestion({
  slug,
  gestion,
  statut,
}: {
  slug: string
  gestion: NonNullable<Awaited<ReturnType<typeof lireLaGestionDUneOrganisation>>['gestion']>
  statut: Statut
}) {
  const { organisation, lecteurs, grille, fiche, courriers } = gestion
  const actifs = lecteurs.filter((l) => l.actif).length
  const horsService = organisation.état === 'suspendue' || organisation.état === 'ecartee'

  return (
    <>
      <Section id="sante" titre="Santé" statut={statut}>
        <Suspense fallback={<p className="text-ardoise">Lecture du contrôle des espaces…</p>}>
          <SantéDeLOrganisation slug={slug} />
        </Suspense>
      </Section>

      <Section id="pilote" titre="Pilote et espace" statut={statut}>
        <Interrupteur action={basculerLePilote} slug={slug} actif={organisation.outilsStratégiques} libellé="Outils stratégiques" />
        <Interrupteur action={basculerLEspace} slug={slug} actif={organisation.espaceRéorganisé} libellé="Espace réorganisé" />
        <p className="text-ardoise">
          L’espace réorganisé lit la grille et les synthèses : il est refusé hors du pilote. Fermer le pilote garde étiquettes et
          synthèses en base.
        </p>
      </Section>

      <Section id="grille" titre="Grille stratégique" statut={statut}>
        {grille.sorte !== 'lue' ? (
          <p className="text-ardoise">{grille.sorte === 'hors-pilote' ? 'Hors du pilote : pas de grille.' : 'Aucune grille enregistrée.'}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-encre">
              Version {grille.version}, {grille.grille.familles.length} familles, {grille.grille.entités.length} entités ·{' '}
              <span className="label-mono text-ardoise">
                {grille.validéeLe ? `validée le ${dateLongueDeParis(grille.validéeLe)}` : 'non validée'} · empreinte {grille.empreinte.slice(0, 8)}
              </span>
            </p>
            <p className="text-ardoise">
              Trous du PESTEL :{' '}
              {grille.trousDuPestel.length === 0 ? 'aucun' : grille.trousDuPestel.map((p) => LIBELLÉS_PESTEL[p]).join(', ')}. Forces non
              suivies : {grille.forcesNonSuivies.length === 0 ? 'aucune' : grille.forcesNonSuivies.map((f) => LIBELLÉS_PORTER[f]).join(', ')}.
            </p>
            {grille.validéeLe ? null : (
              <form action={validerLaGrille}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="version" value={grille.version} />
                <BoutonEnvoi className={bouton}>
                  Valider la version {grille.version}
                </BoutonEnvoi>
              </form>
            )}
          </div>
        )}
      </Section>

      <Section id="fiche" titre="Fiche de veille" statut={statut}>
        {fiche.sorte !== 'lue' ? (
          <p className="text-ardoise">{fiche.sorte === 'hors-pilote' ? 'Hors du pilote : pas de fiche.' : 'Aucune fiche enregistrée : la revue mensuelle la propose.'}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <form action={publierLaFiche} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="slug" value={slug} />
              <p className="text-encre">
                Version {fiche.version} ·{' '}
                <span className="label-mono text-ardoise">{fiche.état === 'publie' ? 'publiée' : fiche.état === 'retire' ? 'retirée' : 'proposée, non montrée'}</span>
              </p>
              {fiche.état === 'publie' ? (
                <>
                  <input type="hidden" name="etat" value="retire" />
                  <BoutonEnvoi className={lienDeGeste}>
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
            <details className="border border-gris-ligne bg-blanc p-4">
              <summary className="cursor-pointer text-label text-encre">Lire la fiche telle que le client la verra</summary>
              <pre className="mt-3 whitespace-pre-wrap font-corps text-corps text-encre">{fiche.texte}</pre>
            </details>
          </div>
        )}
      </Section>

      <Section id="lecteurs" titre="Lecteurs" statut={statut}>
        <p className="label-mono text-ardoise">
          {actifs} actif{actifs > 1 ? 's' : ''} sur {LECTEURS_ACTIFS_MAX}
        </p>
        {lecteurs.length === 0 ? (
          <p className="text-ardoise">Aucun lecteur en base.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
            {lecteurs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className={l.actif ? 'text-encre' : 'text-ardoise'}>{l.nom}</p>
                  <p className="label-mono text-ardoise">
                    {l.actif ? 'actif' : 'révoqué'} · {l.dernièreVisiteLe ? `dernière visite le ${dateLongueDeParis(l.dernièreVisiteLe)}` : 'jamais venu'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {l.actif ? (
                    <form action={renvoyerLeLien}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="lecteur" value={l.id} />
                      <BoutonEnvoi className={bouton}>
                        Renvoyer le lien
                      </BoutonEnvoi>
                    </form>
                  ) : null}
                  {gestion.lecteursModifiables ? (
                    <form action={l.actif ? révoquerUnLecteur : réactiverUnLecteur}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="lecteur" value={l.id} />
                      <BoutonEnvoi className={lienDeGeste}>
                        {l.actif ? 'Révoquer' : 'Réactiver'}
                      </BoutonEnvoi>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {gestion.lecteursModifiables ? (
          <form action={inscrireUnLecteur} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="slug" value={slug} />
            <label className="label-mono flex flex-col gap-1 text-ardoise">
              nom
              <input name="nom" required maxLength={200} className={champ} />
            </label>
            <label className="label-mono flex flex-col gap-1 text-ardoise">
              adresse
              <input name="email" type="email" required maxLength={320} className={champ} />
            </label>
            <BoutonEnvoi className={bouton}>
              Inscrire et envoyer le lien
            </BoutonEnvoi>
          </form>
        ) : (
          <p className="text-ardoise">
            Notion fait foi pour les accès (SOURCE_ACCES ne vaut pas postgres) : inscrire, révoquer et réactiver se font dans la base
            « Accès ». La liste ci-dessus est la copie en base, alignée par l’import.
          </p>
        )}
      </Section>

      <Section id="decision" titre="Décision" statut={statut}>
        <p className="text-encre">
          État : <span className="label-mono text-ardoise">{organisation.état}</span>
          {horsService && organisation.suspendueLe ? (
            <span className="label-mono text-ardoise">
              {' '}
              depuis le {dateLongueDeParis(organisation.suspendueLe)}, avant : {organisation.étatAvantDécision ?? 'inconnu'}
            </span>
          ) : null}
        </p>
        <p className="text-ardoise">
          Suspendre et écarter abandonnent tous deux les travaux non pris de la file et sortent l’organisation des parutions et
          des revues que le calendrier rend aux tâches Notion. Suspendre ferme en plus l’espace à la lecture (l’écran le dit au
          client) ; écarter le laisse lisible, l’organisation quitte seulement le parcours et la production. Aucun courrier ne part :
          prévenez le client vous-même. Pour couper aussi une tâche Notion qui ne passe pas par le calendrier, décochez « Veille
          automatique » sur sa ligne du registre.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {horsService ? (
            <form action={déciderDeLOrganisation}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="decision" value="reactiver" />
              <BoutonEnvoi className={bouton}>
                Réactiver
              </BoutonEnvoi>
            </form>
          ) : (
            <>
              <form action={déciderDeLOrganisation}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="decision" value="suspendre" />
                <BoutonEnvoi className={bouton}>
                  Suspendre
                </BoutonEnvoi>
              </form>
              <form action={déciderDeLOrganisation}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="decision" value="ecarter" />
                <BoutonEnvoi className={lienDeGeste}>
                  Écarter
                </BoutonEnvoi>
              </form>
            </>
          )}
        </div>
      </Section>

      <Section id="courriers" titre={`Courriers, ${JOURS_DU_JOURNAL} derniers jours`} statut={statut}>
        {courriers.length === 0 ? (
          <p className="text-ardoise">Aucun courrier journalisé.</p>
        ) : (
          <div className="overflow-x-auto border border-gris-ligne">
            <table className="w-full border-collapse text-corps">
              <thead>
                <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                  {['date', 'courrier', 'état', 'destinataire', 'déclencheur'].map((e) => (
                    <th key={e} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                      {e}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courriers.map((c, i) => (
                  <tr key={`${c.prévuLe.toISOString()}:${i}`} className="border-b border-gris-ligne align-top">
                    <td className="label-mono px-4 py-3 text-ardoise">{dateLongueDeParis(c.prévuLe)}</td>
                    <td className="px-4 py-3 text-encre">{LIBELLÉS_DE_COURRIER[c.sorte] ?? c.sorte}</td>
                    <td className={`label-mono px-4 py-3 ${c.état === 'echec' || c.état === 'prevu' ? 'text-rose-texte' : 'text-ardoise'}`}>
                      {c.état}
                      {c.erreur ? ` · ${c.erreur}` : ''}
                    </td>
                    <td className="label-mono px-4 py-3 text-ardoise">{c.lecteur ?? c.destinataireEmpreinte}</td>
                    <td className="label-mono px-4 py-3 text-ardoise">{c.déclencheur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
