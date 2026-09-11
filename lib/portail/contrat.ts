import type { DossierOuvert } from '@/lib/domaine/dossiers'

/**
 * Ce que le portail attend d'une lettre, et qui ne peut pas être vérifié ailleurs.
 *
 * Le format des éditions est tenu par des tâches Cowork qui vivent hors de ce
 * dépôt. Le portail ne devine rien : ce qui n'est pas au format n'est pas
 * affiché. C'est la bonne règle — deviner produirait des acteurs inventés et des
 * badges d'impact faux — mais elle a un défaut, et il a coûté cher le
 * 11 septembre 2026 sur le Pays de Mauriac : elle est **silencieuse**. Les deux
 * lettres du client étaient publiées, lisibles, complètes, et son tableau de
 * bord n'affichait ni axe ni acteur. Rien ne cassait.
 *
 * Ce module ne répare rien et ne change aucun affichage. Il nomme l'écart, pour
 * que le journal Vercel le porte — comme « accès valide, aucune édition » a fini
 * par livrer le bug de l'Hermitage.
 */
export type RuptureDeContrat = {
  readonly sorte: 'axes' | 'dossiers'
  readonly message: string
}

export function contrôlerLeContrat(entrée: {
  /** Nombre d'axes trouvés dans les corps de la semaine. */
  readonly axes: number
  /** Nombre de corps de notes réellement lus. */
  readonly notes: number
  /** Les dossiers tels que l'analyse les a rendus. */
  readonly dossiers: readonly DossierOuvert[]
}): RuptureDeContrat[] {
  const ruptures: RuptureDeContrat[] = []

  // Un axe est un titre de niveau 2 dont le suffixe porte le niveau d'impact.
  // Aucun axe sur des notes non vides, c'est un corps écrit sans titre H2 — ou
  // avec des H2 sans suffixe. La vue d'ensemble et l'écran des axes sont alors
  // vides, sans que rien ne le dise.
  if (entrée.notes > 0 && entrée.axes === 0) {
    ruptures.push({
      sorte: 'axes',
      message:
        'aucun axe dans les lettres de la semaine. Le portail lit les axes dans les ' +
        'titres de NIVEAU 2 du corps, dont le suffixe porte l’impact ' +
        '(« Nom de l’axe — FORT », « — MOYEN », « — RAS »). Un impact écrit dans la ' +
        'prose (« Impact fort. ») n’est pas lu. Sans axe, « L’écosystème » et les ' +
        'l’écran des axes restent vides.',
    })
  }

  // Le compteur est entre parenthèses : `nom (compteur, précision)`. Sans lui,
  // l'entrée entière devient le nom, aucune lettre ne la nomme, et l'acteur
  // disparaît de l'accueil. Un seul dossier sans compteur reste plausible ;
  // aucun compteur sur plusieurs dossiers est la signature d'un autre format.
  const avecCompteur = entrée.dossiers.filter((d) => d.compteur !== null).length
  if (entrée.dossiers.length >= 2 && avecCompteur === 0) {
    ruptures.push({
      sorte: 'dossiers',
      message:
        `${entrée.dossiers.length} dossiers suivis, aucun compteur exploitable. ` +
        'Le format attendu est « nom (compteur, précision) », séparés par « · ». ' +
        'Le compteur est un entier ENTRE PARENTHÈSES et il est obligatoire : ' +
        '« nom — précision — compteur » n’est pas lu. Sans compteur, aucun acteur ' +
        'ne remonte à l’accueil.',
    })
  }

  return ruptures
}

/**
 * Journalise les écarts, une ligne par écart, préfixées comme les autres
 * diagnostics du portail. Rien n'est affiché au client : sa lettre reste
 * lisible, c'est son tableau de bord qui est incomplet.
 */
export function journaliserLeContrat(slug: string, ruptures: readonly RuptureDeContrat[]): void {
  for (const rupture of ruptures) {
    console.warn(`[contrat] ${slug} : ${rupture.message}`)
  }
}
