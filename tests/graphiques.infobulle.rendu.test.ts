import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InfobulleDeBulle, type Bulle } from '@/components/graphiques-recharts'

/**
 * L'infobulle des bulles (carte des groupes stratégiques, parties prenantes) :
 * un nuage de points porte trois valeurs par point (x, y, taille), et
 * l'infobulle générique écrivait trois fois les mêmes sujets (7 novembre 2026).
 */
const bulle: Bulle = { x: 2, y: 3, n: 2, teinte: 'rose', libellé: 'Kyocera, Ricoh' }
const axeX = { libellé: 'Intérêt', crans: ['faible', 'moyen', 'fort'] }
const axeY = { libellé: 'Pouvoir', crans: ['faible', 'moyen', 'fort'] }
// Ce que Recharts passe pour un point survolé : une entrée par axe, toutes sur le même point.
const payload = [{ payload: bulle }, { payload: bulle }, { payload: bulle }]

describe('InfobulleDeBulle', () => {
  it('écrit les sujets une seule fois, puis la case sur les deux axes', () => {
    const html = renderToStaticMarkup(createElement(InfobulleDeBulle, { active: true, payload, axeX, axeY }))
    expect(html.split('Kyocera, Ricoh').length - 1).toBe(1)
    expect(html).toContain('Intérêt moyen · Pouvoir fort')
  })

  it('ne rend rien hors survol', () => {
    expect(renderToStaticMarkup(createElement(InfobulleDeBulle, { active: false, payload, axeX, axeY }))).toBe('')
    expect(renderToStaticMarkup(createElement(InfobulleDeBulle, { active: true, payload: [], axeX, axeY }))).toBe('')
  })
})
