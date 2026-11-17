import Link from 'next/link'
import type { ReactNode } from 'react'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import type { LigneDAbonnement } from '@/lib/base/situation'
import type { VeilleListée } from '@/lib/base/veilles'
import { JOURS, aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { parutionsÀPlanifier } from '@/lib/domaine/file'
import { LECTEURS_ACTIFS_MAX } from '@/lib/domaine/offre'
import { abonnementOuvert, dateLongueDeParis, libelléDÉtape, étapeDuParcours, type EntréeDuParcours } from '@/lib/domaine/parcours'
import {
  aperçuDuPlacement,
  ciblesPossibles,
  cléDeCible,
  effetDuPlacement,
  lireUneCible,
  prochaineÉchéance,
  raisonDuRefus,
  refusDeProlonger,
  refusDuPlacement,
  suiteDuHorsParcours,
  étapeDeLaCible,
  type Échéance,
} from '@/lib/domaine/placement'
import { activerLaLettreDAppels, réglerLaVeille } from '@/lib/portail/gestion-actions'
import { mettreEnParcours, placerÀLÉtape, prolongerLEssai, réglerLesParutions } from '@/lib/portail/reglages'
import { lienTableauDeBordStripe } from '@/lib/stripe/souscription'

/**
 * Les briques de la fiche d'une organisation (`/espaces/abonnements/[slug]`),
 * sorties de la page le 16 novembre 2026 pour être rendues par les tests :
 * la section et ses anciennes ancres, le parcours (« Placer à une étape » et
 * son aperçu), la veille hebdomadaire. Aucune lecture ici : la page, derrière
 * sa garde, leur passe ce qu'elle a lu.
 */

export const bouton = 'rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc'
export const lienDeGeste = 'text-label text-ardoise underline decoration-gris-ligne underline-offset-2'
export const champ = 'rounded-douce border border-gris-ligne bg-blanc px-2 py-1 text-corps text-encre'

export type Statut = { readonly section: string | null; readonly message: string } | null

/** Le résultat d'un geste, dans la section de son bouton : c'est là que le navigateur revient. */
export function MessageDeStatut({ message }: { message: string }) {
  return (
    <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
      {message}
    </p>
  )
}

/**
 * Une section de la fiche. `anciens` garde les ancres d'avant le regroupement
 * du 16 novembre 2026 : les gestes qui y revenaient (`section=pilote#pilote`)
 * retrouvent leur contenu, et leur message s'affiche dans la section qui l'a
 * accueilli.
 */
export function Section({ id, anciens = [], titre, statut, children }: { id: string; anciens?: readonly string[]; titre: string; statut: Statut; children: ReactNode }) {
  const ici = statut !== null && statut.section !== null && (statut.section === id || anciens.includes(statut.section))
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4 border-t border-gris-ligne pt-8">
      <h2 className="font-titre text-h2 font-bold text-encre">
        {anciens.map((ancien) => (
          <span key={ancien} id={ancien} className="scroll-mt-6" />
        ))}
        {titre}
      </h2>
      {ici && statut ? <MessageDeStatut message={statut.message} /> : null}
      {children}
    </section>
  )
}

/** Un sous-titre dans une section regroupée. */
export function SousTitre({ children }: { children: ReactNode }) {
  return <h3 className="font-titre text-h3 font-semibold text-encre">{children}</h3>
}

/** Un geste impossible reste montré, grisé, avec sa raison : pas de 409 après le clic. */
export function Impossible({ geste, raison }: { geste: string; raison: string }) {
  return (
    <p className="text-ardoise">
      <span className="label-mono opacity-60">{geste} · indisponible</span>
      <br />
      {raison}
    </p>
  )
}

export function texteDÉchéance(échéance: Échéance | null): string {
  if (!échéance) return 'aucune'
  return `${libelléDÉtape(échéance.étape)}, le ${dateLongueDeParis(new Date(`${échéance.le}T12:00:00Z`))}`
}

export function entréeDuParcours(ligne: LigneDAbonnement, aujourdHui: string): EntréeDuParcours {
  return {
    organisation: { état: ligne.état, activéeLe: ligne.activéeLe, offre: ligne.offre, parutionsDEssai: ligne.parutionsDEssai },
    abonnement: ligne.abonnement,
    aujourdHui,
  }
}

/** Le lundi de la semaine prochaine, valeur par défaut du champ « prochaine lettre ». */
function lundiProchain(aujourdHui: string): string {
  const date = new Date(`${aujourdHui}T00:00:00Z`)
  const jour = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + (8 - jour))
  return date.toISOString().slice(0, 10)
}

export function Donnée({ libellé, children }: { libellé: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label-mono text-ardoise">{libellé}</dt>
      <dd className="text-encre">{children}</dd>
    </div>
  )
}

/**
 * Où en est l'organisation, en une bande en tête de fiche : l'étape, ce qui
 * vient, ses lecteurs, sa santé (lue en flux par la page, qui la passe ici).
 * Tout le reste de la fiche se règle dessous.
 */
export function Résumé({ ligne, archivéeLe, santé }: { ligne: LigneDAbonnement | null; archivéeLe: Date | null; santé: ReactNode }) {
  const entrée = ligne ? entréeDuParcours(ligne, aujourdHuiÀParis()) : null
  return (
    <dl id="sante" className="grid scroll-mt-6 grid-cols-1 gap-4 border border-gris-ligne bg-fond-neutre p-4 sm:grid-cols-2">
      <Donnée libellé="étape">
        {entrée ? libelléDÉtape(étapeDuParcours(entrée)) : archivéeLe ? `archivée le ${dateLongueDeParis(archivéeLe)}` : 'inconnue'}
      </Donnée>
      <Donnée libellé="prochaine échéance">{entrée ? texteDÉchéance(prochaineÉchéance(entrée)) : 'aucune'}</Donnée>
      <Donnée libellé="lecteurs actifs">{ligne ? `${ligne.lecteursActifs} sur ${LECTEURS_ACTIFS_MAX}` : 'aucun'}</Donnée>
      <Donnée libellé="santé">{santé}</Donnée>
    </dl>
  )
}

/**
 * Le parcours : l'étape calculée, ce qui vient, et « Placer à une étape »
 * (16 novembre 2026). L'opératrice nomme l'étape ; `aperçuDuPlacement` dit ce
 * que cela change (J0, lecture, brouillon à venir) avant qu'elle confirme, et
 * `placerÀLÉtape` écrit. Les réglages par date (parutions, prolongation, mise
 * en parcours) restent sous « Réglages avancés », par les mêmes actions.
 * L'abonnement lui-même se modifie chez Stripe, jamais ici.
 */
export function Parcours({ ligne, statut, cibleDemandée }: { ligne: LigneDAbonnement; statut: Statut; cibleDemandée: string | undefined }) {
  const aujourdHui = aujourdHuiÀParis()
  const entrée = entréeDuParcours(ligne, aujourdHui)
  const étape = étapeDuParcours(entrée)
  const suite = suiteDuHorsParcours(étape, ligne)
  const refus = refusDuPlacement(ligne, abonnementOuvert(ligne.abonnement))
  const raisonDePlacer = refus ? raisonDuRefus(refus, ligne.état) : null
  const raisonDeProlonger = refusDeProlonger(ligne)
  const cible = cibleDemandée && !refus ? lireUneCible(cibleDemandée, ligne.parutionsDEssai) : null
  const aperçu = cible ? aperçuDuPlacement(cible, ligne, aujourdHui) : null
  const modeRéel = process.env['STRIPE_MODE'] === 'reel'
  const retour = <input type="hidden" name="retour" value="fiche" />
  const adresse = `/espaces/abonnements/${ligne.slug}`

  return (
    <Section id="parcours" anciens={['abonnement']} titre="Parcours" statut={statut}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Donnée libellé="parutions complètes de l’essai">{ligne.parutionsDEssai}</Donnée>
        <Donnée libellé="j0">
          {ligne.activéeLe ? dateLongueDeParis(ligne.activéeLe) : 'non posé'}
          {ligne.essaiOuvertLe && !ligne.activéeLe ? `, essai ouvert le ${dateLongueDeParis(ligne.essaiOuvertLe)}` : ''}
        </Donnée>
        <Donnée libellé="état en base">{ligne.état}</Donnée>
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
      </dl>

      {suite ? <p className="border-l-2 border-gris-ligne pl-4 text-encre">{suite}</p> : null}

      <SousTitre>Placer à une étape</SousTitre>
      {raisonDePlacer ? (
        <Impossible geste="placer" raison={raisonDePlacer} />
      ) : (
        <>
          <p className="text-ardoise">
            Choisissez l’étape où l’organisation doit se trouver cette semaine : J0 est calculé pour vous. Rien n’est écrit avant
            la confirmation.
          </p>
          <form method="get" action={`${adresse}#parcours`} className="flex flex-wrap items-center gap-2">
            <label className="label-mono text-ardoise">
              étape{' '}
              <select name="placer" defaultValue={cible ? cléDeCible(cible) : undefined} className={champ}>
                {ciblesPossibles(ligne.parutionsDEssai).map((possible) => (
                  <option key={cléDeCible(possible)} value={cléDeCible(possible)}>
                    {libelléDÉtape(étapeDeLaCible(possible, ligne.parutionsDEssai))}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={bouton}>
              Voir l’effet
            </button>
          </form>
          {cibleDemandée && !aperçu ? <p className="text-rose-texte">Cette étape n’existe pas dans son essai.</p> : null}
          {cible && aperçu ? (
            <div className="flex flex-col gap-3 border border-encre bg-blanc p-4">
              <p className="label-mono text-ardoise">effet du placement, rien n’est encore écrit</p>
              <p className="text-encre">{effetDuPlacement(aperçu)}.</p>
              <p className="text-ardoise">
                Ensuite : {texteDÉchéance(aperçu.échéance)}. {ligne.lecteursActifs} lecteur{ligne.lecteursActifs > 1 ? 's' : ''} actif
                {ligne.lecteursActifs > 1 ? 's' : ''} concerné{ligne.lecteursActifs > 1 ? 's' : ''}. Un courrier déjà parti ne repart pas.
              </p>
              {ligne.état === 'abonnee' ? (
                <p className="text-rose-texte">
                  Cette organisation est abonnée hors Stripe : la placer la fait entrer dans le parcours d’essai, avec sa fin.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <form action={placerÀLÉtape}>
                  <input type="hidden" name="slug" value={ligne.slug} />
                  <input type="hidden" name="cible" value={cléDeCible(cible)} />
                  {retour}
                  <BoutonEnvoi className={bouton}>Confirmer le placement</BoutonEnvoi>
                </form>
                <Link href={`${adresse}#parcours`} className={lienDeGeste}>
                  Annuler
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}

      <details className="border border-gris-ligne">
        <summary className="cursor-pointer px-4 py-3 text-encre">Réglages avancés</summary>
        <div className="flex flex-col gap-4 border-t border-gris-ligne p-4">
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
          <p className="text-ardoise">
            Changer ce nombre sans toucher à J0 déplace l’étape : replacez l’organisation ensuite si elle doit rester où elle est.
          </p>
          {raisonDeProlonger ? (
            <Impossible geste="prolonger l’essai" raison={raisonDeProlonger} />
          ) : (
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
          )}
          {raisonDePlacer ? (
            <Impossible geste="mettre en parcours à une date" raison={raisonDePlacer} />
          ) : (
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
          )}
        </div>
      </details>
    </Section>
  )
}

const CADENCES_DE_VEILLE = [
  ['hebdomadaire', 'hebdomadaire'],
  ['bimensuelle', 'quinzaine (semaines paires)'],
  ['mensuelle', 'mensuelle (première occurrence du mois)'],
] as const

/**
 * Les veilles déclarées au portail (16 novembre 2026, lot 3) : jour, heure et
 * cadence, d'où la file planifie, et le dernier numéro attribué. La prochaine
 * parution est calculée par la règle de la planification (`parutionsÀPlanifier`),
 * pas lue dans la file.
 */
export function VeilleHebdomadaire({
  slug,
  veilles,
  statut,
}: {
  slug: string
  veilles: readonly VeilleListée[]
  statut: Statut
}) {
  const aujourdHui = aujourdHuiÀParis()
  return (
    <Section id="veille" titre="Veille hebdomadaire" statut={statut}>
      {veilles.length === 0 ? (
        <p className="text-ardoise">
          Aucune veille déclarée au portail. Les lettres de cette organisation sont produites par les tâches Notion, qui suivent le
          jour de parution et la cadence de sa ligne du registre, que le portail ne lit pas : ils se règlent là-bas. Une veille se
          déclare au portail (route des veilles) quand l’organisation passe à la file de travaux.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {veilles.map((veille) => {
              const prochaine =
                veille.état === 'active' ? parutionsÀPlanifier([{ ...veille }], aujourdHui, 35)[0]?.date : undefined
              return (
                <li key={veille.id} className="flex flex-col gap-3 border border-gris-ligne p-4">
                  <p className="text-encre">
                    {veille.libellé}{' '}
                    <span className="label-mono text-ardoise">
                      {veille.type} · {veille.état} · dernier numéro attribué : {veille.numéroCourant}
                    </span>
                  </p>
                  <p className="text-ardoise">
                    {prochaine
                      ? `Prochaine parution : ${dateLongueDeParis(new Date(`${prochaine}T12:00:00Z`))}, à ${veille.heureParution.slice(0, 5)}.`
                      : veille.état === 'active'
                        ? 'Aucune parution dans les cinq semaines.'
                        : 'Veille non active : aucune parution planifiée.'}
                  </p>
                  <form action={réglerLaVeille} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="type" value={veille.type} />
                    <label className="label-mono flex flex-col gap-1 text-ardoise">
                      jour
                      <select name="jour" defaultValue={String(veille.jourParution)} className={champ}>
                        {JOURS.map((jour, i) => (
                          <option key={jour} value={i + 1}>
                            {jour.toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="label-mono flex flex-col gap-1 text-ardoise">
                      heure de Paris
                      <input type="time" name="heure" required defaultValue={veille.heureParution.slice(0, 5)} className={champ} />
                    </label>
                    <label className="label-mono flex flex-col gap-1 text-ardoise">
                      cadence
                      <select name="cadence" defaultValue={veille.cadence} className={champ}>
                        {CADENCES_DE_VEILLE.map(([valeur, libellé]) => (
                          <option key={valeur} value={valeur}>
                            {libellé}
                          </option>
                        ))}
                      </select>
                    </label>
                    <BoutonEnvoi className={bouton}>Régler</BoutonEnvoi>
                  </form>
                </li>
              )
            })}
          </ul>
          <p className="text-ardoise">
            Le calendrier réglé ici vaut pour la file de travaux du portail : elle planifie les parutions suivantes dessus, un
            travail déjà posé garde son échéance.{' '}
            <Link href="/espaces/file" className="text-encre underline underline-offset-2">
              Voir la file
            </Link>
          </p>
        </>
      )}
      <LettreDAppels slug={slug} />
    </Section>
  )
}

/**
 * La lettre d'appels à projets (17 novembre 2026, `docs/lettre-appels-a-projets.md`) :
 * une troisième lettre, à la quinzaine, sur les appels dont l'organisation est
 * elle-même porteuse. Le geste lance la tâche qui écrit sa section du
 * référentiel et coche la lettre dans le registre ; la fiche ne lit pas le
 * registre et ne sait donc pas si elle est déjà prise : relancer réécrit la
 * section, sans rien envoyer.
 */
export function LettreDAppels({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col gap-3 border border-gris-ligne p-4">
      <p className="text-encre">
        Lettre d’appels à projets <span className="label-mono text-ardoise">quinzaine · marchés publics exclus</span>
      </p>
      <p className="text-ardoise">
        Les appels à projets, AMI et concours dont l’organisation est elle-même porteuse, avec les arguments pour y répondre.
        Le geste fait écrire par la tâche la section « Appels à projets » de son référentiel (familles d’appels, sources, profil
        d’éligibilité), sans validation, puis cocher la lettre dans le registre. Rien ne part au client : chaque lettre reste en
        aperçu avant envoi.
      </p>
      <form action={activerLaLettreDAppels}>
        <input type="hidden" name="slug" value={slug} />
        <BoutonEnvoi className={bouton}>Activer la lettre d’appels à projets</BoutonEnvoi>
      </form>
    </div>
  )
}

