import { construireDocument } from '@/lib/domaine/document'
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
export async function Note({ édition }: { édition: Édition }) {
  const blocs = await lireBlocsDePage(édition.pageId)
  const document = construireDocument(blocs)

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
