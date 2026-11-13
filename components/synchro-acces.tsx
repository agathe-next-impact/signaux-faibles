'use client'

import { useActionState } from 'react'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import {
  synchroniserLesAccès,
  type ComptesAffichés,
  type ÉtatDeLaSynchroDesAccès,
} from '@/lib/portail/import-acces-actions'

const DÉPART: ÉtatDeLaSynchroDesAccès = { état: 'repos' }

/**
 * « Synchroniser les accès depuis Notion », sur le tableau des abonnements
 * (13 novembre 2026). Aperçu d'abord, écriture ensuite : le second bouton
 * n'existe qu'une fois l'aperçu affiché, et il emporte le nombre de
 * désactivations que l'opératrice vient de lire. Chaque bouton se désactive
 * pendant que l'action tourne (`BoutonEnvoi`), et l'action refuse un second
 * passage simultané.
 */
export function SynchroDesAccès() {
  const [état, action] = useActionState(synchroniserLesAccès, DÉPART)

  return (
    <section aria-labelledby="synchro-acces" className="flex flex-col gap-3 border border-gris-ligne bg-blanc p-4">
      <h2 id="synchro-acces" className="font-medium text-encre">
        Synchroniser les accès depuis Notion
      </h2>
      <p className="text-label text-ardoise">
        Aligne les organisations et les lecteurs de Postgres sur la base Notion « Accès », comme{' '}
        <code className="label-mono">pnpm base:importer-acces</code>. Un lecteur absent de Notion est désactivé, jamais
        supprimé. Aucun courrier ni lien d’accès ne part. Une ligne modifiée dans Notion il y a moins d’une minute peut ne
        pas encore être vue.
      </p>

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="geste" value="apercu" />
        <BoutonEnvoi className="rounded-douce border border-encre px-3 py-1 text-label font-medium text-encre">
          {état.état === 'aperçu' ? 'Prévisualiser de nouveau' : 'Prévisualiser'}
        </BoutonEnvoi>
      </form>

      {état.état === 'aperçu' ? (
        <div className="flex flex-col gap-3 border-t border-gris-ligne pt-3">
          <p className="label-mono text-ardoise">aperçu · rien n’est écrit</p>
          <Comptes comptes={état.comptes} futur />
          <form action={action} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="geste" value="ecrire" />
            <input type="hidden" name="desactivations" value={état.comptes.lecteursDésactivés} />
            <BoutonEnvoi className="rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc">
              Confirmer et écrire
            </BoutonEnvoi>
            {état.comptes.lecteursDésactivés > 0 ? (
              <p className="text-label text-rose-texte">
                {état.comptes.lecteursDésactivés > 1
                  ? `${état.comptes.lecteursDésactivés} lecteurs perdront leur accès.`
                  : '1 lecteur perdra son accès.'}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}

      {état.état === 'écrit' ? (
        <div role="status" className="flex flex-col gap-3 border-t border-gris-ligne pt-3">
          <p className="label-mono text-ardoise">synchronisation faite</p>
          <Comptes comptes={état.comptes} />
        </div>
      ) : null}

      {état.état === 'refusé' ? (
        <p role="status" className="text-label text-rose-texte">
          {état.message}
        </p>
      ) : null}

      {état.état === 'échec' ? (
        <p role="status" className="text-label text-rose-texte">
          Notion ou la base n’a pas répondu : rien n’est écrit. Le détail est dans les journaux.
        </p>
      ) : null}
    </section>
  )
}

function Comptes({ comptes, futur = false }: { comptes: ComptesAffichés; futur?: boolean }) {
  const lignes: Array<[string, number]> = [
    ['lignes lues dans Notion', comptes.lignesLues],
    [futur ? 'organisations à écrire' : 'organisations écrites', comptes.organisations],
    ['dont créées', comptes.organisationsCréées],
    [futur ? 'lecteurs à créer' : 'lecteurs créés', comptes.lecteursCréés],
    [futur ? 'lecteurs à mettre à jour' : 'lecteurs mis à jour', comptes.lecteursMisÀJour],
    [futur ? 'lecteurs à désactiver' : 'lecteurs désactivés', comptes.lecteursDésactivés],
    ['opérateurs globaux', comptes.opérateurs],
    ['écartés', comptes.écartés.length],
  ]
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        {lignes.map(([libellé, valeur]) => (
          <div key={libellé} className="flex flex-col">
            <dt className="label-mono text-ardoise">{libellé}</dt>
            <dd className="text-encre">{valeur}</dd>
          </div>
        ))}
      </dl>
      {comptes.lecteursMisÀJour > 0 ? (
        <p className="text-label text-ardoise">
          « Mis à jour » compte toute ligne déjà en base réalignée sur Notion, qu’elle ait changé ou non.
        </p>
      ) : null}
      {comptes.écartés.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-label text-encre">
            {comptes.écartés.length} ligne{comptes.écartés.length > 1 ? 's' : ''} écartée
            {comptes.écartés.length > 1 ? 's' : ''}, à corriger dans Notion
            {comptes.préservés > 0 ? ` (${comptes.préservés} accès actif${comptes.préservés > 1 ? 's' : ''} laissé${comptes.préservés > 1 ? 's' : ''} tel${comptes.préservés > 1 ? 's' : ''} quel${comptes.préservés > 1 ? 's' : ''})` : ''}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {comptes.écartés.map((écart, i) => (
              <li key={`${écart.ligne}-${i}`} className="label-mono text-ardoise">
                {écart.ligne} · {écart.raison}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  )
}
