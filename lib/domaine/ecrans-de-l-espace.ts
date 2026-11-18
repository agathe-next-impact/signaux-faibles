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
  { clé: 'appels', libellé: 'Appels à projets', segment: '/appels', rubrique: 'Cette semaine', classique: false, désactivable: true },
  { clé: 'concurrents', libellé: 'Concurrents ou entreprises suivies', segment: '/concurrents', rubrique: 'Le marché', classique: false, désactivable: true },
  { clé: 'acteurs', libellé: 'Acteurs', segment: '/acteurs', rubrique: 'Le marché', classique: true, désactivable: true },
  { clé: 'forces', libellé: 'Forces du marché', segment: '/forces', rubrique: 'Le marché', classique: false, désactivable: true },
  { clé: 'marches', libellé: 'Marchés et niches', segment: '/marches', rubrique: 'Le marché', classique: false, désactivable: true },
  { clé: 'axes', libellé: 'Les axes', segment: '/axes', rubrique: 'L’environnement', classique: true, désactivable: true },
  { clé: 'pestel', libellé: 'PESTEL', segment: '/pestel', rubrique: 'L’environnement', classique: false, désactivable: true },
  { clé: 'diagnostic', libellé: 'Diagnostic', segment: '/diagnostic', rubrique: 'Stratégie', classique: false, désactivable: true },
  { clé: 'recommandations', libellé: 'Options (Recommandations hors espace réorganisé)', segment: '/recommandations', rubrique: 'Stratégie', classique: true, désactivable: true },
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

/** Les libellés des écrans, dans l'ordre du rail (le nom choisi pour l'organisation d'abord), pour le bandeau de l'opératrice. */
export function libellésDesÉcrans(clés: readonly ÉcranDeLEspace[], noms: Readonly<Partial<Record<ÉcranDeLEspace, string>>> = {}): string[] {
  const voulues = new Set<string>(clés)
  return ÉCRANS_DE_L_ESPACE.filter((é) => voulues.has(é.clé)).map((é) => noms[é.clé] ?? é.libellé)
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

// ── Les noms des écrans (18 novembre 2026, demande de l'opératrice) ──────────

/**
 * Un écran peut porter, pour une organisation, un nom choisi par l'opératrice
 * (`organisations.noms_des_ecrans`, migration 0032) : il remplace le libellé du
 * rail et du menu de pied, le nom de l'écran sur sa carte de la vue
 * d'ensemble, et le titre de l'écran. Un champ vide garde le nom par défaut.
 * Quarante caractères au plus, une ligne, sans caractère de contrôle.
 */
export const NOM_D_ÉCRAN_MAX = 40

/** Au-delà, le libellé court du menu de pied est abrégé, comme « Diagnos. ». */
export const LIBELLÉ_COURT_MAX = 9

export type NomsDesÉcrans = Readonly<Partial<Record<ÉcranDeLEspace, string>>>

const CLÉS: ReadonlySet<string> = new Set(ÉCRANS_DE_L_ESPACE.map((é) => é.clé))

/** Un nom propre, ou `null` : vide, trop long ou porteur d'un caractère de contrôle. */
export function nomDÉcranValide(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null
  const nom = valeur.replace(/\s+/g, ' ').trim()
  if (nom.length === 0 || nom.length > NOM_D_ÉCRAN_MAX) return null
  if (/[\u0000-\u001f\u007f]/.test(nom)) return null
  return nom
}

/** La valeur lue en base, réduite aux clés connues et aux noms valides ; tout le reste est ignoré. */
export function nomsDesÉcransConnus(valeur: unknown): NomsDesÉcrans {
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return {}
  const noms: Partial<Record<ÉcranDeLEspace, string>> = {}
  for (const [clé, nom] of Object.entries(valeur as Record<string, unknown>)) {
    const propre = nomDÉcranValide(nom)
    if (CLÉS.has(clé) && propre) noms[clé as ÉcranDeLEspace] = propre
  }
  return noms
}

/**
 * Ce que le formulaire envoie : un champ `nom:<clé>` par écran. Un champ vide
 * retire le nom ; un nom trop long est refusé (`trop-long`) plutôt que coupé en silence.
 */
export function nomsDuFormulaire(
  champs: Iterable<readonly [string, unknown]>,
): { readonly sorte: 'noms'; readonly noms: NomsDesÉcrans } | { readonly sorte: 'trop-long'; readonly écran: ÉcranDeLEspace } {
  const noms: Partial<Record<ÉcranDeLEspace, string>> = {}
  for (const [champ, valeur] of champs) {
    if (!champ.startsWith('nom:')) continue
    const clé = champ.slice(4)
    if (!CLÉS.has(clé) || typeof valeur !== 'string') continue
    const nettoyé = valeur.replace(/\s+/g, ' ').trim()
    if (nettoyé.length === 0) continue
    const propre = nomDÉcranValide(nettoyé)
    if (!propre) return { sorte: 'trop-long', écran: clé as ÉcranDeLEspace }
    noms[clé as ÉcranDeLEspace] = propre
  }
  return { sorte: 'noms', noms }
}

/** Le libellé court du menu de pied : le nom s'il tient, son premier mot sinon, abrégé au besoin. */
export function libelléCourtDe(nom: string): string {
  if (nom.length <= LIBELLÉ_COURT_MAX) return nom
  const premier = nom.split(' ')[0] ?? nom
  if (premier.length <= LIBELLÉ_COURT_MAX) return premier
  return `${premier.slice(0, LIBELLÉ_COURT_MAX - 1)}.`
}

/** Le nom d'un écran pour une organisation : le sien s'il en a un, `null` sinon. */
export function nomDeLÉcran(noms: NomsDesÉcrans | undefined, écran: ÉcranDeLEspace): string | null {
  return noms?.[écran] ?? null
}

/** Les onglets du rail, renommés : libellé et libellé court. */
export function ongletsRenommés<T extends { readonly href: string; readonly libellé: string; readonly libelléCourt: string }>(
  slug: string,
  onglets: readonly T[],
  noms: NomsDesÉcrans,
): T[] {
  return onglets.map((onglet) => {
    const écran = écranDeLAdresse(slug, onglet.href)
    const nom = écran ? nomDeLÉcran(noms, écran) : null
    return nom ? { ...onglet, libellé: nom, libelléCourt: libelléCourtDe(nom) } : onglet
  })
}

/** Les cases de la vue d'ensemble, renommées : le nom de l'écran sur sa carte. */
export function casesRenommées<T extends { readonly href: string; readonly écran: string }>(slug: string, cases: readonly T[], noms: NomsDesÉcrans): T[] {
  return cases.map((c) => {
    const écran = écranDeLAdresse(slug, c.href)
    const nom = écran ? nomDeLÉcran(noms, écran) : null
    return nom ? { ...c, écran: nom } : c
  })
}
