/**
 * Ce que l'écran « Concurrents » montre, et sous quel nom (7 novembre 2026).
 *
 * Dans la grille, une entité de la veille `concurrentiel` est ce que la veille
 * suit nommément sur le marché. Pour la plupart des organisations, ce sont ses
 * concurrents, et eux seuls depuis le 10 novembre 2026 : un grand compte, un
 * client ou un opérateur public que la veille concurrentielle nomme se déclare
 * en `ecosysteme` dans la grille, pour ne figurer ni à l'écran « Concurrents »
 * ni dans le benchmark des indicateurs (`entitésDuBenchmark`). Pour une organisation qui n'a pas de concurrents à suivre, un
 * établissement consulaire par exemple, l'onboarding adapte cette veille aux
 * **mouvements des entreprises de son territoire** (la CCI du Cantal, référentiel
 * du 2 novembre 2026, contexte client du 21 octobre qui exclut toute veille
 * concurrentielle sur la CCI) : les mêmes entités sont alors ses ressortissants,
 * et les appeler « concurrents » est faux.
 *
 * Le réglage est porté par l'organisation (`organisations.sujets_du_marche`,
 * migration 0024), posé par l'opératrice, `concurrents` par défaut. Il ne change
 * ni la grille, ni les étiquettes, ni les adresses (`/[slug]/concurrents`
 * reste l'adresse de l'écran) : seulement les mots de l'espace.
 */

export const SUJETS_DU_MARCHÉ = ['concurrents', 'entreprises'] as const
export type SujetsDuMarché = (typeof SUJETS_DU_MARCHÉ)[number]

export type VocabulaireDuMarché = {
  /** Le nom de l'écran au rail et sur la vue d'ensemble. */
  readonly écran: string
  readonly écranCourt: string
  /** Le titre de l'écran. */
  readonly titre: string
  /** « 3 concurrents suivis », « 1 entreprise suivie ». */
  readonly suivis: (n: number) => string
  /** Le titre de la liste, et celui de la liste repliée. */
  readonly liste: string
  readonly autres: string
  /** Le début de la phrase d'introduction : « Les concurrents que votre veille suit ». */
  readonly introduction: string
  /** « Aucun n'a changé de case », « Aucune n'a changé de case ». */
  readonly aucunNAChangé: string
  readonly dossiers: string
  /** Le surtitre d'une fiche. */
  readonly fiche: string
  readonly retour: string
  /** Le lien vers l'écran depuis un autre écran. */
  readonly voir: string
  /** Le titre de la section du corpus, et sa phrase sans entité. */
  readonly corpus: string
  readonly aucun: string
  /** Ce qu'est une entité de cette veille, sur sa fiche de présentation. */
  readonly définition: string
  /** La mention de la case « Acteurs » sur la vue d'ensemble, sans synthèse. */
  readonly horsDeLÉcran: string
  /** Le nom commun, au singulier et au pluriel, pour un compte. */
  readonly un: string
  readonly des: string
  /** Le participe accordé, pour « 28 suivies ». */
  readonly suivi: string
  /** « Les concurrents ont leur écran. » sur « Acteurs ». */
  readonly leurÉcran: string
}

const pluriel = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`

export const VOCABULAIRES_DU_MARCHÉ: Readonly<Record<SujetsDuMarché, VocabulaireDuMarché>> = {
  concurrents: {
    écran: 'Concurrents',
    écranCourt: 'Concurr.',
    titre: 'Qui vous dispute vos clients',
    suivis: (n) => pluriel(n, 'concurrent suivi', 'concurrents suivis'),
    liste: 'Les concurrents suivis',
    autres: 'Les autres concurrents suivis',
    introduction: 'Les concurrents que votre veille suit',
    aucunNAChangé: 'Aucun n’a changé de case',
    dossiers: 'Dossiers ouverts sur un concurrent',
    fiche: 'concurrent suivi',
    retour: 'Retour aux concurrents',
    voir: 'Voir les concurrents et leur carte',
    corpus: 'Concurrents suivis',
    aucun: 'Aucun concurrent nommé dans votre veille.',
    définition: 'Un concurrent : votre veille concurrentielle le suit nommément.',
    horsDeLÉcran: 'hors concurrents',
    un: 'concurrent',
    des: 'concurrents',
    suivi: 'suivi',
    leurÉcran: 'Les concurrents ont leur écran.',
  },
  entreprises: {
    écran: 'Entreprises suivies',
    écranCourt: 'Entrepr.',
    titre: 'Les entreprises qui bougent sur votre territoire',
    suivis: (n) => pluriel(n, 'entreprise suivie', 'entreprises suivies'),
    liste: 'Les entreprises suivies',
    autres: 'Les autres entreprises suivies',
    introduction: 'Les entreprises que votre veille suit',
    aucunNAChangé: 'Aucune n’a changé de case',
    dossiers: 'Dossiers ouverts sur une entreprise',
    fiche: 'entreprise suivie',
    retour: 'Retour aux entreprises suivies',
    voir: 'Voir les entreprises suivies et leur carte',
    corpus: 'Entreprises suivies',
    aucun: 'Aucune entreprise nommée dans votre veille.',
    définition: 'Une entreprise de votre territoire : votre veille des mouvements la suit nommément.',
    horsDeLÉcran: 'hors entreprises suivies',
    un: 'entreprise',
    des: 'entreprises',
    suivi: 'suivie',
    leurÉcran: 'Les entreprises suivies ont leur écran.',
  },
}

/** Le vocabulaire d'un réglage lu en base ; une valeur inconnue vaut le défaut. */
export function vocabulaireDuMarché(sujets: string | null | undefined): VocabulaireDuMarché {
  return sujets === 'entreprises' ? VOCABULAIRES_DU_MARCHÉ.entreprises : VOCABULAIRES_DU_MARCHÉ.concurrents
}
