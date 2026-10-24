import { describe, expect, it } from 'vitest'
import { axesDuDocument, construireDocument } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'

/**
 * Les démonstrations de la vitrine sont publiques : chaque lettre doit passer
 * le lint de production comme une lettre qui part chez un client, et rester
 * visiblement fictive.
 */
describe('démonstrations de la vitrine', () => {
  it('portent trois profils distincts : conseil, PME, ESS', () => {
    expect(DÉMONSTRATIONS.map((d) => d.clé)).toEqual(['conseil', 'pme', 'ess'])
  })

  for (const démonstration of DÉMONSTRATIONS) {
    describe(démonstration.organisation, () => {
      const blocs = markdownVersBlocs(démonstration.markdown)

      it('passe le lint de la lettre unique sans rupture', () => {
        const rapport = contrôlerLaLettre({
          titre: `${démonstration.veille}, édition n° ${démonstration.numéro}`,
          blocs,
          dossiersBruts: démonstration.dossiers,
          numéro: démonstration.numéro,
          forme: 'unique',
        })
        expect(rapport.ruptures).toEqual([])
      })

      it('rend dix axes au moins, chacun avec un badge', () => {
        const axes = axesDuDocument(construireDocument(blocs))
        expect(axes.length).toBeGreaterThanOrEqual(10)
        expect(axes.every((axe) => axe.niveau !== null)).toBe(true)
      })

      it('ne cite que des sources fictives, sur le domaine réservé .example', () => {
        const liens = [...démonstration.markdown.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1] ?? '')
        expect(liens.length).toBeGreaterThan(0)
        expect(liens.every((lien) => new URL(lien).hostname.endsWith('.example'))).toBe(true)
      })

      it('ne porte aucun mot de production', () => {
        expect(démonstration.markdown).not.toMatch(/sources non consultées|brouillon|non relu|à confirmer/i)
      })
    })
  }
})
