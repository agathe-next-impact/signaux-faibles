import { describe, expect, it, vi } from 'vitest'

// Les pages importent le layout par leurs composants ; next/font n'existe qu'au build.
vi.mock('next/font/google', () => ({ Lora: () => ({ variable: '' }), Public_Sans: () => ({ variable: '' }), IBM_Plex_Mono: () => ({ variable: '' }) }))
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { GET as llms } from '@/app/llms.txt/route'
import { QUESTIONS_DE_L_ACCUEIL } from '@/components/vitrine-accueil'
import { metadata as métadonnéesDeLAccueil } from '@/app/(portail)/page'
import { metadata as métadonnéesDesTarifs } from '@/app/(portail)/tarifs/page'
import { metadata as métadonnéesDesExemples } from '@/app/(portail)/exemple/page'
import { metadata as métadonnéesDeLaDémo } from '@/app/(portail)/demo/page'
import { enEuros, PRIX_ANNUEL_HT, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import {
  CHEMINS_EXCLUS_DES_ROBOTS,
  enJsonLd,
  nœudFAQ,
  nœudService,
  origineCanonique,
  PAGES_INDEXABLES,
  ROBOTS_D_IA,
} from '@/lib/vitrine/referencement'

/**
 * Le référencement de la vitrine (16 novembre 2026) : ce qu'un moteur de
 * recherche ou un moteur de réponse par IA lit, et ce qu'il ne doit jamais
 * lire. Le point le plus important est le second : la vitrine devient plus
 * visible, le portail reste privé.
 */
describe('origine canonique', () => {
  it('ramène l’apex à www, qui seul répond sans redirection', () => {
    expect(origineCanonique('https://signauxfaibles.io')).toBe('https://www.signauxfaibles.io')
    expect(origineCanonique('https://signauxfaibles.io/')).toBe('https://www.signauxfaibles.io')
    expect(origineCanonique('https://www.signauxfaibles.io')).toBe('https://www.signauxfaibles.io')
  })

  it('retombe sur la production sans variable ou avec une valeur invalide', () => {
    expect(origineCanonique(undefined)).toBe('https://www.signauxfaibles.io')
    expect(origineCanonique('')).toBe('https://www.signauxfaibles.io')
    expect(origineCanonique('pas une url')).toBe('https://www.signauxfaibles.io')
  })
})

describe('robots.txt', () => {
  const règles = robots().rules
  const groupes = Array.isArray(règles) ? règles : [règles]

  it('annonce le sitemap sur l’origine canonique', () => {
    expect(robots().sitemap).toBe('https://www.signauxfaibles.io/sitemap.xml')
  })

  it('donne à chaque groupe, robots d’IA compris, les mêmes exclusions', () => {
    for (const groupe of groupes) {
      expect(groupe.allow).toBe('/')
      expect(groupe.disallow).toEqual([...CHEMINS_EXCLUS_DES_ROBOTS])
    }
    const nommés = groupes.flatMap((g) => (Array.isArray(g.userAgent) ? g.userAgent : [g.userAgent]))
    for (const robot of [...ROBOTS_D_IA.rechercheEtCitation, ...ROBOTS_D_IA.entraînement]) expect(nommés).toContain(robot)
  })

  it('exclut l’API, les liens d’accès, l’admin et le sélecteur de l’opératrice', () => {
    for (const chemin of ['/api/', '/acces/', '/admin', '/payload-api', '/espaces']) {
      expect(CHEMINS_EXCLUS_DES_ROBOTS).toContain(chemin)
    }
  })

  it('ne bloque aucune page indexable', () => {
    for (const page of PAGES_INDEXABLES) {
      expect(CHEMINS_EXCLUS_DES_ROBOTS.some((exclu) => page.chemin.startsWith(exclu))).toBe(false)
    }
  })
})

describe('sitemap', () => {
  it('ne liste que les trois pages vitrines indexables, en URL absolues sur www', () => {
    expect(sitemap().map((e) => e.url)).toEqual([
      'https://www.signauxfaibles.io/',
      'https://www.signauxfaibles.io/tarifs',
      'https://www.signauxfaibles.io/exemple',
    ])
  })
})

describe('métadonnées des pages', () => {
  it('garde le portail en noindex par défaut', async () => {
    const { metadata } = await import('@/app/(portail)/layout')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('rend les trois pages vitrines indexables, avec leur URL canonique et leur carte de partage', () => {
    const pages = [
      [métadonnéesDeLAccueil, '/'],
      [métadonnéesDesTarifs, '/tarifs'],
      [métadonnéesDesExemples, '/exemple'],
    ] as const
    for (const [métadonnées, chemin] of pages) {
      expect(métadonnées.robots).toMatchObject({ index: true, follow: true })
      expect(métadonnées.alternates?.canonical).toBe(chemin)
      expect(métadonnées.openGraph).toMatchObject({ url: chemin, locale: 'fr_FR', siteName: 'signauxfaibles' })
      expect(typeof métadonnées.description).toBe('string')
    }
  })

  it('laisse la demande de démo hors index', () => {
    expect(métadonnéesDeLaDémo.robots).toEqual({ index: false, follow: true })
  })

  it('écrit le prix des tarifs depuis l’offre', () => {
    const titre = métadonnéesDesTarifs.title as { absolute: string }
    expect(titre.absolute).toContain(`${enEuros(PRIX_MENSUEL_HT)} € HT par mois`)
  })
})

describe('données structurées', () => {
  it('portent les prix de l’offre, mensuel et annuel', () => {
    const prix = nœudService().offers.map((o) => o.price)
    expect(prix).toContain(PRIX_MENSUEL_HT)
    expect(prix).toContain(PRIX_ANNUEL_HT)
  })

  it('reprennent mot pour mot les questions affichées', () => {
    const faq = nœudFAQ('/', QUESTIONS_DE_L_ACCUEIL)
    expect(faq.mainEntity.map((q) => q.name)).toEqual(QUESTIONS_DE_L_ACCUEIL.map((q) => q.question))
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(QUESTIONS_DE_L_ACCUEIL.map((q) => q.réponse))
  })

  it('ne ferment jamais la balise script', () => {
    expect(enJsonLd({ texte: '</script><script>alert(1)</script>' })).not.toContain('<')
  })
})

describe('llms.txt', () => {
  it('résume l’offre en Markdown, avec les prix de l’offre et les pages de la vitrine', async () => {
    const réponse = llms()
    expect(réponse.headers.get('Content-Type')).toContain('text/markdown')
    const texte = await réponse.text()
    expect(texte.startsWith('# signauxfaibles\n')).toBe(true)
    expect(texte).toContain(`${enEuros(PRIX_MENSUEL_HT)} € HT par mois`)
    expect(texte).toContain('https://www.signauxfaibles.io/tarifs')
    expect(texte).not.toContain('—')
  })
})
