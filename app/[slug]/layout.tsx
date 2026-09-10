import { Suspense } from 'react'
import { exigerAccès } from '@/lib/auth/appartenance'
import { Coquille } from '@/components/coquille'
import { ongletsDe, semainesPubliées } from '@/lib/portail/semaine'

/**
 * Le cadre de l'espace client : le rail latéral et les cinq écrans.
 *
 * Le contrôle d'appartenance s'exécute ici, dans `Garde`, avant que le moindre
 * contenu ne soit demandé. Il est isolé sous une frontière `Suspense` parce
 * qu'il lit le cookie : avec `cacheComponents`, l'enveloppe reste ainsi
 * pré-rendue.
 *
 * Les pages appellent la même fonction pour obtenir l'identifiant
 * d'organisation. Ce n'est pas une redite inutile : sans RLS, un écran qui
 * oublierait le contrôle servirait les éditions d'un autre client.
 */
export default function LayoutClient({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  // `params` n'est pas attendu ici : avec `cacheComponents`, c'est une donnée
  // de requête, et l'attendre hors de la frontière empêcherait tout pré-rendu.
  return (
    <Suspense fallback={<Chargement />}>
      <Garde params={params}>{children}</Garde>
    </Suspense>
  )
}

async function Garde({
  params,
  children,
}: {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}) {
  const { slug } = await params
  const accès = await exigerAccès(slug)

  // Les deux compteurs du rail se lisent dans la requête de liste, déjà
  // nécessaire : aucun corps de note n'est chargé pour les afficher.
  const semaines = await semainesPubliées(accès.organisationId)
  const recommandations = semaines.filter((semaine) =>
    semaine.éditions.some((édition) => édition.actionDeLaSemaine.length > 0),
  ).length

  return (
    <Coquille
      organisation={accès.organisationLibellé || 'votre veille'}
      onglets={ongletsDe(accès.slug, { recommandations, archives: semaines.length })}
    >
      {children}
    </Coquille>
  )
}

function Chargement() {
  return (
    <div className="px-6 py-8 text-ardoise">
      <p>Chargement…</p>
    </div>
  )
}
