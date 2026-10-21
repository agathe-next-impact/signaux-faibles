/**
 * Trigger.dev : les runs du moteur, hors des fonctions Vercel bornées en durée
 * (programme du 22 octobre 2026, §4). Les tâches vivent dans `trigger/`.
 *
 * `TRIGGER_PROJECT_REF` vient du tableau de bord Trigger.dev ; sans elle, la
 * configuration reste valide pour le typage et les tests, et `trigger.dev dev`
 * refuse de partir, ce qui est voulu. L'extension Playwright fournit le
 * Chromium du navigateur de collecte dans l'image de déploiement.
 */
import { defineConfig } from '@trigger.dev/sdk'
import { playwright } from '@trigger.dev/build/extensions/playwright'

export default defineConfig({
  project: process.env['TRIGGER_PROJECT_REF'] ?? 'proj_signaux_faibles_a_renseigner',
  runtime: 'node-22',
  logLevel: 'info',
  // Une parution lit jusqu'à quatre-vingts sources et appelle le modèle trois fois au plus : vingt minutes couvrent large.
  maxDuration: 20 * 60,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, minTimeoutInMs: 30_000, maxTimeoutInMs: 120_000, factor: 2, randomize: true },
  },
  dirs: ['./trigger'],
  build: {
    extensions: [playwright({ browsers: ['chromium'] })],
  },
})
