/**
 * La rédaction : un appel à sortie structurée, aucun outil (programme du
 * 22 octobre 2026, §3, étape 3).
 *
 * Le modèle reçoit le dossier que le code a réuni (référentiel, nouveautés par
 * source, résultats des requêtes types, édition précédente) et rend un objet
 * JSON au schéma ci-dessous. Il ne peut citer qu'une URL du dossier : le schéma
 * le dit et la porte le vérifie. Le système et le référentiel sont mis en cache
 * une heure, pour que la reprise ne les repaie pas.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { Lecture } from '@/lib/moteur/collecte'
import type { RésultatDeRecherche } from '@/lib/moteur/recherche'
import type { RéférentielUnique } from '@/lib/moteur/referentiel'
import { ANSOFF, FORCES_PORTER, IMPACTS_DE_FAIT, PESTEL } from '@/lib/domaine/strategie'
import { ESSENTIEL_CARACTÈRES_MAX, ESSENTIEL_LIGNES_MAX } from '@/lib/domaine/texte'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'

const schémaDuFait = z.object({
  texte: z
    .string()
    .max(LETTRE_UNIQUE.caractèresParFaitMax)
    .describe(`Une ou deux phrases, ${LETTRE_UNIQUE.caractèresParFaitMax} caractères au plus, sujet verbe complément, la date en toutes lettres dans la phrase (« le 12 septembre »), un seul acteur par phrase, sigles développés`),
  date: z.string().describe('AAAA-MM-JJ, la date du fait'),
  url: z.string().describe("L'URL exacte du dossier d'où vient le fait ; jamais une URL absente du dossier"),
  contexte: z.boolean().describe('vrai si le fait est antérieur à la période et donné comme élément de contexte, non nouveau'),
  })

function schémaAvecLesFaits<F extends z.ZodType>(fait: F) {
  return z.object({
    essentiel: z
      .array(z.string().max(ESSENTIEL_CARACTÈRES_MAX))
      .min(3)
      .max(ESSENTIEL_LIGNES_MAX)
      .describe(`Trois à ${ESSENTIEL_LIGNES_MAX} lignes de ${ESSENTIEL_CARACTÈRES_MAX} caractères au plus, chacune se lit seule (qui, quoi, quand), reprises telles quelles par le digest`),
    axes: z
      .array(
        z.object({
          numéro: z.number().int().min(1).describe("Le numéro de l'axe dans le référentiel"),
          niveau: z.enum(['FORT', 'MOYEN', 'RAS']).describe("Trois niveaux et trois seulement ; le niveau du fait le plus fort de l'axe ; RAS si aucun fait de la période"),
          faits: z
            .array(fait)
            .max(LETTRE_UNIQUE.faitsParAxeMax)
            .describe(`Zéro à ${LETTRE_UNIQUE.faitsParAxeMax} faits, les plus lourds de conséquence ; vide si RAS`),
          ras: z
            .string()
            .max(LETTRE_UNIQUE.caractèresDuRasMax)
            .nullable()
            .describe(`Si RAS : une ou deux phrases, ${LETTRE_UNIQUE.caractèresDuRasMax} caractères au plus, qui nomment ce qui a été vérifié et depuis quand les sources sont muettes ; sinon null`),
        }),
      )
      .min(LETTRE_UNIQUE.axesMin)
      .max(LETTRE_UNIQUE.axesMax)
      .describe('Un objet par axe du référentiel, tous les axes, dans leur ordre'),
    dossiers: z
      .array(
        z.object({
          nom: z.string().max(80).describe('Le nom exact du dossier, inchangé d’une édition à l’autre'),
          compteur: z.number().int().min(0).describe('Le compteur de la précédente édition, plus un si le dossier a bougé pendant la période, sinon inchangé'),
          précision: z.string().max(120).describe('Où en est le dossier, en quelques mots ; vide si rien à dire'),
          suivi: z.string().max(300).describe('Une à deux phrases qui nomment le dossier exactement et disent ce qui a bougé ou ce qu’on attend'),
        }),
      )
      .max(20)
      .describe('Les dossiers ouverts suivis, ceux du référentiel et de la précédente édition, plus ceux que la période ouvre, moins ceux qu’elle clôt (dits clos dans le suivi)'),
    actionDeLaSemaine: z.string().max(300).describe('Une phrase : la chose à faire ou à surveiller cette semaine, tirée des faits FORT'),
  })
}

/**
 * Les étiquettes d'un fait, demandées dans la même sortie que la lettre quand
 * l'organisation est du pilote des outils stratégiques (lot 13 du plan du
 * 26 octobre 2026). Ce sont les mêmes listes fermées que l'étape 4ter ; la
 * place du fait et sa phrase-titre ne sont pas demandées au modèle, le code les
 * lit dans la lettre assemblée (`étiquettesDeLaSortie`), et la porte de
 * `lib/domaine/strategie.ts` contrôle le tout avant d'écrire.
 */
export const schémaDÉtiquette = z.object({
  pestel: z.enum(PESTEL).nullable().describe("La dimension PESTEL d'un fait d'écosystème ; null pour un fait sur un acteur du marché"),
  porter: z.enum(FORCES_PORTER).nullable().describe("La force de Porter d'un fait sur un acteur du marché ; null pour un fait d'écosystème. L'un des deux, jamais les deux"),
  ansoff: z.enum(ANSOFF).nullable().describe('Le mouvement du concurrent, pour une force rivalite ou nouveaux_entrants seulement ; sinon null'),
  entite: z.string().max(120).nullable().describe("L'acteur que le fait nomme, écrit exactement comme dans la grille de l'organisation ; null si aucun"),
  rupture: z.boolean().describe('vrai si le fait change les règles du jeu du marché, et non un mouvement de plus'),
  impact: z.enum(IMPACTS_DE_FAIT).describe("Le niveau de ce fait, FORT ou MOYEN, jamais au-dessus du niveau de l'axe"),
})

const schémaDuFaitÉtiqueté = schémaDuFait.extend({ étiquette: schémaDÉtiquette })

export const schémaDeLaLettre = schémaAvecLesFaits(schémaDuFait)
export const schémaDeLaLettreÉtiquetée = schémaAvecLesFaits(schémaDuFaitÉtiqueté)

export type SortieRédigée = z.infer<typeof schémaDeLaLettre>
export type SortieÉtiquetée = z.infer<typeof schémaDeLaLettreÉtiquetée>
export type ÉtiquetteDuFait = z.infer<typeof schémaDÉtiquette>

export type Sélection = {
  readonly numéro: number
  readonly dateÉdition: string
  readonly période: { readonly début: string; readonly fin: string }
  readonly éditionPrécédente?: { readonly dateÉdition: string; readonly essentiel: readonly string[]; readonly dossiersBruts: string } | null
}

export type DossierDeCollecte = {
  readonly lectures: readonly Lecture[]
  readonly résultats: readonly RésultatDeRecherche[]
}

export const MODÈLE_DE_RÉDACTION = 'claude-opus-5-5'

export function systèmeDeRédaction(): string {
  return (
    `Tu rédiges l'édition hebdomadaire d'une veille pour un dirigeant pressé, à partir d'un dossier que le programme a réuni avant toi : ` +
    `pour chaque axe du référentiel, les passages nouveaux des sources nommées depuis la dernière parution, les passages inchangés, ` +
    `et les résultats des requêtes types. Tu n'as aucun outil et tu n'inventes rien : chaque fait vient d'un extrait du dossier, ` +
    `porte sa date et l'URL exacte de l'extrait. Une URL absente du dossier est une faute qui fait rejeter la lettre.\n\n` +
    `CE QUE TU PRODUIS : une lettre très synthétique qui couvre tout le spectre : un objet par axe, tous les axes, ` +
    `un à ${LETTRE_UNIQUE.faitsParAxeMax} faits de ${LETTRE_UNIQUE.phrasesParFaitMax} phrases au plus pour un axe FORT ou MOYEN, un RAS motivé et court sinon. ` +
    `Le niveau d'un axe est celui de son fait le plus fort, selon les critères de l'axe ; trois niveaux et trois seulement, FAIBLE n'existe pas. ` +
    `Un fait de la période est daté dedans ; un fait antérieur n'entre que comme élément de contexte (contexte: true) quand il éclaire une échéance à venir, ` +
    `et jamais pour remplir. Un axe sans fait de la période est RAS : le dire est une information, remplir serait une faute.\n\n` +
    `COMMENT C'EST ÉCRIT : des phrases, sujet verbe complément, une idée par phrase, un acteur par phrase, les sigles développés à leur première apparition, ` +
    `la date en toutes lettres dans la phrase (« le 12 septembre »), le ton sobre et factuel, sans effet d'annonce. ` +
    `Pas de référence au référentiel, à ses numéros ni à la méthode : ni « référentiel », ni « § », ni « source non ouverte », ni « requête non lancée ». ` +
    `Les lignes de L'essentiel se lisent seules, elles sont reprises telles quelles. Les dossiers gardent leur nom exact d'une édition à l'autre.`
  )
}

export function blocDuRéférentiel(référentiel: RéférentielUnique): string {
  const axes = référentiel.axes
    .map(
      (axe) =>
        `axe ${axe.numéro} : ${axe.nom} (${axe.sorte})\n  critères : ${axe.critères}\n  acteurs : ${axe.acteurs.join(' ; ') || 'aucun'}\n  sources : ${axe.sources.map((s) => `${s.libellé} <${s.url}>`).join(' ; ') || 'aucune'}`,
    )
    .join('\n')
  return `<organisation>${référentiel.organisation}</organisation>\n<fiche>\n${référentiel.fiche}\n</fiche>\n<axes>\n${axes}\n</axes>`
}

function écourter(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, max - 1)}…`
}

export function blocDuDossier(référentiel: RéférentielUnique, sélection: Sélection, dossier: DossierDeCollecte, options: { caractèresParSource?: number } = {}): string {
  const parAxe = référentiel.axes.map((axe) => {
    const lectures = axe.sources
      .map((s) => dossier.lectures.find((l) => l.url === s.url))
      .filter((l): l is Lecture => l !== undefined)
    const extraits = lectures
      .map((l) => {
        if (!l.état.startsWith('ouverte')) return `  <source url="${l.url}" etat="${l.état}" />`
        const nouveautés = l.nouveautés.slice(0, 40).join(' ')
        const corps = nouveautés.length > 0 ? `nouveau depuis la dernière lecture : ${écourter(nouveautés, options.caractèresParSource ?? 3_000)}` : `inchangé depuis la dernière lecture : ${écourter(l.texte, 600)}`
        return `  <source url="${l.url}" etat="${l.état}" changee="${l.changée === null ? 'inconnu' : l.changée ? 'oui' : 'non'}">\n  ${corps}\n  </source>`
      })
      .join('\n')
    const résultats = dossier.résultats
      .filter((r) => r.axe === axe.numéro)
      .map((r) => `  <resultat url="${r.url}" date="${r.date ?? 'inconnue'}">${r.titre} : ${r.extrait}</resultat>`)
      .join('\n')
    return `<axe numero="${axe.numéro}" nom="${axe.nom}">\n${extraits}\n${résultats}\n</axe>`
  })
  const précédente = sélection.éditionPrécédente
    ? `<edition_precedente date="${sélection.éditionPrécédente.dateÉdition}">\nessentiel :\n${sélection.éditionPrécédente.essentiel.map((l) => `- ${l}`).join('\n')}\ndossiers : ${sélection.éditionPrécédente.dossiersBruts}\n</edition_precedente>`
    : '<edition_precedente>aucune : première édition</edition_precedente>'
  return (
    `<parametres>\nnuméro : ${sélection.numéro}\ndate d'édition : ${sélection.dateÉdition}\npériode : du ${sélection.période.début} au ${sélection.période.fin}\n</parametres>\n` +
    `${précédente}\n<dossiers_ouverts_du_referentiel>${référentiel.dossiersBruts || 'aucun'}</dossiers_ouverts_du_referentiel>\n<dossier_de_collecte>\n${parAxe.join('\n')}\n</dossier_de_collecte>\n\n` +
    `Rédige l'édition n° ${sélection.numéro} dans le format demandé.`
  )
}

export type Usage = { entrée: number; sortie: number; cacheLecture: number; cacheÉcriture: number }

export function ajouterUsage(total: Usage, u: unknown): void {
  const usage = (u ?? {}) as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }
  total.entrée += usage.input_tokens ?? 0
  total.sortie += usage.output_tokens ?? 0
  total.cacheLecture += usage.cache_read_input_tokens ?? 0
  total.cacheÉcriture += usage.cache_creation_input_tokens ?? 0
}

export type Rédacteur = {
  /** Premier jet. */
  rédiger: (référentiel: RéférentielUnique, sélection: Sélection, dossier: DossierDeCollecte) => Promise<SortieRédigée>
  /** Reprise dans la même conversation, avec les corrections demandées. */
  reprendre: (corrections: string) => Promise<SortieRédigée>
  readonly usage: Usage
  readonly modèle: string
}

/** Le rédacteur de production : Opus, sortie structurée, cache d'une heure. */
export function rédacteurAnthropic(anthropic: Anthropic, options: { modèle?: string; effort?: 'low' | 'medium' | 'high' | 'xhigh' } = {}): Rédacteur {
  const modèle = options.modèle ?? MODÈLE_DE_RÉDACTION
  const usage: Usage = { entrée: 0, sortie: 0, cacheLecture: 0, cacheÉcriture: 0 }
  const messages: Anthropic.Beta.BetaMessageParam[] = []
  const appeler = async (): Promise<SortieRédigée> => {
    const réponse = await anthropic.beta.messages.parse({
      model: modèle,
      max_tokens: 16_000,
      system: [{ type: 'text', text: systèmeDeRédaction(), cache_control: { type: 'ephemeral', ttl: '1h' } }],
      messages,
      output_format: zodOutputFormat(schémaDeLaLettre),
      ...(options.effort ? { output_config: { effort: options.effort } } : {}),
    } as unknown as Parameters<typeof anthropic.beta.messages.parse>[0])
    ajouterUsage(usage, réponse.usage)
    const sortie = (réponse as unknown as { parsed_output?: SortieRédigée | null }).parsed_output
    if (!sortie) throw new Error(`Rédaction : aucune sortie structurée (${réponse.stop_reason}).`)
    messages.push({ role: 'assistant', content: réponse.content })
    return sortie
  }
  return {
    modèle,
    usage,
    async rédiger(référentiel, sélection, dossier) {
      messages.length = 0
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: blocDuRéférentiel(référentiel), cache_control: { type: 'ephemeral', ttl: '1h' } },
          { type: 'text', text: blocDuDossier(référentiel, sélection, dossier) },
        ],
      })
      return appeler()
    },
    async reprendre(corrections) {
      messages.push({ role: 'user', content: corrections })
      return appeler()
    },
  }
}
