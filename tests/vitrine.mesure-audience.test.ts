import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTENEUR_GTM, mesureActive, PAGES_MESURÉES, scriptDInitialisation } from '@/lib/vitrine/mesure-audience'

describe('mesure d’audience des pages vitrines', () => {
  it('ne charge le conteneur qu’en production Vercel', () => {
    expect(mesureActive('production')).toBe(true)
    expect(mesureActive('preview')).toBe(false)
    expect(mesureActive(undefined)).toBe(false)
  })

  it('refuse tout stockage avant de démarrer le conteneur', () => {
    const script = scriptDInitialisation()
    const consentement = script.indexOf("gtag('consent','default'")
    const démarrage = script.indexOf("'gtm.start'")
    expect(consentement).toBeGreaterThan(-1)
    expect(démarrage).toBeGreaterThan(consentement)
    for (const clé of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      expect(script).toContain(`${clé}:'denied'`)
    }
  })

  it('porte le bon conteneur', () => {
    expect(CONTENEUR_GTM).toBe('GTM-NCNSG52W')
  })

  it('n’est chargé que par les pages vitrines, jamais par un écran de l’espace', () => {
    expect(PAGES_MESURÉES).toEqual(['/', '/offre', '/tarifs', '/exemple', '/demo'])
    const appelants = [
      'components/vitrine.tsx',
      'app/(portail)/demo/page.tsx',
    ]
    for (const fichier of appelants) {
      expect(readFileSync(fichier, 'utf8')).toContain('<GoogleTagManager />')
    }
    for (const fichier of ['app/(portail)/layout.tsx', 'app/(portail)/[slug]/layout.tsx']) {
      expect(readFileSync(fichier, 'utf8')).not.toContain('GoogleTagManager')
    }
  })
})
