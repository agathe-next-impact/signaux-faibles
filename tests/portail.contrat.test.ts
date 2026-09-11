import { describe, expect, it } from 'vitest'
import { lireDossiersOuverts } from '@/lib/domaine/dossiers'
import { contrôlerLeContrat } from '@/lib/portail/contrat'

/**
 * Deux vraies propriétés « Dossiers ouverts suivis », prises dans la base le
 * 11 septembre 2026. Elles se ressemblent à l'œil et ne se valent pas : l'une
 * remonte dix acteurs sur l'accueil, l'autre zéro. C'est exactement l'écart que
 * ce contrôle doit nommer, et une reformulation ne le reproduirait pas.
 */
const INFRALLIANCE_CONFORME =
  'Loi Résilience (0) · CADA (0, rapporteurs identifiés) · règlement marchés publics (0) · ' +
  'catalogue franco-allemand (0) · SecNumCloud 3.2 (0) · PINM (0, aucun décret) · ' +
  'Rovaltain (0) · raccordement Telehouse Magny (0, règle RTE fin 2026) · ' +
  'DNA (0, date corrigée) · colloque Cnam (0)'

const MAURIAC_ROMPU =
  "Budget de l'État 2027, contribution des collectivités — effort chiffré 6-7 Md€ le 03/09, " +
  'texte non déposé (dépôt annoncé 30/09) — 1 | Demandes DETR-DSIL-Fonds vert 2026 de la CC — ' +
  'aucune attribution publiée, dernier tableau = exercice 2025 (04/03/2026) — 1 | ' +
  'Campagne DETR/DSIL 2027 — non publiée, repère : circulaire 2026 du 22/10/2025 — 1 | ' +
  'Maison de santé pluriprofessionnelle — aucune publication depuis les délibérations du ' +
  '23/02/2026 — 1'

describe('le contrat de format des lettres', () => {
  it('ne dit rien d’une semaine conforme', () => {
    const dossiers = lireDossiersOuverts(INFRALLIANCE_CONFORME)
    expect(dossiers).toHaveLength(10)
    expect(dossiers.every((d) => d.compteur !== null)).toBe(true)

    expect(contrôlerLeContrat({ axes: 7, notes: 2, dossiers })).toEqual([])
  })

  it('nomme le compteur hors parenthèses, qui vide la section des acteurs', () => {
    const dossiers = lireDossiersOuverts(MAURIAC_ROMPU)

    // Le séparateur « | » est accepté : les entrées sont bien découpées. Ce qui
    // casse est le compteur, placé après un tiret au lieu d'être entre
    // parenthèses — chaque entrée devient donc son propre nom, en entier.
    expect(dossiers).toHaveLength(4)
    expect(dossiers.every((d) => d.compteur === null)).toBe(true)
    expect(dossiers[0]?.nom).toContain('Budget de l’État 2027'.replace('’', "'"))

    const ruptures = contrôlerLeContrat({ axes: 3, notes: 2, dossiers })
    expect(ruptures.map((r) => r.sorte)).toEqual(['dossiers'])
    expect(ruptures[0]?.message).toContain('aucun compteur exploitable')
  })

  it('nomme l’absence d’axe, qui vide « L’écosystème » et les tendances', () => {
    const dossiers = lireDossiersOuverts(INFRALLIANCE_CONFORME)
    const ruptures = contrôlerLeContrat({ axes: 0, notes: 2, dossiers })
    expect(ruptures.map((r) => r.sorte)).toEqual(['axes'])
  })

  it('relève les deux écarts à la fois — le cas réel du 11 septembre', () => {
    const ruptures = contrôlerLeContrat({
      axes: 0,
      notes: 2,
      dossiers: lireDossiersOuverts(MAURIAC_ROMPU),
    })
    expect(ruptures.map((r) => r.sorte).sort()).toEqual(['axes', 'dossiers'])
  })

  it('se tait quand il n’y a rien à lire', () => {
    // Aucune note : un espace neuf, pas une panne. C'est le layout qui le dit,
    // et il le dit déjà.
    expect(contrôlerLeContrat({ axes: 0, notes: 0, dossiers: [] })).toEqual([])
  })

  it('tolère un dossier unique sans compteur', () => {
    // Le portail est délibérément tolérant sur une entrée isolée : c'est
    // l'absence de compteur sur TOUTE la liste qui signe un autre format.
    const dossiers = lireDossiersOuverts('un dossier sans compteur')
    expect(contrôlerLeContrat({ axes: 2, notes: 1, dossiers })).toEqual([])
  })
})
