import { describe, expect, it } from 'vitest'
import { contrôlerLesÉtiquettes } from '@/lib/domaine/strategie'
import { assemblerLaLettre } from '@/lib/moteur/assemblage'
import { étiquettesDeLaSortie } from '@/lib/moteur/etiquettes'
import { schémaDeLaLettre, schémaDeLaLettreÉtiquetée, type SortieÉtiquetée, type Sélection } from '@/lib/moteur/redaction'
import { lireRéférentielUnique, écrireRéférentielUnique } from '@/lib/moteur/referentiel'

const AXES = 10
const URL = (i: number) => `https://exemple.fr/axe-${i}`
const RÉFÉRENTIEL = lireRéférentielUnique(
  écrireRéférentielUnique('Tolmen Mécanique', {
    fiche: 'Tolmen Mécanique usine des pièces aéronautiques.',
    axes: Array.from({ length: AXES }, (_, i) => ({
      nom: i < 7 ? `Thème ${i + 1}` : `Concurrents ${i + 1}`,
      sorte: i < 7 ? ('thème' as const) : ('concurrents' as const),
      critères: 'FORT si un donneur d’ordre change ses cadences.',
      sources: [{ libellé: `Source ${i + 1}`, url: URL(i + 1) }],
      requêtes: [],
      acteurs: [],
    })),
    dossiers: [],
  }),
)

const SÉLECTION: Sélection = { numéro: 4, dateÉdition: '2026-10-26', période: { début: '2026-10-19', fin: '2026-10-25' } }

/** Un axe de thème sur deux porte deux faits PESTEL, les axes concurrents un fait de rivalité nommé. */
function sortie(): SortieÉtiquetée {
  return {
    essentiel: ['Aérolys relève ses cadences le 21 octobre.', 'Précimeca ouvre un atelier le 22 octobre.', 'Rien de neuf sur la norme EN 9100.'],
    axes: Array.from({ length: AXES }, (_, i) => {
      const numéro = i + 1
      if (numéro >= 8) {
        return {
          numéro,
          niveau: 'FORT' as const,
          faits: [
            {
              texte: `Précimeca a ouvert le 22 octobre un atelier de cinq axes, annonce ${numéro}.`,
              date: '2026-10-22',
              url: URL(numéro),
              contexte: false,
              étiquette: { pestel: null, porter: 'rivalite' as const, ansoff: 'developpement_produit' as const, entite: 'Précimeca', rupture: false, impact: 'FORT' as const },
            },
          ],
          ras: null,
        }
      }
      if (numéro % 2 === 0) return { numéro, niveau: 'RAS' as const, faits: [], ras: 'Rien de neuf. La source nommée est muette depuis le 3 juillet.' }
      return {
        numéro,
        niveau: 'MOYEN' as const,
        faits: [
          {
            texte: `Le texte ${numéro} est paru le 21 octobre. Il s’applique au 1er janvier.`,
            date: '2026-10-21',
            url: URL(numéro),
            contexte: false,
            étiquette: { pestel: 'legal' as const, porter: null, ansoff: null, entite: null, rupture: false, impact: 'MOYEN' as const },
          },
          {
            texte: `Aérolys a relevé ses cadences en septembre, rappel ${numéro}.`,
            date: '2026-09-30',
            url: URL(numéro),
            contexte: true,
            étiquette: { pestel: 'economique' as const, porter: null, ansoff: null, entite: 'Aérolys', rupture: true, impact: 'MOYEN' as const },
          },
        ],
        ras: null,
      }
    }),
    dossiers: [],
    actionDeLaSemaine: 'Vérifier les cadences d’Aérolys avant la revue du 3 novembre.',
  }
}

describe('schémaDeLaLettreÉtiquetée', () => {
  it('le schéma en service ne demande pas d’étiquette ; le schéma étiqueté l’exige pour chaque fait', () => {
    const s = sortie()
    expect(schémaDeLaLettreÉtiquetée.safeParse(s).success).toBe(true)
    const sansÉtiquette = { ...s, axes: s.axes.map((a) => ({ ...a, faits: a.faits.map(({ étiquette: _, ...f }) => f) })) }
    expect(schémaDeLaLettre.safeParse(sansÉtiquette).success).toBe(true)
    expect(schémaDeLaLettreÉtiquetée.safeParse(sansÉtiquette).success).toBe(false)
    const faible = structuredClone(s)
    ;(faible.axes[0]!.faits[0]!.étiquette as { impact: string }).impact = 'FAIBLE'
    expect(schémaDeLaLettreÉtiquetée.safeParse(faible).success).toBe(false)
  })
})

describe('étiquettesDeLaSortie', () => {
  it('rend un lot que la porte accepte entier : place et phrase-titre lues dans la lettre assemblée', () => {
    const s = sortie()
    const lettre = assemblerLaLettre(s, RÉFÉRENTIEL, SÉLECTION)
    const { lot, écarts } = étiquettesDeLaSortie(s, lettre.blocs)
    expect(écarts).toEqual([])
    expect(lot).toHaveLength(4 * 2 + 3)
    expect(lot[0]).toMatchObject({ section: 'axe', axe: 1, rang: 1, date: '2026-10-21', source: URL(1), pestel: 'legal', nouveaute: 'nouveau' })
    expect(lot[1]).toMatchObject({ axe: 1, rang: 2, nouveaute: 'contexte', rupture: true, entite: 'Aérolys' })
    expect(lot[0]!.titre).toContain('Le texte 1 est paru le 21 octobre')

    const contrôle = contrôlerLesÉtiquettes({ blocs: lettre.blocs, dateÉdition: SÉLECTION.dateÉdition, lot, entités: ['Précimeca', 'Aérolys'] })
    expect(contrôle.refus).toEqual([])
    expect(contrôle.acceptées).toHaveLength(lot.length)
    expect(contrôle.faits).toBe(lot.length)
  })

  it('une entité hors grille reste refusée par la porte : la sortie du moteur n’a pas de passe-droit', () => {
    const s = sortie()
    const lettre = assemblerLaLettre(s, RÉFÉRENTIEL, SÉLECTION)
    const { lot } = étiquettesDeLaSortie(s, lettre.blocs)
    const contrôle = contrôlerLesÉtiquettes({ blocs: lettre.blocs, dateÉdition: SÉLECTION.dateÉdition, lot, entités: ['Aérolys'] })
    expect(contrôle.acceptées).toEqual([])
    expect(contrôle.refus.map((r) => r.code)).toEqual(['entité-hors-grille', 'entité-hors-grille', 'entité-hors-grille'])
  })

  it('un fait de la sortie absent de la lettre est un écart nommé, jamais une étiquette devinée', () => {
    const s = sortie()
    const lettre = assemblerLaLettre(s, RÉFÉRENTIEL, SÉLECTION)
    const plus = structuredClone(s)
    plus.axes[0]!.faits.push({ ...plus.axes[0]!.faits[0]!, texte: 'Un troisième fait que la lettre n’a pas.' })
    const { lot, écarts } = étiquettesDeLaSortie(plus, lettre.blocs)
    expect(écarts).toEqual(['axe 1, fait 3'])
    expect(lot).toHaveLength(11)
  })
})
