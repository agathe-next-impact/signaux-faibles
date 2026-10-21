import { describe, expect, it } from 'vitest'
import { lireRéférentielUnique, urlsDuRéférentiel, écrireRéférentielUnique, type RéférentielStructuré } from '@/lib/moteur/referentiel'

const STRUCTURÉ: RéférentielStructuré = {
  fiche: 'Konica Minolta Business Solutions France vend des systèmes d’impression et des services documentaires.',
  axes: Array.from({ length: 11 }, (_, i) => ({
    nom: i < 7 ? `Thème ${i + 1}` : `Concurrents ${i + 1}`,
    sorte: i < 7 ? ('thème' as const) : ('concurrents' as const),
    critères: `FORT si un texte s’applique à l’axe ${i + 1} ; MOYEN si une consultation s’ouvre.`,
    sources: [
      { libellé: `Source ${i + 1}`, url: `https://exemple.fr/axe-${i + 1}` },
      { libellé: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' },
    ],
    requêtes: [`requête ${i + 1}`],
    acteurs: [`Acteur ${i + 1}`],
  })),
  dossiers: [
    { nom: 'facturation électronique', compteur: 2, précision: 'décret attendu' },
    { nom: 'Kyocera', compteur: 0, précision: '' },
  ],
}

describe('le référentiel unique : écriture puis lecture', () => {
  it('se relit à l’identique', () => {
    const markdown = écrireRéférentielUnique('Konica Minolta', STRUCTURÉ)
    const lu = lireRéférentielUnique(markdown)
    expect(lu.organisation).toBe('Konica Minolta')
    expect(lu.fiche).toContain('systèmes d’impression')
    expect(lu.axes).toHaveLength(11)
    expect(lu.axes[0]).toMatchObject({ numéro: 1, nom: 'Thème 1', sorte: 'thème', requêtes: ['requête 1'], acteurs: ['Acteur 1'] })
    expect(lu.axes[0]!.critères).toContain('FORT si')
    expect(lu.axes[0]!.sources).toEqual([
      { libellé: 'Source 1', url: 'https://exemple.fr/axe-1' },
      { libellé: 'Légifrance', url: 'https://www.legifrance.gouv.fr/' },
    ])
    expect(lu.axes[10]!.sorte).toBe('concurrents')
    expect(lu.dossiers).toEqual([
      { nom: 'facturation électronique', compteur: 2, précision: 'décret attendu' },
      { nom: 'Kyocera', compteur: 0, précision: null },
    ])
    expect(lu.dossiersBruts).toBe('facturation électronique (2, décret attendu) · Kyocera (0)')
  })

  it('dédoublonne les URL nommées dans l’ordre des axes', () => {
    const lu = lireRéférentielUnique(écrireRéférentielUnique('Konica Minolta', STRUCTURÉ))
    const urls = urlsDuRéférentiel(lu)
    expect(urls).toHaveLength(12)
    expect(urls[0]).toBe('https://exemple.fr/axe-1')
    expect(urls.filter((u) => u.includes('legifrance'))).toHaveLength(1)
  })

  it('tolère une forme écrite à la main : sections sans puces, sorte en majuscules, critères sans libellé', () => {
    const markdown = `# Référentiel unique : L’Hermitage

## Fiche
Un hôtel de montagne.

## Axes
### ① Hébergement touristique (THÈME)
Ce qui compte : une taxe nouvelle est FORT.
Sources :
Office du tourisme : https://www.exemple-tourisme.fr/actualites
Requêtes :
hôtellerie Savoie réglementation
### ② Hôtels concurrents (concurrents)
Critères : une ouverture est FORT.
Acteurs :
- Hôtel du Lac

## Dossiers ouverts
- taxe de séjour 2027 (1, en discussion)
`
    const lu = lireRéférentielUnique(markdown)
    expect(lu.axes).toHaveLength(2)
    expect(lu.axes[0]).toMatchObject({ nom: 'Hébergement touristique', sorte: 'thème', critères: 'Ce qui compte : une taxe nouvelle est FORT.' })
    expect(lu.axes[0]!.sources).toEqual([{ libellé: 'Office du tourisme', url: 'https://www.exemple-tourisme.fr/actualites' }])
    expect(lu.axes[0]!.requêtes).toEqual(['hôtellerie Savoie réglementation'])
    expect(lu.axes[1]!.acteurs).toEqual(['Hôtel du Lac'])
    expect(lu.dossiers[0]).toEqual({ nom: 'taxe de séjour 2027', compteur: 1, précision: 'en discussion' })
  })

  it('refuse un document sans titre ou sans axe', () => {
    expect(() => lireRéférentielUnique('## Axes\n### ① A (thème)\n')).toThrow(/titre/)
    expect(() => lireRéférentielUnique('# Référentiel unique : X\n## Fiche\nrien\n')).toThrow(/aucun axe/)
  })
})
