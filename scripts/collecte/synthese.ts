/**
 * Condense les grilles et les faits des agents de collecte en une synthèse par
 * référentiel, que lit le rédacteur de cette lettre (23 octobre 2026, piste 2d
 * de l'analyse du coût de la première lettre Heritech).
 *
 *   pnpm collecte:synthese <dossier de collecte>
 *
 * Le dossier porte `grille/*.md` et `faits/*.md`, au format de la consigne de
 * collecte. Écrit `synthese-concurrentiel.md` et `synthese-ecosysteme.md` dans
 * le dossier, et rend sur la sortie standard les comptes de chacune. Sort en
 * erreur si une ligne de grille n'a pas d'état : l'étape 1bis interdit alors
 * de rédiger.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { lireFaits, synthèseDuRéférentiel } from '@/lib/moteur/grille'

const RÉFÉRENTIELS = [
  { nom: 'Concurrentiel', fichier: 'synthese-concurrentiel.md' },
  { nom: 'Écosystème', fichier: 'synthese-ecosysteme.md' },
] as const

function lireLeDossier(dossier: string): { nom: string; markdown: string }[] {
  try {
    return readdirSync(dossier)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => ({ nom: f.replace(/\.md$/, ''), markdown: readFileSync(join(dossier, f), 'utf8') }))
  } catch {
    return []
  }
}

export function synthétiser(dossier: string): { résumé: string; vides: number } {
  const grilles = lireLeDossier(join(dossier, 'grille'))
  const faits = lireLeDossier(join(dossier, 'faits')).flatMap((f) => lireFaits(f.markdown).map((fait) => ({ lot: f.nom, fait })))
  if (grilles.length === 0) throw new Error(`aucune grille dans ${join(dossier, 'grille')}`)
  let vides = 0
  const lignes: string[] = []
  for (const r of RÉFÉRENTIELS) {
    const s = synthèseDuRéférentiel(grilles, faits, r.nom)
    writeFileSync(join(dossier, r.fichier), s.markdown)
    vides += s.vides
    lignes.push(`${r.fichier} : ${s.lignes} ligne(s) de grille, ${s.vides} vide(s), ${s.faitsNouveaux} fait(s) nouveau(x), ${s.faitsDeContexte} de contexte, ${s.constats} RAS ou constat(s).`)
  }
  return { résumé: lignes.join('\n'), vides }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [dossier] = process.argv.slice(2)
  if (!dossier) {
    console.error('usage : pnpm collecte:synthese <dossier de collecte>')
    process.exit(2)
  }
  try {
    const { résumé, vides } = synthétiser(dossier)
    console.log(résumé)
    if (vides) {
      console.error(`${vides} ligne(s) de grille sans état : la collecte n'est pas terminée.`)
      process.exitCode = 1
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  }
}
