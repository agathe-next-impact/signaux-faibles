import type { NiveauImpact } from '@/lib/domaine/impact'

/**
 * La fraîcheur d'une information : ce qui vient de bouger, ce qui dort.
 *
 * Les écrans « Les axes » et « Acteurs » posaient la même question au lecteur —
 * qu'est-ce qui est nouveau ? — et n'y répondaient pas de la même façon : les
 * axes étaient rangés par impact, les acteurs par ancienneté. Une notion
 * commune les range désormais pareil, et lui donne une couleur.
 *
 * **Trois états, deux groupes.** Le lecteur cherche d'abord la coupure entre ce
 * qui a du neuf et ce qui n'en a pas ; le troisième état ne crée pas un
 * troisième groupe, il dit depuis combien de temps le silence dure. C'est
 * gratuit à lire — une pastille — et cela évite de confondre « rien cette
 * semaine » avec « rien depuis un mois ».
 *
 * Ce n'est **pas** une échelle d'impact. La règle 6 fixe trois niveaux
 * d'impact et interdit d'en ajouter ; la fraîcheur est un autre axe de lecture,
 * porté par d'autres mots et d'autres signes, et les deux se lisent ensemble
 * sur la même case — un axe peut être FORT et sans nouveauté.
 */
export type Fraîcheur = 'nouveau' | 'suivi' | 'dormant'

/** Au-delà, un dossier n'est plus « suivi sans nouveauté » : il dort. */
export const SEMAINES_AVANT_DORMANCE = 3

/** L'ordre d'affichage : ce qui a du neuf d'abord, ce qui dort en dernier. */
export const RANG_DE_FRAÎCHEUR: Readonly<Record<Fraîcheur, number>> = {
  nouveau: 0,
  suivi: 1,
  dormant: 2,
}

export function rangDeFraîcheur(fraîcheur: Fraîcheur): number {
  return RANG_DE_FRAÎCHEUR[fraîcheur]
}

/**
 * La fraîcheur d'un axe.
 *
 * **RAS l'emporte sur le mouvement, et c'est délibéré.** Un axe qui apparaît
 * pour la première fois en RAS est nouveau au sens du suivi, mais il n'apporte
 * rien à lire : le classer en tête ferait remonter du vide. « Rien à signaler »
 * veut dire ce qu'il dit.
 */
export function fraîcheurDUnAxe(axe: {
  readonly niveau: NiveauImpact | null
  readonly mouvement: 'nouveau' | 'monté' | 'redescendu' | 'stable'
}): Fraîcheur {
  if (axe.niveau === 'RAS') return 'dormant'
  if (axe.mouvement === 'nouveau' || axe.mouvement === 'monté') return 'nouveau'
  return 'suivi'
}

/**
 * La fraîcheur d'un dossier suivi.
 *
 * Le compteur est le nombre de semaines où le dossier a été rouvert sans avoir
 * bougé : à zéro, il vient de bouger. `aBougé` couvre le cas où le compteur
 * redescend sans atteindre zéro.
 */
export function fraîcheurDUnDossier(dossier: {
  readonly aBougé: boolean
  readonly semainesSansMouvement: number
}): Fraîcheur {
  if (dossier.aBougé || dossier.semainesSansMouvement === 0) return 'nouveau'
  return dossier.semainesSansMouvement >= SEMAINES_AVANT_DORMANCE ? 'dormant' : 'suivi'
}
