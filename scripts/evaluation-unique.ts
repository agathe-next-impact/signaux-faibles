/**
 * Évaluation de la lettre unique par le moteur en code (programme du
 * 22 octobre 2026), sur les exports Notion d'une organisation existante.
 *
 *   pnpm evaluation:unique convertir [--organisation konica]   # les deux référentiels Notion → referentiel-unique.md (un appel)
 *   pnpm evaluation:unique generer   [--organisation konica] [--date-edition AAAA-MM-JJ] [--sans-recherche] [--a-blanc]
 *
 * Même périmètre que `evaluation-lettres.ts` : rien n'est lu ni écrit dans
 * Notion, le portail et Postgres ne sont pas touchés, la clé vient de
 * `EVALUATION_API_KEY`. Le gel des sources est gardé sous
 * `evaluation/sources/<organisation>/unique/gel.json` : la seconde semaine
 * mesure la détection de changement.
 */
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { composerLettre } from '@/lib/email/lettre'
import { navigateurPlaywright, type Gel } from '@/lib/moteur/collecte'
import { produireLaLettre, type Production } from '@/lib/moteur/produire'
import type { Sélection } from '@/lib/moteur/redaction'
import { convertirLesRéférentiels, lireRéférentielUnique } from '@/lib/moteur/referentiel'
import {
  DESTINATAIRE,
  ENTRÉES,
  PORTAIL_URL,
  SORTIES,
  SOURCES,
  aujourdHui,
  cléDÉvaluation,
  horodatageDeSortie,
  lireArguments,
  lireDossier,
  organisationsDisponibles,
  réglerLeMandataire,
} from './evaluation-lettres'

function client(): Anthropic {
  return new Anthropic({ apiKey: cléDÉvaluation(), baseURL: process.env['EVALUATION_BASE_URL'] ?? 'https://api.anthropic.com', maxRetries: 3 })
}

function cheminDuRéférentielUnique(organisation: string): string {
  return join(ENTRÉES, organisation, 'referentiel-unique.md')
}

async function commandeConvertir(organisations: string[]): Promise<void> {
  const anthropic = client()
  for (const organisation of organisations) {
    const éco = lireDossier(organisation, 'ecosysteme', aujourdHui())
    const conc = lireDossier(organisation, 'concurrentielle', aujourdHui())
    process.stderr.write(`conversion ${organisation} (${éco.référentiel.length + conc.référentiel.length} caractères de référentiels)\n`)
    const { markdown, référentiel, usage } = await convertirLesRéférentiels(anthropic, {
      organisation: éco.portail.nom,
      fiche: éco.fiche,
      écosystème: éco.référentiel,
      concurrentiel: conc.référentiel,
      dernièresÉditions: JSON.stringify([...éco.dernièresÉditions, ...conc.dernièresÉditions], null, 1),
    })
    writeFileSync(cheminDuRéférentielUnique(organisation), markdown)
    process.stderr.write(`  ${référentiel.axes.length} axes, ${référentiel.dossiers.length} dossiers → ${cheminDuRéférentielUnique(organisation)} (${JSON.stringify(usage)})\n`)
  }
}

function lireLeGel(organisation: string): Map<string, Gel> {
  const chemin = join(SOURCES, organisation, 'unique', 'gel.json')
  if (!existsSync(chemin)) return new Map()
  const lu = JSON.parse(readFileSync(chemin, 'utf8')) as Array<{ url: string; empreinte: string; phrases: string[] }>
  return new Map(lu.map((g) => [g.url, { empreinte: g.empreinte, phrases: g.phrases }]))
}

function écrireLeGel(organisation: string, gel: ReadonlyMap<string, Gel>): void {
  const répertoire = join(SOURCES, organisation, 'unique')
  mkdirSync(répertoire, { recursive: true })
  writeFileSync(join(répertoire, 'gel.json'), JSON.stringify([...gel.entries()].map(([url, g]) => ({ url, ...g })), null, 1))
}

function sélectionDe(organisation: string, dateÉdition: string): Sélection {
  const éco = lireDossier(organisation, 'ecosysteme', dateÉdition)
  const conc = lireDossier(organisation, 'concurrentielle', dateÉdition)
  const numéro = Math.max(éco.numéro, conc.numéro)
  const précédente = [...éco.dernièresÉditions, ...conc.dernièresÉditions].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return {
    numéro,
    dateÉdition,
    période: éco.période,
    éditionPrécédente: précédente ? { dateÉdition: précédente.date, essentiel: [], dossiersBruts: précédente.dossiers } : null,
  }
}

function écrireLaProduction(répertoire: string, organisation: string, slug: string, production: Production): void {
  mkdirSync(répertoire, { recursive: true })
  const { lettre, sortie, contrôle, mesures, collecte } = production
  writeFileSync(join(répertoire, 'lettre.md'), lettre.markdown)
  writeFileSync(join(répertoire, 'proprietes.json'), JSON.stringify(lettre.propriétés, null, 2))
  writeFileSync(join(répertoire, 'reponse.json'), JSON.stringify(sortie, null, 2))
  writeFileSync(join(répertoire, 'validation.json'), JSON.stringify({ acceptée: production.acceptée, manquements: contrôle.manquements, rapport: contrôle.rapport }, null, 2))
  writeFileSync(join(répertoire, 'production.json'), JSON.stringify({ mesures, collecte: { lectures: collecte.lectures, résultats: collecte.résultats } }, null, 2))
  const courriel = composerLettre({
    objet: `[TEST] ${lettre.propriétés.titre}`,
    édition: { pageId: `test-${slug}`, titre: lettre.propriétés.titre, veille: 'Veille', numéro: lettre.propriétés.numéro, dateÉdition: lettre.propriétés.dateÉdition, périodeCouverte: lettre.propriétés.périodeCouverte },
    blocs: lettre.blocs,
    slug,
    organisation,
    portailUrl: PORTAIL_URL,
    adressePostale: null,
  })
  writeFileSync(join(répertoire, 'courriel.html'), courriel.html)
  writeFileSync(join(répertoire, 'courriel.txt'), courriel.texte)
  writeFileSync(join(répertoire, 'courriel.json'), JSON.stringify({ objet: `[TEST] ${lettre.propriétés.titre}`, destinataire: DESTINATAIRE }, null, 2))
}

async function commandeGenerer(organisations: string[], options: { dateÉdition: string; àBlanc: boolean; recherche: boolean }): Promise<void> {
  const racine = join(SORTIES, horodatageDeSortie())
  mkdirSync(racine, { recursive: true })
  const lignes: string[] = ['| Organisation | Acceptée | Manquements restants | Axes | Faits | Couverture | Reprises | Recherches | Coût ($) | Durée (s) |', '|---|---|---|---|---|---|---|---|---|---|']
  for (const organisation of organisations) {
    const chemin = cheminDuRéférentielUnique(organisation)
    if (!existsSync(chemin)) {
      process.stderr.write(`ignoré : ${organisation} (pas de referentiel-unique.md ; lancer d'abord « convertir »)\n`)
      continue
    }
    const référentiel = lireRéférentielUnique(readFileSync(chemin, 'utf8'))
    const sélection = sélectionDe(organisation, options.dateÉdition)
    const répertoire = join(racine, organisation, 'unique', 'opus-5-5-unique')
    if (options.àBlanc) {
      process.stderr.write(`à blanc : ${organisation}, ${référentiel.axes.length} axes, ${référentiel.axes.reduce((t, a) => t + a.sources.length, 0)} sources nommées, édition n° ${sélection.numéro}, période ${sélection.période.début} → ${sélection.période.fin}\n`)
      continue
    }
    process.stderr.write(`début ${organisation} : ${référentiel.axes.length} axes\n`)
    const slug = lireDossier(organisation, 'ecosysteme', options.dateÉdition).portail.slug
    const production = await produireLaLettre(
      { référentiel, sélection },
      {
        anthropic: client(),
        gel: lireLeGel(organisation),
        ouvrirNavigateur: () => navigateurPlaywright(process.env['CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium'),
        effort: 'medium',
        rechercher: options.recherche ? undefined : null,
        journal: (ligne) => process.stderr.write(`  ${organisation} : ${ligne}\n`),
      },
    )
    écrireLaProduction(répertoire, référentiel.organisation, slug, production)
    écrireLeGel(organisation, production.collecte.gelSuivant)
    const m = production.mesures
    lignes.push(
      `| ${organisation} | ${production.acceptée ? 'oui' : 'NON'} | ${production.contrôle.manquements.map((x) => x.code).join(', ') || 'aucun'} | ${production.contrôle.rapport.aperçu.axes.length} | ${m.faits} | ${Math.round(m.couverture.taux * 100)} % | ${m.reprises} | ${m.recherches} | ${m.coût.toFixed(2)} | ${Math.round(m.duréeMs / 1000)} |`,
    )
    process.stderr.write(`fin   ${organisation} : ${production.acceptée ? 'acceptée' : 'NON acceptée'}, ${m.faits} faits, ${Math.round(m.couverture.taux * 100)} % de couverture, ${m.reprises} reprise(s), ${m.coût.toFixed(2)} $\n`)
  }
  if (!options.àBlanc) {
    writeFileSync(join(racine, 'rapport.md'), `# Lettre unique, moteur en code\n\n${lignes.join('\n')}\n`)
    process.stderr.write(`rapport : ${join(racine, 'rapport.md')}\n`)
  }
}

async function main(): Promise<void> {
  await réglerLeMandataire()
  const [commande = 'generer', ...reste] = process.argv.slice(2)
  const { valeurs, drapeaux } = lireArguments(reste)
  const disponibles = organisationsDisponibles()
  const organisations = (valeurs.get('organisation') ?? 'konica').split(',').map((o) => o.trim()).filter((o) => disponibles.includes(o))
  if (organisations.length === 0) throw new Error(`Aucune organisation exportée parmi : ${disponibles.join(', ')}`)
  if (commande === 'convertir') await commandeConvertir(organisations)
  else if (commande === 'generer') {
    await commandeGenerer(organisations, { dateÉdition: valeurs.get('date-edition') ?? aujourdHui(), àBlanc: drapeaux.has('a-blanc'), recherche: !drapeaux.has('sans-recherche') })
  } else throw new Error(`Commande inconnue : ${commande}. Attendu : convertir ou generer.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erreur: unknown) => {
    process.stderr.write(`${erreur instanceof Error ? erreur.message : String(erreur)}\n`)
    process.exit(1)
  })
}
