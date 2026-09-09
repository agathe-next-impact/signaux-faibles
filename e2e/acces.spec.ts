import { expect, test } from '@playwright/test'

/**
 * Les chemins de refus.
 *
 * Sans RLS derrière, le cloisonnement tient à du code. Ces parcours vérifient
 * que le premier verrou — celui du proxy et de la route d'accès — ferme bien,
 * et qu'aucun d'eux ne devient un oracle sur les identifiants valides.
 */

test('un visiteur sans cookie est renvoyé vers le formulaire, pas vers une erreur', async ({
  page,
}) => {
  await page.goto('/hermitage')
  await expect(page).toHaveURL(/\/recevoir-mon-lien/)
  await expect(page.getByRole('heading', { name: 'Recevoir mon lien' })).toBeVisible()
})

test('la racine oriente vers le formulaire quand il n’y a pas de session', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/recevoir-mon-lien/)
})

test('un jeton falsifié ne pose aucun cookie', async ({ page, context }) => {
  await page.goto('/acces/Y29ycHM.c2lnbmF0dXJlLWZhdXNzZQ')
  await expect(page).toHaveURL(/\/recevoir-mon-lien/)

  const cookies = await context.cookies()
  expect(cookies.find((cookie) => cookie.name === 'sf_acces')).toBeUndefined()
})

test('un cookie fabriqué ne franchit pas le proxy', async ({ context, page }) => {
  await context.addCookies([
    {
      name: 'sf_acces',
      value: 'Y29ycHM.c2lnbmF0dXJlLWZhdXNzZQ',
      domain: '127.0.0.1',
      path: '/',
    },
  ])
  await page.goto('/hermitage')
  await expect(page).toHaveURL(/\/recevoir-mon-lien/)
})

test('le formulaire répond la même chose à une adresse inconnue', async ({ page }) => {
  await page.goto('/recevoir-mon-lien')
  await page.getByLabel('Votre adresse professionnelle').fill('inconnu@exemple.test')
  await page.getByRole('button', { name: 'Recevoir', exact: true }).click()

  // Ni « adresse inconnue », ni « accès révoqué » : une seule réponse.
  await expect(page.getByText(/le lien vient d’y être envoyé|n’a pas abouti/)).toBeVisible()
})

test('le proxy des médias ne sert rien sans session', async ({ request }) => {
  const réponse = await request.get('/api/media/3d6fe829ce7181ef8b08eb569c4e4653')
  expect(réponse.status()).toBe(404)
})

test('le webhook refuse une charge non signée', async ({ request }) => {
  const réponse = await request.post('/api/webhooks/notion', {
    data: { type: 'page.content_updated', entity: { id: 'x', type: 'page' } },
  })
  expect(réponse.status()).toBe(401)
})

test('aucune page du portail n’est indexable', async ({ page }) => {
  await page.goto('/recevoir-mon-lien')
  const robots = page.locator('meta[name="robots"]')
  await expect(robots).toHaveAttribute('content', /noindex/)
})
