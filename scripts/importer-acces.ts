/**
 * Importe la base Notion « Accès — portail » dans la table Postgres `lecteurs`.
 *
 *   pnpm base:importer-acces            # écrit
 *   pnpm base:importer-acces --a-blanc  # n'écrit rien, montre le plan
 *
 * Variables lues : NOTION_TOKEN, NOTION_BASE_ACCES, DATABASE_URL (sauf à blanc).
 * Pour les charger depuis Vercel : `vercel env pull .env.local`, puis
 * `set -a; . ./.env.local; set +a` dans le même terminal avant la commande, et
 * `rm .env.local` après.
 *
 * Rejouable autant de fois que voulu pendant la double lecture : chaque passage
 * aligne Postgres sur Notion. Ce script vit hors du portail ; il lit Notion sans
 * cache, une fois, à la main, et la règle 1 de `CLAUDE.md` ne le concerne pas.
 *
 * Le rapport n'affiche ni adresse ni identifiant d'accès en clair.
 */
import { Client } from '@notionhq/client'
import { base } from '@/lib/base/client'
import { appliquerImport, planifierImport, type LigneAccèsNotion } from '@/lib/base/import-acces'
import { lireCase, lireEmail, lireTexte, lireTitre } from '@/lib/notion/proprietes'

async function lireNotion(): Promise<LigneAccèsNotion[]> {
  const jeton = process.env.NOTION_TOKEN
  const baseAccès = process.env.NOTION_BASE_ACCES
  if (!jeton || !baseAccès) throw new Error('NOTION_TOKEN et NOTION_BASE_ACCES sont requis.')

  const notion = new Client({ auth: jeton })
  const conteneur = (await notion.databases.retrieve({ database_id: baseAccès })) as {
    data_sources?: Array<{ id: string }>
  }
  const sources = conteneur.data_sources ?? []
  if (sources.length !== 1 || !sources[0]) {
    throw new Error(`La base Accès expose ${sources.length} sources de données ; il en faut une.`)
  }

  const pages: unknown[] = []
  let curseur: string | undefined
  do {
    const réponse = await notion.dataSources.query({
      data_source_id: sources[0].id,
      page_size: 100,
      start_cursor: curseur,
    })
    pages.push(...réponse.results)
    curseur = réponse.next_cursor ?? undefined
  } while (curseur)

  return pages.map((page) => ({
    nom: lireTitre(page, 'Nom'),
    email: lireEmail(page, 'Email'),
    organisationLibellé: lireTexte(page, 'Organisation (libellé)'),
    organisationId: lireTexte(page, "Identifiant Notion de l'organisation"),
    slug: lireTexte(page, 'Slug'),
    identifiant: lireTexte(page, "Identifiant d'accès"),
    actif: lireCase(page, 'Actif'),
    tousLesEspaces: lireCase(page, 'Tous les espaces'),
  }))
}

async function principal(): Promise<void> {
  const àBlanc = process.argv.includes('--a-blanc')
  const lignes = await lireNotion()

  // Une base Notion vide désactiverait tous les lecteurs Postgres : c'est plus
  // probablement une intégration qui a perdu son accès qu'une base vidée.
  if (lignes.length === 0) {
    throw new Error('La base Notion « Accès » ne rend aucune ligne : import refusé, rien n’est écrit.')
  }

  const plan = planifierImport(lignes)
  console.info(
    `${lignes.length} ligne(s) lue(s) dans Notion · ${plan.organisations.length} organisation(s) · ` +
      `${plan.lecteurs.length} lecteur(s) à écrire · ${plan.écartés.length} écartée(s).`,
  )
  for (const écart of plan.écartés) console.info(`  écartée — ${écart.raison} : ${écart.ligne}`)
  for (const organisation of plan.organisations) {
    const nombre = plan.lecteurs.filter((lecteur) => lecteur.slug === organisation.slug).length
    console.info(`  ${organisation.slug} (${organisation.nom}) · ${nombre} lecteur(s)`)
  }

  if (àBlanc) {
    console.info('À blanc : rien n’a été écrit.')
    return
  }

  const rapport = await appliquerImport(base(), plan)
  console.info(
    `Écrit : ${rapport.organisations} organisation(s), ${rapport.lecteurs} lecteur(s) ; ` +
      `${rapport.lecteursDésactivés} lecteur(s) désactivé(s) parce qu’absents de Notion.`,
  )
}

principal()
  .then(() => process.exit(0))
  .catch((erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : erreur)
    process.exit(1)
  })
