import { base, baseConfigurée } from '@/lib/base/client'
import {
  appliquerImport,
  DésactivationsAuDelàDeLAperçu,
  planifierImport,
  type Écart,
} from '@/lib/base/import-acces'
import { sourceAccès, type SourceAccès } from '@/lib/auth/source-acces'
import { lignesDAccèsPourImport } from '@/lib/notion/acces'

/**
 * L'alignement de Postgres sur la base Notion « Accès », seule orchestration
 * (13 novembre 2026).
 *
 * Deux portes y mènent, et elles font la même chose : la route
 * `POST /api/veille/importer-acces` (jeton d'activation, appelée par
 * l'onboarding Cowork) et le bouton « Synchroniser les accès depuis Notion »
 * du tableau des abonnements (`lib/portail/import-acces-actions.ts`, privilège
 * opérateur vérifié avant). `pnpm base:importer-acces` reste le geste en ligne
 * de commande, hors du portail.
 *
 * Trois refus avant toute écriture :
 *
 * - **`SOURCE_ACCES=postgres`** : la base Accès est gelée et Postgres fait foi.
 *   Un import désactiverait alors tout lecteur créé depuis le portail
 *   (`POST /api/veille/lecteurs`, « Mon abonnement », la fiche), absent de
 *   Notion par construction ;
 * - **base Notion vide** : plus probablement une intégration qui a perdu son
 *   accès qu'une base vidée, et l'import désactiverait tout le monde ;
 * - **base Postgres absente** (`DATABASE_URL`).
 *
 * L'import n'envoie rien : ni lien d'accès, ni courrier, ni brouillon. Il
 * n'écrit que `organisations` et `lecteurs`. Le résultat ne porte que des
 * comptes, des slugs, des libellés et des empreintes : ni adresse ni
 * identifiant d'accès, qui ne quittent jamais le serveur.
 *
 * La lecture Notion est celle de `lignesDAccèsPourImport`, cachée au profil
 * `acces` (une minute au plus) : une ligne modifiée dans Notion il y a moins
 * d'une minute peut ne pas être vue, et le webhook de la base l'expire plus tôt.
 */

export type RésuméDuPlan = {
  readonly lignesLues: number
  readonly organisations: ReadonlyArray<{
    readonly slug: string
    readonly nom: string
    readonly lecteurs: number
    readonly lecteursActifs: number
  }>
  readonly opérateurs: number
  readonly opérateursActifs: number
  readonly écartés: ReadonlyArray<Écart>
  readonly préservés: number
}

export type ComptesDImport = {
  readonly organisationsÉcrites: number
  readonly organisationsCréées: number
  readonly lecteursCréés: number
  readonly lecteursMisÀJour: number
  readonly lecteursDésactivés: number
  /** Écartés du plan, plus les organisations écartées en base (registre porté par un autre slug). */
  readonly écartés: ReadonlyArray<Écart>
}

export type IssueDeLImport =
  | { readonly état: 'à blanc'; readonly résumé: RésuméDuPlan; readonly comptes: ComptesDImport }
  | { readonly état: 'écrit'; readonly résumé: RésuméDuPlan; readonly comptes: ComptesDImport }
  | { readonly état: 'refusé'; readonly raison: 'base-notion-vide' }
  | { readonly état: 'refusé'; readonly raison: 'postgres-fait-foi'; readonly source: SourceAccès }
  | { readonly état: 'refusé'; readonly raison: 'sans-base' }
  | {
      readonly état: 'refusé'
      readonly raison: 'plan-changé'
      readonly attendues: number
      readonly constatées: number
    }
  | { readonly état: 'échec'; readonly message: string }

export async function importerLesAccès(options: {
  readonly àBlanc: boolean
  /** Le nombre de désactivations vu à l'aperçu ; au-delà, rien n'est écrit. */
  readonly désactivationsAuPlus?: number
}): Promise<IssueDeLImport> {
  const source = sourceAccès()
  if (source === 'postgres') return { état: 'refusé', raison: 'postgres-fait-foi', source }
  if (!baseConfigurée()) return { état: 'refusé', raison: 'sans-base' }

  try {
    const lignes = await lignesDAccèsPourImport()
    if (lignes.length === 0) return { état: 'refusé', raison: 'base-notion-vide' }

    const plan = planifierImport(lignes)
    const résumé: RésuméDuPlan = {
      lignesLues: lignes.length,
      organisations: plan.organisations.map((organisation) => ({
        slug: organisation.slug,
        nom: organisation.nom,
        lecteurs: plan.lecteurs.filter((lecteur) => lecteur.slug === organisation.slug).length,
        lecteursActifs: plan.lecteurs.filter((l) => l.slug === organisation.slug && l.actif).length,
      })),
      opérateurs: plan.opérateurs.length,
      opérateursActifs: plan.opérateurs.filter((opérateur) => opérateur.actif).length,
      écartés: plan.écartés,
      préservés: plan.préservés.length,
    }

    const rapport = await appliquerImport(base(), plan, {
      àBlanc: options.àBlanc,
      désactivationsAuPlus: options.désactivationsAuPlus,
    })
    const comptes: ComptesDImport = {
      organisationsÉcrites: rapport.organisations,
      organisationsCréées: rapport.organisationsCréées,
      lecteursCréés: rapport.lecteursCréés,
      lecteursMisÀJour: rapport.lecteursMisÀJour,
      lecteursDésactivés: rapport.lecteursDésactivés,
      écartés: rapport.écartés,
    }
    return { état: options.àBlanc ? 'à blanc' : 'écrit', résumé, comptes }
  } catch (erreur) {
    if (erreur instanceof DésactivationsAuDelàDeLAperçu) {
      return { état: 'refusé', raison: 'plan-changé', attendues: erreur.attendues, constatées: erreur.constatées }
    }
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    console.error(`[import-accès] ${message}`)
    return { état: 'échec', message }
  }
}
