import type { Metadata } from 'next'
import Link from 'next/link'
import { lireLesÉcransDUneOrganisation } from '@/lib/auth/appartenance'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import { Panneau } from '@/components/coquille'
import { bouton, MessageDeStatut } from '@/components/gestion-operatrice'
import { Logo } from '@/components/marque'
import { ÉCRANS_DE_L_ESPACE } from '@/lib/domaine/ecrans-de-l-espace'
import { réglerLesÉcransDepuisLaFiche } from '@/lib/portail/gestion-actions'

export const metadata: Metadata = { title: 'Écrans de l’espace — signauxfaibles' }

/**
 * L'écran d'activation des écrans de l'espace client (18 novembre 2026,
 * demande de l'opératrice : « un écran d'activation de chaque écran client »).
 *
 * Une case par écran, rangée par rubrique dans l'ordre du rail : cochée, l'écran
 * est montré au client ; décochée, il quitte le rail, le menu de pied et la vue
 * d'ensemble, et son adresse répond 404 au client. L'opératrice continue de
 * l'ouvrir depuis l'espace, sous un bandeau qui le nomme. La vue d'ensemble ne
 * se masque pas : c'est là que mènent la fin d'essai et chaque écran refusé.
 *
 * La garde est dans `lireLesÉcransDUneOrganisation`, avant toute lecture ; le
 * geste passe par `réglerLesÉcransDepuisLaFiche`, privilège d'abord.
 */
export const instant = false

const MESSAGES: Record<string, string> = {
  'écrans-réglés': 'Écrans enregistrés : le client voit l’espace ainsi dès sa prochaine page.',
  inconnue: 'Organisation introuvable ou archivée : rien n’a changé.',
  échec: 'La base n’a pas répondu : rien n’a changé.',
}

export default async function ÉcransDeLEspace({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ gestion?: string | string[] }>
}) {
  const { slug } = await params
  const { accès, écrans } = await lireLesÉcransDUneOrganisation(slug)
  const paramètres = await searchParams
  const message = typeof paramètres.gestion === 'string' ? MESSAGES[paramètres.gestion] : undefined

  const rubriques = [...new Set(ÉCRANS_DE_L_ESPACE.map((é) => é.rubrique))]

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Écrans de l’espace{écrans ? `, ${écrans.nom}` : ''}</h1>
        <p className="text-ardoise">
          <Link href={`/espaces/abonnements/${encodeURIComponent(slug)}#ecrans`} className="text-encre underline underline-offset-2">
            Retour à la fiche
          </Link>{' '}
          ·{' '}
          <Link href={`/${slug}`} className="text-encre underline underline-offset-2">
            Ouvrir l’espace
          </Link>
        </p>
      </header>

      {message ? <MessageDeStatut message={message} /> : null}

      {!écrans ? (
        <Panneau ton="rose">
          <p className="text-encre">La base Postgres n’est pas en service sur cet environnement : rien à régler ici.</p>
        </Panneau>
      ) : (
        <form action={réglerLesÉcransDepuisLaFiche} className="flex flex-col gap-8">
          <input type="hidden" name="slug" value={écrans.slug} />
          <p className="text-ardoise">
            Un écran coché est montré au client. Décoché, il quitte le rail, le menu de pied et sa carte de la vue
            d’ensemble, et son adresse ne s’ouvre plus pour le client. Vous continuez de l’ouvrir depuis l’espace, où un
            bandeau le signale. Rien n’est supprimé : recocher l’écran le rend tel quel.{' '}
            {écrans.réorganisé
              ? 'Cet espace est réorganisé : tous les écrans ci-dessous existent pour le client.'
              : 'Cet espace n’est pas réorganisé : seuls les sept écrans marqués « espace à sept écrans » existent aujourd’hui pour le client ; le réglage des autres prend effet s’il est réorganisé.'}
          </p>

          {rubriques.map((rubrique) => (
            <fieldset key={rubrique} className="flex flex-col gap-3 border-t border-gris-ligne pt-6">
              <legend className="font-titre text-h3 font-semibold text-encre">{rubrique}</legend>
              <ul className="flex flex-col divide-y divide-gris-ligne border-y border-gris-ligne">
                {ÉCRANS_DE_L_ESPACE.filter((é) => é.rubrique === rubrique).map((é) => {
                  const actif = !é.désactivable || !(écrans.masqués as readonly string[]).includes(é.clé)
                  const libellé = é.clé === 'concurrents' ? écrans.marché.écran : é.clé === 'recommandations' && écrans.réorganisé ? 'Options' : é.clé === 'recommandations' ? 'Recommandations' : é.libellé
                  const existe = écrans.réorganisé || é.classique
                  return (
                    <li key={é.clé} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <label className="flex items-center gap-3 text-encre">
                        <input
                          type="checkbox"
                          name="ecran"
                          value={é.clé}
                          defaultChecked={actif}
                          disabled={!é.désactivable}
                          className="size-4 accent-encre"
                        />
                        <span>{libellé}</span>
                      </label>
                      <span className="flex flex-wrap items-center gap-3">
                        <span className="label-mono text-ardoise">
                          {!é.désactivable
                            ? 'toujours active'
                            : [
                                actif ? 'montré' : 'masqué',
                                é.classique ? 'espace à sept écrans' : 'espace réorganisé',
                                é.clé === 'appels' ? 'si une lettre porte un appel' : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                        {existe ? (
                          <Link href={`/${écrans.slug}${é.segment}`} className="text-label text-ardoise underline decoration-gris-ligne underline-offset-2">
                            Ouvrir
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          ))}

          <p>
            <BoutonEnvoi className={bouton}>Enregistrer</BoutonEnvoi>
          </p>
        </form>
      )}
    </main>
  )
}
