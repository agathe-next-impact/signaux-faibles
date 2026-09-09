import { describe, expect, it } from 'vitest'
import {
  CONTRAT_ACCES,
  CONTRAT_EDITIONS,
  PROPRIETES_INTERNES,
  écartsDeSchéma,
  vérifierSchéma,
  type SchémaRéel,
} from '@/lib/notion/schema'

/** Un schéma réel conforme, construit depuis le contrat lui-même. */
function schémaConforme(contrat: typeof CONTRAT_EDITIONS): SchémaRéel {
  return Object.fromEntries(
    Object.entries(contrat).map(([nom, attendue]) => [
      nom,
      attendue.options
        ? { type: attendue.type, select: { options: attendue.options.map((o) => ({ name: o })) } }
        : { type: attendue.type },
    ]),
  )
}

describe('écartsDeSchéma', () => {
  it('ne signale rien sur un schéma conforme', () => {
    expect(écartsDeSchéma(CONTRAT_EDITIONS, schémaConforme(CONTRAT_EDITIONS))).toEqual([])
    expect(écartsDeSchéma(CONTRAT_ACCES, schémaConforme(CONTRAT_ACCES))).toEqual([])
  })

  it('signale une propriété absente', () => {
    const réel = schémaConforme(CONTRAT_EDITIONS)
    delete réel['Période couverte']
    expect(écartsDeSchéma(CONTRAT_EDITIONS, réel)).toEqual([
      { propriété: 'Période couverte', raison: 'absente de la base' },
    ])
  })

  it('signale le retour d’Organisation à une sélection, la panne du 9 septembre à l’envers', () => {
    const réel = schémaConforme(CONTRAT_EDITIONS)
    réel['Organisation'] = { type: 'select' }
    expect(écartsDeSchéma(CONTRAT_EDITIONS, réel)[0]).toEqual({
      propriété: 'Organisation',
      raison: 'type « select », attendu « relation »',
    })
  })

  it('signale la disparition de l’option Envoyé, dont dépend toute publication', () => {
    const réel = schémaConforme(CONTRAT_EDITIONS)
    réel['Statut'] = { type: 'select', select: { options: [{ name: 'Brouillon' }] } }
    expect(écartsDeSchéma(CONTRAT_EDITIONS, réel)[0]?.raison).toContain('Envoyé')
  })

  it('accepte une propriété supplémentaire : Cowork est libre d’en ajouter', () => {
    const réel = schémaConforme(CONTRAT_EDITIONS)
    réel['Note interne de la tâche'] = { type: 'rich_text' }
    expect(écartsDeSchéma(CONTRAT_EDITIONS, réel)).toEqual([])
  })

  it('rassemble tous les écarts, pour ne pas les découvrir un par un', () => {
    const réel = schémaConforme(CONTRAT_EDITIONS)
    delete réel['Numéro']
    delete réel['Veille']
    réel['Organisation'] = { type: 'select' }
    expect(écartsDeSchéma(CONTRAT_EDITIONS, réel)).toHaveLength(3)
  })
})

describe('vérifierSchéma', () => {
  it('ne lève pas sur un schéma conforme', () => {
    expect(() =>
      vérifierSchéma('Éditions de veille', CONTRAT_EDITIONS, schémaConforme(CONTRAT_EDITIONS)),
    ).not.toThrow()
  })

  it('lève en nommant la base et la propriété fautive', () => {
    const réel = schémaConforme(CONTRAT_EDITIONS)
    delete réel['Statut']
    expect(() => vérifierSchéma('Éditions de veille', CONTRAT_EDITIONS, réel)).toThrow(
      /Éditions de veille[\s\S]*Statut/,
    )
  })
})

describe('propriétés internes', () => {
  it('sont déclarées dans le contrat, pour que la garde les surveille aussi', () => {
    for (const interne of PROPRIETES_INTERNES) {
      expect(Object.keys(CONTRAT_EDITIONS)).toContain(interne)
    }
  })
})
