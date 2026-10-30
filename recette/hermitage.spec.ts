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
  { nom: 'recommandations', chemin: `/${SLUG}/recommandations` },
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

  test('vue d’ensemble : la lecture stratégique', async () => {
    await ouvrir(`/${SLUG}`, 'vue-d-ensemble')
    await expect(page.getByRole('heading', { name: 'Lecture stratégique' })).toBeVisible()
    await expect(page.getByText('outil en test').first()).toBeVisible()
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
    expect((await page.request.get(`/${SLUG}/concurrents/un-concurrent-qui-n-existe-pas`, { maxRedirects: 0 })).status()).toBe(404)
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

  test('recommandations : septembre, puis le trimestre de juillet à septembre', async () => {
    await ouvrir(`/${SLUG}/recommandations`, 'recommandations')
    for (const titre of ['Options stratégiques', 'Votre situation', 'Intensité des cinq forces', 'Trois scénarios']) {
      await expect(page.getByRole('heading', { name: titre })).toBeVisible()
    }
    await expect(page.getByText(/Trimestre de juillet à septembre 2026/)).toBeVisible()
    await expect(page.getByText(/Option retenue, synthèse de septembre 2026/i)).toBeVisible()
  })

  test('les axes : l’onglet PESTEL nomme les familles mensuelles', async () => {
    await ouvrir(`/${SLUG}/axes`, 'axes')
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
