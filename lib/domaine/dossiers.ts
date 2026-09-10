/**
 * Les dossiers ouverts suivis d'édition en édition.
 *
 * Il n'y a pas de base « Dossiers » : les dossiers vivent dans une propriété
 * texte de l'édition, au format figé le 9 septembre 2026 — une seule ligne,
 * `nom (compteur, précision)`, les dossiers séparés par ` · `. Le compteur est
 * le nombre de semaines où le dossier a été rouvert sans avoir bougé.
 *
 * L'analyse est volontairement tolérante. Le format est tenu par des tâches
 * Cowork qui évoluent hors de ce dépôt : une entrée illisible est rendue telle
 * quelle, sans compteur, plutôt que perdue.
 */
export type DossierOuvert = {
  readonly nom: string
  /** `null` quand l'entrée ne portait pas de compteur exploitable. */
  readonly compteur: number | null
  /** `null` quand l'entrée ne portait pas de précision. */
  readonly précision: string | null
}

/** Séparateurs de dossiers acceptés, le point médian étant celui du contrat. */
const SÉPARATEUR = /\s+[·|]\s+/

export function lireDossiersOuverts(brut: string | null | undefined): DossierOuvert[] {
  if (!brut) return []

  return brut
    .split(SÉPARATEUR)
    .map((entrée) => entrée.trim())
    .filter((entrée) => entrée.length > 0)
    .map(lireUnDossier)
}

function lireUnDossier(entrée: string): DossierOuvert {
  // On vise la *dernière* parenthèse : un nom de dossier peut lui-même en
  // contenir une, « Loi Résilience (volet 2) (1, au Sénat) ».
  const ouverture = entrée.lastIndexOf('(')
  const fermeture = entrée.lastIndexOf(')')

  if (ouverture <= 0 || fermeture !== entrée.length - 1) {
    return { nom: entrée, compteur: null, précision: null }
  }

  const nom = entrée.slice(0, ouverture).trim()
  const dedans = entrée.slice(ouverture + 1, fermeture).trim()
  if (nom.length === 0) return { nom: entrée, compteur: null, précision: null }

  const virgule = dedans.indexOf(',')
  const têteBrute = virgule === -1 ? dedans : dedans.slice(0, virgule)
  const précision = virgule === -1 ? null : dedans.slice(virgule + 1).trim() || null

  const compteur = /^\d+$/.test(têteBrute.trim()) ? Number(têteBrute.trim()) : null

  // Parenthèse présente mais sans compteur : ce n'est pas le format du contrat,
  // on ne devine rien et on garde l'entrée entière comme nom.
  if (compteur === null) return { nom: entrée, compteur: null, précision: null }

  return { nom, compteur, précision }
}

/**
 * Ce qui a bougé d'abord, ce qui dort ensuite.
 *
 * Le compteur est le nombre de semaines sans mouvement : zéro en tête, donc,
 * puisque c'est l'actualité de la semaine. Les dossiers sans compteur
 * exploitable ferment la marche — on ne sait pas les situer, on ne les met pas
 * en avant.
 */
export function ordonnerLesDossiers(dossiers: readonly DossierOuvert[]): DossierOuvert[] {
  return [...dossiers].sort((a, b) => {
    const gauche = a.compteur ?? Number.MAX_SAFE_INTEGER
    const droite = b.compteur ?? Number.MAX_SAFE_INTEGER
    return gauche !== droite ? gauche - droite : a.nom.localeCompare(b.nom, 'fr')
  })
}
