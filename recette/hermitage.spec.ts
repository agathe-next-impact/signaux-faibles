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
const LIEN = process.env['RECETTE_LIEN_HERMITAGE'] ?? ''
const SORTIES = process.env['RECETTE_SORTIES'] ?? 'recette-sorties'

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
    opérateur = new URL(page.url()).pathname.startsWith('/espaces')
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
    expect(page.url()).not.toContain('/acces/')
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

  test('acteurs : carte des groupes stratégiques et Mendelow de septembre', async () => {
    await ouvrir(`/${SLUG}/acteurs`, 'acteurs')
    await expect(page.getByRole('heading', { name: 'Carte des groupes stratégiques' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Parties prenantes' })).toBeVisible()
    await expect(page.getByText('synthèse de septembre 2026')).toBeVisible()
    await expect(page.getByText('Château du Feÿ').first()).toBeVisible()
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
