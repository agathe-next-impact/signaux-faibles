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

/**
 * Le geste manuel de resynchronisation.
 *
 * C'est une action serveur qui reçoit un slug venu du navigateur et vide des
 * entrées de cache. Trois propriétés la tiennent, et une relecture ne suffit
 * pas à les garantir dans la durée :
 *
 * - elle passe par `exigerAccès`, le contrôle unique, plutôt que de composer
 *   le sien sur un slug cru sur parole ;
 * - elle exige le **privilège** `tousLesEspaces` et non la visite
 *   `enOpérateur`, sans quoi le bouton manquerait sur l'espace de l'opératrice
 *   elle-même et s'ouvrirait aux clients — or Notion tient trois requêtes par
 *   seconde ;
 * - elle utilise `updateTag` et non `revalidateTag` : le second sert l'ancienne
 *   version pendant la régénération, c'est-à-dire exactement ce que la
 *   personne qui clique cherchait à éviter.
 */
describe('la resynchronisation manuelle reste un geste d’opérateur', () => {
  const source = readFileSync(join(process.cwd(), 'lib', 'portail', 'resynchroniser.ts'), 'utf8')

  it('passe par le contrôle d’appartenance unique', () => {
    expect(source).toContain('exigerAccès(slug)')
  })

  it('exige le privilège, pas la visite', () => {
    expect(source).toContain('!accès.tousLesEspaces')
    expect(source).not.toMatch(/if\s*\(\s*!accès\.enOpérateur\s*\)/)
  })

  it('expire immédiatement plutôt que de servir l’ancienne version', () => {
    expect(source).toContain('updateTag(')
    expect(source).not.toContain('revalidateTag(')
  })

  it('ne relance pas la garde de contrat de schéma', () => {
    expect(source).not.toMatch(/updateTag\(\s*'schema:notion'\s*\)/)
  })
})

/**
 * Invalider un tag est un pouvoir, pas une commodité. Trois endroits l'ont, et
 * chacun vérifie quelque chose avant : le webhook une signature Notion, l'action
 * manuelle le privilège opérateur, la route d'ouverture le jeton d'activation.
 * Un écran qui invaliderait au rendu viderait le cache à chaque visite, et la
 * limite de trois requêtes par seconde serait atteinte par le trafic normal.
 */
describe('l’invalidation de cache reste à deux endroits', () => {
  it('personne d’autre n’appelle updateTag ni revalidateTag', () => {
    const trouvés: string[] = []
    const parcourir = (dossier: string) => {
      for (const entrée of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entrée.name)
        if (entrée.isDirectory()) {
          if (entrée.name !== 'node_modules' && !entrée.name.startsWith('.')) parcourir(chemin)
          continue
        }
        if (!/\.tsx?$/.test(entrée.name)) continue
        if (/\b(?:updateTag|revalidateTag)\(/.test(readFileSync(chemin, 'utf8'))) {
          trouvés.push(chemin.replace(`${process.cwd()}/`, ''))
        }
      }
    }
    for (const racine of ['app', 'components', 'lib']) parcourir(join(process.cwd(), racine))

    expect(trouvés.sort()).toEqual([
      'app/api/acces/ouvrir/route.ts',
      'app/api/webhooks/notion/route.ts',
      'lib/portail/resynchroniser.ts',
    ])
  })
})

/**
 * La route d'ouverture envoie un courrier à un vrai lecteur, sur appel d'une
 * tâche qui vit hors du dépôt. Deux choses ne doivent jamais s'y glisser.
 */
describe('la route d’ouverture ne divulgue ni lien ni identifiant', () => {
  const source = readFileSync(
    join(process.cwd(), 'app', 'api', 'acces', 'ouvrir', 'route.ts'),
    'utf8',
  )

  it('ne met le lien ni dans la réponse ni dans un journal', () => {
    // Le lien ne vit que dans le courrier ; le jeton ne se lit que dans
    // /acces/[jeton], qui redirige aussitôt (règle 8).
    const lignes = source.split('\n').filter((ligne) => /\blien\b/.test(ligne))
    for (const ligne of lignes) {
      expect(ligne, ligne.trim()).not.toMatch(/console\.|NextResponse\.json/)
    }
    expect(source).not.toMatch(/(?:json|console)[^\n]*\blien\b/)
  })

  it('ne renvoie pas l’identifiant d’accès à l’appelant', () => {
    const réponses = source.match(/NextResponse\.json\(\{[\s\S]*?\}\)/g) ?? []
    expect(réponses.length).toBeGreaterThan(0)
    for (const réponse of réponses) {
      expect(réponse).not.toContain('identifiant')
    }
  })

  it('vérifie la demande avant de lire l’environnement complet', () => {
    // `env()` lève si une variable manque. Le faire avant le contrôle du jeton
    // laisserait un appelant anonyme provoquer une 500 et apprendre au passage
    // ce qui est mal configuré.
    expect(source.indexOf('interpréterDemande')).toBeLessThan(source.indexOf('env()'))
    expect(source).toContain("process.env['ACTIVATION_SECRET']")
  })
})
