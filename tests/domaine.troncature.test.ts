import { describe, expect, it } from 'vitest'
import type { Bloc, Document, Segment } from '@/lib/domaine/document'
import { tronquerÀLEssentiel } from '@/lib/domaine/troncature'
import { lignesDeLEssentiel } from '@/lib/portail/lint'

const s = (texte: string): Segment => ({ texte, gras: false, italique: false, code: false, barré: false, lien: null })
const p = (texte: string): Bloc => ({ type: 'paragraphe', segments: [s(texte)] })

const lettre: Document = {
  préambule: [p('Note de méthode.')],
  rubriques: [
    {
      titre: 'L’essentiel',
      introduction: [{ type: 'liste', ordonnée: false, éléments: [[s('Le décret est paru le 12 octobre.')], [s('Konica rachète X.')]] }],
      axes: [{ titre: 'Un axe caché — FORT', numéro: 1, niveau: 'FORT', blocs: [p('Détail réservé aux abonnés.')] }],
    },
    { titre: 'Actualités par axe', introduction: [], axes: [{ titre: 'Marché — MOYEN', numéro: 2, niveau: 'MOYEN', blocs: [p('Fait daté.')] }] },
    { titre: 'Recommandation de la période', introduction: [p('Écrire à la préfecture.')], axes: [] },
  ],
  cadrage: [p('Proposition de périmètre.')],
  acteursSuivis: [p('Kyocera, deux faits.')],
}

describe('tronquerÀLEssentiel', () => {
  it('ne garde que l’introduction de « L’essentiel »', () => {
    const tronquée = tronquerÀLEssentiel(lettre)
    expect(tronquée.préambule).toEqual([])
    expect(tronquée.cadrage).toEqual([])
    expect(tronquée.acteursSuivis).toEqual([])
    expect(tronquée.rubriques).toHaveLength(1)
    expect(tronquée.rubriques[0]?.axes).toEqual([])
    expect(lignesDeLEssentiel(tronquée)).toEqual(['Le décret est paru le 12 octobre.', 'Konica rachète X.'])
  })

  it('ne laisse aucun autre texte de la lettre dans le document', () => {
    const json = JSON.stringify(tronquerÀLEssentiel(lettre))
    for (const caché of ['Note de méthode', 'Détail réservé', 'Fait daté', 'préfecture', 'Proposition de périmètre', 'Kyocera']) {
      expect(json).not.toContain(caché)
    }
  })

  it('reconnaît la rubrique comme le validateur, sous ses variantes', () => {
    for (const titre of ["L'essentiel", 'Essentiel', 'L’essentiel de la semaine']) {
      const d: Document = { ...lettre, rubriques: [{ titre, introduction: [p('Une ligne.')], axes: [] }] }
      expect(tronquerÀLEssentiel(d).rubriques).toHaveLength(1)
    }
  })

  it('une lettre sans « L’essentiel » donne un document vide, jamais la lettre entière', () => {
    const d: Document = { ...lettre, rubriques: lettre.rubriques.slice(1) }
    expect(tronquerÀLEssentiel(d).rubriques).toEqual([])
  })
})
