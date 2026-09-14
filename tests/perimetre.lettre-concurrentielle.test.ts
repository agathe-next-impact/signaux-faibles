import { describe, expect, it } from 'vitest'
import { construireDocument } from '@/lib/domaine/document'
import { lireDossiersOuverts } from '@/lib/domaine/dossiers'
import { mentionsDe } from '@/lib/domaine/mentions'
import { BLOCS_CONCURRENTIELS, DOSSIERS_CONCURRENTIELS } from './fixtures/lettre-concurrentielle'

/**
 * Le périmètre, mesuré sur une vraie lettre concurrentielle.
 *
 * Les deux sections qui parlent du périmètre y sont : « Les acteurs que nous
 * suivons pour vous » et « Ajustements du cadrage de cette veille ». Elles
 * quittent la lettre pour l'écran du périmètre — et la seconde garantie compte
 * autant que la première : les dossiers que cette rubrique est la seule à
 * nommer doivent continuer d'avoir un extrait à montrer.
 */
describe('les deux sections de périmètre d’une lettre concurrentielle', () => {
  const document = construireDocument(BLOCS_CONCURRENTIELS)
  const dossiers = lireDossiersOuverts(DOSSIERS_CONCURRENTIELS)

  it('sort les acteurs suivis et le cadrage du corps de la lettre', () => {
    expect(document.rubriques.map((rubrique) => rubrique.titre)).toEqual([
      'L’essentiel',
      'Actualités par axe',
    ])
  })

  it('pose la rubrique du corpus dans les acteurs suivis, entière', () => {
    expect(document.acteursSuivis).toHaveLength(4)
    expect(document.acteursSuivis.every((bloc) => bloc.type === 'paragraphe')).toBe(true)
  })

  it('garde les ajustements de leur côté, coupés au trait', () => {
    expect(document.cadrage.map((bloc) => bloc.type)).toEqual(['liste', 'paragraphe'])
  })

  it('laisse les axes et leur impact dans la lettre', () => {
    const axes = document.rubriques.flatMap((rubrique) => rubrique.axes)
    expect(axes.map((axe) => axe.niveau)).toEqual(['MOYEN', 'MOYEN'])
  })

  it('trouve un passage pour sept des neuf dossiers suivis', () => {
    const sans = dossiers.filter((d) => mentionsDe(d.nom, document).length === 0).map((d) => d.nom)
    // Deux irréductibles, et ils le sont pour la même raison que
    // « SecNumCloud 3.2 » dans la lettre écosystème : la prose reformule le
    // syntagme au lieu de l'insérer tel quel. Elle écrit « la convergence DES
    // RÉSEAUX Xerox et Lexmark » — « réseaux » dépasse les quatre lettres
    // tolérées entre deux mots du nom — et « le rythme comparé sur VOS cinq
    // marchés » là où le dossier dit « sur LES cinq marchés » : un mot
    // remplacé, pas un mot inséré. Les rapprocher quand même demanderait de
    // laisser tomber un mot du nom, c'est-à-dire de citer un passage qui ne
    // nomme pas vraiment le dossier.
    expect(sans).toEqual(['Convergence Xerox et Lexmark', 'Rythme comparé sur les cinq marchés'])
  })

  it('cite les dossiers que la rubrique détachée est seule à nommer', () => {
    // Kyocera n'apparaît dans aucun axe de cette lettre : son seul passage
    // vient de la rubrique du corpus. Sans parcours de la section détachée, sa
    // page serait vide alors que la lettre parle de lui — la panne silencieuse
    // que le portail cherche précisément à éviter.
    const mentions = mentionsDe('Couverture de Kyocera France', document)
    expect(mentions).toHaveLength(1)
    expect(mentions[0]?.titre).toBe('')
    expect(mentions[0]?.passages[0]?.texte).toContain('rétablie par une autre adresse')
  })

  it('ne cite jamais les ajustements de cadrage comme un fait de la semaine', () => {
    // Le Groupe Desk est nommé dans les deux sections détachées. Seule celle
    // des acteurs suivis est du contenu de veille : le cadrage propose, il ne
    // constate pas.
    const passages = mentionsDe('Groupe Desk', document).flatMap((m) => m.passages)
    expect(passages).toHaveLength(1)
    expect(passages[0]?.texte).toContain('introuvable au registre')
  })
})
