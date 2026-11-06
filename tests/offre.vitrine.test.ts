import { describe, expect, it } from 'vitest'
import {
  enEuros,
  FIN_DU_TARIF_EARLY_ADOPTER,
  finDuTarifEarlyAdopter,
  FRAIS_DE_MISE_EN_PLACE_HT,
  HEURES_DE_PRISE_EN_MAIN,
  PRIX_FONDATEUR_HT,
  PRIX_MENSUEL_HT,
  prixTTC,
} from '@/lib/domaine/offre'

/**
 * Les montants des pages vitrines viennent de `lib/domaine/offre.ts`. Ce test
 * tient les chiffres de l'offre revue le 6 novembre 2026, tels que
 * `docs/decision-portail-moteur.md` les écrit : 259 € HT par mois (310,80 € TTC),
 * création du référentiel et deux heures de prise en main comprises ; frais de
 * mise en place offerts aux early adopters, puis 790 € HT (948 € TTC).
 */
const sansEspaceFine = (texte: string) => texte.replace(/\s/g, ' ')

describe('les montants de l’offre', () => {
  it('fixe l’abonnement à 259 € HT par mois, référentiel et deux heures de prise en main compris', () => {
    expect(PRIX_MENSUEL_HT).toBe(259)
    expect(HEURES_DE_PRISE_EN_MAIN).toBe(2)
  })

  it('donne les prix toutes taxes comprises', () => {
    expect(prixTTC(PRIX_MENSUEL_HT)).toBe(310.8)
    expect(prixTTC(FRAIS_DE_MISE_EN_PLACE_HT)).toBe(948)
  })

  it('écrit les euros à la française', () => {
    expect(enEuros(prixTTC(PRIX_MENSUEL_HT))).toBe('310,80')
    expect(enEuros(PRIX_MENSUEL_HT)).toBe('259')
    expect(sansEspaceFine(enEuros(1790))).toBe('1 790')
  })

  it('offre les frais de mise en place jusqu’au 31 décembre 2026, puis 790 € HT', () => {
    expect(FIN_DU_TARIF_EARLY_ADOPTER).toBe('2026-12-31')
    expect(finDuTarifEarlyAdopter()).toBe('31 décembre 2026')
    expect(FRAIS_DE_MISE_EN_PLACE_HT).toBe(790)
  })

  it('garde le tarif fondateur à 29 € HT, distinct des prix publics', () => {
    expect(PRIX_FONDATEUR_HT).toBe(29)
  })
})
