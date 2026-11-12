import { describe, expect, it } from 'vitest'
import {
  enEuros,
  FIN_DU_TARIF_EARLY_ADOPTER,
  finDuTarifEarlyAdopter,
  FRAIS_DE_MISE_EN_PLACE_HT,
  fraisDeMiseEnPlaceDus,
  HEURES_DE_PRISE_EN_MAIN,
  PRIX_FONDATEUR_HT,
  PRIX_ANNUEL_HT,
  PRIX_MENSUEL_HT,
  prixTTC,
  équivalentMensuelDeLAnnuel,
} from '@/lib/domaine/offre'

/**
 * Les montants des pages vitrines viennent de `lib/domaine/offre.ts`. Ce test
 * tient les chiffres de l'offre revue le 6 novembre 2026, tels que
 * `docs/decision-portail-moteur.md` les écrit : 149 € HT par mois (178,80 € TTC) ou 1 490 € HT par an,
 * création du référentiel et deux heures de prise en main comprises ; frais de
 * mise en place offerts aux early adopters, puis 790 € HT (948 € TTC).
 */
const sansEspaceFine = (texte: string) => texte.replace(/\s/g, ' ')

describe('les montants de l’offre', () => {
  it('fixe l’abonnement à 149 € HT par mois, référentiel et deux heures de prise en main compris', () => {
    expect(PRIX_MENSUEL_HT).toBe(149)
    expect(HEURES_DE_PRISE_EN_MAIN).toBe(2)
  })

  it('fixe l’annuel à dix mois payés, 1 490 € HT, soit 124,17 € HT par mois', () => {
    expect(PRIX_ANNUEL_HT).toBe(1490)
    expect(sansEspaceFine(enEuros(PRIX_ANNUEL_HT))).toBe('1 490')
    expect(enEuros(équivalentMensuelDeLAnnuel())).toBe('124,17')
    expect(prixTTC(PRIX_ANNUEL_HT)).toBe(1788)
  })

  it('donne les prix toutes taxes comprises', () => {
    expect(prixTTC(PRIX_MENSUEL_HT)).toBe(178.8)
    expect(prixTTC(FRAIS_DE_MISE_EN_PLACE_HT)).toBe(948)
  })

  it('écrit les euros à la française', () => {
    expect(enEuros(prixTTC(PRIX_MENSUEL_HT))).toBe('178,80')
    expect(enEuros(PRIX_MENSUEL_HT)).toBe('149')
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

describe('fraisDeMiseEnPlaceDus', () => {
  const après = new Date('2027-01-02T09:00:00Z')
  it('les doit à une organisation standard inscrite après le 31 décembre 2026, jamais abonnée', () => {
    expect(fraisDeMiseEnPlaceDus({ offre: 'standard', inscriteLe: après, déjàAbonnée: false })).toBe(true)
  })
  it('les offre à toute inscription jusqu’au 31 décembre inclus, en heure de Paris', () => {
    expect(fraisDeMiseEnPlaceDus({ offre: 'standard', inscriteLe: new Date('2026-11-07T09:00:00Z'), déjàAbonnée: false })).toBe(false)
    // 22 h 59 UTC le 31 décembre : 23 h 59 à Paris, encore offerts.
    expect(fraisDeMiseEnPlaceDus({ offre: 'standard', inscriteLe: new Date('2026-12-31T22:59:00Z'), déjàAbonnée: false })).toBe(false)
    // 23 h 30 UTC le 31 décembre : le 1er janvier à Paris, dus.
    expect(fraisDeMiseEnPlaceDus({ offre: 'standard', inscriteLe: new Date('2026-12-31T23:30:00Z'), déjàAbonnée: false })).toBe(true)
  })
  it('ne les doit ni à un tarif fondateur, ni à un accès offert, ni à une reprise d’abonnement', () => {
    expect(fraisDeMiseEnPlaceDus({ offre: 'fondateur', inscriteLe: après, déjàAbonnée: false })).toBe(false)
    expect(fraisDeMiseEnPlaceDus({ offre: 'gratuite', inscriteLe: après, déjàAbonnée: false })).toBe(false)
    expect(fraisDeMiseEnPlaceDus({ offre: 'standard', inscriteLe: après, déjàAbonnée: true })).toBe(false)
  })
})
