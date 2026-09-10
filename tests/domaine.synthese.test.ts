import { describe, expect, it } from 'vitest'
import { construireDocument, type BlocNotion } from '@/lib/domaine/document'
import { écart, synthétiser } from '@/lib/domaine/synthese'

const t = (c: string) => ({
  plain_text: c, href: null,
  annotations: { bold: false, italic: false, code: false, strikethrough: false },
})
const h1 = (x: string): BlocNotion => ({ id: `h1${x}`, type: 'heading_1', heading_1: { rich_text: [t(x)] } })
const h2 = (x: string): BlocNotion => ({ id: `h2${x}`, type: 'heading_2', heading_2: { rich_text: [t(x)] } })

const noteÉcosystème = construireDocument([
  h1('Actualités par axe'),
  h2('② Cadre — FORT'),
  h2('③ Financements — MOYEN'),
  h2('④ Filière — RAS'),
  h2('⑤ Ancien — FAIBLE'),
])
const noteConcurrentielle = construireDocument([
  h1('Voix concurrentes'),
  h2('① Offres — FORT'),
  h2('② Prix — RAS'),
])

describe('synthétiser', () => {
  it('compte les axes par niveau, sur les deux notes de la semaine', () => {
    const s = synthétiser([noteÉcosystème, noteConcurrentielle], [])
    expect(s.parNiveau).toEqual({ FORT: 2, MOYEN: 1, RAS: 2 })
    expect(s.axesTotal).toBe(6)
  })

  it('ne range pas un suffixe inconnu dans un niveau', () => {
    const s = synthétiser([noteÉcosystème], [])
    expect(s.sansNiveau).toBe(1)
    expect(s.parNiveau.FORT + s.parNiveau.MOYEN + s.parNiveau.RAS).toBe(3)
  })

  it('ne compte qu’une fois un dossier présent dans les deux notes', () => {
    const s = synthétiser(
      [],
      ['CADA (1) · Loi Résilience (0)', 'CADA (3, au Sénat) · Budget (2)'],
    )
    expect(s.dossiers).toHaveLength(3)
    // La mention la plus avancée l'emporte.
    expect(s.dossiers.find((d) => d.nom === 'CADA')).toMatchObject({
      compteur: 3,
      précision: 'au Sénat',
    })
  })

  it('compte comme en attente les dossiers rouverts sans mouvement', () => {
    const s = synthétiser([], ['A (0) · B (2) · C (1) · D (sans compteur)'])
    expect(s.dossiersEnAttente).toBe(2)
  })

  it('rend une synthèse vide sans broncher', () => {
    const s = synthétiser([], [])
    expect(s.axesTotal).toBe(0)
    expect(s.dossiers).toEqual([])
  })
})

describe('écart', () => {
  it('dit la variation, dans les deux sens', () => {
    expect(écart(7, 4)).toBe('+3 vs semaine dernière')
    expect(écart(2, 5)).toBe('−3 vs semaine dernière')
    expect(écart(3, 3)).toBe('stable')
  })

  it('se tait quand il n’y a pas de semaine précédente', () => {
    expect(écart(7, null)).toBeNull()
  })
})
