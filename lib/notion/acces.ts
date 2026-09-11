import { notion, sourcesDeDonnées } from '@/lib/notion/client'
import { lireCase, lireEmail, lireTexte, lireTitre } from '@/lib/notion/proprietes'

/**
 * Une ligne de la base « Accès — portail ».
 *
 * C'est la seule source de l'appartenance. La base est tenue par une tâche
 * Cowork ; le portail la lit et n'y écrit jamais.
 */
export type Accès = {
  readonly nom: string
  readonly email: string | null
  readonly organisationLibellé: string
  /** `page_id` de la ligne du registre : la seule clé de cloisonnement. */
  readonly organisationId: string
  readonly slug: string
  readonly actif: boolean
  /**
   * Accès opérateur : la personne peut ouvrir l'espace de n'importe quel
   * client. Voir `exigerAccès` pour ce que ce privilège autorise exactement.
   */
  readonly tousLesEspaces: boolean
}

/**
 * L'organisation que désigne un slug, lue dans la base « Accès ».
 *
 * **Ceci n'est pas une résolution de nom.** Le portail n'a toujours pas accès
 * au registre et ne sait pas ce qu'est « L'Hermitage » : il compare un slug
 * exact aux slugs d'une base qu'il lit déjà, et n'en tire qu'un identifiant que
 * cette même base porte. Aucune source nouvelle n'est ouverte.
 *
 * Réservé à l'accès opérateur. Un client ordinaire n'emprunte jamais ce chemin :
 * son identifiant d'organisation vient de sa propre ligne, et de nulle part
 * ailleurs.
 */
export async function organisationDuSlug(slug: string): Promise<{
  readonly organisationId: string
  readonly organisationLibellé: string
} | null> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('acces')

  const { accès: sourceId } = await sourcesDeDonnées()
  cacheTag(`liste:${sourceId}`)

  const réponse = await notion().dataSources.query({
    data_source_id: sourceId,
    filter: {
      and: [
        { property: 'Slug', rich_text: { equals: slug } },
        { property: 'Actif', checkbox: { equals: true } },
      ],
    },
    page_size: 1,
  })

  const page = réponse.results[0]
  if (!page) return null

  const organisationId = lireTexte(page, "Identifiant Notion de l'organisation")
    .replaceAll('-', '')
    .toLowerCase()

  if (organisationId.length === 0) return null

  return {
    organisationId,
    organisationLibellé: lireTexte(page, 'Organisation (libellé)'),
  }
}

/**
 * Retrouve un accès par son identifiant.
 *
 * La fonction est cachée et porte le tag de la base : une révocation dans
 * Notion déclenche le webhook, qui invalide le tag, et la case décochée devient
 * effective à la requête suivante.
 *
 * L'argument est un identifiant d'accès, pas un contenu : c'est une lecture
 * d'authentification, et elle est volontairement clefée par personne. Aucune
 * fonction de *contenu* ne reçoit cet argument — elles ne voient que
 * `organisationId`.
 */
export async function lireAccèsParIdentifiant(
  identifiant: string,
): Promise<Accès | null> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('acces')

  const { accès: sourceId } = await sourcesDeDonnées()
  cacheTag(`liste:${sourceId}`)

  const réponse = await notion().dataSources.query({
    data_source_id: sourceId,
    filter: {
      property: "Identifiant d'accès",
      rich_text: { equals: identifiant },
    },
    page_size: 2,
  })

  // Deux lignes pour un même identifiant : la base est incohérente, et un
  // choix arbitraire rattacherait peut-être la personne au mauvais client. On
  // refuse — mais sans le dire, ce refus était indiscernable d'un lien inconnu.
  //
  // Le cas a une cause banale : dupliquer une ligne dans Notion pour ajouter un
  // second lecteur recopie « Identifiant d'accès » avec le reste. Les deux
  // liens cessent alors de fonctionner d'un coup, sans erreur visible.
  if (réponse.results.length > 1) {
    console.warn(
      '[accès] plusieurs lignes portent le même identifiant d’accès : les liens ' +
        'concernés sont refusés. Cause habituelle : une ligne dupliquée dans ' +
        '« Accès — portail » dont l’identifiant n’a pas été régénéré. Tirer un ' +
        'nouvel identifiant (openssl rand -hex 16) pour chaque personne.',
    )
    return null
  }

  if (réponse.results.length === 0) return null

  const page = réponse.results[0]
  const organisationId = lireTexte(page, "Identifiant Notion de l'organisation")
    .replaceAll('-', '')
    .toLowerCase()

  // Sans identifiant d'organisation il n'y a pas de filtre possible : refuser
  // vaut mieux que servir une requête non cloisonnée. Le dire, sinon ce refus
  // est indiscernable d'un identifiant inconnu.
  if (organisationId.length === 0) {
    console.warn(
      "[accès] ligne trouvée mais « Identifiant Notion de l'organisation » vide : accès refusé.",
    )
    return null
  }

  return {
    nom: lireTitre(page, 'Nom'),
    email: lireEmail(page, 'Email'),
    organisationLibellé: lireTexte(page, 'Organisation (libellé)'),
    organisationId,
    slug: lireTexte(page, 'Slug'),
    actif: lireCase(page, 'Actif'),
    tousLesEspaces: lireCase(page, 'Tous les espaces'),
  }
}

/**
 * Retrouve un accès actif par email, pour la page « recevoir mon lien ».
 *
 * Renvoie `null` sans distinguer « inconnu » de « révoqué » : la page dit la
 * même chose dans les deux cas, pour ne pas transformer le formulaire en
 * oracle sur les adresses inscrites.
 */
export async function lireAccèsActifParEmail(email: string): Promise<
  (Accès & { readonly identifiant: string }) | null
> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('acces')

  const { accès: sourceId } = await sourcesDeDonnées()
  cacheTag(`liste:${sourceId}`)

  const réponse = await notion().dataSources.query({
    data_source_id: sourceId,
    filter: {
      and: [
        { property: 'Email', email: { equals: email } },
        { property: 'Actif', checkbox: { equals: true } },
      ],
    },
    page_size: 2,
  })

  if (réponse.results.length !== 1) {
    console.warn(
      `[accès] ${réponse.results.length} ligne(s) active(s) pour ${email}, il en faut ` +
        'exactement une. Vérifier la base « Accès — portail » : adresse absente, ' +
        'case Actif décochée, ou doublon.',
    )
    return null
  }

  const page = réponse.results[0]
  const identifiant = lireTexte(page, "Identifiant d'accès")
  const organisationId = lireTexte(page, "Identifiant Notion de l'organisation")
    .replaceAll('-', '')
    .toLowerCase()

  if (identifiant.length === 0 || organisationId.length === 0) {
    console.warn(
      `[accès] ligne trouvée pour ${email} mais incomplète : ` +
        `${identifiant.length === 0 ? "« Identifiant d'accès » vide" : ''}` +
        `${organisationId.length === 0 ? " « Identifiant Notion de l'organisation » vide" : ''}`.trim(),
    )
    return null
  }

  return {
    identifiant,
    nom: lireTitre(page, 'Nom'),
    email: lireEmail(page, 'Email'),
    organisationLibellé: lireTexte(page, 'Organisation (libellé)'),
    organisationId,
    slug: lireTexte(page, 'Slug'),
    actif: true,
    tousLesEspaces: lireCase(page, 'Tous les espaces'),
  }
}

/** Un espace client, tel qu'un opérateur le choisit. */
export type Espace = {
  readonly slug: string
  readonly organisationLibellé: string
  /** Nombre de personnes actives sur cet espace. */
  readonly lecteurs: number
}

/**
 * Tous les espaces ouverts, pour le sélecteur de l'opérateur.
 *
 * **C'est la seule lecture du portail qui traverse les clients**, et elle
 * n'expose que ce que la base « Accès » porte déjà : un slug et un libellé.
 * Aucune édition, aucun contenu de veille. Elle est réservée à l'accès
 * opérateur, et `listerLesEspaces` de `lib/auth/appartenance.ts` est le seul
 * chemin qui y mène — la garde y est faite avant l'appel, jamais après.
 *
 * Nommée `espacesOuverts` et non `tousLesEspaces` : ce dernier nom est celui de
 * la **case** qui porte le privilège, et deux choses de même nom pour deux rôles
 * opposés — un droit d'un côté, une liste de l'autre — finissent par se
 * confondre à la lecture comme dans une garde d'architecture.
 *
 * Une ligne inactive ne compte pas : un espace dont tous les accès ont été
 * révoqués disparaît du sélecteur, comme il a disparu pour ses lecteurs.
 */
export async function espacesOuverts(): Promise<Espace[]> {
  'use cache: remote'

  const { cacheLife, cacheTag } = await import('next/cache')
  cacheLife('acces')

  const { accès: sourceId } = await sourcesDeDonnées()
  cacheTag(`liste:${sourceId}`)

  const réponse = await notion().dataSources.query({
    data_source_id: sourceId,
    filter: { property: 'Actif', checkbox: { equals: true } },
    page_size: 100,
  })

  const parSlug = new Map<string, Espace>()

  for (const page of réponse.results) {
    const slug = lireTexte(page, 'Slug')
    if (slug.length === 0) continue

    const connu = parSlug.get(slug)
    parSlug.set(slug, {
      slug,
      // Un libellé vide sur une ligne ne doit pas effacer celui d'une autre.
      organisationLibellé: connu?.organisationLibellé || lireTexte(page, 'Organisation (libellé)'),
      lecteurs: (connu?.lecteurs ?? 0) + 1,
    })
  }

  return [...parSlug.values()].sort((a, b) =>
    (a.organisationLibellé || a.slug).localeCompare(b.organisationLibellé || b.slug, 'fr'),
  )
}
