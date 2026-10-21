import { describe, expect, it } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { produireLaLettre } from '@/lib/moteur/produire'
import type { Rédacteur, SortieRédigée, Sélection } from '@/lib/moteur/redaction'
import { lireRéférentielUnique, écrireRéférentielUnique } from '@/lib/moteur/referentiel'
import { schémaDeRemiseDÉdition } from '@/lib/moteur/remise'
import { gelDuDossier, remiseDe } from '../trigger/moteur'

const AXES = 10
const URL = (i: number) => `https://exemple.fr/axe-${i}`
const RÉFÉRENTIEL = lireRéférentielUnique(
  écrireRéférentielUnique('Infralliance', {
    fiche: 'Un réseau d’infrastructures.',
    axes: Array.from({ length: AXES }, (_, i) => ({ nom: `Axe ${i + 1}`, sorte: 'thème' as const, critères: 'c', sources: [{ libellé: 's', url: URL(i + 1) }], requêtes: [], acteurs: [] })),
    dossiers: [],
  }),
)
const SÉLECTION: Sélection = { numéro: 3, dateÉdition: '2026-11-02', période: { début: '2026-10-26', fin: '2026-11-01' }, éditionPrécédente: null }

const sortie: SortieRédigée = {
  essentiel: ['Le raccordement de Telehouse Magny est acté le 27 octobre.', 'Rien de neuf sur le reste.', 'Une consultation s’ouvre le 30 octobre.'],
  axes: Array.from({ length: AXES }, (_, i) =>
    i === 0
      ? { numéro: 1, niveau: 'FORT' as const, faits: [{ texte: 'Le raccordement de Telehouse Magny est acté le 27 octobre.', date: '2026-10-27', url: URL(1), contexte: false }], ras: null }
      : { numéro: i + 1, niveau: 'RAS' as const, faits: [], ras: 'Rien de neuf, source relue le 1er novembre.' },
  ),
  dossiers: [],
  actionDeLaSemaine: 'Suivre le raccordement.',
}

const rédacteur: Rédacteur = { modèle: 'claude-opus-5-5', usage: { entrée: 10, sortie: 5, cacheLecture: 0, cacheÉcriture: 0 }, rédiger: async () => sortie, reprendre: async () => sortie }
const fauxFetch = (async () =>
  new Response(`<p>Le raccordement de Telehouse Magny est acté le 27 octobre. ${'Une phrase de remplissage suffisamment longue pour la page. '.repeat(4)}</p>`, { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch

describe('la remise d’une production au portail', () => {
  it('respecte le schéma de la route, mode et cible compris', async () => {
    const production = await produireLaLettre({ référentiel: RÉFÉRENTIEL, sélection: SÉLECTION }, { anthropic: {} as Anthropic, rédacteur, rechercher: null, fetch: fauxFetch })
    expect(production.acceptée).toBe(true)
    const remise = remiseDe(production, { organisation: 'org-1', filiere: null }, 'parution', 'run_123', new Date('2026-11-02T05:00:00Z'))
    const lue = schémaDeRemiseDÉdition.parse(remise)
    expect(lue.proprietes.titre).toBe('Veille Infralliance, édition n° 3 du 2 novembre 2026')
    expect(lue.collecte.gelSuivant).toHaveLength(AXES)
    expect(lue.collecte.gelSuivant[0]!.phrases.length).toBeGreaterThan(0)
    expect(lue.mesures.couverture.taux).toBe(1)
    expect(lue.acceptee).toBe(true)
  })

  it('reconstruit le gel d’un dossier tel que le portail le rend', () => {
    const gel = gelDuDossier({
      organisation: { id: 'o', nom: 'n', slug: 's' },
      filière: null,
      référentiel: '',
      sélection: { ...SÉLECTION, éditionPrécédente: null },
      gel: [{ url: URL(1), empreinte: 'abc', phrases: ['Une phrase connue de la source.'] }],
    })
    expect(gel.get(URL(1))).toEqual({ empreinte: 'abc', phrases: ['Une phrase connue de la source.'] })
  })
})
