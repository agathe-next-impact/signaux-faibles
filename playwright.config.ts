import { defineConfig, devices } from '@playwright/test'

/**
 * Recette de bout en bout.
 *
 * Ce fichier couvre ce qui se vérifie sans Notion : les chemins de refus.
 * Le cloisonnement entre clients (règle 7) demande un compte par client sur un
 * déploiement réel — c'est la session 8 du plan, et elle ne peut pas tourner
 * ici.
 *
 * Les variables d'environnement sont factices à dessein : aucun de ces
 * parcours ne doit atteindre Notion. Si l'un d'eux y arrivait, il échouerait,
 * et c'est le comportement voulu.
 */
export const FACTICES = {
  NOTION_TOKEN: 'ntn_factice_pour_la_recette',
  NOTION_BASE_EDITIONS: '00000000000000000000000000000001',
  NOTION_BASE_ACCES: '00000000000000000000000000000002',
  NOTION_WEBHOOK_SECRET: 'secret_webhook_factice',
  ACCES_SECRET_HMAC: 'secret-hmac-factice-de-plus-de-trente-deux-caracteres',
  PORTAIL_URL: 'http://127.0.0.1:3100',
  GOOGLE_COMPTE_SERVICE_EMAIL: 'factice@exemple.iam.gserviceaccount.com',
  GOOGLE_COMPTE_SERVICE_CLE_PRIVEE: '-----BEGIN PRIVATE KEY-----\nfactice\n-----END PRIVATE KEY-----\n',
  GMAIL_EXPEDITEUR: 'acces@exemple.test',
  GMAIL_EXPEDITEUR_NOM: 'signauxfaibles',
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Permet d'utiliser un Chromium déjà présent sur la machine plutôt que
        // d'en télécharger un. Sans la variable, Playwright reprend son
        // navigateur habituel.
        ...(process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
          ? {
              launchOptions: {
                executablePath: process.env['PLAYWRIGHT_CHROMIUM_EXECUTABLE'],
              },
            }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npx next start --port 3100',
    url: 'http://127.0.0.1:3100/recevoir-mon-lien',
    reuseExistingServer: false,
    timeout: 120_000,
    env: FACTICES,
  },
})
