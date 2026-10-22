/**
 * Le référentiel unique d'une organisation (programme du 22 octobre 2026, §2).
 *
 * Un seul document Markdown, à la forme fixe ci-dessous, que le code sait lire
 * sans modèle : c'est lui qui donne au moteur ses axes, ses sources, ses
 * requêtes et ses dossiers. Le §6 des anciens référentiels n'existe plus, la
 * richesse de la lettre est fixée par le contrat de forme.
 *
 *     # Référentiel unique : <Organisation>
 *
 *     ## Fiche
 *     <paragraphes libres, courts>
 *
 *     ## Axes
 *     ### ① <Nom de l'axe> (thème | concurrents)
 *     Critères : <ce qui compte comme FORT, comme MOYEN>
 *     Sources :
 *     - <libellé> : <url>
 *     Requêtes :
 *     - <requête type>
 *     Acteurs :
 *     - <acteur suivi>
 *
 *     ## Dossiers ouverts
 *     - <nom> (<compteur>, <précision>)
 *
 * Seul endroit où cette forme est écrite : le lecteur, l'écrivain et la
 * conversion des deux anciens référentiels sont ici.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { lireDossiersOuverts, type DossierOuvert } from '@/lib/domaine/dossiers'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'

export const CERCLÉS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'] as const

export type SorteDAxe = 'thème' | 'concurrents'

export type SourceNommée = { readonly libellé: string; readonly url: string }

export type AxeDuRéférentiel = {
  readonly numéro: number
  readonly nom: string
  readonly sorte: SorteDAxe
  readonly critères: string
  readonly sources: readonly SourceNommée[]
  readonly requêtes: readonly string[]
  readonly acteurs: readonly string[]
}

export type RéférentielUnique = {
  readonly organisation: string
  readonly fiche: string
  readonly axes: readonly AxeDuRéférentiel[]
  readonly dossiers: readonly DossierOuvert[]
  /** La ligne brute des dossiers, au format de la propriété Notion. */
  readonly dossiersBruts: string
}

const schémaDAxe = z.object({
  nom: z.string().min(2).max(80).describe("Le nom de l'axe, tel que le lecteur le verra en titre, sans numéro ni suffixe d'impact, court (60 caractères de préférence)"),
  sorte: z.enum(['thème', 'concurrents']).describe("« thème » pour un sujet de l'écosystème, « concurrents » pour un sujet d'offre commerciale (prix, formules, positionnement) ; dans les deux cas une thématique, jamais le nom d'une organisation"),
  critères: z.string().max(700).describe('Deux à quatre phrases, 400 caractères de préférence : ce qui, sur cet axe, compte comme FORT et comme MOYEN pour cette organisation, seuils chiffrés compris'),
  sources: z
    .array(z.object({ libellé: z.string().max(80), url: z.string().url() }))
    .max(12)
    .describe("Les sources nommées à ouvrir à chaque parution, URL exactes, reprises des référentiels d'origine"),
  requêtes: z.array(z.string().max(120)).max(6).describe('Les requêtes types à lancer à chaque parution'),
  acteurs: z.array(z.string().max(80)).max(12).describe('Les acteurs suivis sur cet axe : concurrents, administrations, guichets'),
})

export const schémaDuRéférentielUnique = z.object({
  fiche: z.string().max(2500).describe("La fiche de l'organisation en quatre à huit phrases : activité, territoire, clients, ce qui la menace et ce qui la porte"),
  axes: z
    .array(schémaDAxe)
    .min(LETTRE_UNIQUE.axesMin)
    .max(LETTRE_UNIQUE.axesMax)
    .describe(`${LETTRE_UNIQUE.axesMin} à ${LETTRE_UNIQUE.axesMax} axes, les thèmes de l'écosystème d'abord, puis les sujets d'offre commerciale, dans l'ordre d'importance pour l'organisation ; les organisations se suivent dans les dossiers, pas dans les axes`),
  dossiers: z
    .array(z.object({ nom: z.string().max(80), compteur: z.number().int().min(0), précision: z.string().max(120) }))
    .max(20)
    .describe("Les dossiers ouverts suivis d'édition en édition : chaque dossier est une organisation (entreprise, administration, association), jamais un sujet, un texte de loi ou une version logicielle, qui sont des faits d'axe ; repris des dernières éditions publiées avec leur compteur"),
})

export type RéférentielStructuré = z.infer<typeof schémaDuRéférentielUnique>

// ── Lecture ──────────────────────────────────────────────────────────────────

function sansTiretsDeListe(ligne: string): string {
  return ligne.replace(/^\s*[-*•·]\s*/, '').trim()
}

function lireAxe(numéro: number, titre: string, corps: readonly string[]): AxeDuRéférentiel {
  const enTête = /^(?:[①-⑳]\s*)?(.+?)\s*\((th[eè]me|concurrents)\)\s*$/i.exec(titre.trim())
  const nom = (enTête?.[1] ?? titre.replace(/^[①-⑳]\s*/, '')).trim()
  const sorte: SorteDAxe = enTête?.[2]?.toLowerCase().startsWith('conc') ? 'concurrents' : 'thème'
  let critères = ''
  const sources: SourceNommée[] = []
  const requêtes: string[] = []
  const acteurs: string[] = []
  let section: 'sources' | 'requêtes' | 'acteurs' | null = null
  for (const brute of corps) {
    const ligne = brute.trim()
    if (ligne.length === 0) continue
    const critère = /^crit[eè]res?\s*:\s*(.*)$/i.exec(ligne)
    if (critère) {
      critères = critère[1]?.trim() ?? ''
      section = null
      continue
    }
    if (/^sources?\s*:/i.test(ligne)) {
      section = 'sources'
      continue
    }
    if (/^requ[eê]tes?\s*:/i.test(ligne)) {
      section = 'requêtes'
      continue
    }
    if (/^acteurs?\s*:/i.test(ligne)) {
      section = 'acteurs'
      continue
    }
    const élément = sansTiretsDeListe(ligne)
    if (section === 'sources') {
      const url = /https?:\/\/\S+/.exec(élément)?.[0]?.replace(/[.,;:)\]]+$/, '')
      if (!url) continue
      const libellé = élément.replace(url, '').replace(/\s*:\s*$/, '').replace(/[\s:]+$/, '').trim() || url
      sources.push({ libellé, url })
    } else if (section === 'requêtes') requêtes.push(élément)
    else if (section === 'acteurs') acteurs.push(élément)
    else if (critères.length === 0) critères = élément
  }
  return { numéro, nom, sorte, critères, sources, requêtes, acteurs }
}

/** Lit un référentiel unique ; jette si la forme n'est pas celle attendue. */
export function lireRéférentielUnique(markdown: string): RéférentielUnique {
  const lignes = markdown.split(/\r?\n/)
  const titre = lignes.find((l) => /^#\s+/.test(l))
  const organisation = titre?.replace(/^#\s+/, '').replace(/^r[ée]f[ée]rentiel unique\s*:\s*/i, '').trim() ?? ''
  if (!organisation) throw new Error('Référentiel unique : le titre « # Référentiel unique : <Organisation> » manque.')

  const sections = new Map<string, string[]>()
  let courante: string | null = null
  for (const ligne of lignes) {
    const h2 = /^##\s+(.+?)\s*$/.exec(ligne)
    if (h2 && !ligne.startsWith('###')) {
      courante = h2[1]!.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      sections.set(courante, [])
      continue
    }
    if (courante) sections.get(courante)!.push(ligne)
  }
  const fiche = (sections.get('fiche') ?? []).join('\n').trim()
  const lignesDAxes = sections.get('axes') ?? []
  const axes: AxeDuRéférentiel[] = []
  let titreCourant: string | null = null
  let corps: string[] = []
  const clore = () => {
    if (titreCourant !== null) axes.push(lireAxe(axes.length + 1, titreCourant, corps))
  }
  for (const ligne of lignesDAxes) {
    const h3 = /^###\s+(.+?)\s*$/.exec(ligne)
    if (h3) {
      clore()
      titreCourant = h3[1]!
      corps = []
    } else corps.push(ligne)
  }
  clore()
  if (axes.length === 0) throw new Error('Référentiel unique : aucun axe « ### ① Nom (thème) » sous « ## Axes ».')

  const dossiersBruts = (sections.get('dossiers ouverts') ?? [])
    .map(sansTiretsDeListe)
    .filter((l) => l.length > 0)
    .join(' · ')
  return { organisation, fiche, axes, dossiers: lireDossiersOuverts(dossiersBruts), dossiersBruts }
}

// ── Écriture ─────────────────────────────────────────────────────────────────

export function écrireRéférentielUnique(organisation: string, structuré: RéférentielStructuré): string {
  const parties = [`# Référentiel unique : ${organisation}`, '', '## Fiche', '', structuré.fiche.trim(), '', '## Axes', '']
  structuré.axes.forEach((axe, i) => {
    parties.push(`### ${CERCLÉS[i] ?? `${i + 1}.`} ${axe.nom} (${axe.sorte})`)
    parties.push(`Critères : ${axe.critères.trim()}`)
    parties.push('Sources :')
    for (const s of axe.sources) parties.push(`- ${s.libellé} : ${s.url}`)
    parties.push('Requêtes :')
    for (const r of axe.requêtes) parties.push(`- ${r}`)
    parties.push('Acteurs :')
    for (const a of axe.acteurs) parties.push(`- ${a}`)
    parties.push('')
  })
  parties.push('## Dossiers ouverts', '')
  for (const d of structuré.dossiers) parties.push(`- ${d.nom} (${d.compteur}${d.précision ? `, ${d.précision}` : ''})`)
  parties.push('')
  return parties.join('\n')
}

/** Toutes les URL nommées du référentiel, dédoublonnées, dans l'ordre des axes. */
export function urlsDuRéférentiel(référentiel: RéférentielUnique): string[] {
  return [...new Set(référentiel.axes.flatMap((axe) => axe.sources.map((s) => s.url)))]
}

// ── Conversion des deux anciens référentiels, une fois par organisation ──────

export const MODÈLE_DE_CONVERSION = 'claude-opus-5-5'

/**
 * Dérive le référentiel unique des deux référentiels Notion d'une organisation.
 * Un seul appel, à l'onboarding d'un client existant ; le résultat est relu par
 * `lireRéférentielUnique` avant d'être gardé, et c'est lui qui fait foi ensuite.
 */
export async function convertirLesRéférentiels(
  anthropic: Anthropic,
  entrée: { organisation: string; fiche: string; écosystème: string; concurrentiel: string; dernièresÉditions: string },
  options: { modèle?: string } = {},
): Promise<{ markdown: string; référentiel: RéférentielUnique; usage: unknown }> {
  const système =
    `Tu convertis les deux référentiels de veille d'une organisation en un référentiel unique, ` +
    `qui servira à un programme (pas à un agent) pour produire chaque semaine UNE lettre de ${LETTRE_UNIQUE.axesMin} à ${LETTRE_UNIQUE.axesMax} axes. ` +
    `Chaque axe est une thématique : un thème de l'écosystème (réglementation, marché, financement, technologie, territoire, etc.) ` +
    `ou un sujet d'offre commerciale (prix, formules, positionnement). Un axe ne porte jamais le nom d'une organisation ni d'un type d'organisations ; ` +
    `les concurrents, administrations et guichets vont dans les acteurs de l'axe, qui servent à les suivre comme dossiers. ` +
    `Un dossier ouvert est une organisation ; un sujet, un texte ou une version logicielle en cours n'est pas un dossier, il se suit dans son axe. ` +
    `Couvre tout le spectre des deux référentiels sans doublon : fusionne ce qui se recoupe, garde les sources et les requêtes telles quelles, ` +
    `ne crée aucune URL que les référentiels ne contiennent pas. Les critères disent ce qui compte comme FORT et MOYEN pour CETTE organisation. ` +
    `Les dossiers ouverts viennent des dernières éditions publiées, avec leur compteur. Réponds en français, dans le format demandé.`
  const utilisateur =
    `<organisation>${entrée.organisation}</organisation>\n\n<fiche>\n${entrée.fiche}\n</fiche>\n\n` +
    `<referentiel_ecosysteme>\n${entrée.écosystème}\n</referentiel_ecosysteme>\n\n` +
    `<referentiel_concurrentiel>\n${entrée.concurrentiel}\n</referentiel_concurrentiel>\n\n` +
    `<dernieres_editions>\n${entrée.dernièresÉditions}\n</dernieres_editions>`
  const réponse = await anthropic.beta.messages.parse({
    model: options.modèle ?? MODÈLE_DE_CONVERSION,
    max_tokens: 20_000,
    system: système,
    messages: [{ role: 'user', content: utilisateur }],
    output_format: zodOutputFormat(schémaDuRéférentielUnique),
  })
  const structuré = réponse.parsed_output
  if (!structuré) throw new Error(`Conversion des référentiels : aucune sortie structurée (${réponse.stop_reason}).`)
  const markdown = écrireRéférentielUnique(entrée.organisation, structuré)
  return { markdown, référentiel: lireRéférentielUnique(markdown), usage: réponse.usage }
}
