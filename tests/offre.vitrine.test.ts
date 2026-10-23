import { describe, expect, it } from 'vitest'
import { enEuros, PRIX_ANNUEL_HT, PRIX_MENSUEL_HT, prixTTC, équivalentMensuelDeLAnnuel } from '@/lib/domaine/offre'

/**
 * Les montants des pages vitrines viennent de `lib/domaine/offre.ts`. Ce test
 * tient les chiffres de l'offre du 17 octobre 2026 tels que
 * `docs/decision-portail-moteur.md` les écrit : 178,80 € TTC par mois,
 * 1 788 € TTC par an (prix du 23 octobre 2026).
 */
const sansEspaceFine = (texte: string) => texte.replace(/\s/g, ' ')

describe('les montants de l’offre', () => {
  it('donne les prix toutes taxes comprises de la décision', () => {
    expect(prixTTC(PRIX_MENSUEL_HT)).toBe(178.8)
    expect(prixTTC(PRIX_ANNUEL_HT)).toBe(1788)
  })

  it('écrit les euros à la française', () => {
    expect(enEuros(prixTTC(PRIX_MENSUEL_HT))).toBe('178,80')
    expect(sansEspaceFine(enEuros(prixTTC(PRIX_ANNUEL_HT)))).toBe('1 788')
    expect(enEuros(PRIX_MENSUEL_HT)).toBe('149')
  })

  it('ramène l’annuel au mois, au centime', () => {
    expect(équivalentMensuelDeLAnnuel()).toBe(124.17)
    expect(enEuros(équivalentMensuelDeLAnnuel())).toBe('124,17')
  })
})
