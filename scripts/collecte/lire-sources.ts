/**
 * Lit en code les sources nommées d'un lot de collecte, avant que l'agent ne
 * cherche quoi que ce soit (23 octobre 2026, piste 7 de l'analyse du coût de la
 * première lettre Heritech).
 *
 *   pnpm collecte:lire <fichier d'URL> <dossier de sortie> [--sans-navigateur]
 *
 * Le fichier d'URL est un texte libre : chaque adresse http(s) qu'il contient
 * est lue une fois (requête simple, puis Chromium pour celles qui refusent les
 * robots ou se rendent en JavaScript). Le texte utile de chaque page ouverte est
 * écrit dans `<dossier>/NN-domaine.txt`, et l'index du lot, une ligne de grille
 * par source, dans `<dossier>/index.md`, aussi rendu sur la sortie standard.
 *
 * Avant, chaque source coûtait un tour de modèle, qui relisait tout son contexte
 * pour ouvrir une page : la moitié des 368 tours de la collecte Heritech. Ici le
 * modèle ne lit que les fichiers des pages qui l'intéressent. Rien n'est jugé :
 * le code dit ce qui s'est ouvert et la dernière date visible, pas ce qui compte.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { collecterLesUrls, navigateurPlaywright } from '@/lib/moteur/collecte'
import { indexDuLot, lignesDuLot } from '@/lib/moteur/grille'
import { urlsDuMarkdown } from '@/lib/moteur/portes'

/** Le Chromium de l'environnement, comme `scripts/lire-page.mjs`. */
const CHROMIUM = process.env['CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium'

/** Paris, pour que la date du jour soit celle des lettres. */
function aujourdhuiÀParis(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

/**
 * Quatre minutes au plus pour un lot : au-delà, les sources restantes sont
 * rendues `delai-du-lot`, à relancer dans un second lot. Le modèle qui attend
 * l'outil garde ainsi son cache, qui expire à cinq minutes.
 */
export const DURÉE_D_UN_LOT_MS = 240_000

/** Lit les URL, écrit un fichier par page ouverte et l'index du lot ; rend l'index. */
export async function lireLesUrls(
  urls: readonly string[],
  dossier: string,
  options: { readonly avecNavigateur: boolean; readonly fetch?: typeof fetch } = { avecNavigateur: true },
): Promise<string> {
  if (urls.length === 0) throw new Error('aucune adresse http(s) à lire')
  mkdirSync(dossier, { recursive: true })
  // L'échéance laisse à la dernière source lancée le temps de finir (20 s de
  // requête simple, 55 s au navigateur) avant les quatre minutes.
  const échéance = Date.now() + DURÉE_D_UN_LOT_MS - 75_000
  const lectures = await collecterLesUrls(urls, {
    ouvrirNavigateur: options.avecNavigateur ? () => navigateurPlaywright(existsSync(CHROMIUM) ? CHROMIUM : undefined) : undefined,
    délaiMs: 20_000,
    parallèle: 6,
    échéance,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })
  const lignes = lignesDuLot(lectures, aujourdhuiÀParis())
  for (const [i, ligne] of lignes.entries()) {
    if (!ligne.fichier) continue
    writeFileSync(join(dossier, ligne.fichier), `${ligne.url}\n${ligne.détail}\n\n${lectures[i]!.texte}\n`)
  }
  const index = indexDuLot(lignes)
  writeFileSync(join(dossier, 'index.md'), index)
  return index
}

/** La commande : un fichier texte libre, dont chaque adresse http(s) est lue. */
export async function lireLeLot(entrée: string, dossier: string, avecNavigateur: boolean): Promise<string> {
  const urls = urlsDuMarkdown(readFileSync(entrée, 'utf8'))
  if (urls.length === 0) throw new Error(`aucune adresse http(s) dans ${entrée}`)
  return lireLesUrls(urls, dossier, { avecNavigateur })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2)
  const avecNavigateur = !args.includes('--sans-navigateur')
  const [entrée, dossier] = args.filter((a) => !a.startsWith('--'))
  if (!entrée || !dossier) {
    console.error('usage : pnpm collecte:lire <fichier d’URL> <dossier de sortie> [--sans-navigateur]')
    process.exit(2)
  }
  lireLeLot(entrée, dossier, avecNavigateur)
    .then((index) => console.log(index))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : String(e))
      process.exitCode = 1
    })
}
