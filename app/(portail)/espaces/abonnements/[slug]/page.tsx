import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { lireLaGestionDUneOrganisation, lireLaSantéDesEspaces } from '@/lib/auth/appartenance'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import { Logo } from '@/components/marque'
import { lecteursModifiables } from '@/lib/portail/situation'
import { Panneau } from '@/components/coquille'
import { FriseDOnboarding, GesteDOnboarding, MESSAGES_DE_LANCEMENT, MétaDOnboarding, MotifDeBlocage, RunsDOnboarding } from '@/components/onboarding-operatrice'
import type { LigneDAbonnement } from '@/lib/base/situation'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { dateLongueDeParis, libelléDÉtape, étapeDuParcours } from '@/lib/domaine/parcours'
import { prochaineÉchéance } from '@/lib/domaine/placement'
import { poserLOffre, réglerLaRelecture, réglerLAperçu } from '@/lib/portail/reglages'
import {
  bouton,
  champ,
  Donnée,
  entréeDuParcours,
  lienDeGeste,
  MessageDeStatut,
  Parcours,
  Résumé,
  Section,
  SousTitre,
  texteDÉchéance,
  VeilleHebdomadaire,
  type Statut,
} from '@/components/gestion-operatrice'
import { LIBELLÉS_PESTEL, LIBELLÉS_PORTER } from '@/lib/domaine/strategie'
import { libellésDesÉcrans, écransMasquésConnus } from '@/lib/domaine/ecrans-de-l-espace'
import {
  basculerLEspace,
  réglerLesSujetsDuMarchéDepuisLaFiche,
  basculerLePilote,
  inscrireUnLecteur,
  publierLaFiche,
  publierLaLettre,
  réactiverUnLecteur,
  renvoyerLeLien,
  renvoyerUnCourrier,
  révoquerUnLecteur,
  validerLaGrille,
} from '@/lib/portail/gestion-actions'
import { JOURS_DU_JOURNAL } from '@/lib/portail/gestion'
import { estRenvoyable, SORTES_RENVOYABLES } from '@/lib/portail/renvoi-courriers'
import { lancementDisponible, type VueDOnboarding } from '@/lib/portail/onboarding'
import { déciderDeLOrganisation } from '@/lib/portail/reglages'
import { archiverLOrganisationDepuisLaFiche } from '@/lib/portail/archivage-actions'

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
 *
 * Depuis le 16 novembre 2026 (demande de l'opératrice : gérer abonnements,
 * essais et veille plus simplement), la fiche s'ouvre sur un résumé (étape,
 * prochaine échéance, lecteurs, santé) et ses onze sections en font huit :
 * « Parcours » (l'étape, ce qui vient, et « Placer à une étape », qui calcule
 * J0 à la place de l'opératrice et montre l'effet avant de confirmer ; les
 * réglages par date passent sous « Réglages avancés »), « Veille hebdomadaire »
 * (jour, heure, cadence et numéro des veilles déclarées au portail), « Accès et
 * envois », « Lecteurs », « Cycle de vie » (offre, suspendre, écarter,
 * archiver), « Outils stratégiques » (pilote, grille, fiche de veille),
 * « Courriers » et « Onboarding ». Un geste impossible reste montré, grisé,
 * avec sa raison. Les anciennes ancres (`#abonnement`, `#decision`, `#pilote`…)
 * mènent toujours à leur contenu.
 */
export const instant = false

const MESSAGES: Record<string, string> = {
  prolongé: 'Essai prolongé : J0 est décalé.',
  'relecture-réglée': 'Destinataire des lettres envoyées par le portail réglé.',
  placée: 'Organisation placée : J0 est posé pour cette étape, la mécanique de fin d’essai suit.',
  'accès-offert': 'Accès offert : il n’a pas de fin d’essai. Repasser l’offre en standard d’abord.',
  'cible-invalide': 'Cette étape n’existe pas dans son essai : régler d’abord le nombre de parutions complètes.',
  'veille-réglée': 'Veille réglée : la file planifie les prochaines parutions sur ce calendrier.',
  'veille-inconnue': 'Veille inconnue : elle se déclare par la route des veilles.',
  'appels-lancé': 'Lettre d’appels à projets : la tâche écrit la section « Appels à projets » du référentiel et coche la lettre dans le registre. La première lettre paraîtra à la quinzaine suivante, en aperçu.',
  'appels-indisponible': 'Le portail ne peut pas lancer la tâche (jeton GitHub absent, ou moteur Trigger.dev) : lancer « pnpm tache balayage --organisation <slug> --consigne appels ».',
  'appels-en-cours': 'Un run est déjà en cours pour cette organisation : attendre sa fin avant d’activer la lettre d’appels.',
  'appels-budget-atteint': 'Budget mensuel des onboardings atteint : la lettre d’appels n’a pas été lancée.',
  'appels-échec-github': 'GitHub n’a pas accepté le lancement : rien n’est parti, réessayer.',
  'appels-échec': 'La base n’a pas répondu : la lettre d’appels n’a pas été lancée.',
  'aperçu-réglé': 'Aperçu avant envoi réglé.',
  'lettre-publiée': 'Lettre publiée et envoyée aux lecteurs.',
  'lettre-publiée-sans-envoi': 'Lettre publiée, mais aucun courrier n’est parti : aucun lecteur actif, ou Gmail n’a pas répondu (voir le journal des courriers).',
  'lettre-introuvable': 'Lettre introuvable : déjà publiée, ou d’une autre organisation.',
  'lettre-hors-payload': 'Les lettres Notion partent en brouillon Gmail : rien à publier ici.',
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
  'marché-entreprises': 'L’écran « Concurrents » s’appelle désormais « Entreprises suivies ».',
  'marché-concurrents': 'L’écran « Entreprises suivies » s’appelle de nouveau « Concurrents ».',
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
  'déjà-archivée': 'Cette organisation est déjà archivée.',
  'archivage-abonnée-stripe': 'Un abonnement Stripe est ouvert : le résilier chez Stripe avant d’archiver.',
  échec: 'La base n’a pas répondu : rien n’a changé.',
  'renvoi-préparé': 'Courrier préparé en brouillon Gmail : à relire et envoyer depuis la boîte émettrice.',
  'renvoi-partiel': 'Courrier préparé pour une partie des lecteurs seulement : voir le journal ci-dessous.',
  'renvoi-déjà-préparé': 'Ce courrier vient d’être préparé pour ce lecteur, il y a moins d’une minute : rien de plus.',
  'renvoi-sans-lecteur': 'Aucun lecteur actif : aucun brouillon préparé.',
  'renvoi-accès-inactif': 'Lecteur introuvable ou révoqué dans la source qui fait foi pour les accès : aucun brouillon préparé.',
  'renvoi-sans-journal': 'Le journal des courriers n’est pas disponible (base absente ou SOURCE_ACCES=notion) : aucun brouillon préparé.',
  'renvoi-échec': 'Gmail n’a pas répondu : aucun brouillon préparé (la ligne en échec est au journal).',
  'sans-abonnement': 'Aucun abonnement Stripe en copie pour cette organisation : ce courrier n’a rien de vrai à dire.',
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
  searchParams: Promise<{
    gestion?: string | string[]
    reglage?: string | string[]
    section?: string | string[]
    onboarding?: string | string[]
    placer?: string | string[]
  }>
}) {
  const { slug } = await params
  const { accès, gestion, abonnement } = await lireLaGestionDUneOrganisation(slug)
  const paramètres = await searchParams
  const code = typeof paramètres.gestion === 'string' ? paramètres.gestion : typeof paramètres.reglage === 'string' ? paramètres.reglage : undefined
  const codeDOnboarding = typeof paramètres.onboarding === 'string' ? paramètres.onboarding : undefined
  const message = code ? MESSAGES[code] : codeDOnboarding ? MESSAGES_DE_LANCEMENT[codeDOnboarding as keyof typeof MESSAGES_DE_LANCEMENT] : undefined
  const section = typeof paramètres.section === 'string' ? paramètres.section : null
  const statut: Statut = message ? { section, message } : null
  // L'étape dont l'opératrice veut voir l'effet avant de confirmer (« Placer à une étape »).
  const cibleDemandée = typeof paramètres.placer === 'string' ? paramètres.placer : undefined

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
          </Link>{' '}
          ·{' '}
          <Link href={`/espaces/abonnements/${encodeURIComponent(slug)}/ecrans`} className="text-encre underline underline-offset-2">
            Écrans de l’espace
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
          <Résumé
            ligne={abonnement}
            archivéeLe={gestion.organisation.archivéeLe}
            santé={
              <Suspense fallback={<span className="text-ardoise">Lecture du contrôle des espaces…</span>}>
                <SantéDeLOrganisation slug={slug} />
              </Suspense>
            }
          />
          <Gestion slug={slug} gestion={gestion} ligne={abonnement} statut={statut} cibleDemandée={cibleDemandée} />
        </>
      )}
    </main>
  )
}

/** La frise, le geste possible et les runs (lots 1 et 2 de `docs/proposition-onboarding-admin.md`). */
function SuiviDOnboarding({ onboarding, disponible }: { onboarding: VueDOnboarding; disponible: boolean }) {
  return (
    <>
      <MotifDeBlocage vue={onboarding} />
      <FriseDOnboarding vue={onboarding} />
      <GesteDOnboarding vue={onboarding} retour="fiche" disponible={disponible} ouverture={lecteursModifiables()} />
      <MétaDOnboarding vue={onboarding} />
      <RunsDOnboarding runs={onboarding.runs} />
    </>
  )
}

/** La santé, lue en flux : la page et ses boutons n'attendent pas le contrôle des espaces. */
async function SantéDeLOrganisation({ slug }: { slug: string }) {
  const { santé: parSlug } = await lireLaSantéDesEspaces()
  const santé = parSlug ? (parSlug.get(slug) ?? []) : null
  if (santé === null) return <span className="text-ardoise">non lue : le contrôle des espaces n’a pas répondu à temps, recharger la page</span>
  if (santé.length === 0) return <>aucun défaut au contrôle du soir</>
  return (
    <ul className="flex flex-col gap-2">
      {santé.map((d) => (
        <li key={`${d.code}:${d.message}`} className="flex flex-col gap-1">
          <span className="label-mono text-rose-texte">{d.code}</span>
          <span className="text-encre">{d.message}</span>
        </li>
      ))}
    </ul>
  )
}

function Gestion({
  slug,
  gestion,
  ligne,
  statut,
  cibleDemandée,
}: {
  slug: string
  gestion: NonNullable<Awaited<ReturnType<typeof lireLaGestionDUneOrganisation>>['gestion']>
  /** La ligne du tableau des abonnements ; `null` pour une organisation archivée, qui en est sortie. */
  ligne: LigneDAbonnement | null
  statut: Statut
  cibleDemandée: string | undefined
}) {
  const { organisation, lecteurs, grille, fiche, courriers, onboarding, lettresÀPublier, veilles } = gestion
  const actifs = lecteurs.filter((l) => l.actif).length
  // Les actifs d'abord, puis les accès révoqués repliés (13 novembre 2026) :
  // un accès supprimé dans Notion désactive le lecteur sans l'effacer.
  const ListeDeLecteurs = ({ liste }: { liste: readonly (typeof lecteurs)[number][] }) => (
    <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
      {liste.map((l) => (
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
  )
  const lecteursActifs = new Set(lecteurs.filter((l) => l.actif).map((l) => l.id))
  const horsService = organisation.état === 'suspendue' || organisation.état === 'ecartee'

  const onboardingEnCours = onboarding !== null && onboarding.étape.étape !== 'espace_ouvert'
  const suivi = onboarding ? (
    <Section id="onboarding" titre="Onboarding" statut={statut}>
      {onboardingEnCours ? (
        <SuiviDOnboarding onboarding={onboarding} disponible={lancementDisponible()} />
      ) : (
        <details>
          <summary className="cursor-pointer text-encre">Espace ouvert : voir le suivi de l’onboarding</summary>
          <div className="mt-4 flex flex-col gap-4">
            <SuiviDOnboarding onboarding={onboarding} disponible={lancementDisponible()} />
          </div>
        </details>
      )}
    </Section>
  ) : null
  return (
    <>
      {onboardingEnCours ? suivi : null}

      {ligne ? <Parcours ligne={ligne} statut={statut} cibleDemandée={cibleDemandée} /> : null}

      <VeilleHebdomadaire slug={slug} veilles={veilles} statut={statut} />

      <Section id="envois" titre="Accès et envois" statut={statut}>
        <form action={réglerLAperçu} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="actif" value={organisation.aperçuAvantEnvoi ? 'non' : 'oui'} />
          <p className="text-encre">
            Aperçu avant envoi : <span className="label-mono text-ardoise">{organisation.aperçuAvantEnvoi ? 'actif' : 'levé'}</span>
          </p>
          <BoutonEnvoi className={organisation.aperçuAvantEnvoi ? lienDeGeste : bouton}>
            {organisation.aperçuAvantEnvoi ? 'Lever l’aperçu' : 'Activer l’aperçu'}
          </BoutonEnvoi>
        </form>
        <p className="text-ardoise">
          {organisation.aperçuAvantEnvoi
            ? 'Rien ne part sans vous : le lien d’accès part d’ici (« Renvoyer le lien » ou « Ouvrir l’espace »), jamais de l’activation ; une lettre du moteur attend ci-dessous.'
            : 'Les tâches font partir le lien d’accès à l’activation, et le moteur envoie une lettre acceptée aussitôt.'}{' '}
          Dans l’espace, vous voyez les lettres non publiées, marquées « aperçu » ; le client ne les voit jamais.
        </p>
        {lettresÀPublier === null ? (
          <p className="text-ardoise">Lettres Notion : elles partent en brouillon Gmail, que vous envoyez après les avoir lues dans l’espace.</p>
        ) : lettresÀPublier.length === 0 ? (
          <p className="text-ardoise">Aucune lettre à publier.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lettresÀPublier.map((lettre) => (
              <li key={lettre.id} className="flex flex-wrap items-center gap-3 border border-gris-ligne p-4">
                <p className="text-encre">
                  {lettre.titre || 'Lettre sans titre'}{' '}
                  <span className="label-mono text-ardoise">
                    {lettre.numéro !== null ? `n° ${lettre.numéro}` : 'sans numéro'}
                    {lettre.dateÉdition ? ` · ${dateLongueDeParis(new Date(`${lettre.dateÉdition}T12:00:00Z`))}` : ''}
                  </span>
                </p>
                <Link href={`/${slug}/lettres/${lettre.id}`} className={lienDeGeste}>
                  Lire dans l’espace
                </Link>
                <form action={publierLaLettre}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="edition" value={lettre.id} />
                  <BoutonEnvoi className={bouton}>Publier et envoyer</BoutonEnvoi>
                </form>
              </li>
            ))}
          </ul>
        )}
        {ligne ? (
          <>
            <form action={réglerLaRelecture} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="retour" value="fiche" />
              <input type="hidden" name="requise" value={ligne.relectureRequise ? 'non' : 'oui'} />
              <p className="text-encre">
                Lettres envoyées par le portail :{' '}
                <span className="label-mono text-ardoise">{ligne.relectureRequise ? 'à l’adresse de relecture' : 'aux lecteurs'}</span>
              </p>
              <BoutonEnvoi className={lienDeGeste}>{ligne.relectureRequise ? 'Envoyer aux lecteurs' : 'Envoyer à la relecture'}</BoutonEnvoi>
            </form>
            <p className="text-ardoise">
              Ce réglage ne détourne que les lettres que le portail envoie lui-même (« Publier et envoyer », « Envoyer les
              lettres »). Les courriers d’essai et d’abonnement sont toujours des brouillons Gmail, que vous envoyez.
            </p>
          </>
        ) : null}
      </Section>

      <Section id="lecteurs" titre="Lecteurs" statut={statut}>
        <p className="label-mono text-ardoise">
          {actifs} actif{actifs > 1 ? 's' : ''} sur {LECTEURS_ACTIFS_MAX}
        </p>
        {lecteurs.length === 0 ? (
          <p className="text-ardoise">Aucun lecteur en base.</p>
        ) : (
          <>
          {[
            { clé: 'actifs', liste: lecteurs.filter((l) => l.actif) },
            { clé: 'révoqués', liste: lecteurs.filter((l) => !l.actif) },
          ].map(({ clé, liste }) =>
            liste.length === 0 ? null : clé === 'actifs' ? (
              <ListeDeLecteurs key={clé} liste={liste} />
            ) : (
              <details key={clé} className="border border-gris-ligne">
                <summary className="cursor-pointer px-4 py-3 text-encre">
                  Accès révoqués
                  <span className="label-mono ml-3 text-ardoise">{liste.length}</span>
                </summary>
                <div className="px-4">
                  <ListeDeLecteurs liste={liste} />
                </div>
              </details>
            ),
          )}
          </>
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

      <Section id="cycle" anciens={['decision', 'archivage']} titre="Cycle de vie" statut={statut}>
        {ligne ? (
          <>
            <SousTitre>Offre</SousTitre>
            <form action={poserLOffre} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="retour" value="fiche" />
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
            <p className="text-ardoise">
              L’accès offert n’a ni fin d’essai ni courrier de parcours ; une organisation en essai y devient abonnée. Le tarif
              fondateur ne propose que sa formule mensuelle.
            </p>
          </>
        ) : null}
        <SousTitre>Sortir du service</SousTitre>
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
        <SousTitre>Archiver</SousTitre>
        {organisation.archivéeLe ? (
          <p className="text-encre">
            Archivée le <span className="label-mono text-ardoise">{dateLongueDeParis(organisation.archivéeLe)}</span> : elle n’apparaît
            plus dans le tableau des abonnements, et se désarchive depuis la liste « Organisations archivées » sous ce tableau.
          </p>
        ) : (
          <>
            <p className="text-ardoise">
              Archiver retire l’organisation du tableau des abonnements, désactive ses lecteurs et abandonne ses travaux non pris.
              Rien n’est effacé : courriers, abonnements et synthèses restent en base, et l’archivage s’annule. Refusé tant qu’un
              abonnement Stripe est ouvert. Tant que Notion fait foi pour les accès, décochez aussi les lignes « Accès » : une ligne
              encore active rouvrirait son lecteur au prochain import.
            </p>
            <form action={archiverLOrganisationDepuisLaFiche}>
              <input type="hidden" name="slug" value={slug} />
              <BoutonEnvoi className={lienDeGeste}>Archiver l’organisation</BoutonEnvoi>
            </form>
          </>
        )}
      </Section>

      <Section id="outils" anciens={['pilote', 'grille', 'fiche']} titre="Outils stratégiques" statut={statut}>
        <Interrupteur action={basculerLePilote} slug={slug} actif={organisation.outilsStratégiques} libellé="Outils stratégiques" />
        <Interrupteur action={basculerLEspace} slug={slug} actif={organisation.espaceRéorganisé} libellé="Espace réorganisé" />
        <form action={réglerLesSujetsDuMarchéDepuisLaFiche} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="sujets" value={organisation.sujetsDuMarché === 'entreprises' ? 'concurrents' : 'entreprises'} />
          <p className="text-encre">
            Écran du marché :{' '}
            <span className="label-mono text-ardoise">{organisation.sujetsDuMarché === 'entreprises' ? 'entreprises suivies' : 'concurrents'}</span>
          </p>
          <BoutonEnvoi className={lienDeGeste}>
            {organisation.sujetsDuMarché === 'entreprises' ? 'Revenir à « Concurrents »' : 'Nommer « Entreprises suivies »'}
          </BoutonEnvoi>
        </form>
        <p className="text-ardoise">
          L’espace réorganisé lit la grille et les synthèses : il est refusé hors du pilote. Fermer le pilote garde étiquettes et
          synthèses en base. « Entreprises suivies » convient quand la veille concurrentielle suit les mouvements des entreprises
          du territoire plutôt que des concurrents (une chambre consulaire) : seuls les mots de l’espace changent.
        </p>
        <SousTitre>Grille stratégique</SousTitre>
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
        <SousTitre>Fiche de veille</SousTitre>
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

      <Section id="ecrans" titre="Écrans de l’espace" statut={statut}>
        <p className="text-encre">
          {(() => {
            const masqués = libellésDesÉcrans(écransMasquésConnus(organisation.écransMasqués))
            return masqués.length === 0
              ? 'Tous les écrans sont montrés au client.'
              : `${masqués.length === 1 ? 'Un écran masqué' : `${masqués.length} écrans masqués`} au client : ${masqués.join(', ')}.`
          })()}
        </p>
        <p>
          <Link href={`/espaces/abonnements/${encodeURIComponent(slug)}/ecrans`} className={bouton}>
            Activer ou désactiver des écrans
          </Link>
        </p>
      </Section>

      <Section id="courriers" titre={`Courriers, ${JOURS_DU_JOURNAL} derniers jours`} statut={statut}>
        <p className="text-ardoise">
          Renvoyer un courrier commercial prépare un nouveau brouillon Gmail, adressé au lecteur, même si ce courrier a déjà été
          préparé ou si son brouillon a été supprimé. Rien ne part au client : relisez et envoyez le brouillon depuis la boîte
          émettrice. Le contenu est celui du jour (offre, parutions d’essai, abonnement en copie Stripe).
        </p>
        {actifs > 0 ? (
          <form action={renvoyerUnCourrier} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="slug" value={slug} />
            <label className="label-mono flex flex-col gap-1 text-ardoise">
              courrier
              <select name="sorte" required className={champ}>
                {SORTES_RENVOYABLES.map((sorte) => (
                  <option key={sorte} value={sorte}>
                    {LIBELLÉS_DE_COURRIER[sorte] ?? sorte}
                  </option>
                ))}
              </select>
            </label>
            <label className="label-mono flex flex-col gap-1 text-ardoise">
              lecteur
              <select name="lecteur" required className={champ}>
                <option value="tous">tous les lecteurs actifs</option>
                {lecteurs
                  .filter((l) => l.actif)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nom}
                    </option>
                  ))}
              </select>
            </label>
            <BoutonEnvoi className={bouton}>Préparer le brouillon</BoutonEnvoi>
          </form>
        ) : (
          <p className="text-ardoise">Aucun lecteur actif : aucun courrier à renvoyer.</p>
        )}
        {courriers.length === 0 ? (
          <p className="text-ardoise">Aucun courrier journalisé.</p>
        ) : (
          <div className="overflow-x-auto border border-gris-ligne">
            <table className="w-full border-collapse text-corps">
              <thead>
                <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
                  {['date', 'courrier', 'état', 'destinataire', 'déclencheur', 'renvoi'].map((e) => (
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
                    <td className="px-4 py-3">
                      {estRenvoyable(c.sorte) && c.lecteurId && lecteursActifs.has(c.lecteurId) ? (
                        <form action={renvoyerUnCourrier}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="sorte" value={c.sorte} />
                          <input type="hidden" name="lecteur" value={c.lecteurId} />
                          <BoutonEnvoi className={lienDeGeste}>Renvoyer</BoutonEnvoi>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {onboardingEnCours ? null : suivi}
    </>
  )
}
