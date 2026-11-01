'use client'

import { useActionState } from 'react'
import { BORNES_DE_LA_DEMANDE, type ChampDeLaDemande } from '@/lib/domaine/onboarding'
import { enregistrerUneDemandeDOnboarding, type ÉtatDuFormulaire } from '@/lib/portail/onboarding-actions'

const DÉPART: ÉtatDuFormulaire = { état: 'repos' }

const CHAMP =
  'min-w-0 rounded-douce border border-gris-ligne bg-blanc px-4 py-3 text-corps text-encre outline-none placeholder:text-ardoise focus:border-ardoise'

const ERREURS: Record<ChampDeLaDemande, string> = {
  nom: `Indiquez le nom de l’organisation, ${BORNES_DE_LA_DEMANDE.nom} caractères au plus.`,
  site: 'Indiquez l’adresse du site, par exemple https://organisation.fr.',
  slug: 'Le slug se compose de lettres minuscules, de chiffres et de tirets, et ne doit pas être une adresse du portail (offre, tarifs, demo, espaces…).',
  objectifs: `Les objectifs tiennent en ${BORNES_DE_LA_DEMANDE.objectifs} caractères au plus.`,
  lecteurNom: `Le nom tient en ${BORNES_DE_LA_DEMANDE.lecteur} caractères au plus.`,
  lecteurEmail: 'Indiquez une adresse email valide, ou laissez le champ vide.',
  exécuteur: 'Choisissez l’API ou Cowork.',
}

const OÙ = { onboarding: 'un onboarding suivi', organisation: 'une organisation du portail' } as const
const PAR = { slug: 'le même slug', nom: 'le même nom', site: 'le même domaine' } as const

/**
 * Le formulaire de demande : les valeurs saisies reviennent du serveur en cas de
 * refus (jamais par l'URL, l'adresse du lecteur final n'y passe pas). Une
 * demande enregistrée redirige vers la liste.
 */
export function FormulaireDeDemande({
  créneauxCowork,
  moteur = 'github',
}: {
  créneauxCowork: { pris: number; max: number }
  /** Lot 5 : après la bascule Payload, le moteur seul exécute ; Cowork n'a plus de place et le registre est Payload. */
  moteur?: 'github' | 'trigger'
}) {
  const [résultat, action, enCours] = useActionState(enregistrerUneDemandeDOnboarding, DÉPART)
  const valeurs = résultat.état === 'repos' ? null : résultat.valeurs
  const enErreur = new Set(résultat.état === 'invalide' ? résultat.champs : [])
  const coworkPlein = créneauxCowork.pris >= créneauxCowork.max

  const erreur = (champ: ChampDeLaDemande) =>
    enErreur.has(champ) ? (
      <p id={`${champ}-erreur`} className="text-label text-rose-texte">
        {ERREURS[champ]}
      </p>
    ) : null
  const décrit = (champ: ChampDeLaDemande) => (enErreur.has(champ) ? { 'aria-invalid': true, 'aria-describedby': `${champ}-erreur` } : {})

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {résultat.état === 'doublon' ? (
        <p role="alert" className="border-l-2 border-rose pl-4 text-encre">
          Demande non enregistrée : {OÙ[résultat.où]} porte déjà {PAR[résultat.par]} (<span className="font-mono">{résultat.slug}</span>).
        </p>
      ) : null}
      {résultat.état === 'créneaux-cowork' ? (
        <p role="alert" className="border-l-2 border-rose pl-4 text-encre">
          Demande non enregistrée : les {créneauxCowork.max} créneaux Cowork de la semaine sont pris ({résultat.pris}). Choisir l’API.
        </p>
      ) : null}
      {résultat.état === 'échec' ? (
        <p role="alert" className="border-l-2 border-rose pl-4 text-encre">
          La base n’a pas répondu : rien n’a été enregistré. Recommencer dans un instant.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="nom" className="text-corps text-ardoise">Organisation</label>
        <input id="nom" name="nom" type="text" required maxLength={BORNES_DE_LA_DEMANDE.nom} defaultValue={valeurs?.nom} className={CHAMP} {...décrit('nom')} />
        {erreur('nom')}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="site" className="text-corps text-ardoise">Adresse du site</label>
        <input id="site" name="site" type="url" required maxLength={BORNES_DE_LA_DEMANDE.site} placeholder="https://organisation.fr" defaultValue={valeurs?.site} className={CHAMP} {...décrit('site')} />
        {erreur('site')}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="slug" className="text-corps text-ardoise">Slug (facultatif)</label>
        <input id="slug" name="slug" type="text" maxLength={BORNES_DE_LA_DEMANDE.slug} placeholder="dérivé du nom si vide" defaultValue={valeurs?.slug} className={`${CHAMP} font-mono`} {...décrit('slug')} />
        <p className="text-label text-ardoise">L’adresse de l’espace dans le portail. Elle ne change plus après la première lettre.</p>
        {erreur('slug')}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="objectifs" className="text-corps text-ardoise">Objectifs de veille</label>
        <textarea id="objectifs" name="objectifs" rows={4} maxLength={BORNES_DE_LA_DEMANDE.objectifs} placeholder="Quelles décisions éclairer, quels sujets ne pas manquer ? Vide ou « à proposer » : l’étape A formule une hypothèse." defaultValue={valeurs?.objectifs} className={CHAMP} {...décrit('objectifs')} />
        {erreur('objectifs')}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="lecteurNom" className="text-corps text-ardoise">Lecteur final (facultatif)</label>
          <input id="lecteurNom" name="lecteurNom" type="text" maxLength={BORNES_DE_LA_DEMANDE.lecteur} defaultValue={valeurs?.lecteurNom} className={CHAMP} {...décrit('lecteurNom')} />
          {erreur('lecteurNom')}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lecteurEmail" className="text-corps text-ardoise">Son adresse (facultative)</label>
          <input id="lecteurEmail" name="lecteurEmail" type="email" maxLength={BORNES_DE_LA_DEMANDE.email} autoComplete="off" defaultValue={valeurs?.lecteurEmail} className={CHAMP} {...décrit('lecteurEmail')} />
          {erreur('lecteurEmail')}
        </div>
      </div>

      {moteur === 'trigger' ? (
        <div className="flex flex-col gap-2">
          <input type="hidden" name="executeur" value="api" />
          <p className="text-label text-ardoise">
            L’organisation est créée au registre Payload, au statut « prospect », avec le lecteur final en contact. Le moteur fait le
            référentiel puis la première lettre en un seul run, lancé depuis la liste.
          </p>
          {erreur('exécuteur')}
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-corps text-ardoise">Exécuteur</legend>
          <label className="flex items-center gap-2 text-encre">
            <input type="radio" name="executeur" value="api" defaultChecked={valeurs?.exécuteur !== 'cowork'} /> API (lancé depuis le portail)
          </label>
          <label className={`flex items-center gap-2 ${coworkPlein ? 'text-ardoise' : 'text-encre'}`}>
            <input type="radio" name="executeur" value="cowork" defaultChecked={valeurs?.exécuteur === 'cowork'} disabled={coworkPlein} /> Cowork (commande
            à lancer dans Claude Code), {créneauxCowork.pris} sur {créneauxCowork.max} créneaux pris cette semaine depuis le portail
          </label>
          <p className="text-label text-ardoise">
            Pour Cowork, l’adresse du lecteur final n’est pas gardée : elle se donne dans la commande. La vue Notion « Créneaux Cowork
            de la semaine » fait foi.
          </p>
          {erreur('exécuteur')}
        </fieldset>
      )}

      <div>
        <button type="submit" disabled={enCours} aria-busy={enCours} className="rounded-douce bg-encre px-4 py-3 text-corps font-medium text-blanc disabled:cursor-wait disabled:opacity-60">
          {enCours ? 'Enregistrement…' : 'Enregistrer la demande'}
        </button>
      </div>
    </form>
  )
}
