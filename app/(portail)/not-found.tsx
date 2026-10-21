import type { Metadata } from 'next'
import Link from 'next/link'
import { CLASSE_ACTION_DE_SECOURS, PageDeSecours } from '@/components/page-de-secours'

export const metadata: Metadata = { title: 'Page introuvable — signauxfaibles' }

/**
 * La page servie par `notFound()`.
 *
 * Elle est volontairement la même pour un slug inconnu, un slug d'un autre
 * client et une lettre qui n'existe pas : le portail ne confirme jamais qu'une
 * adresse existe (règles 2 et 8). Elle ne dit donc rien de plus que « rien ici ».
 */
export default function Introuvable() {
  return (
    <PageDeSecours
      titre="Rien à cette adresse"
      action={
        <Link href="/" className={CLASSE_ACTION_DE_SECOURS}>
          Retour à votre espace
        </Link>
      }
    >
      <p>
        Cette adresse ne mène à aucune page de votre espace. Si vous l’avez reçue par
        courrier, demandez un nouveau lien depuis la page « recevoir mon lien ».
      </p>
    </PageDeSecours>
  )
}
