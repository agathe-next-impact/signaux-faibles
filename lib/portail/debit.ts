import { createHash } from 'node:crypto'

/**
 * Limitation de débit des envois de lien, et temps de réponse constant.
 *
 * Deux routes font partir un courrier à un lecteur sur simple demande : le
 * formulaire « recevoir mon lien » et `POST /api/acces/ouvrir`. Sans frein, un
 * tiers qui connaît l'adresse d'un lecteur peut lui faire renvoyer son lien à
 * volonté, et consommer le quota Gmail du portail. La documentation promettait
 * depuis le 9 septembre 2026 « un envoi au plus par email toutes les dix minutes
 * et par adresse IP » ; rien ne le faisait avant le 14 octobre.
 *
 * **Ce que ce module garantit, et ce qu'il ne garantit pas.** Le portail n'a
 * pas de stockage : le compteur vit en mémoire de l'instance serverless. Il
 * tient donc les rafales (le cas réel : un script qui boucle), pas un attaquant
 * qui répartirait ses requêtes sur plusieurs instances ou attendrait qu'une
 * instance soit recyclée. La garantie forte est à poser hors du dépôt, par une
 * règle de limitation de débit du pare-feu Vercel sur `/recevoir-mon-lien` et
 * `/api/acces/ouvrir` ; ce module est le filet qui tient en attendant, et qui
 * continue de tenir derrière.
 *
 * Les clés ne sont jamais l'adresse en clair : une empreinte, la même que celle
 * des journaux.
 */

const FENÊTRE_MS = 10 * 60 * 1000

/** Une adresse ne reçoit son lien qu'une fois par fenêtre. */
const PAR_EMAIL = 1
/** Une même origine réseau ne déclenche que quelques envois par fenêtre. */
const PAR_ORIGINE = 5

type Fenêtre = { readonly débuts: number[] }

const compteurs = new Map<string, Fenêtre>()

function compter(clé: string, plafond: number, maintenant: number): boolean {
  const fenêtre = compteurs.get(clé) ?? { débuts: [] }
  const récents = fenêtre.débuts.filter((début) => maintenant - début < FENÊTRE_MS)
  if (récents.length >= plafond) {
    compteurs.set(clé, { débuts: récents })
    return false
  }
  récents.push(maintenant)
  compteurs.set(clé, { débuts: récents })

  // Sans purge, une instance qui vit longtemps accumulerait une clé par
  // adresse jamais revue.
  if (compteurs.size > 10_000) {
    for (const [autreClé, autre] of compteurs) {
      if (autre.débuts.every((début) => maintenant - début >= FENÊTRE_MS)) compteurs.delete(autreClé)
    }
  }
  return true
}

/**
 * Autorise ou refuse un envoi vers `email` depuis `origine` (une adresse IP, ou
 * `null` quand elle est inconnue). Refuser ne dit rien au demandeur : c'est à
 * l'appelant de répondre exactement comme si l'envoi avait eu lieu.
 */
export function autoriserLEnvoi(
  email: string,
  origine: string | null,
  maintenant: number = Date.now(),
): { readonly autorisé: boolean; readonly motif?: 'email' | 'origine' } {
  if (!compter(`email:${empreinte(email)}`, PAR_EMAIL, maintenant)) {
    return { autorisé: false, motif: 'email' }
  }
  if (origine && !compter(`origine:${empreinte(origine)}`, PAR_ORIGINE, maintenant)) {
    return { autorisé: false, motif: 'origine' }
  }
  return { autorisé: true }
}

/** Une adresse ne demande une démonstration qu'une fois par fenêtre. */
const DÉMOS_PAR_EMAIL = 1
/** Une même origine réseau n'envoie que quelques demandes par fenêtre. */
const DÉMOS_PAR_ORIGINE = 3

/**
 * Le frein du formulaire `/demo`, sur ses propres compteurs : une demande de
 * démonstration ne doit pas consommer l'envoi de lien d'un lecteur, ni
 * l'inverse. La demande ne part que vers l'opératrice ; le frein protège sa
 * boîte et le quota Gmail d'un script qui boucle.
 */
export function autoriserLaDemandeDeDémo(
  email: string,
  origine: string | null,
  maintenant: number = Date.now(),
): { readonly autorisé: boolean; readonly motif?: 'email' | 'origine' } {
  if (!compter(`démo-email:${empreinte(email)}`, DÉMOS_PAR_EMAIL, maintenant)) {
    return { autorisé: false, motif: 'email' }
  }
  if (origine && !compter(`démo-origine:${empreinte(origine)}`, DÉMOS_PAR_ORIGINE, maintenant)) {
    return { autorisé: false, motif: 'origine' }
  }
  return { autorisé: true }
}

/** Réservé aux tests. */
export function réinitialiserLesCompteurs(): void {
  compteurs.clear()
}

/**
 * L'empreinte d'une donnée personnelle pour les journaux et les compteurs.
 *
 * Huit caractères suffisent à rapprocher deux lignes de journal entre elles,
 * et une adresse ne se retrouve pas depuis l'empreinte sans connaître
 * l'adresse. Les journaux Vercel sont lus par des outils tiers : une adresse
 * de lecteur en clair y est une donnée personnelle qui n'a rien à y faire.
 */
export function empreinte(valeur: string): string {
  return createHash('sha256').update(valeur.trim().toLowerCase()).digest('hex').slice(0, 8)
}

/**
 * L'origine réseau d'une requête, telle que Vercel la transmet.
 *
 * `x-forwarded-for` peut porter une liste ; la première adresse est celle du
 * client. Une absence rend `null` : on ne devine pas une origine.
 */
export function origineDe(entêtes: { get(nom: string): string | null }): string | null {
  const brut = entêtes.get('x-forwarded-for') ?? entêtes.get('x-real-ip')
  if (!brut) return null
  const première = brut.split(',')[0]?.trim() ?? ''
  return première.length > 0 ? première : null
}

/**
 * Exécute `travail` et ne rend la main qu'après `minimumMs`, quoi qu'il arrive.
 *
 * Le formulaire répond le même texte que l'adresse soit connue ou non, mais le
 * chemin « connue » appelle Gmail et prend plusieurs centaines de millisecondes
 * de plus : le délai suffisait à distinguer les deux. Un plancher commun aux
 * deux chemins retire cette différence. Il ne cache pas tout (un envoi très
 * lent dépasse le plancher), mais il retire le cas ordinaire.
 */
export async function avecDuréeMinimale<T>(minimumMs: number, travail: () => Promise<T>): Promise<T> {
  const début = Date.now()
  try {
    return await travail()
  } finally {
    const restant = minimumMs - (Date.now() - début)
    if (restant > 0) await new Promise((résoudre) => setTimeout(résoudre, restant))
  }
}

/** Le plancher appliqué aux deux routes d'envoi de lien. */
export const PLANCHER_DE_RÉPONSE_MS = 1_200
