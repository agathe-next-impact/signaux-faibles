import Link from 'next/link'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import { bouton, lienDeGeste } from '@/components/gestion-operatrice'
import { LIBELLÉS_DES_COURRIERS_DE_PARCOURS } from '@/lib/domaine/courriers-parcours'
import { dateLongueDeParis, libelléDÉtape } from '@/lib/domaine/parcours'
import type { aperçuDeLaSérie, semaineDuParcours } from '@/lib/domaine/placement'
import { appliquerEnSérie } from '@/lib/portail/reglages'

/**
 * Les blocs du tableau des abonnements qui disent ce qui vient et agissent en
 * série (16 novembre 2026), sortis de la page pour être rendus par les tests.
 * Aucune lecture ici : la page leur passe ce qu'elle a calculé.
 */

function jourLong(dateISO: string): string {
  return dateLongueDeParis(new Date(`${dateISO}T12:00:00Z`))
}

/**
 * Ce qui se joue cette semaine et lundi prochain (16 novembre 2026) : les
 * courriers de parcours que le passage quotidien prépare en brouillon, et les
 * organisations dont l'étape change. Le calendrier parle, pas le journal : un
 * brouillon déjà envoyé y figure encore.
 */
export function CetteSemaine({ semaine }: { semaine: ReturnType<typeof semaineDuParcours> }) {
  const { cetteSemaine, lundiProchain } = semaine
  if (cetteSemaine.length === 0 && lundiProchain.length === 0) return null
  return (
    <section aria-labelledby="cette-semaine" className="flex flex-col gap-4 border border-gris-ligne bg-fond-neutre p-4">
      <h2 id="cette-semaine" className="font-titre text-h3 font-semibold text-encre">
        Cette semaine
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="label-mono text-ardoise">brouillons de parcours dus cette semaine</p>
          {cetteSemaine.length === 0 ? (
            <p className="text-ardoise">Aucun.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cetteSemaine.map((m) => (
                <li key={m.slug} className="text-encre">
                  <Link href={`/espaces/abonnements/${m.slug}#courriers`} className="underline underline-offset-2">
                    {m.nom}
                  </Link>{' '}
                  <span className="label-mono text-ardoise">
                    {libelléDÉtape(m.étape)}
                    {m.courrier ? ` · ${LIBELLÉS_DES_COURRIERS_DE_PARCOURS[m.courrier]}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="label-mono text-ardoise">
            lundi prochain{lundiProchain[0] ? `, ${jourLong(lundiProchain[0].le)}` : ''}
          </p>
          {lundiProchain.length === 0 ? (
            <p className="text-ardoise">Aucun changement d’étape.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lundiProchain.map((m) => (
                <li key={m.slug} className="text-encre">
                  <Link href={`/espaces/abonnements/${m.slug}#parcours`} className="underline underline-offset-2">
                    {m.nom}
                  </Link>{' '}
                  <span className="label-mono text-ardoise">
                    {libelléDÉtape(m.étape)}
                    {m.courrier ? ` · ${LIBELLÉS_DES_COURRIERS_DE_PARCOURS[m.courrier]}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-ardoise">
        Les courriers de parcours sont déposés en brouillon Gmail par le passage quotidien, un par lecteur actif : rien ne part
        sans vous. Pour décaler une échéance, cochez l’organisation et prolongez son essai, ou placez-la à une autre étape.
      </p>
    </section>
  )
}

/**
 * L'effet d'un geste en série, organisation par organisation, avant de
 * confirmer : ce qui changera, et pourquoi le reste ne changera pas. Seules les
 * organisations où le geste est possible partent à la confirmation.
 */
export function AperçuDeSérie({ lot, libellé, effets }: { lot: string; libellé: string; effets: ReturnType<typeof aperçuDeLaSérie> }) {
  const possibles = effets.filter((e) => e.possible)
  return (
    <section aria-labelledby="apercu-de-serie" className="flex flex-col gap-4 border border-encre bg-blanc p-4">
      <h2 id="apercu-de-serie" className="font-titre text-h3 font-semibold text-encre">
        {libellé}
      </h2>
      <p className="label-mono text-ardoise">effet sur les organisations cochées, rien n’est encore écrit</p>
      {effets.length === 0 ? (
        <p className="text-encre">Aucune organisation cochée : cochez des lignes du tableau, puis « Voir l’effet ».</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
          {effets.map((effet) => (
            <li key={effet.slug} className="flex flex-col gap-1 py-3">
              <p className={effet.possible ? 'text-encre' : 'text-ardoise'}>{effet.nom}</p>
              {effet.possible ? (
                <p className="text-encre">{effet.effet}.</p>
              ) : (
                <p className="text-ardoise">
                  <span className="label-mono opacity-60">indisponible</span> {effet.raison}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {possibles.length > 0 ? (
          <form action={appliquerEnSérie}>
            <input type="hidden" name="lot" value={lot} />
            {possibles.map((effet) => (
              <input key={effet.slug} type="hidden" name="o" value={effet.slug} />
            ))}
            <BoutonEnvoi className={bouton}>
              Confirmer pour {possibles.length} organisation{possibles.length > 1 ? 's' : ''}
            </BoutonEnvoi>
          </form>
        ) : null}
        <Link href="/espaces/abonnements" className={lienDeGeste}>
          Annuler
        </Link>
      </div>
    </section>
  )
}

/** Le résultat d'une série : ce qui a été réglé, et pourquoi le reste ne l'a pas été. */
export function RetourDeSérie({
  libellé,
  réglées,
  refusées,
  messages,
}: {
  libellé: string
  réglées: readonly string[]
  refusées: readonly { slug: string; code: string }[]
  /** Le texte de chaque code de refus, celui du tableau. */
  messages: Readonly<Record<string, string>>
}) {
  return (
    <div role="status" className="flex flex-col gap-2 border border-gris-ligne bg-fond-ardoise p-4 text-encre">
      <p>
        {libellé} : {réglées.length} organisation{réglées.length > 1 ? 's' : ''} réglée{réglées.length > 1 ? 's' : ''}
        {réglées.length > 0 ? ` (${réglées.join(', ')})` : ''}.
      </p>
      {refusées.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {refusées.map((refus) => (
            <li key={refus.slug}>
              <span className="label-mono text-rose-texte">{refus.slug}</span> {messages[refus.code] ?? 'Réglage refusé.'}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

