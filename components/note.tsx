import { construireDocument } from '@/lib/domaine/document'
import { tronquerÀLEssentiel } from '@/lib/domaine/troncature'
import { lireBlocsDePage, type Édition } from '@/lib/notion/editions'
import { RenduDocument } from '@/components/document'
import { EntêteÉdition } from '@/components/entete-edition'
import { PanneauDossiers } from '@/components/panneau-dossiers'

/**
 * Une note complète : son cartouche, son corps, ses dossiers.
 *
 * La lecture des blocs n'a lieu qu'ici, c'est-à-dire après que l'édition a été
 * retrouvée dans la liste filtrée de l'organisation. C'est cette liste qui
 * porte le cloisonnement ; jamais l'identifiant de page venu d'une URL.
 */
export async function Note({
  édition,
  lecture = 'complète',
}: {
  édition: Édition
  /**
   * `essentiel` en fin d'essai (palier 1c) : le document est tronqué **avant**
   * le rendu, et l'action de la semaine et les dossiers suivis, qui viennent des
   * propriétés de l'édition et non du corps, ne sont pas rendus. Rien du reste
   * de la lettre n'atteint donc le HTML ni les props sérialisées.
   */
  lecture?: 'complète' | 'essentiel'
}) {
  const blocs = await lireBlocsDePage(édition.pageId)
  const document = lecture === 'essentiel' ? tronquerÀLEssentiel(construireDocument(blocs)) : construireDocument(blocs)

  if (lecture === 'essentiel') {
    return (
      <section className="flex flex-col gap-6">
        <EntêteÉdition édition={édition} />
        <RenduDocument document={document} />
        <p className="border border-gris-ligne bg-fond-rose p-4 text-encre">
          Votre essai est terminé : cette lettre est réduite à sa rubrique « L’essentiel ». La lettre
          complète est réservée aux abonnés.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <EntêteÉdition édition={édition} />

      {édition.actionDeLaSemaine ? (
        <aside className="border border-gris-ligne bg-fond-ardoise p-4">
          <h3 className="label-mono text-ardoise">
            Action de la semaine
          </h3>
          <p className="mt-2 text-encre">{édition.actionDeLaSemaine}</p>
        </aside>
      ) : null}

      <RenduDocument document={document} />

      <PanneauDossiers brut={édition.dossiersOuvertsBruts} />
    </section>
  )
}
