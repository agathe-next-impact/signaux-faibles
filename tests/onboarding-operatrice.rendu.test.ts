import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FriseDOnboarding, GesteDOnboarding, MotifDeBlocage, RunsDOnboarding, résuméDeLÉtape } from '@/components/onboarding-operatrice'
import type { OnboardingLu } from '@/lib/base/onboardings'
import { vueDUnOnboarding } from '@/lib/portail/onboarding'

const MAINTENANT = new Date('2026-11-01T12:00:00Z')

const onboarding = (plus: Partial<OnboardingLu> = {}): OnboardingLu => ({
  id: 'o-1',
  slug: 'mastora',
  nom: 'Mastora',
  site: null,
  exécuteur: 'api',
  registreNotion: null,
  statutRapporté: 2,
  statutRapportéLe: MAINTENANT,
  motifDeBlocage: null,
  crééLe: new Date('2026-10-25T08:00:00Z'),
  misÀJourLe: MAINTENANT,
  organisation: null,
  lecteursActifs: 0,
  dernierLienEnvoyéLe: null,
  crééPar: 'tache',
  demande: null,
  runs: [
    {
      id: 'r-1',
      tâche: 'balayage',
      état: 'reussi',
      runGithub: 7,
      lien: 'https://github.com/agathe-next-impact/signaux-faibles/actions/runs/7',
      plafondUsd: 30,
      coûtUsd: 4.82,
      début: new Date('2026-10-25T08:00:00Z'),
      fin: new Date('2026-10-25T08:41:00Z'),
      crééLe: new Date('2026-10-25T08:00:00Z'),
      codeHttp: null,
      lancéPar: null,
      runTrigger: null,
    },
  ],
  ...plus,
})

describe('le suivi d’un onboarding à l’écran', () => {
  it('dit l’étape, sa provenance, la durée et le coût du run', () => {
    const vue = vueDUnOnboarding(onboarding(), MAINTENANT)
    expect(résuméDeLÉtape(vue)).toBe('2 sur 6 · Référentiels générés')
    const frise = renderToStaticMarkup(createElement(FriseDOnboarding, { vue }))
    expect(frise).toContain('Référentiels générés')
    expect(frise).toContain('rapportée')
    expect(frise).toContain('à venir')
    const runs = renderToStaticMarkup(createElement(RunsDOnboarding, { runs: vue.runs }))
    expect(runs).toContain('balayage, réussi')
    expect(runs).toContain('41 min')
    expect(runs).toContain('4,82 $')
    expect(runs).toContain('actions/runs/7')
    expect(renderToStaticMarkup(createElement(MotifDeBlocage, { vue }))).toBe('')
  })

  it('montre le motif d’un blocage, et un run muet comme sans nouvelles', () => {
    const vue = vueDUnOnboarding(
      onboarding({
        motifDeBlocage: 'Email du lecteur final manquant.',
        runs: [{ id: 'r-2', tâche: 'premiere_lettre', état: 'en_cours', runGithub: 8, lien: null, plafondUsd: 40, coûtUsd: null, début: new Date('2026-11-01T06:00:00Z'), fin: null, crééLe: new Date('2026-11-01T06:00:00Z'), codeHttp: null, lancéPar: null, runTrigger: null }],
      }),
      MAINTENANT,
    )
    expect(vue.bloqué).toBe(true)
    expect(renderToStaticMarkup(createElement(MotifDeBlocage, { vue }))).toContain('Email du lecteur final manquant.')
    const runs = renderToStaticMarkup(createElement(RunsDOnboarding, { runs: vue.runs }))
    expect(runs).toContain('premiere-lettre, sans nouvelles')
    expect(runs).toContain('plafond 40,00 $')
    expect(runs).toContain('hors GitHub')
  })
})

describe('le formulaire de demande (lot 3)', () => {
  it('rend les champs, et désactive Cowork quand les créneaux sont pris', async () => {
    const { FormulaireDeDemande } = await import('@/app/(portail)/espaces/onboardings/nouveau/formulaire')
    const libre = renderToStaticMarkup(createElement(FormulaireDeDemande, { créneauxCowork: { pris: 1, max: 2 } }))
    for (const nom of ['nom', 'site', 'slug', 'objectifs', 'lecteurNom', 'lecteurEmail', 'executeur']) expect(libre).toContain(`name="${nom}"`)
    expect(libre).toContain('1 sur 2 créneaux pris')
    expect(libre).not.toMatch(/<input[^>]*disabled=""[^>]*value="cowork"/)
    const plein = renderToStaticMarkup(createElement(FormulaireDeDemande, { créneauxCowork: { pris: 2, max: 2 } }))
    expect(plein).toMatch(/<input[^>]*disabled=""[^>]*value="cowork"/)
  })

  it('une demande Cowork montre la commande à copier, sans adresse', () => {
    const vue = vueDUnOnboarding(
      onboarding({ exécuteur: 'cowork', statutRapporté: null, runs: [], site: 'https://mastora.example/', demande: { objectifs: null, lecteurFinal: 'Camille', avecAdresse: false } }),
      MAINTENANT,
    )
    const rendu = renderToStaticMarkup(createElement(GesteDOnboarding, { vue, retour: 'liste', disponible: true }))
    expect(rendu).toContain('/onboarding-demande Organisation : Mastora')
    expect(rendu).not.toContain('@')
  })
})
