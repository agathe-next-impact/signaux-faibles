import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Garde d'architecture.
 *
 * Le débit Notion est de trois requêtes par seconde par intégration : une
 * lecture non cachée est un bug bloquant, pas une inélégance. Ce test lit le
 * code source plutôt que de faire confiance à la relecture.
 */
const DOSSIER = join(process.cwd(), 'lib', 'notion')

/**
 * Auxiliaires privés, appelés uniquement depuis une fonction cachée, dont ils
 * héritent donc du cache. Toute addition à cette liste doit être justifiée.
 */
const AUXILIAIRES_CACHÉS = new Set(['listerEnfants', 'résoudreUneBase'])

function fonctionsDe(source: string): Array<{ nom: string; corps: string }> {
  const morceaux = source.split(/(?=^(?:export )?(?:async )?function )/m)
  return morceaux
    .map((morceau) => {
      const nom = /^(?:export )?(?:async )?function ([\p{L}\p{N}_$]+)/u.exec(morceau)?.[1]
      return nom ? { nom, corps: morceau } : null
    })
    .filter((entrée): entrée is { nom: string; corps: string } => entrée !== null)
}

const fichiers = readdirSync(DOSSIER).filter((nom) => nom.endsWith('.ts'))

describe('toute lecture Notion vit dans une fonction cachée', () => {
  it('trouve bien les modules à inspecter', () => {
    expect(fichiers.length).toBeGreaterThan(0)
  })

  for (const fichier of fichiers) {
    const source = readFileSync(join(DOSSIER, fichier), 'utf8')

    for (const fonction of fonctionsDe(source)) {
      const litNotion = /\bnotion\(\)\./.test(fonction.corps)
      if (!litNotion) continue

      it(`${fichier} → ${fonction.nom}`, () => {
        const cachée = fonction.corps.includes("'use cache")
        const auxiliaire = AUXILIAIRES_CACHÉS.has(fonction.nom)
        expect(
          cachée || auxiliaire,
          `${fonction.nom} appelle Notion sans directive « use cache ». ` +
            'Soit la déclarer, soit l’ajouter aux auxiliaires privés en justifiant pourquoi.',
        ).toBe(true)
      })
    }
  }

  it('utilise le cache distant, le cache mémoire ne survivant pas en serverless', () => {
    for (const fichier of fichiers) {
      const source = readFileSync(join(DOSSIER, fichier), 'utf8')
      const directives = source.match(/'use cache[^']*'/g) ?? []
      for (const directive of directives) {
        expect(directive, `${fichier} : ${directive}`).toBe("'use cache: remote'")
      }
    }
  })
})

describe('les propriétés internes ne sortent jamais du serveur', () => {
  it('le type Édition ne porte ni Famille, ni Livraison, ni Amendements', () => {
    const source = readFileSync(join(DOSSIER, 'editions.ts'), 'utf8')
    const type = /export type Édition = \{[\s\S]*?\n\}/.exec(source)?.[0] ?? ''
    expect(type).not.toBe('')
    for (const interne of ['Famille', 'Livraison', 'Amendements']) {
      expect(type).not.toContain(interne)
    }
  })
})

describe('le cloisonnement ne se décide jamais sur le premier élément d’une relation', () => {
  it('aucun module ne lit Organisation[0]', () => {
    for (const fichier of fichiers) {
      const source = readFileSync(join(DOSSIER, fichier), 'utf8')
      expect(source).not.toMatch(/lireRelation\([^)]*\)\s*\[\s*0\s*\]/)
    }
  })
})

/**
 * L'exception opérateur ne doit pas se répandre.
 *
 * Deux fonctions la portent. `organisationDuSlug` est le seul chemin par lequel
 * un identifiant d'organisation vient d'ailleurs que de la ligne « Accès » de la
 * personne connectée. `espacesOuverts` est la seule lecture du portail qui
 * traverse les clients. Toutes deux n'ont de sens que confinées au contrôle
 * d'appartenance, où la vérification du privilège précède l'appel : un écran qui
 * les appellerait lui-même la contournerait.
 */
describe('l’exception opérateur reste confinée', () => {
  const appelants = (fonction: string) => {
    const trouvés: string[] = []
    const parcourir = (dossier: string) => {
      for (const entrée of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entrée.name)
        if (entrée.isDirectory()) {
          if (entrée.name !== 'node_modules' && !entrée.name.startsWith('.')) parcourir(chemin)
          continue
        }
        if (!/\.tsx?$/.test(entrée.name)) continue
        if (readFileSync(chemin, 'utf8').includes(fonction)) {
          trouvés.push(chemin.replace(`${process.cwd()}/`, ''))
        }
      }
    }
    for (const racine of ['app', 'components', 'lib']) {
      parcourir(join(process.cwd(), racine))
    }
    return trouvés.sort()
  }

  for (const fonction of ['organisationDuSlug', 'espacesOuverts']) {
    it(`${fonction} n’est déclarée et appelée que dans deux fichiers`, () => {
      expect(appelants(fonction)).toEqual(['lib/auth/appartenance.ts', 'lib/notion/acces.ts'])
    })
  }
})
