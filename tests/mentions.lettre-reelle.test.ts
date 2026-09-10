import { describe, expect, it } from 'vitest'
import { construireDocument } from '@/lib/domaine/document'
import { lireDossiersOuverts } from '@/lib/domaine/dossiers'
import { mentionsDe } from '@/lib/domaine/mentions'
import { BLOCS_RÉELS, DOSSIERS_RÉELS } from './fixtures/lettre-reelle'

/**
 * La recette qui compte : les dossiers réels d'une lettre réelle.
 *
 * Une note inventée pour un test nomme ses dossiers proprement, au bon endroit.
 * Une vraie note ne le fait pas : ses dossiers sont des syntagmes descriptifs
 * que la prose reprend avec ses articles, et la moitié de son texte vit hors
 * des sections thématiques.
 */
describe('mentions dans une lettre réelle', () => {
  const document = construireDocument(BLOCS_RÉELS)
  const dossiers = lireDossiersOuverts(DOSSIERS_RÉELS)
  const trouvés = (nom: string) => mentionsDe(nom, document)

  it('lit les dix dossiers de la propriété', () => {
    expect(dossiers.map((d) => d.nom)).toEqual([
      'Loi Résilience',
      'CADA',
      'règlement marchés publics',
      'catalogue franco-allemand',
      'SecNumCloud 3.2',
      'PINM',
      'Rovaltain',
      'raccordement Telehouse Magny',
      'DNA',
      'colloque Cnam',
    ])
  })

  it('trouve un passage pour neuf dossiers sur dix', () => {
    const sans = dossiers.filter((d) => trouvés(d.nom).length === 0).map((d) => d.nom)
    // « SecNumCloud 3.2 » est le seul irréductible : la lettre écrit
    // « SecNumCloud » d'un côté et « référentiel 3.2 » de l'autre, à dix mots
    // d'intervalle. Les rapprocher demanderait de laisser tomber un qualificatif,
    // ce qui confondrait deux versions du même référentiel.
    expect(sans).toEqual(['SecNumCloud 3.2'])
  })

  it('cite l’essentiel et le récapitulatif, hors de toute section thématique', () => {
    // Aucun des deux n'est dans un axe : l'essentiel ouvre sa rubrique, et le
    // récapitulatif final se range sous la dernière, « Analyse ». Ne chercher
    // que dans les axes revenait à n'en citer aucun.
    // Le second est le pied de la lettre, rendu sans titre depuis que le
    // cadrage a été détaché de sa rubrique.
    const sources = trouvés('règlement marchés publics').map((m) => m.titre)
    expect(sources).toEqual(['L’essentiel', ''])
  })

  it('rattache à son axe un passage qui y figure, avec son badge', () => {
    const cada = trouvés('CADA').find((m) => m.titre === 'Cadre européen')
    expect(cada?.numéro).toBe(1)
    expect(cada?.niveau).toBe('MOYEN')
  })

  it('suit le nom malgré l’article que la prose insère', () => {
    // Le dossier dit « raccordement Telehouse Magny », la lettre écrit
    // « le raccordement de Telehouse Magny ».
    const passages = trouvés('raccordement Telehouse Magny').flatMap((m) => m.passages)
    expect(passages.some((p) => p.includes('raccordement de Telehouse Magny'))).toBe(true)
  })

  it('ne confond pas un dossier avec un mot qui le contient', () => {
    expect(trouvés('DNA').flatMap((m) => m.passages).every((p) => !p.includes('ADN'))).toBe(true)
  })
})

describe('ajustements de cadrage dans une lettre réelle', () => {
  const document = construireDocument(BLOCS_RÉELS)

  it('sort les ajustements des rubriques de lecture', () => {
    const titres = document.rubriques.map((r) => r.titre)
    expect(titres).not.toContain('Ajustements du cadrage de cette veille')
  })

  it('les garde entiers, à part — les puces restant une liste', () => {
    expect(document.cadrage.map((bloc) => bloc.type)).toEqual(['liste', 'paragraphe'])

    const [liste, conclusion] = document.cadrage
    const puces =
      liste?.type === 'liste'
        ? liste.éléments.map((é) => é.map((segment) => segment.texte).join(''))
        : []
    expect(puces).toHaveLength(2)
    expect(puces[0]).toContain('Deux dates à corriger')

    const texte =
      conclusion?.type === 'paragraphe'
        ? conclusion.segments.map((segment) => segment.texte).join('')
        : ''
    expect(texte).toContain('qu’après votre accord')
  })

  it('rend le pied de la lettre à la lettre, et non au cadrage', () => {
    // Le récapitulatif « Dossiers ouverts » suit le trait horizontal. Retirer la
    // rubrique entière l'aurait emporté — or c'est lui qui nomme la plupart des
    // dossiers suivis.
    const pied = document.rubriques.at(-1)
    expect(pied?.titre).toBe('')
    const texte = pied?.introduction.flatMap((bloc) =>
      'segments' in bloc ? [bloc.segments.map((s) => s.texte).join('')] : [],
    )
    expect(texte?.[0]).toContain('Dix dossiers restent ouverts')
  })

  it('ne perd aucune mention de dossier au passage', () => {
    const dossiers = lireDossiersOuverts(DOSSIERS_RÉELS)
    const sans = dossiers.filter((d) => mentionsDe(d.nom, document).length === 0).map((d) => d.nom)
    expect(sans).toEqual(['SecNumCloud 3.2'])
  })
})
