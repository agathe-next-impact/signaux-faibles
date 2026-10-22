/**
 * Banc d'essai local de l'onboarding complet, du nom et du site d'une
 * organisation à sa première lettre acceptée (programme du 22 octobre 2026,
 * palier 4), sans Trigger.dev, sans Payload, sans Notion ni Postgres de
 * production.
 *
 *   pnpm onboarding:local --nom "La petite vitrine" --site https://www.lapetitevitrine.com [--slug la-petite-vitrine] [--date-edition AAAA-MM-JJ]
 *
 * Ce qui tourne pour de vrai : la lecture du site, la recherche d'écosystème,
 * la dérivation du référentiel, la collecte des sources, les requêtes types,
 * la rédaction, les portes du moteur, et la réception par le portail
 * (`recevoirUneÉdition`, lint en forme unique, numéro attribué, journal des
 * runs) sur une base Postgres en mémoire avec les migrations du dépôt.
 * Ce qui ne tourne pas : l'envoi du courriel, le lien d'accès, la publication
 * dans Payload, le webhook, le cron. La clé vient de `EVALUATION_API_KEY`.
 */
import Anthropic from '@anthropic-ai/sdk'
import { PGlite } from '@electric-sql/pglite'
import { randomBytes, randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import * as schema from '@/lib/base/schema'
import { runs, travaux, veilles } from '@/lib/base/schema'
import { poserUnTravailDeLettre } from '@/lib/base/travaux'
import { déclarerLaVeille } from '@/lib/base/veilles'
import { composerLettre } from '@/lib/email/lettre'
import { navigateurPlaywright } from '@/lib/moteur/collecte'
import { dériverLeRéférentiel } from '@/lib/moteur/onboarding'
import { produireLaLettre } from '@/lib/moteur/produire'
import { essentielDuMarkdown, sélectionDe, type ÉditionPrécédente } from '@/lib/moteur/selection'
import { lireRéférentielUnique } from '@/lib/moteur/referentiel'
import type { Gel } from '@/lib/moteur/collecte'
import { eq } from 'drizzle-orm'
import { PORTAIL_URL, SORTIES, cléDÉvaluation, horodatageDeSortie, lireArguments, réglerLeMandataire } from './evaluation-lettres'

type Mesure = { étape: string; coût: number; durée_s: number; détail: string }

function client(): Anthropic {
  return new Anthropic({ apiKey: cléDÉvaluation(), baseURL: process.env['EVALUATION_BASE_URL'] ?? 'https://api.anthropic.com', maxRetries: 3 })
}

function aujourdHuiParis(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

async function main(): Promise<void> {
  await réglerLeMandataire()
  const { valeurs } = lireArguments(process.argv.slice(2))
  const nom = valeurs.get('nom') ?? 'La petite vitrine'
  const site = valeurs.get('site') ?? 'https://www.lapetitevitrine.com'
  const slug = valeurs.get('slug') ?? 'la-petite-vitrine'
  const dateÉdition = valeurs.get('date-edition') ?? aujourdHuiParis()
  const répertoire = join(SORTIES, `${horodatageDeSortie()}-onboarding-${slug}`)
  mkdirSync(répertoire, { recursive: true })
  const mesures: Mesure[] = []
  const trace = (ligne: string) => process.stderr.write(`${ligne}\n`)
  const anthropic = client()

  // 0. Une base Postgres en mémoire, avec les migrations commitées.
  const pg = new PGlite()
  const db = drizzle({ client: pg, schema }) as unknown as Base
  await migrate(db as never, { migrationsFolder: 'drizzle' })
  const registre = randomBytes(16).toString('hex') // la clé de cloisonnement : l'identifiant Payload de l'organisation, sans tirets
  const session = `local-${randomUUID()}`

  // 1. Ouverture en code : organisation en essai, veille unique.
  let t = Date.now()
  const ouverture = await ouvrirEnEssai({ slug, nom, registreNotion: registre }, db)
  const déclaration = await déclarerLaVeille({ slug, type: 'unique', libellé: 'Veille', jourParution: 2, heureParution: '06:30', cadence: 'hebdomadaire', numéroCourant: 0 }, db)
  mesures.push({ étape: 'Ouverture (organisation + veille unique)', coût: 0, durée_s: (Date.now() - t) / 1000, détail: `${ouverture.sorte}, ${déclaration.sorte}` })
  trace(`ouverture : ${ouverture.sorte}, veille ${déclaration.sorte}`)

  // 2. Le référentiel : de zéro (le site, l'écosystème, la rédaction structurée), ou repris d'un fichier.
  let référentiel
  const réutilisé = valeurs.get('referentiel')
  if (réutilisé) {
    const markdown = readFileSync(réutilisé, 'utf8')
    référentiel = lireRéférentielUnique(markdown)
    writeFileSync(join(répertoire, 'referentiel-unique.md'), markdown)
    trace(`référentiel repris de ${réutilisé} : ${référentiel.axes.length} axes, ${référentiel.dossiers.length} dossiers`)
  } else {
    const dérivé = await dériverLeRéférentiel(
      anthropic,
      { organisation: nom, site, filière: null, référentielDeFilière: null, fiche: null },
      { ouvrirNavigateur: () => navigateurPlaywright(process.env['CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium'), journal: (l) => trace(`  ${l}`) },
    )
    for (const é of dérivé.étapes) {
      mesures.push({
        étape: `Référentiel : ${é.nom}`,
        coût: é.coût,
        durée_s: é.duréeMs / 1000,
        détail: `${é.usage.entrée} jetons en entrée, ${é.usage.sortie} en sortie, ${é.recherches} recherches`,
      })
    }
    référentiel = dérivé.référentiel
    writeFileSync(join(répertoire, 'referentiel-unique.md'), dérivé.markdown)
    writeFileSync(join(répertoire, 'pages-du-site.json'), JSON.stringify(dérivé.pagesDuSite, null, 2))
    trace(`référentiel : ${dérivé.référentiel.axes.length} axes, ${dérivé.référentiel.dossiers.length} dossiers, ${dérivé.coût.toFixed(2)} $`)
  }

  // 3. Les parutions, une par semaine simulée, chacune par la file comme en production.
  const { prendreCeTravail, recevoirUneÉdition } = await import('@/lib/portail/file')
  const semaines = Number(valeurs.get('semaines') ?? '1')
  let précédente: ÉditionPrécédente | null = null
  let gel: ReadonlyMap<string, Gel> = new Map()
  const lettres: string[] = []
  const résumés: string[] = []
  for (let semaine = 1; semaine <= semaines; semaine += 1) {
    const dossierDeLaSemaine = semaines > 1 ? join(répertoire, `semaine-${semaine}`) : répertoire
    mkdirSync(dossierDeLaSemaine, { recursive: true })
    const pose = await poserUnTravailDeLettre({ slug, veille: 'unique', type: semaine === 1 ? 'premiere_lettre' : 'lettre', dateDeParution: dateÉdition }, db)
    if (pose.sorte !== 'créé' && pose.sorte !== 'déjà-en-file') throw new Error(`Travail non posé : ${pose.sorte}`)
    const travailId = pose.travailId
    const pris = await prendreCeTravail({ travailId, session }, db)
    if (!pris) throw new Error('Travail non prenable.')
    const numéro = pris.travail.contexte.numéro
    trace(`semaine ${semaine} : travail ${travailId} pris, numéro attribué ${numéro}`)

    const sélection = { ...sélectionDe(dateÉdition, précédente), numéro: typeof numéro === 'number' ? numéro : 1 }
    const début = new Date()
    const production = await produireLaLettre(
      { référentiel, sélection },
      {
        anthropic,
        gel,
        ouvrirNavigateur: () => navigateurPlaywright(process.env['CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium'),
        effort: 'medium',
        journal: (l) => trace(`  [s${semaine}] ${l}`),
      },
    )
    const m = production.mesures
    mesures.push({
      étape: `Lettre n° ${numéro} (semaine ${semaine}) : collecte, recherche, rédaction, portes`,
      coût: m.coût,
      durée_s: m.duréeMs / 1000,
      détail: `${m.usage.entrée} entrée, ${m.usage.sortie} sortie, ${m.usage.cacheLecture} cache lu, ${m.recherches} recherches, ${m.reprises} reprise(s)`,
    })
    writeFileSync(join(dossierDeLaSemaine, 'lettre.md'), production.lettre.markdown)
    writeFileSync(join(dossierDeLaSemaine, 'proprietes.json'), JSON.stringify(production.lettre.propriétés, null, 2))
    writeFileSync(join(dossierDeLaSemaine, 'validation.json'), JSON.stringify({ acceptée: production.acceptée, manquements: production.contrôle.manquements, rapport: production.contrôle.rapport }, null, 2))
    writeFileSync(join(dossierDeLaSemaine, 'production.json'), JSON.stringify({ mesures: m, collecte: { lectures: production.collecte.lectures, articles: production.collecte.articles, résultats: production.collecte.résultats } }, null, 2))

    const réception = await recevoirUneÉdition(
      {
        travailId,
        session,
        organisationPayload: registre,
        titre: production.lettre.propriétés.titre,
        numéro: production.lettre.propriétés.numéro,
        dateÉdition: production.lettre.propriétés.dateÉdition,
        markdown: production.lettre.markdown,
        dossiersBruts: production.lettre.propriétés.dossiersOuvertsSuivis,
        acceptéeParLeMoteur: production.acceptée,
        exécuteur: 'banc-local',
        début,
        fin: new Date(),
        coût: { dollars: m.coût },
      },
      db,
    )
    const [veille] = await db.select().from(veilles)
    const [travail] = await db.select().from(travaux).where(eq(travaux.id, travailId))
    const journalDesRuns = await db.select().from(runs)
    trace(`portail : ${réception.sorte}, numéro courant de la veille ${veille?.numéroCourant}, travail ${travail?.état}, ${journalDesRuns.length} run(s) journalisé(s)`)

    const courriel = composerLettre({
      objet: `[TEST] ${production.lettre.propriétés.titre}`,
      édition: { pageId: `test-${slug}`, titre: production.lettre.propriétés.titre, veille: 'Veille', numéro: production.lettre.propriétés.numéro, dateÉdition: production.lettre.propriétés.dateÉdition, périodeCouverte: production.lettre.propriétés.périodeCouverte },
      blocs: production.lettre.blocs,
      slug,
      organisation: nom,
      portailUrl: PORTAIL_URL,
      adressePostale: null,
    })
    writeFileSync(join(dossierDeLaSemaine, 'courriel.html'), courriel.html)

    const changées = production.collecte.lectures.filter((l) => l.changée === true).length
    résumés.push(
      `Semaine ${semaine} (n° ${numéro}) : réception **${réception.sorte}**, ${production.contrôle.rapport.aperçu.axes.length} axes, ${m.faits} faits, ${production.collecte.lectures.length} sources dont ${changées} changées depuis le gel, ${production.collecte.articles.length} articles lus, ${m.reprises} reprise(s), manquements restants : ${production.contrôle.manquements.map((x) => x.code).join(', ') || 'aucun'}.`,
    )
    lettres.push(production.lettre.markdown)
    précédente = { dateÉdition, numéro: typeof numéro === 'number' ? numéro : semaine, essentiel: essentielDuMarkdown(production.lettre.markdown), dossiersBruts: production.lettre.propriétés.dossiersOuvertsSuivis }
    gel = production.collecte.gelSuivant
  }

  // 4. Ce que la semaine suivante répète de la précédente.
  const recouvrement: string[] = []
  if (lettres.length >= 2) {
    const faitsDe = (md: string) => md.split(/\r?\n/).filter((l) => /\]\(https?:\/\//.test(l) && !/^\s*[-*]\s*\[/.test(l) && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('- ['))
    const urlsDe = (ligne: string) => [...ligne.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]!.replace(/\/$/, '').toLowerCase())
    for (let i = 1; i < lettres.length; i += 1) {
      const avant = faitsDe(lettres[i - 1]!)
      const après = faitsDe(lettres[i]!)
      const urlsAvant = new Set(avant.flatMap(urlsDe))
      const mêmeUrl = après.filter((l) => urlsDe(l).some((u) => urlsAvant.has(u))).length
      const mêmeTexte = après.filter((l) => avant.includes(l)).length
      recouvrement.push(`Semaine ${i + 1} contre semaine ${i} : ${après.length} lignes de fait, dont ${mêmeTexte} identiques mot pour mot et ${mêmeUrl} qui citent une URL déjà citée la semaine précédente.`)
    }
  }

  const total = mesures.reduce((s, x) => s + x.coût, 0)
  const rapport = [
    `# Onboarding local : ${nom}`,
    '',
    `Site : ${site}. Date d'édition simulée : ${dateÉdition}. ${semaines} parution(s).`,
    '',
    '| Étape | Coût ($) | Durée (s) | Détail |',
    '|---|---|---|---|',
    ...mesures.map((x) => `| ${x.étape} | ${x.coût.toFixed(2)} | ${x.durée_s.toFixed(0)} | ${x.détail} |`),
    `| **Total** | **${total.toFixed(2)}** | ${mesures.reduce((s, x) => s + x.durée_s, 0).toFixed(0)} | |`,
    '',
    ...résumés.map((r) => `- ${r}`),
    ...recouvrement.map((r) => `- ${r}`),
    '',
  ].join('\n')
  writeFileSync(join(répertoire, 'rapport.md'), rapport)
  trace(`rapport : ${join(répertoire, 'rapport.md')}`)
  await pg.close()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erreur: unknown) => {
    process.stderr.write(`${erreur instanceof Error ? (erreur.stack ?? erreur.message) : String(erreur)}\n`)
    process.exit(1)
  })
}
