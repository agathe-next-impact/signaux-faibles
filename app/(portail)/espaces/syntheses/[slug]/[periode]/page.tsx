import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { lireUneSynthèseÀRelire } from '@/lib/auth/appartenance'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import { BORNES, LIBELLÉS_PESTEL, type Pestel } from '@/lib/domaine/strategie'
import { libelléDePériode } from '@/lib/domaine/strategie-vues'
import { publierUnePériode } from '@/lib/portail/publication'
import { modifierUnÉnoncéDeSynthèse } from '@/lib/portail/relecture'
import type { ÉlémentÀRelire } from '@/lib/portail/strategie'

export const metadata: Metadata = { title: 'Relire une synthèse — signauxfaibles' }

/**
 * La relecture d'une période de synthèse avant publication (30 octobre 2026).
 *
 * L'opératrice y retouche le texte de chaque élément : énoncés de la SWOT, de
 * la TOWS et de l'option retenue, lignes PESTEL, scénarios et leur titre,
 * interprétations du trimestre. Les faits cités, les cases, les crans de la
 * carte et de Mendelow ne se changent pas ici : ils viennent de la porte, et
 * les corriger demande de re-poster la synthèse. Une période dont une ligne est
 * publiée se lit seulement : la retirer d'abord, depuis le tableau.
 *
 * Comme le tableau, la garde est dans `lireUneSynthèseÀRelire`, avant toute
 * lecture ; la page vit hors de `/[slug]` et n'emprunte pas la coquille.
 */
export const instant = false

const MESSAGES: Record<string, string> = {
  modifié: 'Énoncé enregistré.',
  refusé: 'Énoncé refusé, rien n’a changé',
  'déjà-publiée': 'La période est publiée : la retirer d’abord pour la retoucher.',
  introuvable: 'Élément introuvable dans cette période (synthèse re-postée entre-temps ?).',
  'sans-énoncé': 'Cet élément n’a pas d’énoncé à retoucher.',
  'hors-pilote': 'Cette organisation n’est pas dans le pilote des outils stratégiques.',
  'organisation-inconnue': 'Organisation inconnue.',
  échec: 'La base n’a pas répondu : rien n’a changé.',
}

const SECTIONS: readonly { readonly titre: string; readonly retient: (é: ÉlémentÀRelire) => boolean }[] = [
  { titre: 'Option retenue', retient: (é) => é.outil === 'tows' && é.candidate },
  { titre: 'Options stratégiques (TOWS)', retient: (é) => é.outil === 'tows' && !é.candidate },
  { titre: 'Votre situation (SWOT)', retient: (é) => é.outil === 'swot' },
  { titre: 'Scénarios', retient: (é) => é.outil === 'scenario' },
  { titre: 'PESTEL', retient: (é) => é.outil === 'pestel' },
  { titre: 'Indice de cycle de vie, benchmark et matrice GE', retient: (é) => ['indice_cycle', 'benchmark', 'ge'].includes(é.outil) },
]

const CASES: Record<string, string> = { forces: 'Force', faiblesses: 'Faiblesse', opportunites: 'Opportunité', menaces: 'Menace' }

function repère(é: ÉlémentÀRelire): string {
  if (é.outil === 'swot') return `${CASES[é.clé] ?? é.clé} ${é.rang}`
  if (é.outil === 'tows') return `${é.clé} ${é.rang}`
  if (é.outil === 'scenario') return `Scénario ${String.fromCharCode(64 + Number(é.clé.replace('scenario-', '') || 1))}`
  if (é.outil === 'pestel') return LIBELLÉS_PESTEL[é.clé.replace('pestel:', '') as Pestel] ?? é.clé
  return é.clé
}

export default async function RelireUneSynthèse({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; periode: string }>
  searchParams: Promise<{ resultat?: string | string[]; element?: string | string[]; motif?: string | string[] }>
}) {
  const { slug, periode } = await params
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^\d{4}-(\d{2}|T[1-4])$/.test(periode)) notFound()
  const { accès, synthèse } = await lireUneSynthèseÀRelire(slug, periode)
  const paramètres = await searchParams
  const résultat = typeof paramètres.resultat === 'string' ? paramètres.resultat : undefined
  const élémentRetouché = typeof paramètres.element === 'string' ? paramètres.element : undefined
  const motif = typeof paramètres.motif === 'string' ? paramètres.motif : undefined

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Relire une synthèse</h1>
        <p className="text-ardoise">
          {synthèse?.sorte === 'lue' ? `${synthèse.nom}, ` : `${slug}, `}
          {periode.includes('T') ? 'trimestre' : 'mois'} {libelléDePériode(periode)}.{' '}
          <Link href="/espaces/abonnements#syntheses" className="text-encre underline underline-offset-2">
            Retour au tableau
          </Link>
        </p>
      </header>

      {résultat && MESSAGES[résultat] ? (
        <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
          {MESSAGES[résultat]}
          {résultat === 'refusé' && motif ? ` : ${motif}.` : ''}
        </p>
      ) : null}

      {synthèse === null ? (
        <Panneau ton="rose">
          <p className="text-encre">La base Postgres n’est pas en service sur cet environnement : rien à relire.</p>
        </Panneau>
      ) : synthèse.sorte !== 'lue' ? (
        <p className="text-ardoise">{MESSAGES[synthèse.sorte] ?? 'Aucune synthèse enregistrée pour cette période.'}</p>
      ) : (
        <>
          {synthèse.publiée ? (
            <Panneau ton="rose">
              <p className="text-encre">
                Cette période est publiée : ses lecteurs la voient. Pour la retoucher, la retirer
                depuis le tableau, corriger, puis la publier de nouveau.
              </p>
            </Panneau>
          ) : (
            <section className="flex flex-wrap items-center justify-between gap-4 border border-gris-ligne p-4">
              <p className="text-ardoise">
                Proposée, non montrée au client. Chaque énoncé s’enregistre seul ; publier rend la
                période visible à ses lecteurs dès leur prochaine visite.
              </p>
              <form action={publierUnePériode}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="periode" value={periode} />
                <input type="hidden" name="etat" value="publie" />
                <button type="submit" className="rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc">
                  Publier
                </button>
              </form>
            </section>
          )}

          {SECTIONS.map((section) => {
            const éléments = synthèse.éléments.filter((é) => section.retient(é) && é.énoncé !== null)
            if (éléments.length === 0) return null
            return (
              <section key={section.titre} className="flex flex-col gap-4">
                <h2 className="font-titre text-h2 font-bold text-encre">{section.titre}</h2>
                {éléments.map((é) => (
                  <Élément
                    key={é.id}
                    élément={é}
                    slug={slug}
                    période={periode}
                    modifiable={!synthèse.publiée}
                    retouché={é.id === élémentRetouché}
                  />
                ))}
              </section>
            )
          })}
        </>
      )}
    </main>
  )
}

function Élément({
  élément,
  slug,
  période,
  modifiable,
  retouché,
}: {
  élément: ÉlémentÀRelire
  slug: string
  période: string
  modifiable: boolean
  retouché: boolean
}) {
  const max = élément.outil === 'scenario' ? BORNES.scénarioMax : BORNES.énoncéMax
  const détails = [
    `${élément.faits} fait${élément.faits > 1 ? 's' : ''} cité${élément.faits > 1 ? 's' : ''}`,
    élément.origine === 'declaratif' ? 'déclaratif' : null,
    `${max} caractères au plus`,
  ].filter(Boolean)
  return (
    <article id={élément.id} className={`flex flex-col gap-2 border p-4 ${retouché ? 'border-encre' : 'border-gris-ligne'}`}>
      <p className="label-mono text-ardoise">
        {repère(élément)} · {détails.join(' · ')}
      </p>
      {modifiable ? (
        <form action={modifierUnÉnoncéDeSynthèse} className="flex flex-col gap-2">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="periode" value={période} />
          <input type="hidden" name="element" value={élément.id} />
          {élément.outil === 'scenario' ? (
            <label className="flex flex-col gap-1">
              <span className="label-mono text-ardoise">titre</span>
              <input
                name="titre"
                defaultValue={élément.titre ?? ''}
                maxLength={BORNES.libelléMax * 2}
                className="border border-gris-ligne px-3 py-2 text-encre"
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="label-mono text-ardoise">énoncé</span>
            <textarea
              name="enonce"
              defaultValue={élément.énoncé ?? ''}
              maxLength={max}
              rows={élément.outil === 'scenario' ? 5 : 3}
              className="border border-gris-ligne px-3 py-2 text-encre"
            />
          </label>
          <div>
            <button type="submit" className="rounded-douce border border-encre px-3 py-1 text-label font-medium text-encre">
              Enregistrer
            </button>
          </div>
        </form>
      ) : (
        <>
          {élément.titre ? <p className="font-medium text-encre">{élément.titre}</p> : null}
          <p className="text-encre">{élément.énoncé}</p>
        </>
      )}
    </article>
  )
}
