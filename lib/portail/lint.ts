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
import type { NiveauImpact } from '@/lib/domaine/impact'
import { contrôlerLeContrat } from '@/lib/portail/contrat'

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

export type Rupture = {
  readonly code:
    | 'aucun-axe'
    | 'axe-sans-niveau'
    | 'niveau-faible'
    | 'dossier-sans-compteur'
    | 'cadrage-absent'
    | 'cadrage-non-clos'
    | 'cadrage-sans-adresse'
    | 'titre-vide'
    | 'essentiel-absent'
    | 'essentiel-trop-long'
  readonly portée: Portée
  readonly message: string
}

export type Avertissement = {
  readonly code:
    | 'dossier-non-nommé'
    | 'axes-hors-rubrique'
    | 'référence-interne'
    | 'aucun-dossier'
    | 'essentiel-ligne-longue'
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

/**
 * « L'essentiel » tient en huit lignes de 140 caractères au plus.
 *
 * Ces lignes sont reprises **telles quelles**, sans modèle de langage, par le
 * digest hebdomadaire de l'espace client Next Impact : une édition y occupe au
 * plus huit lignes. La limite ne peut donc être tenue qu'à la source, ici, avant
 * l'envoi. Une ligne est une puce (à puces ou numérotée) ou un paragraphe non
 * vide de l'introduction de la rubrique — ce qui précède son premier H2.
 */
export const ESSENTIEL_LIGNES_MAX = 8
export const ESSENTIEL_CARACTÈRES_MAX = 140

/** « L'essentiel », « L’essentiel », « Essentiel », « L'essentiel de la semaine ». */
function estRubriqueEssentielle(titre: string): boolean {
  return /^(l')?essentiel\b/.test(sansAccent(titre).trim())
}

/** Les lignes de « L'essentiel », au sens du digest : puces et paragraphes non vides. */
export function lignesDeLEssentiel(document: Document): string[] | null {
  const rubrique = document.rubriques.find((r) => estRubriqueEssentielle(r.titre))
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

function sansAccent(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('’', "'")
    .toLowerCase()
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
 * On relit donc les blocs bruts : entre le H1 qui contient « cadrage » et le
 * H1 suivant (ou la fin), il doit y avoir un `divider`.
 */
function cadrageClos(blocs: readonly BlocNotion[]): { présent: boolean; clos: boolean } {
  const début = blocs.findIndex(
    (bloc) => bloc.type === 'heading_1' && sansAccent(texteBrutDUnBlocNotion(bloc)).includes('cadrage'),
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
}): Rapport {
  const ruptures: Rupture[] = []
  const avertissements: Avertissement[] = []

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

  if (!cadrage.présent) {
    ruptures.push({
      code: 'cadrage-absent',
      portée: 'portail',
      message:
        'aucune rubrique de niveau 1 dont le titre contient « cadrage ». Le bloc « Ajustements du cadrage de cette veille » est obligatoire à chaque édition, même vide ; sans lui, l’écran Cadrage est vide et le lecteur n’a pas l’adresse.',
    })
  } else if (!cadrage.clos) {
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

  // ── Références internes : le référentiel n'est jamais communiqué ─────────
  const texte = texteDuDocument(document)
  const paragraphes = texte.match(/§\s?\d+/g)
  if (paragraphes && paragraphes.length > 0) {
    avertissements.push({
      code: 'référence-interne',
      message: `le corps cite une numérotation interne (${[...new Set(paragraphes)].join(', ')}) : aucun renvoi au référentiel ne doit apparaître dans une lettre.`,
    })
  }

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
