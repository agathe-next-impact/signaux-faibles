// Lit une page web avec le Chromium de la session, pour les sources que la
// récupération simple ne lit pas (503 renvoyé aux robots, contenu rendu en
// JavaScript). Sert aux commandes d'onboarding, jamais au portail.
//
//   node scripts/lire-page.mjs <url> [caractères]
//
// Écrit sur la sortie standard : le statut HTTP, le titre, puis le texte visible
// de la page, tronqué à 20 000 caractères par défaut.
import { chromium } from '@playwright/test'

const [url, plafond = '20000'] = process.argv.slice(2)
if (!url || !/^https?:\/\//.test(url)) {
  console.error('usage : node scripts/lire-page.mjs <url http(s)> [caractères]')
  process.exit(2)
}

// Le Chromium de l'environnement n'est pas forcément la version attendue par
// @playwright/test : on lance l'exécutable installé plutôt que d'en télécharger un.
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
try {
  const page = await navigateur.newPage({ locale: 'fr-FR' })
  const réponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  const texte = await page.evaluate(() => document.body?.innerText ?? '')
  console.log(`statut : ${réponse?.status() ?? 'inconnu'}`)
  console.log(`titre : ${await page.title()}`)
  console.log('')
  console.log(texte.replace(/\n{3,}/g, '\n\n').slice(0, Number(plafond)))
} finally {
  await navigateur.close()
}
