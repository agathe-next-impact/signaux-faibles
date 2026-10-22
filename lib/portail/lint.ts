import {
  axesDuDocument,
  construireDocument,
  écourter,
  type Bloc,
  type BlocNotion,
  type Document,
} from '@/lib/domaine/document'
import { lireDossiersOuverts, type DossierOuvert } from '@/lib/domaine/dossiers'
import { mentionsDe } from '@/lib/domaine/mentions'
import { faitsDe, phrasesDe } from '@/lib/domaine/document'
import type { NiveauImpact } from '@/lib/domaine/impact'
import { contrôlerLeContrat } from '@/lib/portail/contrat'
import {
  ESSENTIEL_CARACTÈRES_MAX,
  ESSENTIEL_LIGNES_MAX,
  estTitreDeCadrage,
  estTitreDeLEssentiel,
  sansAccent,
} from '@/lib/domaine/texte'

/**
 * Le validateur de lettre : ce que le portail affichera, dit **avant** l'envoi.
 *
 * Jusqu'au 17 septembre 2026, le contrat de forme était vérifié en trois
 * endroits, tous après coup : `contrat.ts` au rendu (journal Vercel), l'étape
 * 3bis de la réconciliation le soir, et la relecture humaine. Le 11 septembre,
 * deux lettres complètes du Pays de Mauriac avaient donné un tableau de bord
 * vide sans que rien ne casse. Ce module ferme la fenêtre : la tâche qui écrit
 * la lettre l'appelle sur la page encore en Brouillon, et corrige tant que le
 * rapport n'est pas conforme.
 *
 * Il ne réinvente aucune règle : il passe la page dans **le parseur de
 * production** — `construireDocument`, `lireDossiersOuverts`, `mentionsDe`,
 * `contrôlerLeContrat` — et rend ce que ces fonctions ont vu. Ce que le
 * validateur accepte, le portail l'affiche ; ce qu'il refuse, le portail ne
 * l'aurait pas affiché. Il n'y a pas de troisième lecture.
 *
 * Deux portées de rupture. `portail` : ce que le portail n'affichera pas (un axe
 * sans suffixe, un dossier sans compteur). `lettre` : une règle de la page
 * « Tâche — Lettres de veille » que le portail ne lit pas mais qui engage le
 * dispositif (la phrase de clôture du cadrage, l'absence de « FAIBLE »). Les
 * deux bloquent la conformité. Un avertissement n'empêche rien.
 */

export type Portée = 'portail' | 'lettre'

/**
 * La forme attendue d'une lettre (programme du 22 octobre 2026).
 *   · `double` : les deux lettres par parution du dispositif en service, le
 *     contrat de la page « Tâche Lettres de veille » tel quel ;
 *   · `unique` : la lettre unique du programme, dix à quinze axes, un à trois
 *     faits courts par axe, et plusieurs avertissements qui deviennent des
 *     ruptures, puisqu'aucun humain ne relit avant l'envoi.
 */
export type Forme = 'double' | 'unique'

export type Rupture = {
  readonly code:
    | 'aucun-axe'
    | 'axe-sans-niveau'
    | 'niveau-faible'
    | 'dossier-sans-compteur'
    | 'cadrage-non-clos'
    | 'cadrage-sans-adresse'
    | 'titre-vide'
    | 'essentiel-absent'
    | 'essentiel-trop-long'
    | CodeDeFormeUnique
  readonly portée: Portée
  readonly message: string
}

/** Les codes que seule la forme unique produit, ou qu'elle élève au rang de rupture. */
export type CodeDeFormeUnique =
  | 'axes-trop-peu'
  | 'axes-trop-nombreux'
  | 'axe-trop-fourni'
  | 'axe-peu-fourni'
  | 'fait-trop-long'
  | 'fait-sans-date'
  | 'fait-sans-source'
  | 'ras-trop-long'
  | 'recommandation-de-post'
  | 'axe-est-un-acteur'
  | 'dossiers-sans-rubrique'
  | 'lettre-trop-longue'
  | 'absence-en-prose'
  | 'cadrage-présent'
  | 'collecte-dans-la-lettre'
  | 'dossier-non-nommé'
  | 'essentiel-ligne-longue'

export type Avertissement = {
  readonly code:
    | 'dossier-non-nommé'
    | 'axes-hors-rubrique'
    | 'référence-interne'
    | 'aucun-dossier'
    | 'absence-en-prose'
    | 'essentiel-ligne-longue'
    | 'lettre-maigre'
    | 'analyse-absente'
    | 'cadrage-présent'
    | 'collecte-dans-la-lettre'
  readonly message: string
}

export type AperçuAxe = {
  readonly numéro: number | null
  readonly titre: string
  readonly niveau: NiveauImpact | null
}

export type AperçuDossier = DossierOuvert & {
  /** `true` si au moins un passage de la lettre le nomme : sa page aura un extrait. */
  readonly nommé: boolean
}

export type Rapport = {
  readonly conforme: boolean
  readonly ruptures: readonly Rupture[]
  readonly avertissements: readonly Avertissement[]
  readonly aperçu: {
    readonly titre: string
    readonly rubriques: readonly string[]
    readonly axes: readonly AperçuAxe[]
    readonly dossiers: readonly AperçuDossier[]
    readonly cadrage: {
      readonly présent: boolean
      readonly clos: boolean
      readonly phraseDeClôture: boolean
    }
  }
}

/** Date à partir de laquelle une lettre est tenue au contrat de forme (page Lettres, étape 3). */
export const CONTRAT_DE_FORME_DEPUIS = '2026-09-11'

/** La phrase que chaque bloc de cadrage doit porter, verbatim, et l'adresse qu'elle donne. */
export const PHRASE_DE_CLÔTURE = 'Ces ajustements ne seront appliqués qu’après votre accord'
export const ADRESSE_DU_CADRAGE = 'agathe@signauxfaibles.io'

const RUBRIQUE_DES_AXES = 'actualites par axe'
const RUBRIQUE_DES_DOSSIERS = 'dossiers suivis'

/**
 * Le contrat de la lettre unique (docs/programme-lettre-unique.md, §2) : les
 * seuls endroits où ces nombres sont écrits. Le moteur les lit pour écrire son
 * prompt et ses messages de correction ; le validateur les applique.
 */
export const LETTRE_UNIQUE = {
  axesMin: 10,
  axesMax: 15,
  faitsParAxeMin: 2,
  faitsParAxeMax: 2,
  phrasesParFaitMax: 2,
  caractèresParFaitMax: 220,
  motsMax: 1800,
} as const

/** Les rubriques de conseils de publication : « Trois idées de posts », « Recommandation de post LinkedIn ». */
const MOTIF_DE_POST = /\bidees?\b.*\bposts?\b|\bposts?\b.*\b(linkedin|reseaux)\b|\brecommandations?\b.*\bposts?\b/

function clefDeNom(texte: string): string {
  return sansAccent(texte).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Le nom d'un axe, sans son numéro cerclé ni son niveau : « ③ Agences et studios — MOYEN » devient « Agences et studios ». */
function nomDAxe(titre: string): string {
  return titre.replace(/^[\s①-⑳\d.]+/, '').replace(/\s+[—–-]\s+(FORT|MOYEN|RAS|FAIBLE)\s*$/i, '').trim()
}

/** Une date lisible dans un fait : « 12 septembre », « 1er octobre 2026 », « 12/09/2026 ». */
const DATE_DANS_UN_FAIT =
  /\b\d{1,2}(?:er)?\s+(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/

function porteUneDate(texte: string): boolean {
  return DATE_DANS_UN_FAIT.test(sansAccent(texte))
}

function porteUneSource(bloc: Bloc): boolean {
  if (bloc.type !== 'paragraphe') return false
  return bloc.segments.some((s) => (s.lien !== null && s.lien.length > 0) || /https?:\/\//.test(s.texte))
}

/** Le texte d'un fait sans le lien de source qui le termine, « (… ) » compris. */
function texteSansLaSource(bloc: Bloc): string {
  if (bloc.type !== 'paragraphe') return texteDuBloc(bloc).trim()
  const segments = bloc.segments
  let i = segments.length - 1
  // La source en fin de fait : « ( lien , lien ) », un ou deux liens (ou plus) séparés par une virgule ou un point-virgule.
  if (i < 2 || !/^\s*\)\s*$/.test(segments[i]!.texte)) return segments.map((s) => s.texte).join('').trim()
  i -= 1
  let liens = 0
  while (i >= 0 && (segments[i]!.lien !== null || (liens > 0 && /^[\s,;]+$/.test(segments[i]!.texte)))) {
    if (segments[i]!.lien !== null) liens += 1
    i -= 1
  }
  const avant = segments[i]
  if (liens === 0 || !avant || !/\(\s*$/.test(avant.texte)) return segments.map((s) => s.texte).join('').trim()
  return (segments.slice(0, i).map((s) => s.texte).join('') + avant.texte.replace(/\(\s*$/, '')).trim()
}

function nombreDeMots(texte: string): number {
  return texte.split(/\s+/).filter((mot) => mot.length > 0).length
}

/**
 * Une édition n°1 porte au moins six faits hors encadrés (§6 du prompt de
 * génération des référentiels, révisé le 19 octobre 2026).
 *
 * Les éditions n°1 de La petite vitrine et de Suneido, les 18 et 19 octobre,
 * comptaient en moyenne 5 paragraphes de faits, contre 26 pour les lettres
 * régulières : leurs référentiels n'avaient plus de structure de note, et rien
 * ne le signalait. Le seuil ne vaut que pour l'édition n°1, la seule que le
 * client lit ligne à ligne et la seule dont le gabarit vient d'être écrit ; une
 * édition courante qui manque de faits relève du RAS motivé, pas d'une alerte.
 * C'est un avertissement : un fait ajouté pour le volume serait pire qu'un RAS.
 */
export const FAITS_MIN_ÉDITION_N1 = 6

/** Les rubriques de faits hors des axes : signaux et actualité des acteurs. */
function estRubriqueDeFaits(titre: string): boolean {
  const t = sansAccent(titre)
  return (t.startsWith('signaux') || t.includes('acteurs')) && !estTitreDeCadrage(titre)
}

/** Un bloc qui porte un fait : hors encadré, et avec du texte. */
function estBlocDeFait(bloc: Bloc): boolean {
  if (bloc.type !== 'paragraphe' && bloc.type !== 'liste' && bloc.type !== 'citation') return false
  return texteDuBloc(bloc).trim().length > 0
}

function nombreDeFaits(document: Document): number {
  let total = 0
  for (const rubrique of document.rubriques) {
    for (const axe of rubrique.axes) total += faitsDe(axe.blocs).filter(estBlocDeFait).length
    if (estRubriqueDeFaits(rubrique.titre)) {
      total += faitsDe(rubrique.introduction).filter(estBlocDeFait).length
    }
  }
  return total
}

/**
 * « L'essentiel » tient en huit lignes de 140 caractères au plus.
 *
 * Ces lignes sont reprises **telles quelles**, sans modèle de langage, par le
 * digest hebdomadaire de l'espace client Next Impact : une édition y occupe au
 * plus huit lignes. La limite ne peut donc être tenue qu'à la source, ici, avant
 * l'envoi. Une ligne est une puce (à puces ou numérotée) ou un paragraphe non
 * vide de l'introduction de la rubrique — ce qui précède son premier H2.
 */
export { ESSENTIEL_CARACTÈRES_MAX, ESSENTIEL_LIGNES_MAX }

/** Les lignes de « L'essentiel », au sens du digest : puces et paragraphes non vides. */
export function lignesDeLEssentiel(document: Document): string[] | null {
  const rubrique = document.rubriques.find((r) => estTitreDeLEssentiel(r.titre))
  if (!rubrique) return null

  const lignes: string[] = []
  for (const bloc of rubrique.introduction) {
    if (bloc.type === 'paragraphe') lignes.push(bloc.segments.map((s) => s.texte).join(''))
    else if (bloc.type === 'liste') {
      for (const élément of bloc.éléments) lignes.push(élément.map((s) => s.texte).join(''))
    }
  }
  return lignes.map((ligne) => ligne.trim()).filter((ligne) => ligne.length > 0)
}

/**
 * Les intitulés sous lesquels le rapport de collecte s'écrivait dans la lettre
 * (note de méthode en tête, listes du pied). Seul endroit où la liste est
 * écrite ; `lib/email/lettre.ts` en filtrait déjà une partie du courriel.
 */
const INTITULÉS_DE_COLLECTE = [
  'note de methode',
  'sources non ouvertes',
  'sources non consultees',
  'requetes non lancees',
  'methode et reserves',
  'ce qui a ete verifie',
  'sources verifiees',
  'sources ouvertes',
  'grille de collecte',
]

/**
 * Seule trace du rapport de collecte admise dans la lettre unique (demande du
 * 22 octobre 2026) : la rubrique « Sources non consultées », quand elle n'est
 * qu'une liste de liens, sans une ligne de rédaction.
 */
const RUBRIQUE_DES_SOURCES_IGNORÉES = 'sources non consultees'

function estUneListeDeLiens(blocs: readonly Bloc[]): boolean {
  const listes = blocs.filter((bloc) => bloc.type !== 'séparateur')
  return (
    listes.length > 0 &&
    listes.every(
      (bloc) =>
        bloc.type === 'liste' &&
        bloc.éléments.every((élément) => {
          const écrits = élément.filter((segment) => segment.texte.trim().length > 0)
          return écrits.length > 0 && écrits.every((segment) => segment.lien !== null)
        }),
    )
  )
}

function intitulésDeCollecte(document: Document, forme: Forme): string[] {
  const trouvés = new Set<string>()
  const examiner = (texte: string) => {
    const début = sansAccent(texte).replace(/^[^a-z0-9]+/, '').slice(0, 40)
    for (const intitulé of INTITULÉS_DE_COLLECTE) if (début.startsWith(intitulé)) trouvés.add(intitulé)
  }
  for (const bloc of document.préambule) examiner(texteDuBloc(bloc))
  for (const rubrique of document.rubriques) {
    const listeDeLiens =
      forme === 'unique' &&
      sansAccent(rubrique.titre).startsWith(RUBRIQUE_DES_SOURCES_IGNORÉES) &&
      rubrique.axes.length === 0 &&
      estUneListeDeLiens(rubrique.introduction)
    if (listeDeLiens) continue
    examiner(rubrique.titre)
    for (const bloc of rubrique.introduction) examiner(texteDuBloc(bloc))
    for (const axe of rubrique.axes) for (const bloc of axe.blocs) examiner(texteDuBloc(bloc))
  }
  return [...trouvés]
}

function texteDuBloc(bloc: Bloc): string {
  switch (bloc.type) {
    case 'paragraphe':
    case 'titre':
    case 'citation':
    case 'encadré':
      return bloc.segments.map((s) => s.texte).join('')
    case 'liste':
      return bloc.éléments.map((é) => é.map((s) => s.texte).join('')).join('\n')
    case 'tableau':
      return bloc.lignes
        .map((ligne) => ligne.map((cellule) => cellule.map((s) => s.texte).join('')).join(' '))
        .join('\n')
    case 'code':
      return bloc.texte
    case 'séparateur':
    case 'image':
      return ''
  }
}

function texteDuDocument(document: Document): string {
  const morceaux: string[] = document.préambule.map(texteDuBloc)
  for (const rubrique of document.rubriques) {
    morceaux.push(rubrique.titre, ...rubrique.introduction.map(texteDuBloc))
    for (const axe of rubrique.axes) morceaux.push(axe.titre, ...axe.blocs.map(texteDuBloc))
  }
  return morceaux.join('\n')
}

function texteBrutDUnBlocNotion(bloc: BlocNotion): string {
  const corps = bloc[bloc.type]
  const richText = (corps as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text
  return Array.isArray(richText) ? richText.map((m) => m.plain_text ?? '').join('') : ''
}

/**
 * Le trait horizontal ferme-t-il la rubrique de cadrage ?
 *
 * `construireDocument` ne le dit pas : sans trait, il pose tout dans
 * `document.cadrage` et la lettre perd son pied sans que rien ne le signale.
 * On relit donc les blocs bruts : entre le H1 de cadrage (même convention que
 * `construireDocument`, `estTitreDeCadrage`) et le H1 suivant (ou la fin), il
 * doit y avoir un `divider`.
 */
function cadrageClos(blocs: readonly BlocNotion[]): { présent: boolean; clos: boolean } {
  const début = blocs.findIndex(
    (bloc) => bloc.type === 'heading_1' && estTitreDeCadrage(texteBrutDUnBlocNotion(bloc)),
  )
  if (début === -1) return { présent: false, clos: false }

  for (let i = début + 1; i < blocs.length; i += 1) {
    const bloc = blocs[i]
    if (!bloc) break
    if (bloc.type === 'heading_1') break
    if (bloc.type === 'divider') return { présent: true, clos: true }
  }
  return { présent: true, clos: false }
}

export function contrôlerLaLettre(entrée: {
  readonly titre: string
  readonly blocs: readonly BlocNotion[]
  readonly dossiersBruts: string
  /** Le numéro de l'édition ; les contrôles de richesse ne visent que la n°1. */
  readonly numéro?: number | null
  /** La forme attendue ; `double` par défaut, le dispositif en service. */
  readonly forme?: Forme
}): Rapport {
  const ruptures: Rupture[] = []
  const avertissements: Avertissement[] = []
  const forme: Forme = entrée.forme ?? 'double'

  const document = construireDocument(entrée.blocs)
  const axes = axesDuDocument(document)
  const dossiers = lireDossiersOuverts(entrée.dossiersBruts)

  // ── Titre ────────────────────────────────────────────────────────────────
  if (entrée.titre.trim().length === 0) {
    ruptures.push({ code: 'titre-vide', portée: 'portail', message: 'la page n’a pas de titre.' })
  }

  // ── Axes : ce que contrat.ts constate au rendu, dit avant ────────────────
  for (const rupture of contrôlerLeContrat({ axes: axes.length, notes: 1, dossiers })) {
    ruptures.push({
      code: rupture.sorte === 'axes' ? 'aucun-axe' : 'dossier-sans-compteur',
      portée: 'portail',
      message: rupture.message,
    })
  }

  for (const axe of axes) {
    if (axe.niveau !== null) continue
    const enFaible = /\bFAIBLE\b/i.test(axe.titre)
    ruptures.push({
      code: enFaible ? 'niveau-faible' : 'axe-sans-niveau',
      portée: enFaible ? 'lettre' : 'portail',
      message: enFaible
        ? `l’axe « ${axe.titre} » porte le suffixe FAIBLE, qui n’existe pas : trois niveaux, FORT, MOYEN, RAS. Le portail l’affiche sans badge et ne le convertit jamais.`
        : `l’axe « ${axe.titre} » n’a pas de suffixe d’impact lisible (« — FORT », « — MOYEN », « — RAS ») : il s’affichera sans badge et ne comptera dans aucun tri.`,
    })
  }

  const rubriqueDesAxes = document.rubriques.find(
    (rubrique) => sansAccent(rubrique.titre) === RUBRIQUE_DES_AXES,
  )
  const axesAilleurs = document.rubriques
    .filter((rubrique) => rubrique !== rubriqueDesAxes)
    .flatMap((rubrique) => rubrique.axes)
  if (axes.length > 0 && axesAilleurs.length > 0) {
    avertissements.push({
      code: 'axes-hors-rubrique',
      message:
        `${axesAilleurs.length} axe(s) hors de la rubrique « Actualités par axe » : ` +
        axesAilleurs.map((axe) => `« ${axe.titre} »`).join(', ') +
        '. Le portail les lit quand même ; la page Lettres demande de les grouper sous ce seul titre de niveau 1.',
    })
  }

  // ── Absence et méthode : en encadré, jamais en prose ─────────────────────
  // Convention du 21 septembre 2026 (`estUnFait`) : ce qui est encadré n'est
  // pas un fait, et les écrans d'extraction ne le citent pas. Un axe en RAS
  // n'a, par définition, aucun fait à donner : tout ce que son corps porte
  // est un constat de vérification. Écrit en paragraphes, ce constat serait
  // rendu sur la page de l'axe et cité sur celle de chaque acteur qu'il nomme.
  for (const axe of axes) {
    if (axe.niveau !== 'RAS') continue
    if (faitsDe(axe.blocs).length === 0) continue
    avertissements.push({
      code: 'absence-en-prose',
      message:
        `l’axe « ${axe.titre} » est en RAS mais son corps n’est pas en encadré : ` +
        'le portail le rendra sur la page de l’axe et le citera sur la page de chaque acteur qu’il nomme, comme s’il s’agissait de faits. ' +
        'Le RAS motivé, les sources non ouvertes et les notes de méthode s’écrivent en encadré (callout).',
    })
  }

  // ── L'essentiel : huit lignes de 140 caractères, reprises par le digest ──
  const essentiel = lignesDeLEssentiel(document)
  if (essentiel === null || essentiel.length === 0) {
    ruptures.push({
      code: 'essentiel-absent',
      portée: 'lettre',
      message:
        essentiel === null
          ? 'aucune rubrique de niveau 1 « L’essentiel ». Elle ouvre chaque lettre et le digest hebdomadaire de l’espace client la reprend telle quelle : sans elle, l’édition n’y a aucune ligne.'
          : 'la rubrique « L’essentiel » est vide : ni puce ni paragraphe avant le titre suivant. Le digest hebdomadaire de l’espace client la reprend telle quelle.',
    })
  } else {
    if (essentiel.length > ESSENTIEL_LIGNES_MAX) {
      ruptures.push({
        code: 'essentiel-trop-long',
        portée: 'lettre',
        message:
          `la rubrique « L’essentiel » compte ${essentiel.length} lignes pour ${ESSENTIEL_LIGNES_MAX} au plus ` +
          '(une ligne = une puce ou un paragraphe non vide). Le digest hebdomadaire la reprend telle ' +
          'quelle, sans résumé : fusionner ou retirer des lignes, le détail a sa place dans les axes.',
      })
    }
    essentiel.forEach((ligne, i) => {
      if (ligne.length <= ESSENTIEL_CARACTÈRES_MAX) return
      avertissements.push({
        code: 'essentiel-ligne-longue',
        message:
          `la ligne ${i + 1} de « L’essentiel » fait ${ligne.length} caractères pour ${ESSENTIEL_CARACTÈRES_MAX} au plus : ` +
          `« ${écourter(ligne, 60)} ». Le digest la reprend telle quelle ; la resserrer.`,
      })
    })
  }

  // ── Dossiers : chacun est-il nommé quelque part dans la lettre ? ─────────
  const dossiersAperçu: AperçuDossier[] = dossiers.map((dossier) => {
    // Un dossier sans compteur a déjà sa rupture ; on ne cherche que les autres.
    const nommé = dossier.compteur !== null && mentionsDe(dossier.nom, document).length > 0
    return { ...dossier, nommé }
  })

  // contrat.ts ne conclut à un autre format que si AUCUN dossier n'a de
  // compteur. Ici on est avant l'envoi : un seul dossier illisible suffit à
  // faire disparaître un acteur, et on le nomme — sauf si la rupture globale
  // vient déjà de le dire pour tous.
  const ruptureGlobale = ruptures.some((r) => r.code === 'dossier-sans-compteur')
  for (const dossier of dossiers) {
    if (dossier.compteur === null && !ruptureGlobale) {
      ruptures.push({
        code: 'dossier-sans-compteur',
        portée: 'portail',
        message: `le dossier « ${dossier.nom} » n’a pas de compteur entre parenthèses : le format est « nom (compteur, précision) ».`,
      })
    }
  }

  for (const dossier of dossiersAperçu) {
    if (dossier.compteur !== null && !dossier.nommé) {
      avertissements.push({
        code: 'dossier-non-nommé',
        message: `le dossier « ${dossier.nom} » n’est nommé nulle part dans le corps : sa page n’aura aucun extrait. Le tableau du pied de lettre doit reprendre son nom exactement.`,
      })
    }
  }

  if (dossiers.length === 0) {
    avertissements.push({
      code: 'aucun-dossier',
      message: 'aucun dossier ouvert suivi : l’écran « Acteurs » restera vide pour cette édition.',
    })
  }

  // ── Cadrage : présent, clos par un trait, avec l'adresse ─────────────────
  const cadrage = cadrageClos(entrée.blocs)
  const texteDuCadrage = document.cadrage.map(texteDuBloc).join('\n')
  const phraseDeClôture =
    sansAccent(texteDuCadrage).includes(sansAccent(PHRASE_DE_CLÔTURE)) &&
    texteDuCadrage.includes(ADRESSE_DU_CADRAGE)

  // Décision du 22 octobre 2026 : le bloc de cadrage ne figure plus dans les
  // lettres client. Son absence n'est plus une rupture ; sa présence est signalée
  // tant que la tâche de production n'a pas été alignée, et s'il est là, il doit
  // rester clos et porter l'adresse, pour que le pied de lettre ne parte pas avec.
  if (cadrage.présent) {
    avertissements.push({
      code: 'cadrage-présent',
      message:
        'la lettre porte un bloc « Ajustements du cadrage » : depuis le 22 octobre 2026, les propositions de cadrage ne sont plus écrites dans la lettre client, elles vont dans la propriété « Amendements au référentiel ».',
    })
  }
  if (cadrage.présent && !cadrage.clos) {
    ruptures.push({
      code: 'cadrage-non-clos',
      portée: 'portail',
      message:
        'la rubrique de cadrage n’est pas suivie d’un trait horizontal (`---`) : tout ce qui la suit — dossiers suivis, sources vérifiées, prochaine parution — partirait avec le cadrage et disparaîtrait de la lettre.',
    })
  }

  if (cadrage.présent && !phraseDeClôture) {
    ruptures.push({
      code: 'cadrage-sans-adresse',
      portée: 'lettre',
      message:
        `le bloc de cadrage ne se termine pas par la phrase verbatim « ${PHRASE_DE_CLÔTURE}… » avec l’adresse ${ADRESSE_DU_CADRAGE}. C’est elle qui donne au lecteur le moyen de demander une modification.`,
    })
  }

  // ── Rapport de collecte : hors de la lettre client (22 octobre 2026) ─────
  const collecte = intitulésDeCollecte(document, forme)
  if (collecte.length > 0) {
    avertissements.push({
      code: 'collecte-dans-la-lettre',
      message:
        `la lettre porte des éléments du rapport de collecte (${collecte.map((i) => `« ${i} »`).join(', ')}) : depuis le 22 octobre 2026, la note de méthode, les sources ouvertes ou non, les requêtes et les réserves restent dans le compte rendu du run, jamais dans la lettre client.`,
    })
  }

  // ── Édition n°1 : la richesse que le gabarit du §6 demande ───────────────
  // La lettre unique est compacte par contrat : ni faits minimum ni rubrique d'analyse.
  if (entrée.numéro === 1 && forme !== 'unique') {
    const faits = nombreDeFaits(document)
    if (faits < FAITS_MIN_ÉDITION_N1) {
      avertissements.push({
        code: 'lettre-maigre',
        message:
          `l’édition n°1 ne porte que ${faits} paragraphe(s) de faits hors encadrés, pour ${FAITS_MIN_ÉDITION_N1} au moins. ` +
          'Vérifier que le §6 du référentiel a sa structure complète, que chaque requête type et chaque entité du corpus ont été requêtées, ' +
          'et élargir la fenêtre des familles vides (éléments de contexte datés). Jamais de remplissage.',
      })
    }
    if (!document.rubriques.some((rubrique) => sansAccent(rubrique.titre).includes('analyse'))) {
      avertissements.push({
        code: 'analyse-absente',
        message:
          'l’édition n°1 n’a pas de rubrique de niveau 1 « Analyse de la période » : le §6 du prompt de génération la prévoit, ' +
          'deux à trois paragraphes qui relient les faits de la période à ce qui menace ou porte l’activité du client.',
      })
    }
  }

  // ── Références internes : le référentiel n'est jamais communiqué ─────────
  const texte = texteDuDocument(document)
  const paragraphes = texte.match(/§\s?\d+/g)
  if (paragraphes && paragraphes.length > 0) {
    avertissements.push({
      code: 'référence-interne',
      message: `le corps cite une numérotation interne (${[...new Set(paragraphes)].join(', ')}) : aucun renvoi au référentiel ne doit apparaître dans une lettre.`,
    })
  }

  if (forme === 'unique') contrôlerLaFormeUnique(document, axes, dossiers, ruptures, avertissements)

  return {
    conforme: ruptures.length === 0,
    ruptures,
    avertissements,
    aperçu: {
      titre: entrée.titre,
      rubriques: document.rubriques.map((rubrique) => rubrique.titre),
      axes: axes.map((axe) => ({ numéro: axe.numéro, titre: axe.titre, niveau: axe.niveau })),
      dossiers: dossiersAperçu,
      cadrage: { ...cadrage, phraseDeClôture },
    },
  }
}

/**
 * Le contrat de la lettre unique, par-dessus le contrat commun.
 *
 * Aucun humain ne relit avant l'envoi : ce qui n'était qu'un avertissement
 * quand une relectrice pouvait corriger devient une rupture, que le moteur
 * corrige lui-même sur message de reprise. Les seuils sont dans `LETTRE_UNIQUE`.
 */
function contrôlerLaFormeUnique(
  document: Document,
  axes: ReturnType<typeof axesDuDocument>,
  dossiers: readonly DossierOuvert[],
  ruptures: Rupture[],
  avertissements: Avertissement[],
): void {
  const { axesMin, axesMax, faitsParAxeMin, faitsParAxeMax, phrasesParFaitMax, caractèresParFaitMax, motsMax } = LETTRE_UNIQUE

  // ── Dix à quinze axes ────────────────────────────────────────────────────
  if (axes.length > 0 && axes.length < axesMin) {
    ruptures.push({
      code: 'axes-trop-peu',
      portée: 'portail',
      message: `${axes.length} axe(s) pour ${axesMin} au moins : la lettre unique couvre tout le spectre du référentiel, un axe par thématique, en RAS s’il le faut ; les organisations se suivent dans « Dossiers suivis », pas dans les axes.`,
    })
  }
  if (axes.length > axesMax) {
    ruptures.push({
      code: 'axes-trop-nombreux',
      portée: 'portail',
      message: `${axes.length} axes pour ${axesMax} au plus : regrouper les thèmes voisins, la lettre doit se lire en cinq minutes.`,
    })
  }

  // ── Chaque axe : un à trois faits courts, datés et sourcés ; un RAS court ─
  for (const axe of axes) {
    const faits = faitsDe(axe.blocs).filter(estBlocDeFait)
    if (axe.niveau === 'RAS') {
      // Un axe sans fait n'écrit rien d'autre que « RAS » (demande du 22 octobre 2026).
      const encadrés = axe.blocs.filter((bloc) => bloc.type === 'encadré')
      const écrit = encadrés.map(texteDuBloc).join(' ').trim()
      if (écrit.length > 0 && sansAccent(écrit).replace(/[^a-z]/g, '') !== 'ras') {
        ruptures.push({
          code: 'ras-trop-long',
          portée: 'lettre',
          message: `l’axe « ${axe.titre} » est en RAS et son encadré dit « ${écourter(écrit, 60)} » : un axe sans fait n’écrit que « RAS », sans phrase ni détail de ce qui a été vérifié.`,
        })
      }
      continue
    }
    if (faits.length < faitsParAxeMin) {
      ruptures.push({
        code: 'axe-peu-fourni',
        portée: 'lettre',
        message: `l’axe « ${axe.titre} » porte ${faits.length} fait(s) pour ${faitsParAxeMin} au moins : ajouter un second fait de la période, ou un élément de contexte daté tiré du dossier (contexte: true) ; sans second fait sourçable, l’axe passe en RAS.`,
      })
    }
    if (faits.length > faitsParAxeMax) {
      ruptures.push({
        code: 'axe-trop-fourni',
        portée: 'lettre',
        message: `l’axe « ${axe.titre} » porte ${faits.length} faits pour ${faitsParAxeMax} au plus : garder les plus lourds de conséquence, le reste va dans les dossiers suivis ou attend la parution suivante.`,
      })
    }
    faits.forEach((fait, i) => {
      // La source entre parenthèses en fin de fait n'est ni une phrase ni du texte à compter.
      const texte = texteSansLaSource(fait).replace(/\s*\(élément de contexte, non nouveau\)\s*$/, '')
      const phrases = fait.type === 'paragraphe' ? phrasesDe([{ texte, gras: false, italique: false, code: false, barré: false, lien: null }]).length : 1
      if (texte.length > caractèresParFaitMax || phrases > phrasesParFaitMax) {
        ruptures.push({
          code: 'fait-trop-long',
          portée: 'lettre',
          message: `le fait ${i + 1} de l’axe « ${axe.titre} » fait ${texte.length} caractères et ${phrases} phrase(s), pour ${caractèresParFaitMax} caractères et ${phrasesParFaitMax} phrases au plus : « ${écourter(texte, 60)} ».`,
        })
      }
      if (!porteUneDate(texte)) {
        ruptures.push({
          code: 'fait-sans-date',
          portée: 'lettre',
          message: `le fait ${i + 1} de l’axe « ${axe.titre} » ne porte aucune date lisible (jour et mois) : « ${écourter(texte, 60)} ». Un fait non daté n’est pas un fait de la période.`,
        })
      }
      if (!porteUneSource(fait)) {
        ruptures.push({
          code: 'fait-sans-source',
          portée: 'lettre',
          message: `le fait ${i + 1} de l’axe « ${axe.titre} » ne porte aucun lien vers sa source : « ${écourter(texte, 60)} ». Chaque fait cite l’URL ouverte pendant le run.`,
        })
      }
    })
  }

  // ── Pas de recommandation de post dans la lettre ─────────────────────────
  const intitulés = [...document.rubriques.map((rubrique) => rubrique.titre), ...axes.map((axe) => axe.titre)]
  const posts = intitulés.filter((titre) => MOTIF_DE_POST.test(sansAccent(titre)))
  if (posts.length > 0) {
    ruptures.push({
      code: 'recommandation-de-post',
      portée: 'lettre',
      message: `la lettre porte une rubrique de recommandation de posts (${posts.map((titre) => `« ${écourter(titre, 50)} »`).join(', ')}) : la lettre informe, elle ne propose pas de contenu à publier.`,
    })
  }

  // ── Un axe est une thématique, un acteur est une organisation ────────────
  const nomsDeDossiers = new Set(dossiers.map((dossier) => clefDeNom(dossier.nom)))
  for (const axe of axes) {
    if (nomsDeDossiers.has(clefDeNom(nomDAxe(axe.titre)))) {
      ruptures.push({
        code: 'axe-est-un-acteur',
        portée: 'lettre',
        message: `l’axe « ${axe.titre} » porte le nom d’un dossier suivi : un axe est une thématique, un acteur est une organisation et se suit dans « Dossiers suivis ». Nommer l’axe par le sujet, pas par l’acteur.`,
      })
    }
  }

  // ── La rubrique des dossiers suivis, quand il y a des dossiers ───────────
  const rubriqueDesDossiers = document.rubriques.find((rubrique) => sansAccent(rubrique.titre).startsWith(RUBRIQUE_DES_DOSSIERS))
  if (dossiers.length > 0 && !rubriqueDesDossiers) {
    ruptures.push({
      code: 'dossiers-sans-rubrique',
      portée: 'lettre',
      message: 'la lettre n’a pas de rubrique de niveau 1 « Dossiers suivis » : c’est là que chaque dossier ouvert est nommé, en un paragraphe, exactement comme la propriété le porte.',
    })
  }

  // ── Longueur de la lettre entière ────────────────────────────────────────
  const mots = nombreDeMots(texteDuDocument(document))
  if (mots > motsMax) {
    ruptures.push({
      code: 'lettre-trop-longue',
      portée: 'lettre',
      message: `la lettre fait ${mots} mots pour ${motsMax} au plus : resserrer les faits, le lecteur la parcourt en cinq minutes.`,
    })
  }

  // ── Ce qui n'était qu'un avertissement devient une rupture ───────────────
  const élevés = new Set<Avertissement['code']>(['absence-en-prose', 'cadrage-présent', 'collecte-dans-la-lettre', 'dossier-non-nommé', 'essentiel-ligne-longue'])
  for (let i = avertissements.length - 1; i >= 0; i -= 1) {
    const avertissement = avertissements[i]
    if (!avertissement || !élevés.has(avertissement.code)) continue
    avertissements.splice(i, 1)
    ruptures.push({ code: avertissement.code as CodeDeFormeUnique, portée: 'lettre', message: avertissement.message })
  }
}
