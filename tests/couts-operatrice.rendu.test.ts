import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChoixDuMois, CoûtsParOrganisation, CoûtsParTâche, RunsDuMois, TotauxDesCoûts } from '@/components/couts-operatrice'
import { totauxDuMois, type RunMesuré } from '@/lib/domaine/couts'

const run = (plus: Partial<RunMesuré> = {}): RunMesuré => ({
  tâche: 'lettres',
  organisation: null,
  organisations: ['mastora', 'hermitage'],
  issue: 'success',
  coûtUsd: 18,
  plafondUsd: 60,
  duréeMs: 30 * 60_000,
  tours: 200,
  runGithub: 501,
  lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/501',
  origine: 'harnais',
  mesuréLe: new Date('2026-11-16T05:00:00Z'),
  ...plus,
})

const RUNS = [
  run(),
  run({ tâche: 'premiere-lettre', organisation: 'aquitaine-robotics', organisations: ['aquitaine-robotics'], coûtUsd: 15.172, plafondUsd: 40, runGithub: 502, lien: null, issue: 'error_max_budget_usd' }),
  run({ tâche: 'reconciliation', organisations: [], coûtUsd: 1.5, plafondUsd: 5, runGithub: null, lien: null }),
]
const TOTAUX = totauxDuMois(RUNS)
const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| | /g, ' ').replace(/\s+/g, ' ')

describe('l’écran des coûts', () => {
  it('montre le total, les runs sans réussite, le réparti et le non attribué', () => {
    const rendu = texte(renderToStaticMarkup(createElement(TotauxDesCoûts, { totaux: TOTAUX })))
    expect(rendu).toContain('34,67 $')
    expect(rendu).toContain('1 sans réussite')
    expect(rendu).toContain('18,00 $')
    expect(rendu).toContain('1,50 $')
  })

  it('dit « tous réussis » quand aucun run n’a échoué', () => {
    expect(renderToStaticMarkup(createElement(TotauxDesCoûts, { totaux: totauxDuMois([run()]) }))).toContain('tous réussis')
  })

  it('donne une ligne par tâche, du plus coûteux au moins coûteux, avec sa part du mois', () => {
    const html = renderToStaticMarkup(createElement(CoûtsParTâche, { totaux: TOTAUX }))
    const rendu = texte(html)
    expect(rendu.indexOf('lettres de veille')).toBeLessThan(rendu.indexOf('première lettre'))
    expect(rendu.indexOf('première lettre')).toBeLessThan(rendu.indexOf('réconciliation des envois'))
    expect(rendu).toContain('52 %')
    expect(rendu).toContain('44 %')
    expect(html).toContain('aria-label="Coût par tâche"')
  })

  it('sépare, par organisation, ce qui est imputé en entier de la part estimée, et nomme celles que le portail connaît', () => {
    const html = renderToStaticMarkup(createElement(CoûtsParOrganisation, { totaux: TOTAUX, noms: { mastora: 'Mastora', hermitage: 'L’Hermitage' } }))
    const rendu = texte(html)
    expect(rendu).toContain('imputé en entier')
    expect(rendu).toContain('part estimée')
    expect(html).toContain('href="/espaces/abonnements/mastora"')
    // Un slug que le portail ne connaît pas ne mène nulle part.
    expect(html).not.toContain('href="/espaces/abonnements/aquitaine-robotics"')
    expect(rendu).toContain('pas encore dans le portail')
    expect(rendu).toContain('15,17 $')
    expect(rendu).toContain('9,00 $')
  })

  it('le dit quand aucun run ne nomme une organisation', () => {
    const rendu = renderToStaticMarkup(createElement(CoûtsParOrganisation, { totaux: totauxDuMois([run({ organisations: [] })]), noms: {} }))
    expect(rendu).toContain('Aucun run de ce mois ne nomme une organisation.')
  })

  it('liste les runs avec leur issue et le lien du job quand il existe', () => {
    const html = renderToStaticMarkup(createElement(RunsDuMois, { runs: RUNS }))
    expect(html).toContain('href="https://github.com/agathe-next-impact/signaux-faibles/actions/runs/501"')
    expect(html.match(/<a /g)).toHaveLength(1)
    const rendu = texte(html)
    expect(rendu).toContain('error_max_budget_usd')
    expect(rendu).toContain('hermitage, mastora')
  })

  it('abrège une longue liste d’organisations', () => {
    const rendu = texte(renderToStaticMarkup(createElement(RunsDuMois, { runs: [run({ organisations: ['a', 'b', 'c', 'd', 'e', 'f'] })] })))
    expect(rendu).toContain('a, b, c, d et 2 de plus')
  })

  it('ne propose pas un mois à venir', () => {
    const courant = renderToStaticMarkup(createElement(ChoixDuMois, { mois: '2026-11', moisEnCours: '2026-11' }))
    expect(courant).toContain('href="/espaces/couts?mois=2026-10"')
    expect(courant).not.toContain('mois=2026-12')
    const passé = renderToStaticMarkup(createElement(ChoixDuMois, { mois: '2026-10', moisEnCours: '2026-11' }))
    expect(passé).toContain('href="/espaces/couts?mois=2026-09"')
    expect(passé).toContain('href="/espaces/couts?mois=2026-11"')
  })
})
