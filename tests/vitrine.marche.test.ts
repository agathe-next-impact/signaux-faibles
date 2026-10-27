import { describe, expect, it } from 'vitest'
import { positionSurLÉchelle } from '@/components/graphiques-vitrine'
import { construireDocument } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import { faitsDeLaLettre } from '@/lib/domaine/strategie'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import { lectureDeDémonstration } from '@/lib/vitrine/lecture-demonstration'
import {
  coûtDeLaVeilleInterne,
  coûtDUneHeureParSemaine,
  FAMILLES_D_OFFRES,
  notreFourchette,
  POSITIONS_SUR_LA_CARTE,
  prixParLecteur,
} from '@/lib/vitrine/marche'

/**
 * Les phrases chiffrées des pages vitrines (27 octobre 2026) sont des
 * affirmations publiques : chacune est tenue ici contre les données qu'elle
 * résume, pour qu'un changement de prix ou de relevé ne laisse pas une page
 * dire le contraire de ses graphiques.
 */
const famille = (clé: (typeof FAMILLES_D_OFFRES)[number]['clé']) => {
  const f = FAMILLES_D_OFFRES.find((x) => x.clé === clé)
  if (!f) throw new Error(`famille absente : ${clé}`)
  return f
}

describe('les repères de marché', () => {
  it('rangent les familles du moins cher au plus cher, chacune avec une source', () => {
    const minima = FAMILLES_D_OFFRES.map((f) => f.min)
    expect(minima).toEqual([...minima].sort((a, b) => a - b))
    for (const f of FAMILLES_D_OFFRES) {
      expect(f.min).toBeLessThanOrEqual(f.max)
      expect(f.sources.length).toBeGreaterThan(0)
      for (const s of f.sources) expect(s.url).toMatch(/^https:\/\//)
    }
  })

  it('tiennent « au prix des outils d’alerte haut de gamme, loin sous les plateformes »', () => {
    const nous = notreFourchette()
    expect(nous).toEqual({ min: 124.17, max: PRIX_MENSUEL_HT })
    expect(nous.min).toBeGreaterThanOrEqual(famille('outils').min)
    expect(nous.max).toBeLessThanOrEqual(famille('outils').max)
    expect(famille('plateformes').min / PRIX_MENSUEL_HT).toBeGreaterThanOrEqual(20)
  })

  it('tiennent « moins qu’une lettre professionnelle vendue par utilisateur »', () => {
    expect(prixParLecteur()).toBe(50)
    expect(prixParLecteur()).toBeLessThan(famille('lettres').min)
  })

  it('placent chaque famille sur la carte, et nous seuls avec les cabinets en haut à droite', () => {
    for (const f of FAMILLES_D_OFFRES) expect(POSITIONS_SUR_LA_CARTE.some((p) => p.clé === f.clé)).toBe(true)
    const enHaut = POSITIONS_SUR_LA_CARTE.filter((p) => p.analyse === 3 && p.personnalisation === 3).map((p) => p.clé)
    expect(enHaut.sort()).toEqual(['cabinets', 'nous'])
  })

  it('dessinent l’échelle logarithmique de 10 à 10 000 €', () => {
    expect(positionSurLÉchelle(10)).toBe(0)
    expect(positionSurLÉchelle(10_000)).toBe(100)
    expect(positionSurLÉchelle(100)).toBeCloseTo(33.33, 1)
    expect(positionSurLÉchelle(0)).toBe(0)
  })
})

describe('le temps de veille interne', () => {
  it('vaut 217, 433 et 650 € par mois à 50 € de l’heure, et une heure dépasse déjà le prix', () => {
    expect(coûtDeLaVeilleInterne().map((l) => l.parMois)).toEqual([217, 433, 650])
    expect(coûtDUneHeureParSemaine()).toBe(217)
    expect(coûtDUneHeureParSemaine()).toBeGreaterThan(PRIX_MENSUEL_HT)
  })
})

describe('la lecture stratégique des démonstrations', () => {
  for (const démonstration of DÉMONSTRATIONS) {
    it(`${démonstration.organisation} : chaque fait a un cadre, chaque rupture désigne un fait`, () => {
      const document = construireDocument(markdownVersBlocs(démonstration.markdown))
      const faits = faitsDeLaLettre(document)
      for (const f of faits) {
        if (f.axe !== null) expect(démonstration.grille.axes[f.axe], `axe ${f.axe} sans cadre`).toBeDefined()
      }
      const lecture = lectureDeDémonstration(démonstration, document)
      expect(lecture.total).toBe(faits.length)
      const classés = lecture.pestel.reduce((n, d) => n + d.faits, 0) + lecture.forces.reduce((n, f) => n + f.faits, 0)
      expect(classés).toBe(faits.length)
      expect(lecture.ruptures).toHaveLength(démonstration.grille.ruptures.length)
      expect(lecture.forces.find((f) => f.clé === 'rivalite')?.entités.length).toBeGreaterThan(0)
    })
  }
})
