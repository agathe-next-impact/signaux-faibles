import type { CléDeDémonstration } from '@/lib/domaine/demonstration'
import { détacherLeNuméro } from '@/lib/domaine/impact'
import { DÉMONSTRATIONS, type Démonstration } from '@/lib/vitrine/demonstrations'

/**
 * Les **deux lettres de la semaine** d'une organisation de démonstration, telles
 * que le dispositif en service les envoie à chaque client (8 novembre 2026,
 * demande de l'opératrice : « Lire la dernière lettre » ne propose que la
 * dernière lettre écosystème et la dernière lettre concurrentielle).
 *
 * L'espace de démonstration garde sa série de lettres uniques ; ici, la
 * dernière lettre unique de chaque organisation est **répartie** en deux
 * lettres par la grille stratégique de la démonstration : un axe placé sous
 * une dimension PESTEL va à la lettre écosystème, un axe placé sous une force
 * de Porter (clients, concurrents, fournisseurs) à la lettre concurrentielle ;
 * un axe que la grille ne cadre pas va à l'écosystème. Le texte des axes est
 * repris mot pour mot et les axes sont renumérotés dans chaque lettre ; ce qui
 * dépend de la lettre entière (l'essentiel, l'action de la semaine, les
 * dossiers suivis et leur compteur) est écrit ici pour chacune. Chaque lettre
 * passe le lint du dispositif en service (`forme: 'double'`,
 * `tests/vitrine.lettres-par-veille.test.ts`). Rien n'est lu : tout vient du
 * code, et les deux lettres portent le numéro de la lettre unique dont elles
 * viennent.
 */
export type VeilleDeDémonstration = 'ecosysteme' | 'concurrentielle'

export const VEILLES_DE_DÉMONSTRATION: readonly VeilleDeDémonstration[] = ['ecosysteme', 'concurrentielle']

/** Le nom de la veille, tel qu'il paraît en surtitre du courriel et dans l'objet. */
export const NOM_DE_LA_VEILLE: Readonly<Record<VeilleDeDémonstration, string>> = {
  ecosysteme: 'Veille écosystème',
  concurrentielle: 'Veille concurrentielle',
}

/** L'adjectif de la veille, pour un libellé de lien : « la lettre écosystème ». */
export const QUALIFICATIF_DE_LA_VEILLE: Readonly<Record<VeilleDeDémonstration, string>> = {
  ecosysteme: 'écosystème',
  concurrentielle: 'concurrentielle',
}

export function estUneVeilleDeDémonstration(valeur: string): valeur is VeilleDeDémonstration {
  return (VEILLES_DE_DÉMONSTRATION as readonly string[]).includes(valeur)
}

export type LettreParVeille = {
  readonly veille: VeilleDeDémonstration
  readonly nomDeLaVeille: string
  readonly numéro: number
  readonly dateÉdition: string
  readonly périodeCouverte: string
  readonly actionDeLaSemaine: string
  readonly dossiers: string
  readonly markdown: string
  /** Les numéros, dans la lettre unique, des axes repris. */
  readonly axesRepris: readonly number[]
}

type EntêteDeLettre = {
  readonly essentiel: readonly string[]
  readonly actionDeLaSemaine: string
  readonly dossiers: string
  readonly dossiersSuivis: readonly string[]
}

// ── Ce qui dépend de la lettre entière, écrit pour chacune ──────────────────

const ENTÊTES: Readonly<Record<CléDeDémonstration, Readonly<Record<VeilleDeDémonstration, EntêteDeLettre>>>> = {
  conseil: {
    ecosysteme: {
      essentiel: [
        "Le Département de l'Ardaine reporte au 9 décembre le vote de son budget 2027.",
        'Le seuil des marchés sans publicité préalable passe à 60 000 euros, selon un décret fictif du 13 octobre.',
        "Trois collectivités de la région lancent des consultations sur l'intelligence artificielle dans les services.",
        "La Région Val-d'Ardaine finance jusqu'à 70 % des études de planification écologique des communes.",
        '62 % des communes de plus de 10 000 habitants peinent à recruter des chefs de projet.',
        "Le salon des acteurs publics de Valrive tient un atelier sur les achats de conseil le 26 novembre.",
      ],
      actionDeLaSemaine:
        "Candidater avant le 31 octobre à l'appel à intervenants des rencontres régionales des directeurs généraux des services.",
      dossiers:
        "Département de l'Ardaine (0, budget reporté au 9 décembre) · fonds d'ingénierie (0, études financées à 70 %) · salon des acteurs publics (0, atelier achats le 26 novembre)",
      dossiersSuivis: [
        "Le Département de l'Ardaine votera son budget 2027 le 9 décembre. Les études nouvelles attendront ce vote.",
        "Le fonds d'ingénierie de la Région est ouvert depuis le 14 octobre. Les communes pourront financer les études qu'elles repoussaient.",
        'Le salon des acteurs publics de Valrive se tient les 26 et 27 novembre. Les acheteurs de Valrive y seront avant la remise des offres.',
      ],
    },
    concurrentielle: {
      essentiel: [
        "La Métropole de Valrive ouvre le 14 octobre un accord-cadre de conseil de quatre ans, candidatures jusqu'au 6 novembre.",
        "Cap Territoires lève 3 millions d'euros le 16 octobre et ouvre une agence à Lyon.",
        "Orbis Public nomme le 15 octobre un nouveau directeur général, venu d'un grand cabinet national.",
        'Préfigure, cabinet national, décroche une première mission à 30 kilomètres de Lyon.',
        "Une centrale d'achat nationale ouvre un catalogue de missions courtes de conseil, sans mise en concurrence.",
        "Atelier Civique, votre partenaire de concertation, n'a rien publié depuis le 30 septembre.",
      ],
      actionDeLaSemaine:
        'Déposer avant le 6 novembre la candidature à l’accord-cadre Valrive, lot « conduite du changement ».',
      dossiers:
        "accord-cadre Valrive (0, candidatures jusqu'au 6 novembre) · Cap Territoires (0, levée de fonds et agence lyonnaise) · Orbis Public (0, nouveau directeur général) · schéma numérique Saint-Aubert (0, consultation ouverte) · centrale d'achat Ardaine (1, renouvellement en 2027) · Atelier Civique (2, aucune nouvelle)",
      dossiersSuivis: [
        "L'accord-cadre Valrive est ouvert depuis le 14 octobre, avec des candidatures jusqu'au 6 novembre.",
        'Cap Territoires a annoncé une levée de fonds et une agence lyonnaise le 16 octobre.',
        'Orbis Public change de directeur général à compter du 2 novembre. Son arrivée devrait réorienter le cabinet vers les achats publics.',
        "Le schéma numérique Saint-Aubert est en consultation jusqu'au 14 novembre. Le cahier des charges demande une référence communale récente.",
        "La centrale d'achat Ardaine renouvellera son marché de conseil en 2027. Aucune date de consultation n'est encore publiée.",
        'Atelier Civique reste silencieux depuis deux semaines. Sa réponse conditionne votre offre conjointe sur Valrive.',
      ],
    },
  },
  pme: {
    ecosysteme: {
      essentiel: [
        "L'appel à projets Industrie durable finance jusqu'à 30 % des machines, clôture le 28 novembre.",
        "Certéo publie ses dates d'audit EN 9100 du premier trimestre, à partir du 12 janvier.",
        "340 postes d'usineur restent non pourvus dans le département, selon l'observatoire fictif des métiers.",
        'Un diagnostic énergétique gratuit est ouvert aux sites de moins de 250 salariés.',
        "Les délais de livraison des centres d'usinage cinq axes passent de neuf à cinq mois.",
        'Un programme de drones de surveillance réserve une part de sa production aux PME régionales.',
      ],
      actionDeLaSemaine:
        "Réunir avant le 28 novembre les trois devis de machines demandés par l'appel à projets Industrie durable.",
      dossiers:
        "appel à projets Industrie durable (1, clôture le 28 novembre) · certification EN 9100 (2, audit en janvier) · formation de régleurs (0, douze places en alternance)",
      dossiersSuivis: [
        "L'appel à projets Industrie durable reste ouvert jusqu'au 28 novembre. Le dossier demande trois devis de machines.",
        "La certification EN 9100 sera auditée en janvier. Les nouvelles règles de traçabilité s'appliqueront à l'audit suivant.",
        'La formation de régleurs du lycée professionnel ouvre douze places en alternance. Deux de vos postes ouverts correspondent à ce profil.',
      ],
    },
    concurrentielle: {
      essentiel: [
        'Aérolys relève ses cadences de 15 % pour 2027 et qualifie trois nouveaux sous-traitants en usinage.',
        'Usinage Delmas, concurrent direct, est placé en redressement judiciaire le 16 octobre.',
        'Ferrovia Systèmes remporte une commande de 40 rames de tramway, livrables à partir de 2028.',
        'Précimeca investit dans une ligne de rectification qui vise vos clients aéronautiques.',
        "Le prix de l'électricité industrielle recule de 6 % sur le mois, selon l'indice régional fictif.",
        "Hélivale reporte de six mois son programme d'hélicoptère léger.",
        "Le contrat régional d'électricité à prix fixe rouvre jusqu'au 30 novembre.",
      ],
      actionDeLaSemaine:
        'Demander à Aérolys avant le 31 octobre ses volumes 2027 pour les pièces de train d’atterrissage.',
      dossiers:
        'Aérolys (0, cadences relevées de 15 %) · Usinage Delmas (0, redressement judiciaire) · Ferrovia Systèmes (0, commande de 40 rames) · Précimeca (0, nouvelle ligne de rectification) · Hélivale (0, programme reporté de six mois)',
      dossiersSuivis: [
        'Aérolys relève ses cadences et qualifie de nouveaux sous-traitants avant le 20 novembre. Votre réponse doit chiffrer la capacité que vous pouvez ajouter en 2027.',
        'Usinage Delmas est en redressement judiciaire, offres de reprise attendues avant le 4 décembre. Ses deux centres cinq axes et ses contrats ferroviaires peuvent être repris séparément.',
        'Ferrovia Systèmes consultera ses fournisseurs de pièces usinées du 3 au 28 novembre. La première livraison de pièces est attendue au second semestre 2027.',
        "Précimeca entre sur l'aéronautique avec sa nouvelle ligne de rectification. Elle sera en service au printemps.",
        "Hélivale a reporté de six mois son programme d'hélicoptère léger. Vos commandes 2027 sur ce programme sont décalées d'autant.",
      ],
    },
  },
  ess: {
    ecosysteme: {
      essentiel: [
        "L'enveloppe régionale des aides au poste 2027 progresse de 5 %, selon la préfecture fictive du 15 octobre.",
        "L'appel à projets Réemploi solidaire ouvre le 13 octobre : jusqu'à 80 000 euros par structure.",
        "L'éco-organisme textile fictif relève de 10 % son soutien au tri à partir de janvier.",
        'La Fondation Horizon commun réunit son comité de sélection le 5 novembre.',
        "La fondation Terres partagées finance l'achat de véhicules, jusqu'à 30 000 euros.",
        "Les agréments d'insertion deviennent valables trois ans, selon une instruction fictive du 13 octobre.",
      ],
      actionDeLaSemaine:
        'Déposer avant le 14 novembre le dossier de l’appel à projets Réemploi solidaire, volet investissement.',
      dossiers:
        'aides au poste 2027 (0, enveloppe régionale en hausse) · appel à projets Réemploi solidaire (0, clôture le 14 novembre) · Fondation Horizon commun (1, comité le 5 novembre) · prêt participatif territorial (2, dossier en instruction)',
      dossiersSuivis: [
        "Les aides au poste 2027 progressent de 5 %, répartition attendue en décembre. Votre demande d'extension à quatorze postes peut être présentée au dialogue de gestion.",
        "L'appel à projets Réemploi solidaire ferme le 14 novembre. Le dossier demande un plan de financement sur trois ans et deux devis.",
        'La Fondation Horizon commun examinera votre demande le 5 novembre. La réponse est attendue avant la fin du mois.',
        'Le prêt participatif territorial est toujours en instruction. Il sera examiné à la séance de décembre.',
      ],
    },
    concurrentielle: {
      essentiel: [
        'La Métropole de Valrive publie un marché réservé de collecte textile, réponses avant le 21 novembre.',
        'Le Fil vert ouvre une seconde boutique à trois kilomètres de la vôtre.',
        "Le Département de l'Ardaine réservera 10 % de ses marchés d'entretien à l'insertion à partir de 2027.",
        'Un réseau de recycleries régionales ouvre en mars une plateforme commune de vente en ligne.',
      ],
      actionDeLaSemaine: 'Répondre avant le 21 novembre au marché réservé de collecte textile de la Métropole de Valrive.',
      dossiers: 'marché réservé Valrive (0, réponses avant le 21 novembre) · Le Fil vert (0, seconde boutique)',
      dossiersSuivis: [
        'Le marché réservé Valrive attend les réponses avant le 21 novembre. Il porte sur quarante points de collecte pendant trois ans.',
        "Le Fil vert ouvre une seconde boutique à Valrive. Ses prix d'appel sont inférieurs aux vôtres de 20 %.",
      ],
    },
  },
}

// ── Répartition des axes de la lettre unique ────────────────────────────────

const TITRE_DES_AXES = '# Actualités par axe'
const CERCLÉS = [...'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳']

type AxeDeLaLettre = { readonly numéro: number | null; readonly markdown: string }

/** Les axes de la rubrique « Actualités par axe », chacun avec son numéro cerclé et son texte entier. */
function axesDeLaLettreUnique(markdown: string): AxeDeLaLettre[] {
  const rubriques = markdown.split(/\n(?=# )/)
  const rubrique = rubriques.find((r) => r.startsWith(TITRE_DES_AXES))
  if (!rubrique) return []
  const sections = rubrique.split(/\n(?=## )/).slice(1)
  return sections.map((section) => {
    const titre = section.split('\n', 1)[0]?.replace(/^##\s*/, '') ?? ''
    return { numéro: détacherLeNuméro(titre).numéro, markdown: section.trimEnd() }
  })
}

function veilleDeLAxe(démonstration: Démonstration, numéro: number | null): VeilleDeDémonstration {
  const cadre = numéro === null ? undefined : démonstration.grille.axes[numéro]
  return cadre && 'porter' in cadre ? 'concurrentielle' : 'ecosysteme'
}

/** Le même axe, renuméroté à son rang dans la lettre où il est repris. */
function renuméroter(axe: AxeDeLaLettre, rang: number): string {
  const cerclé = CERCLÉS[rang - 1] ?? `${rang}.`
  const [titre = '', ...reste] = axe.markdown.split('\n')
  const sansNuméro = détacherLeNuméro(titre.replace(/^##\s*/, '')).reste
  return [`## ${cerclé} ${sansNuméro}`, ...reste].join('\n')
}

function démonstration(clé: CléDeDémonstration): Démonstration {
  const d = DÉMONSTRATIONS.find((d) => d.clé === clé)
  if (!d) throw new Error(`démonstration « ${clé} » absente`)
  return d
}

/** La dernière lettre d'une organisation de démonstration pour une veille. */
export function lettreDeLaSemaine(clé: CléDeDémonstration, veille: VeilleDeDémonstration): LettreParVeille {
  const d = démonstration(clé)
  const entête = ENTÊTES[clé][veille]
  const axes = axesDeLaLettreUnique(d.markdown).filter((axe) => veilleDeLAxe(d, axe.numéro) === veille)
  const markdown = [
    "# L'essentiel",
    '',
    entête.essentiel.map((ligne) => `- ${ligne}`).join('\n'),
    '',
    TITRE_DES_AXES,
    '',
    axes.map((axe, i) => renuméroter(axe, i + 1)).join('\n\n'),
    '',
    '# Dossiers suivis',
    '',
    entête.dossiersSuivis.join('\n\n'),
    '',
  ].join('\n')
  return {
    veille,
    nomDeLaVeille: NOM_DE_LA_VEILLE[veille],
    numéro: d.numéro,
    dateÉdition: d.dateÉdition,
    périodeCouverte: d.périodeCouverte,
    actionDeLaSemaine: entête.actionDeLaSemaine,
    dossiers: entête.dossiers,
    markdown,
    axesRepris: axes.map((axe) => axe.numéro ?? 0),
  }
}

/** Le titre d'une lettre, qui est aussi l'objet de son courriel. */
export function titreDeLaLettre(clé: CléDeDémonstration, lettre: LettreParVeille): string {
  return `${lettre.nomDeLaVeille} de ${démonstration(clé).organisation}, édition n° ${lettre.numéro}`
}
