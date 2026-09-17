import type { Édition } from '@/lib/notion/editions'
import type { LigneDAccèsContrôlée } from '@/lib/notion/acces'
import type { Rapport } from '@/lib/portail/lint'

/**
 * Le contrôle du soir, en code.
 *
 * L'étape 3bis de « Tâche — Réconciliation des envois » demandait chaque soir
 * au modèle de relire la base « Accès », de comparer des identifiants et de
 * vérifier le contrat de forme de la dernière lettre. Trois pannes silencieuses
 * en deux jours l'avaient rendue nécessaire (10, 11 et 12 septembre 2026), et
 * elle avait le défaut de toute vérification confiée à la prose : elle pouvait
 * elle-même se tromper en silence. Ce module la remplace ; la route
 * `/api/veille/etat` l'expose, et le cron Vercel l'appelle.
 *
 * La partie qui décide est pure — `contrôlerUnEspace` ne lit rien — pour être
 * testée sans réseau, comme le reste du domaine.
 */
export type CodeDeDéfaut =
  | 'identifiant-organisation-vide'
  | 'identifiant-organisation-divergent'
  | 'identifiant-acces-vide'
  | 'identifiant-acces-doublon'
  | 'email-manquant'
  | 'aucun-acces-actif'
  | 'aucune-lettre-publiée'
  | 'contrat-rompu'

export type Défaut = {
  readonly slug: string
  readonly code: CodeDeDéfaut
  readonly message: string
}

export type EspaceContrôlé = {
  readonly slug: string
  readonly organisationId: string | null
  readonly lecteursActifs: number
  readonly lettresPubliées: number
  readonly dernièreLettre: { readonly pageId: string; readonly titre: string; readonly date: string } | null
  readonly défauts: readonly Défaut[]
}

/** Regroupe les lignes « Accès » par slug ; les lignes sans slug sont ignorées et comptées. */
export function regrouperParSlug(lignes: readonly LigneDAccèsContrôlée[]): {
  readonly parSlug: ReadonlyMap<string, readonly LigneDAccèsContrôlée[]>
  readonly sansSlug: number
} {
  const parSlug = new Map<string, LigneDAccèsContrôlée[]>()
  let sansSlug = 0
  for (const ligne of lignes) {
    if (ligne.slug.length === 0) {
      sansSlug += 1
      continue
    }
    parSlug.set(ligne.slug, [...(parSlug.get(ligne.slug) ?? []), ligne])
  }
  return { parSlug, sansSlug }
}

/**
 * Les défauts d'un espace, à partir de ses lignes d'accès, de ses lettres
 * publiées et du rapport de validation de la dernière.
 *
 * L'ordre des messages suit la gravité pour le lecteur : un client qui se
 * connecte sur un espace vide passe avant une adresse manquante.
 */
export function contrôlerUnEspace(entrée: {
  readonly slug: string
  readonly lignes: readonly LigneDAccèsContrôlée[]
  readonly lettres: readonly Édition[]
  /** `null` quand aucune lettre publiée, ou quand le corps n'a pas pu être lu. */
  readonly rapport: Rapport | null
}): EspaceContrôlé {
  const { slug, lignes, lettres, rapport } = entrée
  const défauts: Défaut[] = []
  const actives = lignes.filter((l) => l.actif)

  // ── L'identifiant d'organisation : la seule clé de cloisonnement ─────────
  const identifiants = new Set(lignes.map((l) => l.organisationId).filter((id) => id.length > 0))
  const organisationId = identifiants.size === 1 ? [...identifiants][0] ?? null : null

  if (lignes.some((l) => l.organisationId.length === 0)) {
    défauts.push({
      slug,
      code: 'identifiant-organisation-vide',
      message: 'une ligne d’accès n’a pas d’« Identifiant Notion de l’organisation » : le lien est refusé.',
    })
  }
  if (identifiants.size > 1) {
    défauts.push({
      slug,
      code: 'identifiant-organisation-divergent',
      message:
        `les lignes d’accès portent ${identifiants.size} identifiants d’organisation différents : ` +
        'au plus une est juste, les autres ouvrent un espace vide et silencieux.',
    })
  }

  // ── L'identifiant d'accès : le secret signé ───────────────────────────────
  if (lignes.some((l) => l.identifiantVide)) {
    défauts.push({ slug, code: 'identifiant-acces-vide', message: 'une ligne d’accès n’a pas d’identifiant d’accès : aucun lien ne peut être composé.' })
  }
  if (lignes.some((l) => l.identifiantEnDoublon)) {
    défauts.push({
      slug,
      code: 'identifiant-acces-doublon',
      message:
        'un identifiant d’accès est partagé avec une autre ligne (ligne dupliquée) : les deux liens sont refusés. Tirer un identifiant neuf.',
    })
  }

  // ── Les lecteurs ──────────────────────────────────────────────────────────
  if (actives.length === 0 && lettres.length > 0) {
    défauts.push({ slug, code: 'aucun-acces-actif', message: 'des lettres sont publiées mais aucune ligne d’accès n’est active : personne ne peut entrer.' })
  }
  if (actives.some((l) => !l.emailRenseigné)) {
    défauts.push({ slug, code: 'email-manquant', message: 'une ligne d’accès active n’a pas d’adresse : le portail ne peut pas lui envoyer de lien.' })
  }

  // ── Ce que le client voit ─────────────────────────────────────────────────
  if (actives.length > 0 && lettres.length === 0) {
    défauts.push({
      slug,
      code: 'aucune-lettre-publiée',
      message:
        'accès actif, aucune lettre publiée. Deux causes, dans cet ordre : les lettres sont encore au statut Brouillon ' +
        '(le portail ne voit que les « Envoyé »), ou l’identifiant d’organisation n’est pas celui de la ligne de registre. ' +
        'Vérifier le statut avant l’identifiant.',
    })
  }

  const dernière = lettres[0] ?? null
  if (rapport) {
    const ruptures = rapport.ruptures.filter((r) => r.portée === 'portail')
    if (ruptures.length > 0) {
      défauts.push({
        slug,
        code: 'contrat-rompu',
        message:
          `la dernière lettre publiée (« ${dernière?.titre ?? '?'} ») rompt le contrat de forme : ` +
          ruptures.map((r) => r.message).join(' '),
      })
    }
  }

  return {
    slug,
    organisationId,
    lecteursActifs: actives.length,
    lettresPubliées: lettres.length,
    dernièreLettre: dernière ? { pageId: dernière.pageId, titre: dernière.titre, date: dernière.dateÉdition } : null,
    défauts,
  }
}

export type ÉtatDuDispositif = {
  readonly date: string
  readonly espaces: readonly EspaceContrôlé[]
  readonly défauts: readonly Défaut[]
  readonly lignesSansSlug: number
}

/** Le courriel du soir : une ligne par défaut, rien de plus. Texte brut, lisible sur un téléphone. */
export function composerCourrierDÉtat(état: ÉtatDuDispositif): { objet: string; texte: string } {
  const parSlug = new Map<string, Défaut[]>()
  for (const défaut of état.défauts) parSlug.set(défaut.slug, [...(parSlug.get(défaut.slug) ?? []), défaut])

  const lignes: string[] = [
    `Contrôle des espaces clients du ${état.date} — ${état.défauts.length} défaut(s) sur ${parSlug.size} espace(s).`,
    '',
  ]
  for (const [slug, défauts] of parSlug) {
    lignes.push(`${slug}`)
    for (const défaut of défauts) lignes.push(`  · ${défaut.message}`)
    lignes.push('')
  }
  if (état.lignesSansSlug > 0) {
    lignes.push(`${état.lignesSansSlug} ligne(s) d’accès sans slug, ignorée(s).`, '')
  }
  lignes.push('Ce message est envoyé par le portail, seulement quand quelque chose est cassé. Le détail : GET /api/veille/etat.')

  return {
    objet: `[Veille] Espaces clients — ${état.défauts.length} défaut(s) à corriger`,
    texte: lignes.join('\n'),
  }
}
