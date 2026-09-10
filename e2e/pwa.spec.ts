import { spawn, type ChildProcess } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { FACTICES } from '../playwright.config'

/**
 * L'application installable et son fonctionnement hors ligne.
 *
 * Le hors-ligne ne se vérifie pas avec `context.setOffline` : le drapeau ne
 * s'applique pas aux requêtes émises par le service worker, qui continuent
 * d'atteindre le serveur — un test « hors ligne » y passerait sans rien
 * prouver. On démarre donc un serveur à nous, on chauffe le cache, puis on
 * l'arrête pour de bon. C'est la seule coupure fidèle.
 */
const PORT = 3101
const BASE = `http://127.0.0.1:${PORT}`

test.describe('installation et hors-ligne', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })

  let serveur: ChildProcess | null = null

  test.beforeAll(async () => {
    // Un serveur resté du run précédent tiendrait le port et répondrait à sa
    // place : le test « serveur coupé » tournerait alors serveur debout, et
    // passerait sans rien prouver. On refuse de démarrer plutôt que de mentir.
    const occupé = await fetch(`${BASE}/hors-ligne`).then(() => true, () => false)
    if (occupé) throw new Error(`le port ${PORT} est déjà pris, arrêtez ce serveur`)

    serveur = spawn('npx', ['next', 'start', '--port', String(PORT)], {
      env: { ...process.env, ...FACTICES, PORTAIL_URL: BASE },
      stdio: 'ignore',
      // `npx` n'est qu'un lanceur : c'est son petit-fils qui écoute. Sans
      // groupe de processus dédié, l'arrêt ne tuerait que le lanceur et le
      // serveur resterait debout — le test « hors ligne » passerait en ligne.
      detached: true,
    })
    const limite = Date.now() + 120_000
    for (;;) {
      try {
        const réponse = await fetch(`${BASE}/hors-ligne`)
        if (réponse.ok) break
      } catch {
        // Le serveur n'écoute pas encore.
      }
      if (Date.now() > limite) throw new Error('le serveur de test n’a pas démarré')
      await new Promise((suite) => setTimeout(suite, 500))
    }
  })

  /** Arrête le serveur et tout ce qu'il a lancé. */
  function couperLeServeur() {
    if (!serveur?.pid) return
    try {
      process.kill(-serveur.pid, 'SIGKILL')
    } catch {
      // Déjà parti.
    }
    serveur = null
  }

  test.afterAll(couperLeServeur)

  test('le manifeste décrit une application installable', async ({ request }) => {
    const réponse = await request.get(`${BASE}/manifest.webmanifest`)
    expect(réponse.ok()).toBe(true)

    const manifeste = await réponse.json()
    expect(manifeste.display).toBe('standalone')
    expect(manifeste.start_url).toBe('/')
    expect(manifeste.icons.length).toBeGreaterThanOrEqual(2)
    expect(manifeste.icons.some((icône: { purpose?: string }) => icône.purpose === 'maskable')).toBe(
      true,
    )
  })

  test('le service worker est servi sans cache et pour toute l’origine', async ({ request }) => {
    const réponse = await request.get(`${BASE}/sw.js`)
    expect(réponse.ok()).toBe(true)
    expect(réponse.headers()['cache-control']).toContain('no-store')
    expect(réponse.headers()['service-worker-allowed']).toBe('/')
  })

  test('la page hors ligne s’atteint sans session', async ({ request }) => {
    // Sans quoi le service worker ne pourrait pas la mettre en cache à
    // l'installation, et le secours n'existerait pas.
    const réponse = await request.get(`${BASE}/hors-ligne`)
    expect(réponse.status()).toBe(200)
  })

  test('serveur coupé, la page déjà ouverte reste lisible et l’inconnue bascule sur le secours', async ({
    browser,
  }) => {
    const contexte = await browser.newContext()
    const chauffe = await contexte.newPage()

    await chauffe.goto(`${BASE}/recevoir-mon-lien`, { waitUntil: 'networkidle' })
    await chauffe.evaluate(() => navigator.serviceWorker.ready)
    // La première visite installe le worker ; c'est la seconde qu'il intercepte.
    await chauffe.reload({ waitUntil: 'networkidle' })

    const enCache = await chauffe.evaluate(async () => {
      const noms = await caches.keys()
      const pages = await caches.open(noms.find((nom) => nom.includes('pages'))!)
      return (await pages.keys()).map((requête) => new URL(requête.url).pathname)
    })
    expect(enCache).toContain('/hors-ligne')
    expect(enCache).toContain('/recevoir-mon-lien')
    await chauffe.close()

    couperLeServeur()
    await expect
      .poll(async () => fetch(`${BASE}/hors-ligne`).then(() => 'debout', () => 'coupé'), {
        timeout: 15_000,
      })
      .toBe('coupé')

    const déjàOuverte = await contexte.newPage()
    await déjàOuverte.goto(`${BASE}/recevoir-mon-lien`, { waitUntil: 'domcontentloaded' })
    await expect(déjàOuverte.getByRole('heading', { name: 'Recevoir mon lien' })).toBeVisible()

    const jamaisOuverte = await contexte.newPage()
    await jamaisOuverte.goto(`${BASE}/hermitage/tendances`, { waitUntil: 'domcontentloaded' })
    await expect(jamaisOuverte.getByRole('heading', { name: 'Pas de réseau' })).toBeVisible()
    // L'adresse demandée est conservée : un rechargement, une fois le réseau
    // revenu, ramène la page voulue et non la page de secours.
    expect(new URL(jamaisOuverte.url()).pathname).toBe('/hermitage/tendances')

    await contexte.close()
  })
})
