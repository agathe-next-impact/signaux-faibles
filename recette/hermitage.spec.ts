import { mkdirSync } from 'node:fs'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/**
 * Recette de l'espace de L'Hermitage sur le portail déployé (29 octobre 2026) :
 * les écrans des outils stratégiques et le cloisonnement (règle 7).
 *
 * Deux parties. Sans session, ce qui se vérifie depuis n'importe où : les écrans
 * ne s'ouvrent pas et ne laissent rien passer. Avec la session d'un lecteur de
 * L'Hermitage, dont le lien vient de `RECETTE_LIEN_HERMITAGE` (secret GitHub) :
 * les écrans montrent les synthèses publiées, et le HTML envoyé ne porte rien
 * d'une autre organisation du pilote. Un lien d'opérateur ouvre aussi les
 * écrans, mais ne prouve pas le cloisonnement : cette partie est alors sautée.
 *
 * Le lien ne s'affiche jamais : une navigation qui échoue lève une erreur sans
 * adresse, et aucune trace n'est gardée.
 */

const SLUG = 'hermitage'
// Le secret peut porter le lien complet ou le seul jeton ; un blanc, des
// guillemets ou des chevrons collés avec lui ne doivent pas fausser la signature.
const BRUT = (process.env['RECETTE_LIEN_HERMITAGE'] ?? '').trim().replace(/^[<"'«\s]+|[>"'»\s]+$/g, '')
const LIEN = !BRUT ? '' : /^https?:\/\//.test(BRUT) ? BRUT : `/acces/${BRUT.replace(/^\/?acces\//, '')}`
const SORTIES = process.env['RECETTE_SORTIES'] ?? 'recette-sorties'

/**
 * La forme du secret, pour comprendre un refus sans rien en montrer : où il
 * mène, combien de morceaux porte le jeton, s'ils sont en base64url, et la
 * forme de l'identifiant décodé (longueur, hexadécimal ou non). Ni le jeton,
 * ni l'identifiant, ni la signature ne sont écrits.
 */
function formeDuLien(brut: string): string {
  const préfixe = /^https?:\/\/[^/]+\/acces\//.exec(brut)?.[0]
  const hôte = préfixe ? new URL(préfixe).host : null
  const jeton = (préfixe ? brut.slice(préfixe.length) : brut.replace(/^\/?acces\//, '')).split(/[?#]/)[0] ?? ''
  const décodé = (() => {
    try {
      return decodeURIComponent(jeton)
    } catch {
      return jeton
    }
  })()
  const morceaux = décodé.split('.')
  const horsBase64 = [...décodé].filter((c) => !/[A-Za-z0-9_.-]/.test(c)).length
  let identifiant = ''
  try {
    identifiant = Buffer.from(morceaux[0] ?? '', 'base64url').toString('utf8')
  } catch {
    identifiant = ''
  }
  const signature = Buffer.from(morceaux[1] ?? '', 'base64url').length
  return [
    préfixe ? `lien complet vers ${hôte}` : /^https?:/.test(brut) ? 'adresse qui ne mène pas à /acces/' : 'jeton seul',
    `${brut.length} caractères au total`,
    `${morceaux.length} morceau(x) séparés par un point (2 attendus)`,
    `${horsBase64} caractère(s) hors base64url dans le jeton`,
    `identifiant de ${identifiant.length} caractères${/^[0-9a-f]+$/i.test(identifiant) ? ', hexadécimal' : ', pas hexadécimal'}`,
    `signature de ${signature} octets (32 attendus)`,
  ].join(' ; ')
}

/** Les autres organisations du pilote : leur nom ne doit figurer dans aucune page de L'Hermitage. */
const AUTRES = [
  { slug: 'mastora', nom: 'Mastora' },
  { slug: 'infralliance', nom: 'Infralliance' },
  { slug: 'heritech', nom: 'Heritech' },
  { slug: 'konica-minolta-france', nom: 'Konica Minolta' },
]

const ÉCRANS = [
  { nom: 'vue-d-ensemble', chemin: `/${SLUG}` },
  { nom: 'lettres', chemin: `/${SLUG}/lettres` },
  { nom: 'axes', chemin: `/${SLUG}/axes` },
  { nom: 'concurrents', chemin: `/${SLUG}/concurrents` },
  { nom: 'acteurs', chemin: `/${SLUG}/acteurs` },
  { nom: 'forces', chemin: `/${SLUG}/forces` },
  { nom: 'pestel', chemin: `/${SLUG}/pestel` },
  { nom: 'diagnostic', chemin: `/${SLUG}/diagnostic` },
  { nom: 'recommandations', chemin: `/${SLUG}/recommandations` },
  { nom: 'scenarios', chemin: `/${SLUG}/scenarios` },
  { nom: 'archives', chemin: `/${SLUG}/archives` },
  { nom: 'perimetre', chemin: `/${SLUG}/perimetre` },
]

test.describe('sans session', () => {
  for (const écran of ÉCRANS) {
    test(`${écran.chemin} renvoie au formulaire sans rien montrer`, async ({ page }) => {
      const réponse = await page.goto(écran.chemin)
      await expect(page).toHaveURL(/\/recevoir-mon-lien/)
      const html = (await réponse?.text()) ?? ''
      for (const marque of ['Carte des groupes stratégiques', 'Lecture stratégique', 'Options stratégiques', 'Château du Feÿ']) {
        expect(html, `« ${marque} » dans la réponse de ${écran.chemin}`).not.toContain(marque)
      }
    })
  }

  test('un jeton falsifié ne pose aucun cookie', async ({ page, context }) => {
    await page.goto('/acces/Y29ycHM.c2lnbmF0dXJlLWZhdXNzZQ')
    await expect(page).toHaveURL(/\/recevoir-mon-lien/)
    expect((await context.cookies()).find((c) => c.name === 'sf_acces')).toBeUndefined()
  })
})

test.describe('avec la session d’un lecteur de L’Hermitage', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!LIEN, 'RECETTE_LIEN_HERMITAGE absent : partie sautée')

  let contexte: BrowserContext
  let page: Page
  let opérateur = false
  /** Où le lien a mené, sans le jeton : un chemin et ses paramètres. */
  let arrivée = ''

  test.beforeAll(async ({ browser }) => {
    mkdirSync(SORTIES, { recursive: true })
    contexte = await browser.newContext()
    page = await contexte.newPage()
    try {
      await page.goto(LIEN)
    } catch {
      // Jamais l'erreur d'origine : elle porte l'adresse, donc le jeton.
      throw new Error('le lien de recette n’a pas abouti')
    }
    const url = new URL(page.url())
    arrivée = url.pathname.startsWith('/acces/') ? '/acces/…' : `${url.pathname}${url.search}`
    opérateur = url.pathname.startsWith('/espaces')
  })

  test.afterAll(async () => {
    await contexte?.close()
  })

  async function ouvrir(chemin: string, capture: string): Promise<void> {
    const réponse = await page.goto(chemin)
    expect(réponse?.status(), `statut de ${chemin}`).toBe(200)
    await expect(page, `${chemin} ne doit pas renvoyer ailleurs`).toHaveURL(new RegExp(`${chemin.replace(/\//g, '\\/')}(\\?|#|$)`))
    await page.screenshot({ path: `${SORTIES}/${capture}.png`, fullPage: true })
  }

  test('le lien pose la session et disparaît de l’adresse', async () => {
    expect(
      arrivée.startsWith('/recevoir-mon-lien'),
      `le portail a refusé le lien et renvoyé vers ${arrivée} : jeton invalide, ligne d'accès inactive ou identifiant porté par deux lignes. Forme du secret : ${formeDuLien(BRUT)}`,
    ).toBe(false)
    expect(arrivée, 'le lien doit mener à l’espace de L’Hermitage ou au sélecteur').toMatch(/^\/(hermitage|espaces)(\?|$)/)
    const cookie = (await contexte.cookies()).find((c) => c.name === 'sf_acces')
    expect(cookie, 'cookie de session').toBeDefined()
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.secure).toBe(true)
  })

  /** Depuis le 30 octobre 2026, aucune vue d'ensemble n'affiche plus la lecture stratégique. */
  test('vue d’ensemble : sans lecture stratégique', async () => {
    await ouvrir(`/${SLUG}`, 'vue-d-ensemble')
    await expect(page.getByRole('heading', { name: 'Lecture stratégique' })).toHaveCount(0)
  })

  /**
   * L'espace réorganisé (lot 2, 30 octobre 2026) : la carte passe sur
   * « Concurrents », Mendelow reste sur « Acteurs ». Tant que l'espace de
   * L'Hermitage n'est pas réorganisé, « Concurrents » répond 404 et la carte est
   * attendue sur « Acteurs », comme avant.
   */
  let réorganisé = false

  test('concurrents : carte, liste et fiche d’un concurrent, si l’espace est réorganisé', async () => {
    const réponse = await page.goto(`/${SLUG}/concurrents`)
    réorganisé = réponse?.status() === 200
    test.skip(!réorganisé, 'espace de L’Hermitage non réorganisé : écran absent, la carte est vérifiée sur « Acteurs »')
    await expect(page.getByRole('heading', { name: 'Qui vous dispute vos clients' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Carte des groupes stratégiques' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Les concurrents suivis' })).toBeVisible()
    await expect(page.getByText('synthèse de septembre 2026')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Concurrents' }).first()).toBeVisible()
    await page.screenshot({ path: `${SORTIES}/concurrents.png`, fullPage: true })
    await ouvrir(`/${SLUG}/concurrents/chateau-du-fey`, 'fiche-concurrent')
    await expect(page.getByRole('heading', { name: 'Château du Feÿ', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sa position' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ses faits datés' })).toBeVisible()
    // Un concurrent hors de la grille : la page introuvable. Le cadre de l'espace
    // est déjà parti en flux quand la fiche appelle `notFound()` : le statut reste
    // 200, comme pour un acteur inconnu, et c'est le contenu qui fait foi.
    await page.goto(`/${SLUG}/concurrents/un-concurrent-qui-n-existe-pas`)
    await expect(page.getByRole('heading', { name: 'Rien à cette adresse' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sa position' })).toHaveCount(0)
  })

  test('acteurs : Mendelow de septembre, et la carte si l’espace n’est pas réorganisé', async () => {
    await ouvrir(`/${SLUG}/acteurs`, 'acteurs')
    await expect(page.getByRole('heading', { name: 'Parties prenantes' })).toBeVisible()
    if (réorganisé) {
      await expect(page.getByRole('heading', { name: 'Qui pèse sur votre activité' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Carte des groupes stratégiques' })).toHaveCount(0)
    } else {
      await expect(page.getByRole('heading', { name: 'Carte des groupes stratégiques' })).toBeVisible()
      await expect(page.getByText('synthèse de septembre 2026')).toBeVisible()
      await expect(page.getByText('Château du Feÿ').first()).toBeVisible()
    }
  })

  /**
   * Un écran par outil (lot 3, 30 octobre 2026) : la SWOT, les forces, les
   * scénarios et le PESTEL sortent de « Recommandations » et de « Les axes ».
   * Tant que le lot n'est pas déployé, « Diagnostic » n'existe pas : ces écrans
   * sont sautés et les anciens sont vérifiés comme avant.
   */
  let parOutil = false

  test('stratégie par outil : diagnostic, scénarios, forces et PESTEL, et le rail en rubriques', async () => {
    await page.goto(`/${SLUG}/diagnostic`)
    parOutil = réorganisé && (await page.getByRole('heading', { name: 'Où en êtes-vous' }).isVisible())
    test.skip(!parOutil, 'écrans par outil absents : lot 3 non déployé ou espace non réorganisé')
    await expect(page.getByRole('heading', { name: 'Votre situation' })).toBeVisible()
    // « Stratégie » seul jusqu'au 30 octobre 2026, puis « Stratégie → », lien vers l'écran de la rubrique.
    await expect(page.locator('nav[aria-label="Sections"]').first().getByText(/^Stratégie( →)?$/)).toBeVisible()
    await page.screenshot({ path: `${SORTIES}/diagnostic.png`, fullPage: true })
    await ouvrir(`/${SLUG}/scenarios`, 'scenarios')
    await expect(page.getByRole('heading', { name: 'Trois scénarios' })).toBeVisible()
    await ouvrir(`/${SLUG}/forces`, 'forces')
    await expect(page.getByRole('heading', { name: 'Intensité des cinq forces' })).toBeVisible()
    await expect(page.getByText(/Trimestre de juillet à septembre 2026/)).toBeVisible()
    await ouvrir(`/${SLUG}/pestel`, 'pestel')
    await expect(page.getByText('Technologies et substituts').first()).toBeVisible()
    await expect(page.getByText('Influence et parties prenantes').first()).toBeVisible()
    await expect(page.getByText(/^Famille \d+$/)).toHaveCount(0)
  })

  test('lecture rapide : tableau de bord en cases, bandeaux « En bref », listes repliées', async () => {
    test.skip(!parOutil, 'écrans par outil absents')
    await page.goto(`/${SLUG}`)
    const espace = await page.getByRole('heading', { name: 'Votre espace' }).isVisible()
    test.skip(!espace, 'lot 4 non déployé : pas de tableau de bord en cases')
    // Onze cases au lot 4, douze au lot 5, puis quatre cartes de rubrique (30 octobre 2026).
    const cases = await page.getByRole('list', { name: 'Les écrans de votre espace' }).getByRole('listitem').count()
    const rubriques = await page.getByRole('list', { name: 'Les rubriques de votre espace' }).getByRole('listitem').count()
    expect([11, 12]).toContain(cases + rubriques * 3)
    await page.screenshot({ path: `${SORTIES}/tableau-de-bord.png`, fullPage: true })
    await ouvrir(`/${SLUG}/concurrents`, 'concurrents-lot4')
    await expect(page.getByRole('region', { name: 'En bref' })).toBeVisible()
    await expect(page.getByText(/Voir les \d+ autres concurrents/)).toBeVisible()
    await ouvrir(`/${SLUG}/diagnostic`, 'diagnostic-lot4')
    await expect(page.getByRole('region', { name: 'En bref' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Fait du .* lettre n° \d+$/ }).first()).toBeVisible()
  })

  test('graphiques : indicateurs, forces en crans, PESTEL en barres, chaleur des axes, activité', async () => {
    test.skip(!parOutil, 'écrans par outil absents')
    await page.goto(`/${SLUG}/indicateurs`)
    const lot5 = await page.getByRole('heading', { name: 'Le secteur grandit-il' }).isVisible()
    test.skip(!lot5, 'lot 5 non déployé : pas d’écran « Indicateurs »')
    await page.screenshot({ path: `${SORTIES}/indicateurs.png`, fullPage: true })
    await expect(page.getByRole('heading', { name: 'Entrées et sorties du marché' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Chiffre d’affaires publié, par entité' })).toBeVisible()
    await ouvrir(`/${SLUG}/forces`, 'forces-lot5')
    await expect(page.getByRole('img', { name: /^cran \d sur 3$/ }).first()).toBeVisible()
    await ouvrir(`/${SLUG}/pestel`, 'pestel-lot5')
    await expect(page.getByRole('list', { name: 'Politique, faits par mois' })).toBeVisible()
    await ouvrir(`/${SLUG}/axes`, 'axes-lot5')
    await expect(page.getByRole('heading', { name: 'Les axes sur huit semaines' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Niveau des axes sur les huit dernières semaines' })).toBeVisible()
    await ouvrir(`/${SLUG}`, 'tableau-de-bord-lot5')
    await expect(page.getByRole('list', { name: /^Faits relevés par semaine/ })).toBeVisible()
  })

  test('rubriques : quatre cartes sur la vue d’ensemble, chaque écran de rubrique avec la grille de ses écrans', async () => {
    test.skip(!parOutil, 'écrans par outil absents')
    await page.goto(`/${SLUG}/marche`)
    const déployé = await page.getByRole('heading', { name: 'Le marché' }).isVisible()
    test.skip(!déployé, 'écrans de rubrique non déployés')
    await page.screenshot({ path: `${SORTIES}/rubrique-marche.png`, fullPage: true })
    await expect(page.getByRole('list', { name: 'Les écrans de la rubrique Le marché' }).getByRole('listitem')).toHaveCount(3)
    await ouvrir(`/${SLUG}/strategie`, 'rubrique-strategie')
    await expect(page.getByRole('list', { name: 'Les écrans de la rubrique Stratégie' }).getByRole('listitem')).toHaveCount(4)
    await ouvrir(`/${SLUG}/environnement`, 'rubrique-environnement')
    await expect(page.getByRole('list', { name: 'Les écrans de la rubrique L’environnement' }).getByRole('listitem')).toHaveCount(2)
    await ouvrir(`/${SLUG}/veille`, 'rubrique-veille')
    // Deux écrans avant le lot 6, six après (thèmes, sources, corpus, calendrier).
    expect([2, 6]).toContain(await page.getByRole('list', { name: 'Les écrans de la rubrique Votre veille' }).getByRole('listitem').count())
    await ouvrir(`/${SLUG}`, 'tableau-de-bord-rubriques')
    await expect(page.getByRole('list', { name: 'Les rubriques de votre espace' }).getByRole('listitem')).toHaveCount(4)
    await expect(page.locator('nav[aria-label="Sections"]').first().getByRole('link', { name: 'Stratégie →' })).toBeVisible()
  })

  test('PESTEL : chaque axe qui suit une dimension mène à l’écran de ses faits', async () => {
    test.skip(!parOutil, 'écrans par outil absents')
    await ouvrir(`/${SLUG}/pestel`, 'pestel-axes')
    const lien = page.locator('a[href^="/' + SLUG + '/pestel/"]').first()
    test.skip((await lien.count()) === 0, 'écran des faits d’un axe non déployé')
    const cible = await lien.getAttribute('href')
    await lien.click()
    await expect(page).toHaveURL(new RegExp(`${cible}$`))
    await expect(page.getByRole('link', { name: /Retour au PESTEL/ })).toBeVisible()
    await expect(page.getByText(/fait(s)? en treize semaines/i).first()).toBeVisible()
    await page.screenshot({ path: `${SORTIES}/pestel-axe.png`, fullPage: true })
    // Un segment absent de la grille ne mène à rien.
    await page.goto(`/${SLUG}/pestel/axe-qui-n-existe-pas`)
    await expect(page.getByRole('heading', { name: 'Rien à cette adresse' })).toBeVisible()
  })

  test('votre veille : thèmes, sources, corpus et calendrier, publiés ou annoncés', async () => {
    test.skip(!parOutil, 'écrans par outil absents')
    await page.goto(`/${SLUG}/veille/themes`)
    const déployé = await page.getByRole('heading', { name: 'Ce que nous surveillons pour vous' }).isVisible()
    test.skip(!déployé, 'lot 6 non déployé : pas d’écrans « Votre veille »')
    await page.screenshot({ path: `${SORTIES}/veille-themes.png`, fullPage: true })
    // Une case par famille de la grille, chacune menant aux faits de son axe.
    expect(await page.locator('a[href^="/' + SLUG + '/pestel/"]').count()).toBeGreaterThan(0)
    await ouvrir(`/${SLUG}/veille/corpus`, 'veille-corpus')
    await expect(page.getByRole('heading', { name: 'Concurrents suivis' })).toBeVisible()
    await expect(page.locator('a[href^="/' + SLUG + '/concurrents/"]').first()).toBeVisible()
    for (const [chemin, titre] of [
      ['sources', 'Où nous regardons'],
      ['calendrier', 'Ce que nous attendons'],
    ] as const) {
      await ouvrir(`/${SLUG}/veille/${chemin}`, `veille-${chemin}`)
      await expect(page.getByRole('heading', { name: titre })).toBeVisible()
      // Publiée ou non, l'écran dit quelque chose : la fiche, ou qu'elle n'est pas encore publiée.
      await expect(page.locator('main')).toContainText(/n’est pas encore publié|Votre environnement|Votre concurrence|Les douze prochains mois/)
    }
  })

  test('recommandations : l’option retenue de septembre, et le reste selon l’espace', async () => {
    await ouvrir(`/${SLUG}/recommandations`, 'recommandations')
    await expect(page.getByRole('heading', { name: 'Options stratégiques' })).toBeVisible()
    await expect(page.getByText(/Option retenue, synthèse de septembre 2026/i)).toBeVisible()
    if (parOutil) {
      // Les codes des options mènent au diagnostic ; la SWOT et le trimestre n'y sont plus.
      await expect(page.getByRole('heading', { name: 'Votre situation' })).toHaveCount(0)
      await expect(page.locator(`a[href^="/${SLUG}/diagnostic#"]`).first()).toBeVisible()
    } else {
      for (const titre of ['Votre situation', 'Intensité des cinq forces', 'Trois scénarios']) {
        await expect(page.getByRole('heading', { name: titre })).toBeVisible()
      }
      await expect(page.getByText(/Trimestre de juillet à septembre 2026/)).toBeVisible()
    }
  })

  test('les axes : le PESTEL nomme les familles mensuelles, en onglet ou en écran', async () => {
    await ouvrir(`/${SLUG}/axes`, 'axes')
    if (parOutil) {
      await expect(page.getByRole('tab', { name: 'PESTEL' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: /dimensions PESTEL/ })).toBeVisible()
      return
    }
    await page.getByRole('tab', { name: 'PESTEL' }).click()
    const panneau = page.getByRole('tabpanel')
    await expect(panneau.getByText('Technologies et substituts').first()).toBeVisible()
    await expect(panneau.getByText('Influence et parties prenantes').first()).toBeVisible()
    await expect(panneau.getByText(/^Famille \d+$/)).toHaveCount(0)
    await page.screenshot({ path: `${SORTIES}/axes-pestel.png`, fullPage: true })
  })

  test('les autres écrans s’ouvrent', async () => {
    for (const écran of ÉCRANS.filter((é) => ['lettres', 'archives', 'perimetre'].includes(é.nom))) {
      await ouvrir(écran.chemin, écran.nom)
    }
  })

  test('cloisonnement : aucune autre organisation dans le HTML, aucun autre espace ouvert', async () => {
    test.skip(opérateur, 'lien d’opérateur : il ouvre tous les espaces, le cloisonnement ne se prouve qu’avec un lecteur')
    for (const écran of ÉCRANS) {
      // Le HTML tel qu'il part, charge RSC comprise, et non la page rendue.
      const html = await (await page.request.get(écran.chemin)).text()
      for (const autre of AUTRES) {
        expect(html.includes(autre.nom), `« ${autre.nom} » dans ${écran.chemin}`).toBe(false)
      }
    }
    for (const autre of AUTRES) {
      const réponse = await page.request.get(`/${autre.slug}`, { maxRedirects: 0 })
      expect(réponse.status(), `/${autre.slug} pour un lecteur de L'Hermitage`).toBe(404)
    }
  })
})
