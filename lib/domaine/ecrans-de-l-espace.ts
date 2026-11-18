/**
 * Les écrans de l'espace client que l'opératrice peut activer ou désactiver,
 * organisation par organisation (18 novembre 2026, demande de l'opératrice :
 * « un écran d'activation de chaque écran client »).
 *
 * Ce qui est stocké est la liste des écrans **masqués**
 * (`organisations.ecrans_masques`, migration 0031), vide par défaut : tout ce
 * qui s'affichait avant reste affiché, et un écran ajouté plus tard est actif
 * sans rien régler. Un écran masqué quitte le rail et le menu de pied, sa carte
 * quitte la vue d'ensemble, et son adresse répond 404 au client
 * (`exigerLÉcran`, `lib/portail/ecrans.ts`) ; l'opératrice, au privilège
 * « Tous les espaces », continue de le voir et de l'ouvrir, sous un bandeau.
 *
 * Module pur : ni base, ni Next.js. Les clés sont écrites ici et nulle part
 * ailleurs ; une clé inconnue lue en base est ignorée, jamais interprétée.
 */

export const ÉCRANS_DE_L_ESPACE = [
  { clé: 'vue-d-ensemble', libellé: 'Vue d’ensemble', segment: '', rubrique: 'Cette semaine', classique: true, désactivable: false },
  { clé: 'lettres', libellé: 'Lettres', segment: '/lettres', rubrique: 'Cette semaine', classique: true, désactivable: true },
  { clé: 'calendrier', libellé: 'Calendrier', segment: '/veille/calendrier', rubrique: 'Cette semaine', classique: false, désactivable: true },
  { clé: 'concurrents', libellé: 'Concurrents ou entreprises suivies', segment: '/concurrents', rubrique: 'Le marché', classique: false, désactivable: true },
  { clé: 'acteurs', libellé: 'Acteurs', segment: '/acteurs', rubrique: 'Le marché', classique: true, désactivable: true },
  { clé: 'forces', libellé: 'Forces du marché', segment: '/forces', rubrique: 'Le marché', classique: false, désactivable: true },
  { clé: 'marches', libellé: 'Marchés et niches', segment: '/marches', rubrique: 'Le marché', classique: false, désactivable: true },
  { clé: 'axes', libellé: 'Les axes', segment: '/axes', rubrique: 'L’environnement', classique: true, désactivable: true },
  { clé: 'pestel', libellé: 'PESTEL', segment: '/pestel', rubrique: 'L’environnement', classique: false, désactivable: true },
  { clé: 'diagnostic', libellé: 'Diagnostic', segment: '/diagnostic', rubrique: 'Stratégie', classique: false, désactivable: true },
  { clé: 'recommandations', libellé: 'Options (Recommandations hors espace réorganisé)', segment: '/recommandations', rubrique: 'Stratégie', classique: true, désactivable: true },
  { clé: 'appels', libellé: 'Appels à projets', segment: '/appels', rubrique: 'Stratégie', classique: false, désactivable: true },
  { clé: 'scenarios', libellé: 'Scénarios', segment: '/scenarios', rubrique: 'Stratégie', classique: false, désactivable: true },
  { clé: 'indicateurs', libellé: 'Indicateurs', segment: '/indicateurs', rubrique: 'Stratégie', classique: false, désactivable: true },
  { clé: 'themes', libellé: 'Thèmes suivis', segment: '/veille/themes', rubrique: 'Votre veille', classique: false, désactivable: true },
  { clé: 'sources', libellé: 'Sources', segment: '/veille/sources', rubrique: 'Votre veille', classique: false, désactivable: true },
  { clé: 'corpus', libellé: 'Corpus', segment: '/veille/corpus', rubrique: 'Votre veille', classique: false, désactivable: true },
  { clé: 'perimetre', libellé: 'Périmètre', segment: '/perimetre', rubrique: 'Votre veille', classique: true, désactivable: true },
  { clé: 'archives', libellé: 'Archives', segment: '/archives', rubrique: 'Votre veille', classique: true, désactivable: true },
] as const

export type ÉcranDeLEspace = (typeof ÉCRANS_DE_L_ESPACE)[number]['clé']

/** Les écrans qui peuvent être masqués : tous sauf la vue d'ensemble, où mènent la fin d'essai et chaque écran refusé. */
export type ÉcranDésactivable = Exclude<ÉcranDeLEspace, 'vue-d-ensemble'>

const CLÉS_DÉSACTIVABLES: ReadonlySet<string> = new Set(ÉCRANS_DE_L_ESPACE.filter((é) => é.désactivable).map((é) => é.clé))

export function estÉcranDésactivable(valeur: unknown): valeur is ÉcranDésactivable {
  return typeof valeur === 'string' && CLÉS_DÉSACTIVABLES.has(valeur)
}

/**
 * La liste lue en base, réduite aux clés connues et désactivables, sans doublon,
 * dans l'ordre du rail : une clé retirée du code ou écrite à la main n'a aucun effet.
 */
export function écransMasquésConnus(valeurs: readonly string[] | null | undefined): readonly ÉcranDésactivable[] {
  const présentes = new Set(valeurs ?? [])
  return ÉCRANS_DE_L_ESPACE.filter((é) => é.désactivable && présentes.has(é.clé)).map((é) => é.clé as ÉcranDésactivable)
}

/** L'écran que désigne l'adresse d'un onglet ou d'une case, ou `null` s'il n'en désigne aucun. */
export function écranDeLAdresse(slug: string, href: string): ÉcranDeLEspace | null {
  const base = `/${slug}`
  if (href !== base && !href.startsWith(`${base}/`)) return null
  const reste = href.slice(base.length).split(/[?#]/)[0] ?? ''
  // Le segment le plus long d'abord : « /veille/calendrier » avant tout préfixe plus court.
  const trouvés = ÉCRANS_DE_L_ESPACE.filter((é) => (é.segment === '' ? reste === '' : reste === é.segment || reste.startsWith(`${é.segment}/`)))
  return trouvés.sort((a, b) => b.segment.length - a.segment.length)[0]?.clé ?? null
}

/** Garde ce qui mène à un écran actif ; ce qui ne mène à aucun écran connu reste. */
export function sansLesÉcransMasqués<T extends { readonly href: string }>(
  slug: string,
  éléments: readonly T[],
  masqués: readonly ÉcranDeLEspace[],
): T[] {
  if (masqués.length === 0) return [...éléments]
  const masqué = new Set<string>(masqués)
  return éléments.filter((élément) => {
    const écran = écranDeLAdresse(slug, élément.href)
    return écran === null || !masqué.has(écran)
  })
}

/** Les libellés des écrans masqués, dans l'ordre du rail, pour le bandeau de l'opératrice. */
export function libellésDesÉcrans(clés: readonly ÉcranDeLEspace[]): string[] {
  const voulues = new Set<string>(clés)
  return ÉCRANS_DE_L_ESPACE.filter((é) => voulues.has(é.clé)).map((é) => é.libellé)
}

/**
 * Ce que le formulaire de l'opératrice envoie : les écrans **cochés**, donc
 * actifs. Le masqué est le complément, parmi les désactivables. Une valeur
 * inconnue est ignorée.
 */
export function masquésDuFormulaire(actifs: readonly unknown[]): readonly ÉcranDésactivable[] {
  const cochés = new Set(actifs.filter(estÉcranDésactivable))
  return ÉCRANS_DE_L_ESPACE.filter((é) => é.désactivable && !cochés.has(é.clé)).map((é) => é.clé as ÉcranDésactivable)
}
