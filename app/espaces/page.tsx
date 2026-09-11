import type { Metadata } from 'next'
import { listerLesEspaces } from '@/lib/auth/appartenance'
import { Case, Grille, LienFlèche } from '@/components/coquille'
import { Logo } from '@/components/marque'

export const metadata: Metadata = { title: 'Choisir un espace — signauxfaibles' }

/**
 * Le sélecteur d'espaces de l'opérateur.
 *
 * Cet écran est le seul du portail à nommer plusieurs clients sur une même
 * page. Sa garde est donc dans `listerLesEspaces`, avant toute lecture : une
 * personne sans le privilège reçoit `notFound`, sans que la page confirme son
 * existence.
 *
 * Il vit hors de `/[slug]` et n'emprunte pas la coquille : celle-ci porte la
 * navigation d'un espace client, or on n'en a encore choisi aucun.
 */
// Toute la page dépend de la garde, qui lit le cookie : il n'y a pas
// d'enveloppe à pré-rendre autour d'elle, et une frontière Suspense n'aurait
// rien à montrer en attendant. `instant = false` assume ce blocage, qui dure le
// temps d'une lecture cachée — comme pour la racine.
export const instant = false

export default async function Espaces() {
  const { accès, espaces } = await listerLesEspaces()

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Choisir un espace</h1>
        <p className="text-ardoise">
          Vous ouvrez l’espace d’un client tel qu’il le voit. Chaque visite est signalée
          par un bandeau et journalisée.
        </p>
      </header>

      {espaces.length === 0 ? (
        <p className="text-ardoise">
          Aucun espace ouvert. Un espace apparaît ici dès qu’une ligne active existe dans
          « Accès — portail ».
        </p>
      ) : (
        <Grille étiquette="Espaces clients" colonnes={2}>
          {espaces.map((espace) => (
            <Case key={espace.slug}>
              <h2 className="font-titre text-h3 font-semibold text-encre">
                {espace.organisationLibellé || espace.slug}
              </h2>
              <p className="label-mono text-ardoise">
                {espace.slug} · {espace.lecteurs} lecteur{espace.lecteurs > 1 ? 's' : ''}
              </p>
              <div className="mt-auto pt-1">
                <LienFlèche href={`/${espace.slug}`} étendu>
                  Ouvrir
                </LienFlèche>
              </div>
            </Case>
          ))}
        </Grille>
      )}
    </main>
  )
}
