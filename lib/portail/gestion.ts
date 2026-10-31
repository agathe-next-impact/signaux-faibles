import { courriersRécents } from '@/lib/base/courriers'
import { lecteursÀGérer, organisationÀGérer, type LecteurÀGérer, type OrganisationÀGérer } from '@/lib/base/gestion'
import type { Défaut } from '@/lib/portail/etat'
import { contrôlerLeDispositif } from '@/lib/portail/controle-du-soir'
import { lireLaFicheDuPilote, type LectureDeLaFiche } from '@/lib/portail/fiche-veille'
import { lecteursModifiables } from '@/lib/portail/situation'
import { lireLaGrilleDuPilote, type LectureDeLaGrille } from '@/lib/portail/strategie'

/**
 * Ce que la page de gestion d'une organisation montre à l'opératrice
 * (31 octobre 2026, `/espaces/abonnements/[slug]`). Ces lectures traversent les
 * clients : leur seule entrée est la garde de `lib/auth/appartenance.ts`
 * (`lireLaGestionDUneOrganisation`, `lireLaSantéDesEspaces`), qui vérifie le
 * privilège « Tous les espaces » avant de les appeler ; `tests/architecture.test.ts`
 * le vérifie. Aucune lecture Notion de plus que le contrôle du soir, dont les
 * lectures sont cachées.
 */

/**
 * Le délai au-delà duquel la santé n'est pas montrée. Elle arrive en flux, après
 * le reste de la page (31 octobre 2026) : en production, le contrôle dépasse
 * souvent quatre secondes, et l'attendre figeait chaque page de l'opératrice,
 * boutons compris, pendant tout ce temps.
 */
const DÉLAI_DE_LA_SANTÉ_MS = 8_000

export type SantéDesEspaces = ReadonlyMap<string, readonly Défaut[]>

/**
 * Les défauts du contrôle du soir, rangés par slug d'espace ; ceux de la base
 * sous « (base) ». `null` si le contrôle n'aboutit pas dans le délai : l'écran
 * dit « non lue », il ne prend pas un silence pour une bonne santé.
 */
export async function santéDesEspaces(): Promise<SantéDesEspaces | null> {
  try {
    const lu = await Promise.race([
      contrôlerLeDispositif(),
      new Promise<null>((résoudre) => setTimeout(() => résoudre(null), DÉLAI_DE_LA_SANTÉ_MS)),
    ])
    if (!lu) {
      console.warn(`[gestion] contrôle des espaces au-delà de ${DÉLAI_DE_LA_SANTÉ_MS} ms : santé non montrée.`)
      return null
    }
    const parSlug = new Map<string, Défaut[]>()
    for (const défaut of lu.état.défauts) parSlug.set(défaut.slug, [...(parSlug.get(défaut.slug) ?? []), défaut])
    return parSlug
  } catch (erreur) {
    console.warn(`[gestion] contrôle des espaces impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return null
  }
}

export type CourrierÀGérer = Awaited<ReturnType<typeof courriersRécents>>[number]

export type GestionDUneOrganisation = {
  readonly organisation: OrganisationÀGérer
  readonly lecteurs: readonly LecteurÀGérer[]
  /** Faux tant que Notion fait foi pour les accès (`SOURCE_ACCES` autre que `postgres`). */
  readonly lecteursModifiables: boolean
  readonly grille: LectureDeLaGrille
  readonly fiche: LectureDeLaFiche
  readonly courriers: readonly CourrierÀGérer[]
}

export const JOURS_DU_JOURNAL = 30

/** `null` si l'organisation est inconnue. */
export async function gestionDUneOrganisation(slug: string, maintenant: Date = new Date()): Promise<GestionDUneOrganisation | null> {
  const organisation = await organisationÀGérer(slug)
  if (!organisation) return null
  const depuis = new Date(maintenant.getTime() - JOURS_DU_JOURNAL * 24 * 60 * 60 * 1000)
  const [lecteurs, grille, fiche, courriers] = await Promise.all([
    lecteursÀGérer(organisation.id),
    lireLaGrilleDuPilote({ slug }),
    lireLaFicheDuPilote({ slug }),
    courriersRécents(depuis),
  ])
  return {
    organisation,
    lecteurs,
    lecteursModifiables: lecteursModifiables(),
    grille,
    fiche,
    courriers: courriers.filter((c) => c.slug === slug),
  }
}
