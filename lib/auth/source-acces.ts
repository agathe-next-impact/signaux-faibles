import { z } from 'zod'
import {
  espacesAvecLecteurs,
  lireLecteurActifParEmail,
  lireLecteurParIdentifiant,
  organisationParSlug,
} from '@/lib/base/lecteurs'
import {
  espacesOuverts as espacesOuvertsNotion,
  lireAccèsActifParEmail as lireAccèsActifParEmailNotion,
  lireAccèsParIdentifiant as lireAccèsParIdentifiantNotion,
  organisationDuSlug as organisationDuSlugNotion,
  type Accès,
  type Espace,
} from '@/lib/notion/acces'
import { empreinte } from '@/lib/portail/debit'

/**
 * D'où vient l'appartenance : le seul endroit qui en décide.
 *
 * Palier 1 de la décision du 16 octobre 2026 : la base Notion « Accès » migre
 * vers la table Postgres `lecteurs`. La bascule se fait en trois temps, par la
 * variable `SOURCE_ACCES`, sans redéploiement de code entre deux temps :
 *
 * - `notion` (défaut, et valeur tant que la base n'est pas créée) : exactement
 *   le comportement d'avant le palier 1. Postgres n'est jamais ouvert ;
 * - `double` : les deux sources sont lues, **Notion est servie**, et tout écart
 *   est journalisé (`[accès:double]`). Une panne Postgres ne change rien pour
 *   le lecteur : elle est journalisée et Notion répond. C'est la semaine de
 *   vérification ;
 * - `postgres` : Postgres est servie, Notion n'est plus lue. La base Accès est
 *   alors gelée.
 *
 * Tous les appelants de l'appartenance importent d'ici, jamais de
 * `lib/notion/acces.ts` ni de `lib/base/lecteurs.ts` directement ; la garde
 * d'architecture le vérifie. Les exports portent les noms d'avant pour que le
 * contrôle d'appartenance (`lib/auth/appartenance.ts`) n'ait rien à apprendre.
 *
 * Les journaux d'écart ne portent ni adresse ni identifiant d'accès : des
 * empreintes de huit caractères, comme le reste du portail.
 */

export type SourceAccès = 'notion' | 'double' | 'postgres'

const schéma = z.enum(['notion', 'double', 'postgres'])

/**
 * Lue à chaque appel et non au démarrage : un changement de variable sur
 * Vercel prend effet au déploiement suivant, et les tests la font varier.
 * Une valeur inconnue retombe sur `notion` en le disant, plutôt que de faire
 * tomber toutes les pages pour une faute de frappe dans l'hébergeur.
 */
export function sourceAccès(): SourceAccès {
  const brute = process.env.SOURCE_ACCES?.trim()
  if (!brute) return 'notion'
  const lue = schéma.safeParse(brute)
  if (lue.success) return lue.data
  console.warn(`[accès] SOURCE_ACCES="${brute}" n’est pas une valeur connue : lecture dans Notion.`)
  return 'notion'
}

const CHAMPS: ReadonlyArray<keyof Accès> = [
  'nom',
  'email',
  'organisationLibellé',
  'organisationId',
  'slug',
  'actif',
  'tousLesEspaces',
]

/**
 * Les champs qui diffèrent entre deux lectures d'un même accès. Une absence
 * d'un côté seulement est un écart en soi (`présence`). L'email est comparé en
 * minuscules : Postgres le compare ainsi, Notion le rend tel que saisi.
 */
export function écartsEntre(notion: Accès | null, postgres: Accès | null): string[] {
  if (!notion && !postgres) return []
  if (!notion || !postgres) return ['présence']
  return CHAMPS.filter((champ) => {
    const a = notion[champ]
    const b = postgres[champ]
    if (champ === 'email') return (a as string | null)?.toLowerCase() !== (b as string | null)?.toLowerCase()
    return a !== b
  })
}

async function enDouble<T>(
  lecture: string,
  désignation: string,
  notion: () => Promise<T>,
  postgres: () => Promise<T>,
  comparer: (n: T, p: T) => string[],
): Promise<T> {
  const [résultatNotion, résultatPostgres] = await Promise.allSettled([notion(), postgres()])

  // Notion est la source servie : son échec est celui du portail, comme avant.
  if (résultatNotion.status === 'rejected') throw résultatNotion.reason

  if (résultatPostgres.status === 'rejected') {
    console.warn(
      `[accès:double] ${lecture} ${désignation} : Postgres en échec, Notion servie. ` +
        `${résultatPostgres.reason instanceof Error ? résultatPostgres.reason.message : String(résultatPostgres.reason)}`,
    )
    return résultatNotion.value
  }

  const écarts = comparer(résultatNotion.value, résultatPostgres.value)
  if (écarts.length > 0) {
    console.warn(
      `[accès:double] ${lecture} ${désignation} : écart sur ${écarts.join(', ')}. ` +
        'Rejouer l’import (pnpm base:importer-acces) avant toute bascule.',
    )
  }
  return résultatNotion.value
}

export async function lireAccèsParIdentifiant(identifiant: string): Promise<Accès | null> {
  const source = sourceAccès()
  if (source === 'notion') return lireAccèsParIdentifiantNotion(identifiant)
  if (source === 'postgres') return lireLecteurParIdentifiant(identifiant)
  return enDouble(
    'par identifiant',
    empreinte(identifiant),
    () => lireAccèsParIdentifiantNotion(identifiant),
    () => lireLecteurParIdentifiant(identifiant),
    écartsEntre,
  )
}

export async function lireAccèsActifParEmail(
  email: string,
): Promise<(Accès & { readonly identifiant: string }) | null> {
  const source = sourceAccès()
  if (source === 'notion') return lireAccèsActifParEmailNotion(email)
  if (source === 'postgres') return lireLecteurActifParEmail(email)
  return enDouble(
    'par email',
    empreinte(email),
    () => lireAccèsActifParEmailNotion(email),
    () => lireLecteurActifParEmail(email),
    (n, p) => {
      const écarts = écartsEntre(n, p)
      if (n && p && n.identifiant !== p.identifiant) écarts.push('identifiant')
      return écarts
    },
  )
}

/** Réservée à l'accès opérateur, appelée seulement par `exigerAccès`. */
export async function organisationDuSlug(
  slug: string,
): Promise<{ readonly organisationId: string; readonly organisationLibellé: string } | null> {
  const source = sourceAccès()
  if (source === 'notion') return organisationDuSlugNotion(slug)
  if (source === 'postgres') return organisationParSlug(slug)
  return enDouble(
    'par slug',
    slug,
    () => organisationDuSlugNotion(slug),
    () => organisationParSlug(slug),
    (n, p) => {
      if (!n && !p) return []
      if (!n || !p) return ['présence']
      return n.organisationId === p.organisationId ? [] : ['organisationId']
    },
  )
}

/** Réservée au sélecteur de l'opérateur, appelée seulement par `listerLesEspaces`. */
export async function espacesOuverts(): Promise<Espace[]> {
  const source = sourceAccès()
  if (source === 'notion') return espacesOuvertsNotion()
  if (source === 'postgres') return espacesAvecLecteurs()
  return enDouble(
    'des espaces',
    '',
    () => espacesOuvertsNotion(),
    () => espacesAvecLecteurs(),
    (n, p) => {
      const clé = (espaces: Espace[]) =>
        espaces
          .map((espace) => `${espace.slug}:${espace.lecteurs}`)
          .sort()
          .join('|')
      return clé(n) === clé(p) ? [] : ['liste']
    },
  )
}
