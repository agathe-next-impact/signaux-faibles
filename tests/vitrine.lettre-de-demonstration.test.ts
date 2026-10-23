import { describe, expect, it } from 'vitest'
import { axesDuDocument, construireDocument } from '@/lib/domaine/document'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { LETTRE_DE_DÉMONSTRATION } from '@/lib/vitrine/lettre-de-demonstration'

/**
 * La lettre de la vitrine est publique : elle doit passer le lint de
 * production comme une lettre qui part chez un client, et ne porter ni le
 * rapport de collecte ni de mot de production.
 */
describe('lettre de démonstration', () => {
  const blocs = markdownVersBlocs(LETTRE_DE_DÉMONSTRATION.markdown)

  it('passe le lint de la lettre unique sans rupture', () => {
    const rapport = contrôlerLaLettre({
      titre: `${LETTRE_DE_DÉMONSTRATION.veille}, édition n° ${LETTRE_DE_DÉMONSTRATION.numéro}`,
      blocs,
      dossiersBruts: '',
      numéro: LETTRE_DE_DÉMONSTRATION.numéro,
      forme: 'unique',
    })
    expect(rapport.ruptures).toEqual([])
  })

  it('rend ses treize axes avec un badge', () => {
    const axes = axesDuDocument(construireDocument(blocs))
    expect(axes).toHaveLength(13)
    expect(axes.every((axe) => axe.niveau !== null)).toBe(true)
  })

  it('ne porte ni rapport de collecte ni mot de production', () => {
    expect(LETTRE_DE_DÉMONSTRATION.markdown).not.toMatch(/sources non consultées|brouillon|non relu|à confirmer/i)
  })
})
