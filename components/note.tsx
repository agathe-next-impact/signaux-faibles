import { construireDocument, type Document } from '@/lib/domaine/document'
import { tronquerÀLEssentiel } from '@/lib/domaine/troncature'
import { lireBlocsDePage, type Édition } from '@/lib/documents'
import { ÀRetenir } from '@/components/a-retenir'
import { ancreDAxe, RenduDocument } from '@/components/document'
import { axesÀRetenir, suivreLesAxes } from '@/lib/domaine/tendances'
import { EntêteÉdition } from '@/components/entete-edition'
import { PanneauDossiers } from '@/components/panneau-dossiers'
import { PurgeHorsLigne } from '@/components/purge-hors-ligne'

/**
 * Une note complète : son cartouche, son corps, ses dossiers.
 *
 * La lecture des blocs n'a lieu qu'ici, c'est-à-dire après que l'édition a été
 * retrouvée dans la liste filtrée de l'organisation. C'est cette liste qui
 * porte le cloisonnement ; jamais l'identifiant de page venu d'une URL.
 */
export async function Note({
  édition,
  lecture,
  précédente,
}: {
  édition: Édition
  /**
   * `essentiel` en fin d'essai (palier 1c) : le document est tronqué **avant**
   * le rendu, et l'action de la semaine et les dossiers suivis, qui viennent des
   * propriétés de l'édition et non du corps, ne sont pas rendus. Rien du reste
   * de la lettre n'atteint donc le HTML ni les props sérialisées.
   *
   * Obligatoire, sans valeur par défaut : un appelant qui l'oublierait ne doit
   * pas servir la lettre entière par mégarde.
   */
  lecture: 'complète' | 'essentiel'
  /**
   * La lettre précédente de la même veille (31 octobre 2026) : sa lecture, déjà
   * cachée, dit ce qui est nouveau ou en hausse. Sans elle, pas de mise en avant
   * (archives d'une semaine) ; `null` pour une première lettre : seuls les axes
   * FORT sont mis en avant.
   */
  précédente?: Édition | null
}) {
  const blocs = await lireBlocsDePage(édition.pageId)
  const document = lecture === 'essentiel' ? tronquerÀLEssentiel(construireDocument(blocs)) : construireDocument(blocs)

  if (lecture === 'essentiel') {
    return (
      <section className="flex flex-col gap-6">
        <PurgeHorsLigne />
        <EntêteÉdition édition={édition} />
        <RenduDocument document={document} />
        <p className="border border-gris-ligne bg-fond-rose p-4 text-encre">
          {document.rubriques.length === 0
            ? 'Votre essai est terminé. Cette lettre ne porte pas de rubrique « L’essentiel » : elle est réservée aux abonnés.'
            : 'Votre essai est terminé : cette lettre est réduite à sa rubrique « L’essentiel ». La lettre complète est réservée aux abonnés.'}
        </p>
      </section>
    )
  }

  const miseEnAvant = précédente === undefined ? null : await àRetenirDeLaLettre(document, précédente)

  return (
    <section className="flex flex-col gap-6">
      <EntêteÉdition édition={édition} />

      {miseEnAvant ? (
        <ÀRetenir
          titre="À retenir"
          mention={précédente ? 'signal fort et nouveautés depuis la lettre précédente' : 'signal fort'}
          axes={miseEnAvant.axes}
          lien={(axe) => `#${ancreDAxe(axe.titre)}`}
        />
      ) : null}

      {édition.actionDeLaSemaine ? (
        <aside className="border border-gris-ligne bg-fond-ardoise p-4">
          <h3 className="label-mono text-ardoise">
            Action de la semaine
          </h3>
          <p className="mt-2 text-encre">{édition.actionDeLaSemaine}</p>
        </aside>
      ) : null}

      <RenduDocument document={document} miseEnAvant={miseEnAvant ? { nouveaux: miseEnAvant.nouveaux } : undefined} />

      <PanneauDossiers brut={édition.dossiersOuvertsBruts} />
    </section>
  )
}

/** Les axes à retenir d'une lettre, comparée à la précédente de la même veille. */
async function àRetenirDeLaLettre(document: Document, précédente: Édition | null) {
  const avant = précédente ? construireDocument(await lireBlocsDePage(précédente.pageId)) : null
  const suivis = suivreLesAxes([document], avant ? [avant] : [])
  const axes = axesÀRetenir(suivis, { avecPrécédent: avant !== null })
  const nouveaux = new Set(
    avant ? suivis.filter((a) => a.niveau !== 'RAS' && (a.mouvement === 'nouveau' || a.mouvement === 'monté')).map((a) => a.titre) : [],
  )
  return { axes, nouveaux }
}
