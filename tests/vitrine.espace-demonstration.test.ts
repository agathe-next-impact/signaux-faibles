import { describe, expect, it } from 'vitest'
import { accèsDeDémonstration, blocsDeDémonstration, éditionsDeDémonstration, identifiantDePage } from '@/lib/vitrine/espace-demonstration'
import {
  type CléDeDémonstration,
  cléDeCloisonnementDeDémonstration,
  démonstrationDeLaClé,
  démonstrationDuSlug,
  estLaDémonstration,
  SLUGS_DE_DÉMONSTRATION,
} from '@/lib/domaine/demonstration'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { SLUGS_RÉSERVÉS } from '@/lib/domaine/onboarding'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import { lettresDeDémonstration } from '@/lib/vitrine/lettres-demonstration'

const CLÉS: readonly CléDeDémonstration[] = ['conseil', 'pme', 'ess']

describe('les lettres des espaces de démonstration', () => {
  for (const clé of CLÉS) {
    const lettres = lettresDeDémonstration(clé)
    const d = DÉMONSTRATIONS.find((d) => d.clé === clé)!

    it(`${clé} : chaque lettre passe le lint de la lettre unique`, () => {
      for (const lettre of lettres) {
        const verdict = contrôlerLaLettre({
          titre: `${d.veille}, édition n° ${lettre.numéro}`,
          numéro: lettre.numéro,
          blocs: markdownVersBlocs(lettre.markdown),
          dossiersBruts: lettre.dossiers,
          forme: 'unique',
        })
        expect(verdict.ruptures, `n° ${lettre.numéro}`).toEqual([])
        expect(
          verdict.avertissements.filter((a) => a.code !== 'cadrage-présent').map((a) => `${a.code} : ${a.message}`),
          `n° ${lettre.numéro}`,
        ).toEqual([])
      }
    })

    it(`${clé} : la dernière lettre est celle de « Exemples », les autres la précèdent de lundi en lundi`, () => {
      expect(lettres[0]?.numéro).toBe(d.numéro)
      expect(lettres[0]?.markdown).toBe(d.markdown)
      for (let i = 1; i < lettres.length; i++) {
        const récente = new Date(lettres[i - 1]!.dateÉdition)
        const ancienne = new Date(lettres[i]!.dateÉdition)
        expect(lettres[i]!.numéro).toBe(lettres[i - 1]!.numéro - 1)
        expect((récente.getTime() - ancienne.getTime()) / 86_400_000).toBe(7)
        expect(ancienne.getUTCDay()).toBe(1)
      }
    })

    it(`${clé} : la façade sert ses éditions et ses corps par la clé de cloisonnement`, () => {
      const éditions = éditionsDeDémonstration(cléDeCloisonnementDeDémonstration(clé))
      expect(éditions.length).toBe(lettres.length)
      for (const édition of éditions) {
        expect(édition.pageId.startsWith('demo-')).toBe(true)
        expect(édition.veille).toBe(d.veille)
        expect(blocsDeDémonstration(édition.pageId).length).toBeGreaterThan(10)
      }
      expect(blocsDeDémonstration(identifiantDePage(clé, 999))).toEqual([])
    })
  }

  it('un identifiant de client ne donne ni édition ni corps', () => {
    expect(éditionsDeDémonstration('0123456789abcdef0123456789abcdef')).toEqual([])
    expect(blocsDeDémonstration('0123456789abcdef0123456789abcdef')).toEqual([])
    expect(estLaDémonstration('0123456789abcdef0123456789abcdef')).toBe(false)
    expect(démonstrationDeLaClé('demonstration:autre')).toBeNull()
    expect(démonstrationDuSlug('hermitage')).toBeNull()
  })

  it('la clé de cloisonnement ne peut pas exister dans Postgres', () => {
    for (const clé of CLÉS) expect(cléDeCloisonnementDeDémonstration(clé)).not.toMatch(/^[0-9a-f]{32}$/)
  })

  it('les slugs sont réservés et reconnus', () => {
    for (const clé of CLÉS) {
      const slug = SLUGS_DE_DÉMONSTRATION[clé]
      expect(SLUGS_RÉSERVÉS.has(slug)).toBe(true)
      expect(démonstrationDuSlug(slug)).toBe(clé)
    }
  })

  it('l’accès du visiteur est un lecteur anonyme, sans privilège, marqué démonstration', () => {
    const accès = accèsDeDémonstration('conseil')
    expect(accès).toMatchObject({
      email: null,
      slug: 'lisiere-conseil',
      organisationId: 'demonstration:conseil',
      organisationLibellé: 'Lisière Conseil',
      actif: true,
      tousLesEspaces: false,
      enOpérateur: false,
      aperçu: false,
      démonstration: true,
    })
  })
})
