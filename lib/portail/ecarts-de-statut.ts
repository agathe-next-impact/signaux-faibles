import type { Défaut } from '@/lib/portail/etat'

/**
 * Les écarts de statut entre le registre Notion et le portail (15 novembre
 * 2026). Une organisation écartée d'un côté seulement reste en service de
 * l'autre : le calendrier la sort des tâches, mais le registre la montre
 * encore, ou l'inverse, et personne ne le voit tant qu'un client ne s'en
 * plaint.
 *
 * Le portail ne lit jamais le registre : c'est la tâche qui **donne** les
 * lignes qu'elle vient de lire (`POST /api/veille/etat`, comme le calendrier
 * reçoit les lignes de la vue « Veilles actives »). Rien n'en est gardé : un
 * statut recopié en base vieillirait et accuserait à tort. La comparaison est
 * pure, testée sans réseau ni base.
 *
 * Ce qui n'est PAS un écart : une organisation suspendue au portail. La
 * suspension ferme l'espace, elle n'a pas d'équivalent au registre, et le
 * calendrier la sort déjà des tâches. Une organisation de test non plus (la
 * décision « écarter » ne s'y applique pas).
 *
 * L'archivage (13 novembre 2026) est un état à part : il pose `archivée_le`,
 * désactive les lecteurs et abandonne la file, mais ne change ni l'état de
 * l'organisation ni le registre, et le calendrier ne la sort pas des tâches. Une
 * archivée est donc hors service au portail quel que soit son état, et un
 * registre qui la montre encore en service est un écart : les tâches continuent
 * de lui produire des lettres.
 */
export type LigneDuRegistre = {
  readonly slug: string
  /** Le statut tel que la tâche l'a lu : « 0 · Écartée », « 6 · Veille active », ou le chiffre seul. */
  readonly statut: string | number
}

const LIBELLÉS: Readonly<Record<number, string>> = {
  0: '0 · Écartée',
  1: '1 · Demande reçue',
  2: '2 · Référentiels générés',
  3: '3 · Référentiels validés',
  4: '4 · Première lettre produite',
  5: '5 · Prête à activer',
  6: '6 · Veille active',
}

/** Ce que le portail sait d'une organisation : son état, et si l'opératrice l'a archivée. */
export type OrganisationDuPortail = { readonly état: string; readonly archivée: boolean }

/** Les états où le portail traite encore l'organisation : file, calendrier, parcours. */
const ÉTATS_EN_SERVICE: ReadonlySet<string> = new Set(['demande', 'generation', 'essai', 'abonnee'])

/**
 * Le chiffre du statut, de 0 à 6, ou `null` s'il est illisible. Le libellé
 * Notion commence toujours par lui (« 4 · Première lettre produite — à
 * valider ») ; « 10 » ou « Écartée » seuls ne se devinent pas.
 */
export function statutDuRegistre(brut: string | number): number | null {
  if (typeof brut === 'number') return Number.isInteger(brut) && brut >= 0 && brut <= 6 ? brut : null
  const lu = /^\s*([0-6])(?![0-9])/.exec(brut)
  return lu ? Number(lu[1]) : null
}

/**
 * Compare les lignes du registre aux organisations du portail (par slug).
 * Une ligne dont le slug est absent de `états` n'est une anomalie qu'à partir
 * du statut 4 : avant, l'organisation n'est pas encore entrée dans le portail,
 * c'est le cours normal de l'onboarding (l'entrée en essai a lieu à la première
 * lettre). Un portail qui connaît une organisation que le registre ne donne
 * pas n'est jamais une anomalie ici : la tâche a pu ne donner qu'une partie du
 * registre.
 */
export function contrôlerLesStatuts(
  registre: readonly LigneDuRegistre[],
  organisations: ReadonlyMap<string, OrganisationDuPortail>,
): Défaut[] {
  const défauts: Défaut[] = []
  for (const ligne of registre) {
    const slug = ligne.slug.trim().toLowerCase()
    if (!slug) continue
    const statut = statutDuRegistre(ligne.statut)
    if (statut === null) {
      défauts.push({
        slug,
        code: 'statut-registre-illisible',
        message: `le statut lu au registre (« ${String(ligne.statut).slice(0, 40)} ») ne commence pas par un chiffre de 0 à 6 : ses écarts avec le portail ne sont pas contrôlés. Le libellé a-t-il changé dans Notion ?`,
      })
      continue
    }
    const organisation = organisations.get(slug)

    if (organisation === undefined) {
      if (statut >= 4) {
        défauts.push({
          slug,
          code: 'organisation-absente-du-portail',
          message: `« ${LIBELLÉS[statut]} » au registre, mais aucune organisation de ce slug au portail : l'entrée en essai (POST /api/veille/organisations, étape e1) n'a pas eu lieu, ou le slug diffère.`,
        })
      }
      continue
    }

    const { état, archivée } = organisation

    if (statut === 0 && !archivée && ÉTATS_EN_SERVICE.has(état)) {
      défauts.push({
        slug,
        code: 'statut-ecartee-registre',
        message: `« ${LIBELLÉS[0]} » au registre, mais l'organisation est encore en service au portail (état ${état}) : sa file, son calendrier et son parcours continuent. Appliquer « écarter » sur /espaces/abonnements/${slug} (ou PATCH /api/veille/organisations, action decision).${
          état === 'abonnee' ? ' Elle est abonnée : résilier aussi l’abonnement dans Stripe, la décision ne le fait pas.' : ''
        }`,
      })
    }

    if (statut !== 0 && archivée) {
      défauts.push({
        slug,
        code: 'statut-archivee-portail',
        message: `archivée au portail, mais le registre la montre au statut « ${LIBELLÉS[statut]} » : ses lecteurs sont désactivés et sa file abandonnée, mais le calendrier ne la sort pas des tâches, qui continuent de lui produire des lettres. Poser « ${LIBELLÉS[0]} » avec motif au registre, ou la désarchiver sur /espaces/abonnements.`,
      })
    } else if (statut !== 0 && état === 'ecartee') {
      défauts.push({
        slug,
        code: 'statut-ecartee-portail',
        message: `écartée au portail, mais le registre la montre au statut « ${LIBELLÉS[statut]} » : le calendrier la sort des tâches, pas le registre. Poser « ${LIBELLÉS[0]} » avec motif au registre, ou réactiver l'organisation sur /espaces/abonnements/${slug}.`,
      })
    }
  }
  return défauts
}
