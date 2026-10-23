import { describe, expect, it } from 'vitest'
import { enEuros, PRIX_ANNUEL_HT, PRIX_MENSUEL_HT, prixTTC, équivalentMensuelDeLAnnuel } from '@/lib/domaine/offre'

/**
 * Les montants des pages vitrines viennent de `lib/domaine/offre.ts`. Ce test
 * tient les chiffres de l'offre du 17 octobre 2026 tels que
 * `docs/decision-portail-moteur.md` les écrit : 106,80 € TTC par mois,
 * 1 068 € TTC par an.
 */
const sansEspaceFine = (texte: string) => texte.replace(/\s/g, ' ')

describe('les montants de l’offre', () => {
  it('donne les prix toutes taxes comprises de la décision', () => {
    expect(prixTTC(PRIX_MENSUEL_HT)).toBe(106.8)
    expect(prixTTC(PRIX_ANNUEL_HT)).toBe(1068)
  })

  it('écrit les euros à la française', () => {
    expect(enEuros(prixTTC(PRIX_MENSUEL_HT))).toBe('106,80')
    expect(sansEspaceFine(enEuros(prixTTC(PRIX_ANNUEL_HT)))).toBe('1 068')
    expect(enEuros(PRIX_MENSUEL_HT)).toBe('89')
  })

  it('ramène l’annuel au mois, au centime', () => {
    expect(équivalentMensuelDeLAnnuel()).toBe(74.17)
    expect(enEuros(équivalentMensuelDeLAnnuel())).toBe('74,17')
  })
})
