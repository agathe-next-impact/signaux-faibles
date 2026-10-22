import { describe, expect, it } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { assemblerLaLettre, phraseDatée, titreDÉdition } from '@/lib/moteur/assemblage'
import { collecterLesSources, couvertureDe, phrasesDuTexte, versTexte, type Gel } from '@/lib/moteur/collecte'
import { contrôlerLaProduction, urlsDuMarkdown } from '@/lib/moteur/portes'
import { produireLaLettre } from '@/lib/moteur/produire'
import type { Rédacteur, SortieRédigée, Sélection } from '@/lib/moteur/redaction'
import { lireRéférentielUnique, écrireRéférentielUnique } from '@/lib/moteur/referentiel'

// ── Un référentiel et une sélection de test ─────────────────────────────────

const AXES = 12
const URL = (i: number) => `https://exemple.fr/axe-${i}`
const RÉFÉRENTIEL = lireRéférentielUnique(
  écrireRéférentielUnique('Konica Minolta', {
    fiche: 'Konica Minolta vend des systèmes d’impression.',
    axes: Array.from({ length: AXES }, (_, i) => ({
      nom: i < 8 ? `Thème ${i + 1}` : `Concurrents ${i + 1}`,
      sorte: i < 8 ? ('thème' as const) : ('concurrents' as const),
      critères: 'FORT si un texte s’applique.',
      sources: [{ libellé: `Source ${i + 1}`, url: URL(i + 1) }],
      requêtes: [],
      acteurs: [],
    })),
    dossiers: [{ nom: 'facturation électronique', compteur: 1, précision: 'décret attendu' }],
  }),
)

const SÉLECTION: Sélection = {
  numéro: 12,
  dateÉdition: '2026-10-26',
  période: { début: '2026-10-19', fin: '2026-10-25' },
  éditionPrécédente: { dateÉdition: '2026-10-19', essentiel: ['Le décret est attendu.'], dossiersBruts: 'facturation électronique (0, décret attendu)' },
}

/** Une sortie au contrat : niveaux alternés, faits datés dans la période, URL du dossier. */
function sortieConforme(): SortieRédigée {
  return {
    essentiel: ['Le décret sur la facturation électronique est paru le 21 octobre.', 'Kyocera a présenté sa gamme le 22 octobre.', 'Rien de neuf sur les marchés publics.'],
    axes: Array.from({ length: AXES }, (_, i) => {
      const niveau = (['FORT', 'MOYEN', 'RAS'] as const)[i % 3]!
      return niveau === 'RAS'
        ? { numéro: i + 1, niveau, faits: [] }
        : {
            numéro: i + 1,
            niveau,
            faits: [
              { texte: `Le texte ${i + 1} est paru le 21 octobre. Il s’applique au 1er janvier.`, date: '2026-10-21', url: URL(i + 1), autresUrls: [], contexte: false },
              { texte: `Le second texte ${i + 1} est paru le 20 octobre.`, date: '2026-10-20', url: URL(i + 1), autresUrls: [], contexte: false },
            ],
          }
    }),
    dossiers: [{ nom: 'facturation électronique', compteur: 0, précision: 'décret paru', suivi: 'Le dossier facturation électronique avance : le décret est paru le 21 octobre.' }],
    actionDeLaSemaine: 'Vérifier la conformité de la facturation au décret paru le 21 octobre.',
  }
}

const URLS_ADMISES = new Set(Array.from({ length: AXES }, (_, i) => URL(i + 1)))

// ── Assemblage ──────────────────────────────────────────────────────────────

describe('assemblerLaLettre', () => {
  it('produit une lettre au contrat de forme unique, conforme au validateur', () => {
    const lettre = assemblerLaLettre(sortieConforme(), RÉFÉRENTIEL, SÉLECTION)
    const contrôle = contrôlerLaProduction({ lettre, sortie: sortieConforme(), sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements).toEqual([])
    expect(contrôle.franchies).toBe(true)
    expect(contrôle.rapport.aperçu.axes).toHaveLength(AXES)
    expect(contrôle.faits).toBe(16)
  })

  it('écrit le titre, les propriétés et la ligne des dossiers au format du portail', () => {
    const lettre = assemblerLaLettre(sortieConforme(), RÉFÉRENTIEL, SÉLECTION)
    expect(lettre.propriétés.titre).toBe('Veille Konica Minolta, édition n° 12 du 26 octobre 2026')
    expect(titreDÉdition('X', 1, '2026-11-01')).toBe('Veille X, édition n° 1 du 1er novembre 2026')
    expect(lettre.propriétés.dossiersOuvertsSuivis).toBe('facturation électronique (0, décret paru)')
    expect(lettre.propriétés.périodeCouverte).toBe('du 19 octobre 2026 au 25 octobre 2026')
    expect(lettre.propriétés.fenêtreÉlargie).toBe(false)
    expect(lettre.markdown).toContain('## ① Thème 1 — FORT')
    expect(lettre.markdown).toContain('## ③ Thème 3 — RAS')
    expect(lettre.markdown).toMatch(/## ③ Thème 3 — RAS\n\n> RAS\n/)
    expect(lettre.markdown).toContain('([exemple.fr](https://exemple.fr/axe-1))')
    expect(lettre.markdown).toContain('# Dossiers suivis')
  })

  it('date en tête un fait dont la phrase ne porte pas sa date, et rend RAS un axe omis', () => {
    expect(phraseDatée('La gamme est présentée à Lyon.', '2026-10-01')).toBe('Le 1er octobre, la gamme est présentée à Lyon.')
    expect(phraseDatée('Le 3 octobre, la gamme est présentée.', '2026-10-03')).toBe('Le 3 octobre, la gamme est présentée.')
    const sortie = sortieConforme()
    sortie.axes = sortie.axes.filter((a) => a.numéro !== 5)
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    expect(lettre.markdown).toContain('## ⑤ Thème 5 — RAS')
  })

  it('range les dossiers sans mouvement dans une ligne unique, nommés, et écrit ceux qui ont bougé', () => {
    const sortie = sortieConforme()
    sortie.dossiers = [
      { nom: 'facturation électronique', compteur: 0, précision: 'décret paru', suivi: 'Le dossier facturation électronique avance : le décret est paru le 21 octobre.' },
      { nom: 'Kyocera', compteur: 3, précision: 'gamme attendue', suivi: '' },
      { nom: 'Ricoh', compteur: 2, précision: '', suivi: '' },
    ]
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    expect(lettre.markdown).toContain('Sans mouvement cette semaine : Kyocera (gamme attendue) ; Ricoh.')
    expect(lettre.markdown).toContain('Le dossier facturation électronique avance')
    expect(lettre.propriétés.dossiersOuvertsSuivis).toBe('facturation électronique (0, décret paru) · Kyocera (3, gamme attendue) · Ricoh (2)')
  })

  it('liste les sources non consultées en liens seuls, sans une ligne de rédaction', () => {
    const ignorées = [
      { libellé: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' },
      { libellé: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' },
      { libellé: '', url: 'https://www.cnil.fr/fr' },
    ]
    const lettre = assemblerLaLettre(sortieConforme(), RÉFÉRENTIEL, SÉLECTION, ignorées)
    expect(lettre.markdown).toContain('# Sources non consultées\n\n- [Légifrance](https://www.legifrance.gouv.fr/)\n- [cnil.fr](https://www.cnil.fr/fr)\n')
    expect(lettre.urlsIgnorées).toEqual(['https://www.legifrance.gouv.fr/', 'https://www.cnil.fr/fr'])
    const contrôle = contrôlerLaProduction({ lettre, sortie: sortieConforme(), sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements).toEqual([])
  })

  it('écrit une seconde source quand le fait en a deux, et le validateur l\'accepte', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0]!.autresUrls = [URL(2)]
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    expect(lettre.markdown).toContain('([exemple.fr](https://exemple.fr/axe-1), [exemple.fr](https://exemple.fr/axe-2))')
    const contrôle = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements).toEqual([])
  })

  it('refuse une seconde source absente du dossier', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0]!.autresUrls = ['https://ailleurs.example/invente']
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const contrôle = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements.map((m) => m.code)).toContain('citation-non-ouverte')
  })

  it('sans source ignorée, aucune rubrique', () => {
    expect(assemblerLaLettre(sortieConforme(), RÉFÉRENTIEL, SÉLECTION).markdown).not.toContain('Sources non consultées')
  })

  it('un fait ne peut pas citer une source ignorée : elle n’a pas été lue', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0]!.url = 'https://www.legifrance.gouv.fr/'
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION, [{ libellé: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' }])
    const contrôle = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements.map((m) => m.code)).toContain('citation-non-ouverte')
  })
})

// ── Portes ──────────────────────────────────────────────────────────────────

describe('contrôlerLaProduction', () => {
  it('refuse une URL qui n’est pas dans le dossier de collecte', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0]!.url = 'https://ailleurs.example/invente'
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const contrôle = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements.map((m) => m.code)).toContain('citation-non-ouverte')
    expect(contrôle.messageDeReprise).toContain('ailleurs.example')
  })

  it('refuse un fait antérieur à la période qui n’est pas donné comme contexte, et l’admet marqué contexte', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0] = { texte: 'Le texte est paru le 2 septembre.', date: '2026-09-02', url: URL(1), autresUrls: [], contexte: false }
    let lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES }).manquements.map((m) => m.code)).toContain('fait-hors-période')
    sortie.axes[0]!.faits[0]!.contexte = true
    lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const contrôle = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements).toEqual([])
    expect(lettre.propriétés.fenêtreÉlargie).toBe(true)
  })

  it('refuse le vocabulaire du dispositif et un axe omis de la sortie', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0]!.texte = 'Le référentiel prévoit un texte paru le 21 octobre.'
    sortie.axes = sortie.axes.filter((a) => a.numéro !== 7)
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const codes = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES }).manquements.map((m) => m.code)
    expect(codes).toContain('vocabulaire-interdit')
    expect(codes).toContain('axe-omis')
  })

  it('refuse un fait dont la date ne se lit pas dans sa source, l’admet quand elle s’y lit', () => {
    const sortie = sortieConforme()
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const sansDate = new Map([[URL(1), 'Une page qui parle du 3 octobre seulement.']])
    const refusé = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes: sansDate })
    expect(refusé.manquements.map((m) => m.code)).toContain('fait-date-non-sourcée')
    expect(refusé.messageDeReprise).toContain('2026-10-21')
    const avecDate = new Map([[URL(1), 'Publié le 21 octobre 2026 : le texte est paru. Complété le 20 octobre.']])
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes: avecDate }).manquements).toEqual([])
    // Une URL dont le programme n'a aucun texte n'est pas jugée : la porte des citations la tient déjà.
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes: new Map() }).manquements).toEqual([])
  })

  it('un fait daté du jour de l’édition que sa source écrit elle-même est une nouveauté du jour, pas un relevé', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0] = { texte: 'Le 26 octobre, la source publie un guide.', date: SÉLECTION.dateÉdition, url: URL(1), autresUrls: [], contexte: false }
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const textes = new Map([[URL(1), 'Un guide publié le 26 octobre 2026. Complété le 20 octobre.']])
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes }).manquements).toEqual([])
  })

  it('refuse un chiffre que la source ne donne pas, admet ceux qu’elle écrit sous une autre mise en forme', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0] = { texte: 'Le 21 octobre, Sicollab affiche 1 000 à 1 500 € HT par mois, contre 290 € HT.', date: '2026-10-21', url: URL(1), autresUrls: [], contexte: false }
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const long = (t: string) => `${'Une page de tarifs. '.repeat(90)}${t}`
    const bon = new Map([[URL(1), long('Publié le 21 octobre 2026. 1000 à 1500 € HT. 290€ HT. Complété le 20 octobre.')]])
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes: bon }).manquements.map((m) => m.code)).not.toContain('chiffre-non-sourcé')
    const mauvais = new Map([[URL(1), long('Publié le 21 octobre 2026. Sicollab 1 000 € HT. Complété le 20 octobre.')]])
    const refusé = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes: mauvais })
    expect(refusé.manquements.map((m) => m.code)).toContain('chiffre-non-sourcé')
    expect(refusé.messageDeReprise).toContain('1500')
    // Un extrait court (résultat de recherche) n'est pas jugé : le modèle de recherche en a lu davantage.
    const court = new Map([[URL(1), 'Publié le 21 octobre 2026. Complété le 20 octobre.']])
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes: court }).manquements.map((m) => m.code)).not.toContain('chiffre-non-sourcé')
  })

  it('un relevé de page daté du jour de l’édition passe sans que la date se lise dans la page, à condition d’être marqué contexte', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0] = { texte: 'Au 26 octobre, la source affiche une grille de deux formules.', date: SÉLECTION.dateÉdition, url: URL(1), autresUrls: [], contexte: true }
    const textes = new Map([[URL(1), 'Une page de tarifs. Complétée le 20 octobre 2026.']])
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes }).manquements.filter((m) => m.code === 'fait-date-non-sourcée')).toEqual([])
    sortie.axes[0]!.faits[0]!.contexte = false
    const refusé = contrôlerLaProduction({ lettre: assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION), sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, textes })
    expect(refusé.manquements.map((m) => m.code)).toContain('releve-non-marque')
  })

  it('refuse un axe en RAS quand le dossier porte de la matière, l’admet quand aucune source n’a pu être lue', () => {
    const sortie = sortieConforme()
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const tous = new Set(Array.from({ length: AXES }, (_, i) => i + 1))
    const refusé = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, axesAvecMatière: tous })
    expect(refusé.manquements.map((m) => m.code)).toContain('axe-ras-evitable')
    expect(refusé.messageDeReprise).toContain('relevé de page')
    const sansMatièreSurLesRas = new Set([...tous].filter((n) => sortie.axes[n - 1]!.niveau !== 'RAS'))
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES, axesAvecMatière: sansMatièreSurLesRas }).manquements).toEqual([])
  })

  it('refuse deux dossiers qui écrivent le même sujet', () => {
    const sortie = sortieConforme()
    sortie.dossiers = [
      { nom: 'Automattic', compteur: 0, précision: '', suivi: "Le litige d'Automattic avec WP Engine n'a pas bougé cette semaine ; le procès reste fixé au 19 octobre 2027." },
      { nom: 'WP Engine', compteur: 0, précision: '', suivi: "Le litige de WP Engine avec Automattic n'a pas bougé cette semaine ; on attend la suite avant le procès du 19 octobre 2027." },
    ]
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    const contrôle = contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES })
    expect(contrôle.manquements.map((m) => m.code)).toContain('dossiers-doublons')
  })

  it('refuse un relevé qui compte les éléments d’une page', () => {
    const sortie = sortieConforme()
    sortie.axes[0]!.faits[0] = { texte: 'Au 26 octobre, le blog compte 11 billets sur les infrastructures de réseau.', date: SÉLECTION.dateÉdition, url: URL(1), autresUrls: [], contexte: true }
    const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
    expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES }).manquements.map((m) => m.code)).toContain('releve-vide')
    sortie.axes[0]!.faits[0] = { texte: 'Au 26 octobre, le blog affiche une grille de trois formules.', date: SÉLECTION.dateÉdition, url: URL(1), autresUrls: [], contexte: true }
    expect(contrôlerLaProduction({ lettre: assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION), sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES }).manquements.map((m) => m.code)).not.toContain('releve-vide')
  })

  it('« référentiel » n’est interdit que pour désigner le dispositif, pas dans le nom d’un document public', () => {
    const refusés = ['Le référentiel prévoit un texte.', 'Selon le référentiel de veille, rien.', 'Un écart avec notre référentiel.']
    const admis = [
      'ANS : référentiel HDS v2 publié.',
      'Le référentiel ANSSI des mesures de base reste attendu.',
      'Le référentiel de certification HDS passe en version 2.1.',
      'Le référentiel SecNumCloud 3.2 est paru le 12 octobre.',
      'Le référentiel général de sécurité évolue.',
    ]
    for (const texte of refusés) {
      const sortie = sortieConforme()
      sortie.axes[0]!.faits[0]!.texte = `${texte} Le texte est paru le 21 octobre.`
      const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
      expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES }).manquements.map((m) => m.code), texte).toContain('vocabulaire-interdit')
    }
    for (const texte of admis) {
      const sortie = sortieConforme()
      sortie.axes[0]!.faits[0]!.texte = `${texte} Le texte est paru le 21 octobre.`
      const lettre = assemblerLaLettre(sortie, RÉFÉRENTIEL, SÉLECTION)
      expect(contrôlerLaProduction({ lettre, sortie, sélection: SÉLECTION, urlsAdmises: URLS_ADMISES }).manquements.map((m) => m.code), texte).not.toContain('vocabulaire-interdit')
    }
  })

  it('relève les URL d’un Markdown', () => {
    expect(urlsDuMarkdown('voir [a](https://a.fr/x) et https://b.fr/y.')).toEqual(['https://a.fr/x', 'https://b.fr/y'])
  })
})

// ── Collecte ────────────────────────────────────────────────────────────────

describe('collecterLesSources', () => {
  const pages = new Map<string, string>()
  for (let i = 1; i <= AXES; i += 1) {
    pages.set(URL(i), `<html><head><title>t</title><script>x()</script></head><body><h1>Axe ${i}</h1><p>Première phrase stable de la source numéro ${i}, écrite pour durer et pour dépasser le seuil de longueur d’une page utile.</p><p>Seconde phrase, elle aussi stable et suffisamment longue pour que la page compte comme ouverte et lisible par le programme.</p></body></html>`)
  }
  const fauxFetch = (async (entrée: string | URL | Request) => {
    const url = String(entrée)
    if (url === URL(3)) return new Response('', { status: 503 })
    const html = pages.get(url)
    return html ? new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }) : new Response('', { status: 404 })
  }) as typeof fetch

  it('extrait le texte utile, mesure la couverture et marque ce qui a changé', async () => {
    const premières = await collecterLesSources(RÉFÉRENTIEL, { fetch: fauxFetch, parallèle: 3 })
    expect(premières).toHaveLength(AXES)
    const ouverte = premières.find((l) => l.url === URL(1))!
    expect(ouverte.état).toBe('ouverte')
    expect(ouverte.texte).not.toContain('<p>')
    expect(ouverte.texte).not.toContain('x()')
    expect(ouverte.changée).toBeNull()
    expect(ouverte.nouveautés).toHaveLength(2)
    expect(premières.find((l) => l.url === URL(3))!.état).toBe('http-503')
    const couverture = couvertureDe(premières)
    expect(couverture).toMatchObject({ nommées: AXES, ouvertes: AXES - 1 })
    expect(couverture.fermées).toEqual([{ url: URL(3), état: 'http-503' }])

    const gel = new Map<string, Gel>()
    for (const l of premières) if (l.état === 'ouverte') gel.set(l.url, { empreinte: l.empreinte, phrases: phrasesDuTexte(l.texte) })
    pages.set(URL(1), pages.get(URL(1))!.replace('</body>', '<p>Une troisième phrase, nouvelle cette semaine, annonce un décret.</p></body>'))
    const secondes = await collecterLesSources(RÉFÉRENTIEL, { fetch: fauxFetch, gel })
    const changée = secondes.find((l) => l.url === URL(1))!
    expect(changée.changée).toBe(true)
    expect(changée.nouveautés).toEqual(['Une troisième phrase, nouvelle cette semaine, annonce un décret.'])
    expect(secondes.find((l) => l.url === URL(2))!.changée).toBe(false)
    expect(secondes.find((l) => l.url === URL(2))!.nouveautés).toEqual([])
  })

  it('passe au navigateur une source fermée et le ferme à la fin', async () => {
    let fermé = false
    const lectures = await collecterLesSources(RÉFÉRENTIEL, {
      fetch: fauxFetch,
      ouvrirNavigateur: async () => ({
        lire: async (url) => ({ statut: 200, texte: url === URL(3) ? `Texte rendu par le navigateur pour la source trois. ${'Encore une phrase de contenu. '.repeat(8)}` : '' }),
        fermer: async () => {
          fermé = true
        },
      }),
    })
    expect(lectures.find((l) => l.url === URL(3))!.état).toBe('ouverte-navigateur')
    expect(fermé).toBe(true)
  })

  it('versTexte retire scripts, styles et balises, et garde les sauts utiles', () => {
    expect(versTexte('<style>a{}</style><p>Un.</p><p>Deux &amp; trois.</p>')).toBe('Un.\nDeux & trois.')
  })
})

// ── Le cycle entier, avec un rédacteur simulé ───────────────────────────────

function rédacteurSimulé(réponses: SortieRédigée[]): Rédacteur & { corrections: string[] } {
  const corrections: string[] = []
  let i = 0
  return {
    modèle: 'claude-opus-5-5',
    usage: { entrée: 1000, sortie: 500, cacheLecture: 0, cacheÉcriture: 0 },
    corrections,
    rédiger: async () => réponses[i++]!,
    reprendre: async (c) => {
      corrections.push(c)
      return réponses[i++]!
    },
  }
}

const fetchDuCycle = (async (entrée: string | URL | Request) =>
  new Response(`<p>Le texte est paru le 21 octobre et complété le 20 octobre, ${String(entrée)}. Une seconde phrase stable et longue, qui fait passer la page au-dessus du seuil de deux cents caractères, pour que la collecte la compte comme ouverte.</p>`, { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch

/** Une sortie dont chaque axe a de la matière : les axes sans nouveauté portent deux relevés de page datés du jour de l'édition. */
function sortieAvecReleves(): SortieRédigée {
  const sortie = sortieConforme()
  sortie.axes = sortie.axes.map((axe) =>
    axe.niveau === 'RAS'
      ? {
          ...axe,
          niveau: 'MOYEN' as const,
          faits: [
            { texte: `Au 26 octobre, la source ${axe.numéro} affiche une grille de deux formules.`, date: SÉLECTION.dateÉdition, url: URL(axe.numéro), autresUrls: [], contexte: true },
            { texte: `Au 26 octobre, la source ${axe.numéro} affiche un délai de trois jours.`, date: SÉLECTION.dateÉdition, url: URL(axe.numéro), autresUrls: [], contexte: true },
          ],
        }
      : axe,
  )
  return sortie
}

describe('produireLaLettre', () => {
  it('accepte une première rédaction conforme sans reprise, et rend le gel suivant', async () => {
    const rédacteur = rédacteurSimulé([sortieAvecReleves()])
    const production = await produireLaLettre(
      { référentiel: RÉFÉRENTIEL, sélection: SÉLECTION },
      { anthropic: {} as Anthropic, rédacteur, rechercher: null, fetch: fetchDuCycle },
    )
    expect(production.acceptée).toBe(true)
    expect(production.mesures.reprises).toBe(0)
    expect(production.mesures.couverture.taux).toBe(1)
    expect(production.mesures.faits).toBe(24)
    expect(production.mesures.coût).toBeCloseTo((1000 * 4 + 500 * 20) / 1_000_000, 6)
    expect(production.collecte.gelSuivant.size).toBe(AXES)
    expect(production.lettre.blocs.length).toBeGreaterThan(20)
  })

  it('reprend sur un manquement avec le message de reprise, puis accepte', async () => {
    const fausse = sortieAvecReleves()
    fausse.axes[0]!.faits[0]!.url = 'https://invente.example/x'
    const rédacteur = rédacteurSimulé([fausse, sortieAvecReleves()])
    const journal: string[] = []
    const production = await produireLaLettre(
      { référentiel: RÉFÉRENTIEL, sélection: SÉLECTION },
      { anthropic: {} as Anthropic, rédacteur, rechercher: null, fetch: fetchDuCycle, journal: (l) => journal.push(l) },
    )
    expect(production.acceptée).toBe(true)
    expect(production.mesures.reprises).toBe(1)
    expect(rédacteur.corrections[0]).toContain('citation-non-ouverte')
    expect(journal.some((l) => l.startsWith('reprise 1'))).toBe(true)
  })

  it('s’arrête après deux reprises et rend la lettre non acceptée, avec ses manquements', async () => {
    const fausse = sortieAvecReleves()
    fausse.axes[0]!.faits[0]!.url = 'https://invente.example/x'
    const rédacteur = rédacteurSimulé([fausse, fausse, fausse])
    const production = await produireLaLettre(
      { référentiel: RÉFÉRENTIEL, sélection: SÉLECTION },
      { anthropic: {} as Anthropic, rédacteur, rechercher: null, fetch: fetchDuCycle },
    )
    expect(production.acceptée).toBe(false)
    expect(production.mesures.reprises).toBe(2)
    expect(production.contrôle.manquements.map((m) => m.code)).toContain('citation-non-ouverte')
  })

  it('admet les URL des résultats de recherche comme sources', async () => {
    const sortie = sortieAvecReleves()
    sortie.axes[0]!.faits[0]!.url = 'https://presse.example/article'
    const rédacteur = rédacteurSimulé([sortie])
    const production = await produireLaLettre(
      { référentiel: RÉFÉRENTIEL, sélection: SÉLECTION },
      {
        anthropic: {} as Anthropic,
        rédacteur,
        fetch: fetchDuCycle,
        rechercher: async () => ({
          résultats: [{ axe: 1, titre: 'Un article', url: 'https://presse.example/article', date: '2026-10-21', extrait: 'Le décret est paru.' }],
          urlsOuvertes: ['https://presse.example/article'],
          recherches: 3,
          usage: { input_tokens: 100, output_tokens: 50 },
          modèle: 'claude-opus-5-5',
        }),
      },
    )
    expect(production.acceptée).toBe(true)
    expect(production.mesures.recherches).toBe(3)
    expect(production.mesures.usage.entrée).toBe(1100)
  })
})
