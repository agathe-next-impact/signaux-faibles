import type { Axe, Bloc, Document, Segment } from '@/lib/domaine/document'
import { trierParImpact } from '@/lib/domaine/impact'
import { BadgeImpact } from '@/components/badge-impact'
import { TitreAxe } from '@/components/titre-axe'

/**
 * Rendu de la note comme un document.
 *
 * Les axes sont repliables et triés par impact ; le reste garde l'ordre
 * de la note. Aucune couleur n'est écrite ici : tout passe par les tokens, pour
 * que l'arrivée de la charte ne touche aucun composant.
 */

function Texte({ segments }: { segments: readonly Segment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        let contenu: React.ReactNode = segment.texte
        if (segment.code) contenu = <code className="font-mono text-[0.9em]">{contenu}</code>
        if (segment.italique) contenu = <em>{contenu}</em>
        if (segment.gras) contenu = <strong className="font-medium">{contenu}</strong>
        if (segment.barré) contenu = <s>{contenu}</s>

        if (segment.lien) {
          contenu = (
            <a
              href={segment.lien}
              rel="noreferrer noopener"
              target="_blank"
              className="text-encre underline decoration-gris-ligne underline-offset-2"
            >
              {contenu}
            </a>
          )
        }

        return <span key={index}>{contenu}</span>
      })}
    </>
  )
}

function RenduBloc({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case 'paragraphe':
      return (
        <p className="text-encre">
          <Texte segments={bloc.segments} />
        </p>
      )

    case 'titre':
      return (
        <h4 className="font-titre text-h3 font-semibold text-encre">
          <Texte segments={bloc.segments} />
        </h4>
      )

    case 'liste': {
      const Liste = bloc.ordonnée ? 'ol' : 'ul'
      return (
        <Liste
          className={`flex flex-col gap-1 pl-5 ${bloc.ordonnée ? 'list-decimal' : 'list-disc'}`}
        >
          {bloc.éléments.map((élément, index) => (
            <li key={index} className="text-encre">
              <Texte segments={élément} />
            </li>
          ))}
        </Liste>
      )
    }

    case 'citation':
      return (
        <blockquote className="border-l-2 border-gris-ligne pl-4 text-ardoise">
          <Texte segments={bloc.segments} />
        </blockquote>
      )

    case 'encadré':
      return (
        <aside className="bg-fond-neutre px-4 py-3 text-encre">
          <Texte segments={bloc.segments} />
        </aside>
      )

    case 'code':
      return (
        <pre className="overflow-x-auto bg-fond-neutre p-4">
          <code className="font-mono text-label">{bloc.texte}</code>
        </pre>
      )

    case 'séparateur':
      return <hr className="border-gris-ligne" />

    case 'image':
      return (
        <figure className="flex flex-col gap-2">
          {/* Jamais l'URL Notion : elle expire en une heure. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${bloc.blocId}`}
            alt={bloc.légende}
            loading="lazy"
          />
          {bloc.légende ? (
            <figcaption className="font-mono text-label text-ardoise">
              {bloc.légende}
            </figcaption>
          ) : null}
        </figure>
      )

    case 'tableau':
      return (
        // Un tableau large défile dans son propre cadre : la page, elle, ne
        // défile jamais horizontalement.
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-corps">
            <tbody>
              {bloc.lignes.map((ligne, indexLigne) => {
                const enTête = bloc.enTête && indexLigne === 0
                const Cellule = enTête ? 'th' : 'td'
                return (
                  <tr key={indexLigne} className="border-b border-gris-ligne">
                    {ligne.map((cellule, indexCellule) => (
                      <Cellule
                        key={indexCellule}
                        scope={enTête ? 'col' : undefined}
                        className={`px-3 py-2 text-left align-top ${
                          enTête ? 'font-medium text-ardoise' : 'text-encre'
                        }`}
                      >
                        <Texte segments={cellule} />
                      </Cellule>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
  }
}

export function RenduBlocs({ blocs }: { blocs: readonly Bloc[] }) {
  return <Blocs blocs={blocs} />
}

function Blocs({ blocs }: { blocs: readonly Bloc[] }) {
  if (blocs.length === 0) return null
  return (
    <div className="flex flex-col gap-4">
      {blocs.map((bloc, index) => (
        <RenduBloc key={index} bloc={bloc} />
      ))}
    </div>
  )
}

function RenduAxe({ axe }: { axe: Axe }) {
  return (
    <details
      // Ouvertes par défaut, toutes. La charte pose que « RAS » est un état à
      // part entière : il se montre, il ne se cache pas — un axe replié
      // d'office le cacherait. Le pli reste offert au lecteur, il n'est pas
      // imposé. C'est aussi ce qui fait une lettre plutôt qu'un tableau de bord.
      open
      className="border border-gris-ligne"
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
        <span className="font-titre text-h3 font-semibold text-encre">
          <TitreAxe axe={axe} />
        </span>
        <BadgeImpact niveau={axe.niveau} />
      </summary>
      <div className="px-4 pb-4">
        <Blocs blocs={axe.blocs} />
      </div>
    </details>
  )
}

export function RenduDocument({ document }: { document: Document }) {
  return (
    <article className="flex flex-col gap-8">
      <Blocs blocs={document.préambule} />

      {document.rubriques.map((rubrique, index) => (
        <section key={index} className="flex flex-col gap-4">
          {rubrique.titre ? (
            <h3 className="font-titre text-h2 font-bold text-encre">{rubrique.titre}</h3>
          ) : null}

          <Blocs blocs={rubrique.introduction} />

          {rubrique.axes.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Le tri par impact opère au niveau des axes, jamais des
                  faits : la note est un document, pas une base d'items. */}
              {trierParImpact(rubrique.axes).map((axe, rang) => (
                <RenduAxe key={rang} axe={axe} />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </article>
  )
}
