import { describe, expect, it } from 'vitest'
import { essentielDuMarkdown, périodeDe, sélectionDe } from '@/lib/moteur/selection'

describe('la sélection d’une parution', () => {
  it('première édition : numéro 1, sept jours avant la date d’édition', () => {
    const s = sélectionDe('2026-11-02', null)
    expect(s.numéro).toBe(1)
    expect(s.période).toEqual({ début: '2026-10-26', fin: '2026-11-01' })
    expect(s.éditionPrécédente).toBeNull()
  })

  it('édition suivante : depuis le jour de la précédente, qu’elle ne couvrait pas, jusqu’à la veille', () => {
    const s = sélectionDe('2026-11-02', { dateÉdition: '2026-10-26', numéro: 11, essentiel: ['a'], dossiersBruts: 'x (1)' })
    expect(s.numéro).toBe(12)
    expect(s.période).toEqual({ début: '2026-10-26', fin: '2026-11-01' })
    expect(s.éditionPrécédente?.essentiel).toEqual(['a'])
  })

  it('une parution rattrapée le lendemain couvre quand même sept jours', () => {
    expect(périodeDe('2026-10-27', { dateÉdition: '2026-10-26', numéro: 1, essentiel: [], dossiersBruts: '' })).toEqual({ début: '2026-10-20', fin: '2026-10-26' })
  })

  it('une précédente trop ancienne ne fait pas remonter au-delà de quatorze jours', () => {
    expect(périodeDe('2026-11-02', { dateÉdition: '2026-09-01', numéro: 1, essentiel: [], dossiersBruts: '' })).toEqual({ début: '2026-10-19', fin: '2026-11-01' })
  })

  it('lit les lignes de « L’essentiel » d’une lettre Markdown', () => {
    const markdown = "# L'essentiel\n\n- Le décret est paru le 21 octobre.\n- Kyocera a présenté sa gamme.\n\n# Actualités par axe\n\n## ① A — RAS\n"
    expect(essentielDuMarkdown(markdown)).toEqual(['Le décret est paru le 21 octobre.', 'Kyocera a présenté sa gamme.'])
    expect(essentielDuMarkdown('# Autre\n- x')).toEqual([])
  })
})
