import { defineConfig, devices } from '@playwright/test'

/**
 * Recette sur le portail déployé (29 octobre 2026), à part de `pnpm e2e`, qui
 * démarre son propre serveur sans Notion.
 *
 *   pnpm recette                      (production, chemins sans session)
 *   RECETTE_LIEN_HERMITAGE=… pnpm recette   (avec la session d'un lecteur)
 *
 * Le lien d'accès ne s'écrit jamais dans une commande : il vient d'un secret
 * GitHub (`.github/workflows/recette.yml`), que GitHub masque dans les
 * journaux. Ni trace, ni vidéo : l'une et l'autre garderaient l'adresse du
 * lien et le cookie de session. Seules les captures d'écran sortent.
 */
export default defineConfig({
  testDir: './recette',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env['RECETTE_URL'] ?? 'https://www.signauxfaibles.io',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        ...(process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
          ? { launchOptions: { executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'] } }
          : {}),
      },
    },
  ],
})
