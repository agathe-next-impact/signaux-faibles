import type { Metadata } from 'next'
import Link from 'next/link'
import { listerLesSynthèses } from '@/lib/auth/appartenance'
import { BoutonEnvoi } from '@/components/bouton-envoi'
import { Logo } from '@/components/marque'
import { Panneau } from '@/components/coquille'
import {
  comptesDesPériodes,
  périodesÀRelire,
  type PériodeAPublier,
  type SynthèsesDUneOrganisation,
} from '@/lib/domaine/strategie-vues'
import { publierUnePériode } from '@/lib/portail/publication'

export const metadata: Metadata = { title: 'Synthèses stratégiques — signauxfaibles' }

/**
 * L'écran des synthèses stratégiques de l'opératrice (12 novembre 2026).
 *
 * Les synthèses vivaient depuis le 29 octobre 2026 en section du tableau des
 * abonnements ; la page de relecture d'une période
 * (`/espaces/syntheses/[slug]/[periode]`) n'avait pas de page parente. Elles ont
 * désormais leur écran : les comptes, puis ce qui attend un geste (périodes
 * proposées ou publiées en partie, toutes organisations confondues), puis
 * toutes les périodes, organisation par organisation, avec « Relire », « Publier »
 * et « Retirer ». Le geste reste celui de `publierUnePériode`, qui revient ici.
 *
 * Comme le tableau des abonnements, la garde est dans `listerLesSynthèses`,
 * avant toute lecture qui traverse les clients ; la page vit hors de `/[slug]`
 * et n'emprunte pas la coquille. Elle ne lit aucun corps : des comptes de
 * lignes, en Postgres seulement.
 */
export const instant = false

const MESSAGES: Record<string, string> = {
  publiée: 'Période publiée : les lecteurs la voient à leur prochaine visite.',
  retirée: 'Période retirée : elle n’est plus montrée au client.',
  aucune: 'Aucune synthèse enregistrée pour cette période.',
  'hors-pilote': 'Cette organisation n’est pas dans le pilote des outils stratégiques.',
  'organisation-inconnue': 'Organisation inconnue.',
  échec: 'La base n’a pas répondu : rien n’a changé.',
}

const LIBELLÉS_D_ÉTAT: Record<PériodeAPublier['état'], string> = {
  proposée: 'proposée, non montrée',
  publiée: 'publiée',
  retirée: 'retirée',
  mêlée: 'publiée en partie, non montrée',
}

const BOUTON = 'rounded-douce bg-encre px-3 py-1 text-label font-medium text-blanc'
const LIEN = 'text-label text-encre underline underline-offset-2'

export default async function Synthèses({
  searchParams,
}: {
  searchParams: Promise<{ synthese?: string | string[]; slug?: string | string[]; periode?: string | string[] }>
}) {
  const { accès, organisations } = await listerLesSynthèses()
  const paramètres = await searchParams
  const résultat = typeof paramètres.synthese === 'string' ? MESSAGES[paramètres.synthese] : undefined
  const slugRéglé = typeof paramètres.slug === 'string' ? paramètres.slug : undefined
  const périodeRéglée = typeof paramètres.periode === 'string' ? paramètres.periode : undefined

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        <Logo />
        <p className="label-mono text-rose-texte">accès opérateur · {accès.nom}</p>
        <h1 className="font-titre text-h1 font-bold text-encre">Synthèses stratégiques</h1>
        <p className="text-ardoise">
          Une période n’est montrée au client qu’une fois publiée en entier, après relecture du courriel « [Relecture] » ;
          « Relire et modifier » permet d’en retoucher les énoncés avant. Publier la rend visible à ses lecteurs dès leur
          prochaine visite, sur les écrans de l’espace qui lisent la synthèse (Acteurs, Forces du marché, PESTEL,
          Diagnostic, Scénarios, Options ou Recommandations, Indicateurs) ; retirer la leur cache aussitôt.{' '}
          <Link href="/espaces" className="text-encre underline underline-offset-2">
            Choisir un espace
          </Link>
        </p>
      </header>

      {résultat ? (
        <p role="status" className="border border-gris-ligne bg-fond-ardoise p-4 text-encre">
          {slugRéglé ? `${slugRéglé}${périodeRéglée ? `, ${périodeRéglée}` : ''} : ` : ''}
          {résultat}
        </p>
      ) : null}

      {organisations === null ? (
        <Panneau ton="rose">
          <p className="text-encre">
            La base Postgres n’est pas en service sur cet environnement (`SOURCE_ACCES` vaut `notion`, ou `DATABASE_URL`
            est absente) : aucune synthèse à montrer.
          </p>
        </Panneau>
      ) : organisations.length === 0 ? (
        <p className="text-ardoise">Aucune synthèse enregistrée pour le pilote.</p>
      ) : (
        <>
          <Comptes organisations={organisations} />
          <ÀRelire organisations={organisations} />
          <section aria-labelledby="par-organisation" className="flex flex-col gap-4">
            <h2 id="par-organisation" className="font-titre text-h2 font-bold text-encre">
              Par organisation
            </h2>
            {organisations.map((o) => (
              <Organisation key={o.slug} organisation={o} />
            ))}
          </section>
        </>
      )}
    </main>
  )
}

function Comptes({ organisations }: { organisations: readonly SynthèsesDUneOrganisation[] }) {
  const c = comptesDesPériodes(organisations)
  const cases: readonly { intitulé: string; valeur: number; signal?: boolean }[] = [
    { intitulé: 'à relire', valeur: c.àRelire, signal: c.àRelire > 0 },
    { intitulé: 'publiées', valeur: c.publiées },
    { intitulé: 'retirées', valeur: c.retirées },
    { intitulé: 'organisations', valeur: c.organisations },
  ]
  return (
    <dl className="grid grid-cols-2 border-l border-t border-gris-ligne sm:grid-cols-4">
      {cases.map((k) => (
        <div key={k.intitulé} className="flex flex-col gap-1 border-b border-r border-gris-ligne p-4">
          <dt className="label-mono text-ardoise">{k.intitulé}</dt>
          <dd className={`font-titre text-h2 font-bold ${k.signal ? 'text-rose-texte' : 'text-encre'}`}>{k.valeur}</dd>
        </div>
      ))}
    </dl>
  )
}

function ÀRelire({ organisations }: { organisations: readonly SynthèsesDUneOrganisation[] }) {
  const périodes = périodesÀRelire(organisations)
  return (
    <section aria-labelledby="a-relire" className="flex flex-col gap-4">
      <h2 id="a-relire" className="font-titre text-h2 font-bold text-encre">
        À relire et publier
      </h2>
      {périodes.length === 0 ? (
        <p className="text-ardoise">Rien n’attend de relecture : chaque période est publiée ou retirée.</p>
      ) : (
        <TableDesPériodes
          entêtes={['organisation', 'période', 'lignes', 'état', 'publication']}
          lignes={périodes.map((p) => ({ slug: p.slug, nom: p.nom, période: p, montrerOrganisation: true }))}
        />
      )}
    </section>
  )
}

function Organisation({ organisation: o }: { organisation: SynthèsesDUneOrganisation }) {
  return (
    <section aria-labelledby={`organisation-${o.slug}`} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 id={`organisation-${o.slug}`} className="font-titre text-h3 font-semibold text-encre">
          {o.nom}
        </h3>
        <span className="label-mono text-ardoise">
          {o.slug} · {o.périodes.length} période{o.périodes.length > 1 ? 's' : ''}
        </span>
        <Link href={`/espaces/abonnements/${o.slug}`} className={LIEN}>
          Gérer
        </Link>
        <Link href={`/${o.slug}/recommandations`} className={LIEN}>
          Ouvrir l’espace
        </Link>
      </div>
      <TableDesPériodes
        entêtes={['période', 'lignes', 'état', 'publication']}
        lignes={o.périodes.map((p) => ({ slug: o.slug, nom: o.nom, période: p, montrerOrganisation: false }))}
      />
    </section>
  )
}

type LigneDePériode = {
  readonly slug: string
  readonly nom: string
  readonly période: PériodeAPublier
  readonly montrerOrganisation: boolean
}

function TableDesPériodes({ entêtes, lignes }: { entêtes: readonly string[]; lignes: readonly LigneDePériode[] }) {
  return (
    <div className="overflow-x-auto border border-gris-ligne">
      <table className="w-full border-collapse text-corps">
        <thead>
          <tr className="border-b border-gris-ligne bg-fond-neutre text-left">
            {entêtes.map((entête) => (
              <th key={entête} scope="col" className="label-mono px-4 py-3 font-normal text-ardoise">
                {entête}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map(({ slug, nom, période: p, montrerOrganisation }) => (
            <tr key={`${slug}:${p.période}`} className="border-b border-gris-ligne align-top">
              {montrerOrganisation ? (
                <td className="px-4 py-3">
                  <p className="text-encre">{nom}</p>
                  <p className="label-mono text-ardoise">{slug}</p>
                </td>
              ) : null}
              <td className="px-4 py-3">
                <p className="text-encre">
                  {p.granularité === 'trimestre' ? 'Trimestre' : 'Mois'} {p.libellé}
                </p>
                <p className="label-mono text-ardoise">{p.période}</p>
                <Link href={`/espaces/syntheses/${slug}/${p.période}`} className={LIEN}>
                  {p.état === 'publiée' ? 'Lire' : 'Relire et modifier'}
                </Link>
              </td>
              <td className="label-mono px-4 py-3 text-ardoise">{p.lignes}</td>
              <td className={`label-mono px-4 py-3 ${p.état === 'publiée' ? 'text-encre' : 'text-ardoise'}`}>
                {LIBELLÉS_D_ÉTAT[p.état]}
              </td>
              <td className="px-4 py-3">
                <form action={publierUnePériode} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="periode" value={p.période} />
                  {p.état === 'publiée' ? (
                    <>
                      <input type="hidden" name="etat" value="retire" />
                      <BoutonEnvoi className="text-label text-ardoise underline decoration-gris-ligne underline-offset-2">
                        Retirer
                      </BoutonEnvoi>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="etat" value="publie" />
                      <BoutonEnvoi className={BOUTON}>Publier</BoutonEnvoi>
                    </>
                  )}
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
