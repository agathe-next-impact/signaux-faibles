import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
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

/**
 * Chemin relatif au dépôt, avec des barres obliques quel que soit le système :
 * `join` compose avec `\\` sous Windows, et `process.cwd()` y porte une lettre
 * de lecteur. Les listes attendues ci-dessous sont écrites en `/`, comme le
 * dépôt les nomme.
 */
const relatif = (chemin: string): string => relative(process.cwd(), chemin).split(sep).join('/')

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
          trouvés.push(relatif(chemin))
        }
      }
    }
    for (const racine of ['app', 'components', 'lib']) {
      parcourir(join(process.cwd(), racine))
    }
    return trouvés.sort()
  }

  // Depuis le palier 1 (16 octobre 2026), la façade `source-acces` choisit la
  // source entre Notion et Postgres et porte les mêmes noms : elle est un
  // troisième fichier, et le seul ajouté. L'écran n'y a toujours pas accès.
  for (const fonction of ['organisationDuSlug', 'espacesOuverts']) {
    it(`${fonction} n’est déclarée et appelée que dans la lecture, la façade et le contrôle`, () => {
      expect(appelants(fonction)).toEqual([
        'lib/auth/appartenance.ts',
        'lib/auth/source-acces.ts',
        'lib/notion/acces.ts',
      ])
    })
  }

  for (const fonction of ['organisationParSlug', 'espacesAvecLecteurs']) {
    it(`${fonction} (Postgres) n’est appelée que par la façade`, () => {
      expect(appelants(fonction)).toEqual(['lib/auth/source-acces.ts', 'lib/base/lecteurs.ts'])
    })
  }
})

/**
 * Le palier 1 : Postgres porte l'état, et un seul dossier lui parle.
 *
 * Deux gardes, du même esprit que celles de Notion. Aucun module hors de
 * `lib/base/` n'importe Drizzle ni le pilote, pour qu'une requête ne puisse pas
 * naître dans un composant ou une route ; et aucun appelant de l'appartenance ne
 * lit Notion ou Postgres directement, pour que `SOURCE_ACCES` soit réellement le
 * seul aiguillage.
 */
describe('Postgres ne se lit que par lib/base, l’appartenance que par la façade', () => {
  const sources = (): Array<{ chemin: string; source: string }> => {
    const trouvés: Array<{ chemin: string; source: string }> = []
    const parcourir = (dossier: string) => {
      for (const entrée of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entrée.name)
        if (entrée.isDirectory()) {
          if (entrée.name !== 'node_modules' && !entrée.name.startsWith('.')) parcourir(chemin)
          continue
        }
        if (/\.tsx?$/.test(entrée.name)) trouvés.push({ chemin: relatif(chemin), source: readFileSync(chemin, 'utf8') })
      }
    }
    for (const racine of ['app', 'components', 'lib']) parcourir(join(process.cwd(), racine))
    trouvés.push({ chemin: 'proxy.ts', source: readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8') })
    return trouvés
  }

  it('aucun import de Drizzle, de Neon ou de PGlite hors de lib/base', () => {
    const fautifs = sources()
      .filter(({ chemin }) => !chemin.startsWith('lib/base/'))
      .filter(({ source }) => /from ['"](?:drizzle-orm|@neondatabase\/serverless|@electric-sql\/pglite)/.test(source))
      .map(({ chemin }) => chemin)
    expect(fautifs).toEqual([])
  })

  it('les lectures Postgres d’appartenance ne sont appelées que par la façade', () => {
    for (const fonction of ['lireLecteurParIdentifiant', 'lireLecteurActifParEmail']) {
      const appelants = sources()
        .filter(({ source }) => source.includes(`${fonction}(`))
        .map(({ chemin }) => chemin)
        .sort()
      expect(appelants, fonction).toEqual(['lib/auth/source-acces.ts', 'lib/base/lecteurs.ts'])
    }
  })

  it('personne n’importe une lecture d’appartenance de lib/notion/acces, sauf la façade', () => {
    // Seule exception : le contrôle du soir lit la base Notion telle qu'elle
    // est, doublons compris — c'est précisément ce qu'il vérifie.
    const PERMIS = new Set(['lignesDAccèsPourContrôle', 'lignesDAccèsPourImport'])
    const fautifs: string[] = []
    for (const { chemin, source } of sources()) {
      if (chemin === 'lib/auth/source-acces.ts' || chemin === 'lib/notion/acces.ts') continue
      for (const [, noms] of source.matchAll(/import\s+\{([^}]*)\}\s+from\s+['"]@\/lib\/notion\/acces['"]/g)) {
        const valeurs = (noms ?? '')
          .split(',')
          .map((nom) => nom.trim())
          .filter((nom) => nom.length > 0 && !nom.startsWith('type '))
        for (const nom of valeurs) if (!PERMIS.has(nom)) fautifs.push(`${chemin} : ${nom}`)
      }
    }
    expect(fautifs).toEqual([])
  })
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
 * Invalider un tag est un pouvoir, pas une commodité. Quatre endroits l'ont, et
 * chacun vérifie quelque chose avant : le webhook une signature Notion, l'action
 * manuelle le privilège opérateur, la route d'ouverture et le validateur de
 * lettre le jeton d'activation. Le validateur expire le tag de la page qu'on
 * lui soumet, parce qu'elle vient d'être corrigée et qu'un rapport sur la
 * version d'avant ferait corriger dans le vide. Un écran qui invaliderait au
 * rendu viderait le cache à chaque visite, et la limite de trois requêtes par
 * seconde serait atteinte par le trafic normal.
 */
describe('l’invalidation de cache reste à quatre endroits, tous gardés', () => {
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
          trouvés.push(relatif(chemin))
        }
      }
    }
    for (const racine of ['app', 'components', 'lib']) parcourir(join(process.cwd(), racine))

    expect(trouvés.sort()).toEqual([
      'app/api/acces/ouvrir/route.ts',
      'app/api/veille/lint/route.ts',
      'app/api/webhooks/notion/route.ts',
      'lib/portail/resynchroniser.ts',
    ])
  })

  it('le validateur vérifie le jeton avant d’invalider', () => {
    const source = readFileSync(join(process.cwd(), 'app', 'api', 'veille', 'lint', 'route.ts'), 'utf8')
    expect(source.indexOf('refuserSiNonAutorisé')).toBeLessThan(source.indexOf('revalidateTag('))
    // `updateTag` n'est permis que dans une action serveur : dans un handler il lève.
    expect(source).not.toContain('updateTag(')
    expect(source).toContain('{ expire: 0 }')
  })
})

/**
 * Les lectures réservées au dispositif ne doivent jamais alimenter un écran.
 *
 * `lib/notion/travail.ts` lit les éditions tous statuts confondus et avec leurs
 * propriétés internes (Famille, Amendements, Livraison) : c'est ce dont la
 * tâche des lettres a besoin, et ce qu'un client ne doit jamais recevoir
 * (règles 3 et 7). `lignesDAccèsPourContrôle` traverse tous les clients. Leurs
 * seuls appelants sont les routes `/api/veille/*`, derrière le jeton d'activation.
 */
describe('les lectures du dispositif restent sous /api/veille', () => {
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
        if (readFileSync(chemin, 'utf8').includes(`${fonction}(`)) {
          trouvés.push(relatif(chemin))
        }
      }
    }
    for (const racine of ['app', 'components', 'lib']) parcourir(join(process.cwd(), racine))
    return trouvés.sort()
  }

  it('lireÉditionDeTravail n’est appelée que par le validateur et la mise en forme du courriel', () => {
    expect(appelants('lireÉditionDeTravail')).toEqual([
      'app/api/veille/courriel/route.ts',
      'app/api/veille/lint/route.ts',
      'lib/notion/travail.ts',
    ])
  })

  /**
   * Tout courriel client sort du gabarit de la charte (20 octobre 2026). Un
   * appelant hors de `lib/email/` ou des courriers de parcours composerait un
   * courriel ailleurs, et finirait par réinventer une couleur ou un bouton.
   */
  it('composerCourriel n’est appelé que par les compositeurs de courriels', () => {
    expect(appelants('composerCourriel')).toEqual([
      'lib/domaine/courriers-parcours.ts',
      'lib/email/gabarit.ts',
      'lib/email/gmail.ts',
      'lib/email/lemlist.ts',
      'lib/email/lettre.ts',
      'lib/email/message.ts',
    ])
  })

  it('la mise en forme d’une lettre refuse une lettre non conforme avant de la composer', () => {
    const corps = readFileSync(join(process.cwd(), 'app/api/veille/courriel/route.ts'), 'utf8')
    expect(corps.indexOf('contrôlerLaLettre(')).toBeGreaterThan(0)
    expect(corps.indexOf('contrôlerLaLettre(')).toBeLessThan(corps.indexOf('composerLettre('))
    expect(corps).not.toContain('revalidateTag(')
    expect(corps).not.toContain('envoyerCourrier(')
  })

  it('listerÉditionsDeTravail n’est appelée que par le contexte', () => {
    expect(appelants('listerÉditionsDeTravail')).toEqual([
      'app/api/veille/contexte/route.ts',
      'lib/notion/travail.ts',
    ])
  })

  it('lignesDAccèsPourContrôle n’est appelée que par le contrôle du soir', () => {
    expect(appelants('lignesDAccèsPourContrôle')).toEqual([
      'app/api/veille/etat/route.ts',
      'lib/notion/acces.ts',
    ])
  })

  it('lignesDAccèsPourImport n’est appelée que par la route d’import', () => {
    expect(appelants('lignesDAccèsPourImport')).toEqual([
      'app/api/veille/importer-acces/route.ts',
      'lib/notion/acces.ts',
    ])
  })

  it('la copie de l’abonnement n’est écrite que par le webhook Stripe', () => {
    expect(appelants('enregistrerÉvénementDAbonnement')).toEqual([
      'app/api/webhooks/stripe/route.ts',
      'lib/base/abonnements.ts',
    ])
  })

  it('Stripe n’est appelé que par la souscription, et l’organisation facturée par elle seule', () => {
    expect(appelants('clientStripe')).toEqual(['lib/portail/abonnement.ts', 'lib/stripe/souscription.ts'])
    expect(appelants('lireFacturation')).toEqual(['lib/base/abonnements.ts', 'lib/portail/abonnement.ts'])
  })

  it('une visite opérateur ne souscrit ni n’ouvre la facturation d’un client', () => {
    const source = readFileSync(join(process.cwd(), 'lib', 'portail', 'abonnement.ts'), 'utf8')
    for (const [action, appel] of [
      ['export async function souscrire', 'pageDePaiement(accès'],
      ['export async function gérerLAbonnement', 'espaceDeFacturation(accès'],
    ] as const) {
      const corps = source.slice(source.indexOf(action))
      const garde = corps.indexOf('if (accès.enOpérateur) redirect(')
      expect(garde, action).toBeGreaterThan(corps.indexOf('exigerAccès(slug)'))
      expect(garde, action).toBeLessThan(corps.indexOf(appel))
    }
  })

  it('tout courrier passe par le journal : envoyerMessage n’est appelé que par lib/portail/courriers.ts', () => {
    expect(appelants('envoyerMessage')).toEqual(['lib/email/gmail.ts', 'lib/portail/courriers.ts'])
    expect(appelants('prévoirCourrier')).toEqual(['lib/base/courriers.ts', 'lib/portail/courriers.ts'])
    expect(appelants('conclureCourrier')).toEqual(['lib/base/courriers.ts', 'lib/portail/courriers.ts'])
    const source = readFileSync(join(process.cwd(), 'lib', 'portail', 'courriers.ts'), 'utf8')
    const corps = source.slice(source.indexOf('export async function envoyerCourrier'))
    expect(corps.indexOf('prévoirCourrier(')).toBeGreaterThan(0)
    expect(corps.indexOf('prévoirCourrier(')).toBeLessThan(corps.indexOf('envoyerMessage('))
  })

  it('l’entrée en essai a un seul chemin, et J0 deux écrivains bornés', () => {
    // Ouvrir en essai ne se fait que par la route gardée de l'onboarding ;
    // J0 n'est posé que par le passage quotidien, d'après la première lettre publiée,
    // et ne se déplace que par le réglage de l'opératrice, sur la même route gardée.
    expect(appelants('ouvrirEnEssai')).toEqual(['app/api/veille/organisations/route.ts', 'lib/base/organisations.ts'])
    expect(appelants('fixerJ0')).toEqual(['lib/base/organisations.ts', 'lib/portail/parcours-courriers.ts'])
    // Depuis le 19 octobre 2026, les mêmes réglages ont un second chemin : les
    // actions du tableau des abonnements, derrière le privilège opérateur.
    expect(appelants('réglerLeParcours')).toEqual([
      'app/api/veille/organisations/route.ts',
      'lib/base/organisations.ts',
      'lib/portail/reglages.ts',
    ])
    const route = readFileSync(join(process.cwd(), 'app', 'api', 'veille', 'organisations', 'route.ts'), 'utf8')
    const patch = route.slice(route.indexOf('export async function PATCH'))
    expect(patch.indexOf('refuserSiNonAutorisé(requête')).toBeGreaterThan(0)
    expect(patch.indexOf('refuserSiNonAutorisé(requête')).toBeLessThan(patch.indexOf('réglerLeParcours('))
    const actions = readFileSync(join(process.cwd(), 'lib', 'portail', 'reglages.ts'), 'utf8')
    expect(actions.indexOf('exigerOpérateur()')).toBeGreaterThan(0)
    expect(actions.indexOf('exigerOpérateur()')).toBeLessThan(actions.indexOf('réglerLeParcours('))
  })

  it('les lecteurs ne s’écrivent que par la route gardée et par les actions de l’espace client', () => {
    // Depuis le 19 octobre 2026, un lecteur ajoute ou retire un lecteur de son
    // organisation depuis « Mon abonnement ». L'action passe par le contrôle
    // d'appartenance unique, refuse la visite opérateur, exige que Postgres
    // fasse foi, et seulement ensuite écrit. Le retrait se fait par identifiant
    // de ligne, jamais par adresse : la page n'en porte aucune.
    expect(appelants('créerLecteur')).toEqual([
      'app/api/veille/lecteurs/route.ts',
      'lib/base/ecriture-lecteurs.ts',
      'lib/portail/lecteurs.ts',
    ])
    expect(appelants('révoquerLecteurParId')).toEqual(['lib/base/ecriture-lecteurs.ts', 'lib/portail/lecteurs.ts'])
    const source = readFileSync(join(process.cwd(), 'lib', 'portail', 'lecteurs.ts'), 'utf8')
    for (const [action, écriture] of [
      ['export async function ajouterLecteur', 'créerLecteur('],
      ['export async function retirerLecteur', 'révoquerLecteurParId('],
    ] as const) {
      const corps = source.slice(source.indexOf(action))
      const contrôle = corps.indexOf('exigerAccès(slug)')
      const refus = corps.indexOf('if (accès.enOpérateur)')
      const source_ = corps.indexOf('lecteursModifiables()')
      expect(contrôle, action).toBeGreaterThan(0)
      expect(refus, action).toBeGreaterThan(contrôle)
      expect(source_, action).toBeGreaterThan(refus)
      expect(corps.indexOf(écriture), action).toBeGreaterThan(source_)
    }
  })

  it('le tableau des abonnements traverse les clients : sa garde est dans l’appartenance', () => {
    // La lecture Postgres n'a qu'un appelant, le contrôle qui vérifie le
    // privilège avant ; l'écran n'appelle que ce contrôle. Et l'écran client lit
    // sa situation par la clé de cloisonnement, par le seul lecteur du portail.
    expect(appelants('tableauDesAbonnements')).toEqual(['lib/auth/appartenance.ts', 'lib/base/situation.ts'])
    expect(appelants('listerLesAbonnements')).toEqual(['app/espaces/abonnements/page.tsx', 'lib/auth/appartenance.ts'])
    expect(appelants('lireSituationDAbonnement')).toEqual(['lib/base/situation.ts', 'lib/portail/situation.ts'])
    expect(appelants('situationDeLEspace')).toEqual(['app/[slug]/abonnement/page.tsx', 'lib/portail/situation.ts'])
  })

  it('toute route /api/veille commence par la garde du jeton', () => {
    const racine = join(process.cwd(), 'app', 'api', 'veille')
    const routes = readdirSync(racine).map((nom) => join(racine, nom, 'route.ts'))
    expect(routes.length).toBeGreaterThanOrEqual(4)
    for (const route of routes) {
      const source = readFileSync(route, 'utf8')
      expect(source, route).toContain('refuserSiNonAutorisé(requête')
      // La garde précède toute lecture de l'environnement complet, comme pour l'activation.
      const garde = source.indexOf('refuserSiNonAutorisé(requête')
      const environnement = source.indexOf('env()')
      if (environnement !== -1) expect(garde, route).toBeLessThan(environnement)
    }
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

/**
 * Le rail annonce sept écrans. Un onglet qui pointe sur une route inexistante
 * donne un 404 depuis la navigation principale — l'erreur la plus visible du
 * portail, et celle qu'un renommage de dossier produit sans rien casser au
 * build. Le 11 septembre 2026, « Tendances » a été scindé en « Les axes » et
 * « Acteurs » : trois routes déplacées, quatre liens à suivre.
 */
describe('chaque onglet du rail mène à une route qui existe', () => {
  it('les sept écrans sont déclarés et présents sur le disque', async () => {
    const { ongletsDe } = (await import('@/lib/portail/semaine')) as {
      ongletsDe: (
        slug: string,
        comptes: { lettres: number; recommandations: number; archives: number },
      ) => Array<{ href: string; libellé: string; libelléCourt: string }>
    }

    const onglets = ongletsDe('client', { lettres: 0, recommandations: 0, archives: 0 })
    expect(onglets).toHaveLength(7)

    for (const onglet of onglets) {
      // `/client` → la racine de l'espace ; `/client/axes` → le dossier `axes`.
      const segment = onglet.href.replace(/^\/client\/?/, '')
      const chemin = segment
        ? join(process.cwd(), 'app', '[slug]', segment, 'page.tsx')
        : join(process.cwd(), 'app', '[slug]', 'page.tsx')

      expect(existsSync(chemin), `${onglet.libellé} → ${onglet.href} (${chemin})`).toBe(true)
      // Le menu de pied tronque au-delà : un libellé coupé ne dit plus où il mène.
      expect(onglet.libelléCourt.length, onglet.libelléCourt).toBeLessThanOrEqual(8)
    }
  })

  it('hors lecture complète, le rail ne montre que ce qui reste ouvert', async () => {
    const { ongletsDe } = await import('@/lib/portail/semaine')
    const comptes = { lettres: 2, recommandations: 0, archives: 1 }
    expect(ongletsDe('client', comptes, 'essentiel').map((o) => o.href)).toEqual(['/client', '/client/lettres'])
    expect(ongletsDe('client', comptes, 'aucune').map((o) => o.href)).toEqual(['/client'])
  })

  it('les deux écrans scindés portent chacun sa page de détail', () => {
    for (const détail of [
      join('axes', '[axe]'),
      join('acteurs', '[acteur]'),
    ]) {
      expect(existsSync(join(process.cwd(), 'app', '[slug]', détail, 'page.tsx')), détail).toBe(
        true,
      )
    }
    // L'ancien écran ne doit pas survivre à côté des nouveaux.
    expect(existsSync(join(process.cwd(), 'app', '[slug]', 'tendances'))).toBe(false)
  })

  /**
   * « Cadrage » est devenu « Périmètre » le 14 septembre 2026, en accueillant la
   * rubrique des acteurs suivis. Le rail ne mène plus à l'ancienne adresse, mais
   * un signet, si : la redirection est la seule chose qui l'empêche de tomber
   * sur un 404, et rien dans le build ne casserait si elle disparaissait.
   */
  it('l’écran renommé laisse sa redirection derrière lui', () => {
    expect(existsSync(join(process.cwd(), 'app', '[slug]', 'cadrage'))).toBe(false)

    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    expect(config).toContain("source: '/:slug/cadrage'")
    expect(config).toContain("destination: '/:slug/perimetre'")
  })
})

/**
 * Deux garde-fous posés le 14 octobre 2026, après l'audit du portail.
 *
 * Le proxy des médias lisait le bloc dans Notion avant de vérifier que le
 * demandeur avait le droit de le voir ; et plusieurs journaux portaient
 * l'adresse d'un lecteur en clair. Ni l'un ni l'autre ne doit revenir.
 */
/**
 * La fin d'essai (palier 1c) ne vaut que si chaque écran obéit au droit de
 * lecture. Les écrans qui assemblent plusieurs lettres (axes, acteurs,
 * recommandations, archives, périmètre) n'ont pas de version tronquée : ils
 * exigent la lecture complète. Seuls la vue d'ensemble et les lettres restent
 * ouverts hors lecture complète, et ils lisent le droit eux-mêmes.
 */
describe('chaque écran de l’espace obéit au droit de lecture', () => {
  const racine = join(process.cwd(), 'app', '[slug]')
  const pages: string[] = []
  const parcourir = (dossier: string) => {
    for (const entrée of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, entrée.name)
      if (entrée.isDirectory()) parcourir(chemin)
      else if (entrée.name === 'page.tsx') pages.push(chemin)
    }
  }
  parcourir(racine)
  // « Mon abonnement » (19 octobre 2026) ne lit aucune édition : il reste ouvert
  // quel que soit le droit de lecture, c'est l'endroit où un essai terminé mène.
  const ouvertes = [
    'page.tsx',
    join('lettres', 'page.tsx'),
    join('lettres', '[edition]', 'page.tsx'),
    join('abonnement', 'page.tsx'),
  ]

  it('les écrans de contenu assemblé exigent la lecture complète', () => {
    const fermées = pages.filter((p) => !ouvertes.includes(p.slice(racine.length + 1)))
    expect(fermées.length).toBeGreaterThanOrEqual(8)
    for (const page of fermées) {
      const source = readFileSync(page, 'utf8')
      expect(source, page).toContain('exigerLectureComplète(slug)')
      expect(source, page).not.toContain('exigerAccès(')
    }
  })

  it('la vue d’ensemble et les lettres lisent le droit de lecture', () => {
    for (const ouverte of ouvertes) {
      const source = readFileSync(join(racine, ouverte), 'utf8')
      expect(source, ouverte).toContain('exigerLecture(slug)')
      expect(source, ouverte).not.toContain('exigerAccès(')
    }
  })

  it('le service worker ne sert jamais de cache en ligne pour les charges RSC ni l’API', () => {
    const sw = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')
    expect(sw).toContain("const JAMAIS = ['/api/'")
    expect(sw).toContain("requête.headers.has('RSC') || url.searchParams.has('_rsc')")
    expect(sw).not.toContain("const VERSION = 'v1'")
  })

  it('la lettre tronque le document avant de le rendre', () => {
    const source = readFileSync(join(process.cwd(), 'components', 'note.tsx'), 'utf8')
    expect(source).toContain('tronquerÀLEssentiel(construireDocument(blocs))')
  })

  it('le proxy des médias ne sert rien hors lecture complète, avant toute lecture Notion', () => {
    const source = readFileSync(join(process.cwd(), 'app', 'api', 'media', '[block_id]', 'route.ts'), 'utf8')
    expect(source.indexOf('lectureDeLEspace(')).toBeGreaterThan(-1)
    expect(source.indexOf('lectureDeLEspace(')).toBeLessThan(source.indexOf('listerÉditionsPubliées('))
  })
})

describe('le proxy des médias vérifie l’appartenance avant de lire Notion', () => {
  it('consulte la liste des éditions de l’organisation avant de résoudre le bloc', () => {
    const source = readFileSync(
      join(process.cwd(), 'app', 'api', 'media', '[block_id]', 'route.ts'),
      'utf8',
    )
    expect(source.indexOf('listerÉditionsPubliées(')).toBeLessThan(source.indexOf('lireMédiaDeBloc('))
    expect(source).toContain("searchParams.get('page')")
  })
})

describe('aucun journal ne porte une adresse email en clair', () => {
  it('les console.* n’interpolent ni email ni accès.email', () => {
    const fautifs: string[] = []
    const parcourir = (dossier: string) => {
      for (const entrée of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entrée.name)
        if (entrée.isDirectory()) {
          if (entrée.name !== 'node_modules' && !entrée.name.startsWith('.')) parcourir(chemin)
          continue
        }
        if (!/\.tsx?$/.test(entrée.name)) continue
        const source = readFileSync(chemin, 'utf8')
        // Un appel console.* peut s'étaler sur plusieurs lignes : on regarde
        // le bloc jusqu'à la parenthèse fermante de premier niveau, grossièrement.
        for (const bloc of source.match(/console\.(?:info|warn|error|log)\([\s\S]*?\)\s*\n/g) ?? []) {
          if (/\$\{(?:accès\.)?email\}/.test(bloc)) fautifs.push(`${relatif(chemin)} : ${bloc.trim().slice(0, 80)}`)
        }
      }
    }
    for (const racine of ['app', 'lib']) parcourir(join(process.cwd(), racine))
    expect(fautifs).toEqual([])
  })
})

describe('le schéma de la base part avec le code', () => {
  // Le 18 octobre 2026, la migration 0003 est partie en production sans être
  // appliquée : l'entrée en essai et l'import ont échoué en SQLSTATE 42703.
  it('le build de production applique les migrations avant next build', () => {
    const paquet = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(paquet.scripts['build']).toMatch(/^tsx scripts\/base-migrer\.ts --deploiement && next build$/)
  })

  it('le contrôle du soir signale les migrations en attente', () => {
    const route = readFileSync(join(process.cwd(), 'app', 'api', 'veille', 'etat', 'route.ts'), 'utf8')
    expect(route).toContain('migrationsEnAttente()')
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    expect(config).toContain("'/api/veille/etat': ['./drizzle/meta/_journal.json']")
  })
})

/**
 * La prospection par lemlist (19 octobre 2026) tient à trois frontières.
 *
 * Un seul module parle à l'API lemlist, et il n'a que deux gestes : arrêter une
 * séquence, écrire des variables. Un seul module les appelle, l'orchestration
 * de la prospection, qui est aussi la seule à écrire dans les tables de
 * prospection. Et la seule lecture ouverte au dispositif passe par sa route
 * `/api/veille/prospection`. Le portail n'ajoute jamais un contact à une
 * campagne et ne lance rien : ce serait le signe que la prospection a changé de
 * mains sans discussion.
 */
describe('la prospection par lemlist reste à sa place', () => {
  const sources = (): Array<{ chemin: string; source: string }> => {
    const trouvés: Array<{ chemin: string; source: string }> = []
    const parcourir = (dossier: string) => {
      for (const entrée of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entrée.name)
        if (entrée.isDirectory()) {
          if (entrée.name !== 'node_modules' && !entrée.name.startsWith('.')) parcourir(chemin)
          continue
        }
        if (/\.tsx?$/.test(entrée.name)) trouvés.push({ chemin: relatif(chemin), source: readFileSync(chemin, 'utf8') })
      }
    }
    for (const racine of ['app', 'components', 'lib']) parcourir(join(process.cwd(), racine))
    return trouvés
  }
  const appelants = (motif: string | RegExp) =>
    sources()
      .filter(({ source }) => (typeof motif === 'string' ? source.includes(motif) : motif.test(source)))
      .map(({ chemin }) => chemin)
      .sort()

  it('seul lib/lemlist/client.ts connaît l’adresse de l’API lemlist', () => {
    expect(appelants('api.lemlist.com')).toEqual(['lib/lemlist/client.ts'])
  })

  it('le client lemlist n’a que deux gestes, et un seul appelant', () => {
    for (const geste of ['arrêterLaSéquence', 'écrireVariables']) {
      // `\b` ne connaît pas les lettres accentuées : la frontière de mot est écrite à la main.
      expect(appelants(new RegExp(`(?<![\\p{L}\\p{N}_$])${geste}(?![\\p{L}\\p{N}_$])`, 'u')), geste).toEqual(['lib/lemlist/client.ts', 'lib/portail/prospection.ts'])
    }
    const client = readFileSync(join(process.cwd(), 'lib', 'lemlist', 'client.ts'), 'utf8')
    // Ni création de lead, ni lancement de campagne, ni suppression : rien de plus que ce qui est documenté ici.
    expect(client).not.toMatch(/'DELETE'|\/campaigns\/[^']*\/start|\/leads\/[^']*\/launch/)
    expect(client.match(/requête\('(?:POST|PATCH)'/g)).toHaveLength(2)
  })

  it('les écritures de prospection ne viennent que de l’orchestration', () => {
    for (const fonction of ['rattacherLead(', 'journaliserÉvénement(', 'enregistrerVisite(', 'passerAuStatut(', 'noterLaSynchro(', 'prospectionsÀSynchroniser(', 'prospectionsEnCours(']) {
      expect(appelants(fonction), fonction).toEqual(['lib/base/prospection.ts', 'lib/portail/prospection.ts'])
    }
    expect(appelants('prospectionsRécentes(')).toEqual(['app/api/veille/prospection/route.ts', 'lib/base/prospection.ts'])
  })

  it('la visite n’est signalée que par la route du lien d’accès, et la synchronisation que par le cron du parcours', () => {
    expect(appelants('signalerVisite(')).toEqual(['app/acces/[jeton]/route.ts', 'lib/portail/prospection.ts'])
    expect(appelants('synchroniserLaProspection(')).toEqual(['app/api/veille/parcours/route.ts', 'lib/portail/prospection.ts'])
    expect(appelants('traiterÉvénementLemlist(')).toEqual(['app/api/webhooks/lemlist/route.ts', 'lib/portail/prospection.ts'])
  })

  it('le webhook lemlist vérifie le secret avant d’écrire, et lit ce secret directement', () => {
    const route = readFileSync(join(process.cwd(), 'app', 'api', 'webhooks', 'lemlist', 'route.ts'), 'utf8')
    expect(route.indexOf('interpréterLivraisonLemlist(')).toBeLessThan(route.indexOf('traiterÉvénementLemlist('))
    expect(route).toContain("process.env['LEMLIST_WEBHOOK_SECRET']")
    expect(route).not.toContain('env()')
    // Il ne répond jamais à lemlist par un appel à lemlist : pas d'importation du client.
    expect(route).not.toContain('lib/lemlist/client')
  })

  it('la route du lien d’accès signale la visite après la pose du cookie, hors du chemin de la réponse', () => {
    const route = readFileSync(join(process.cwd(), 'app', 'acces', '[jeton]', 'route.ts'), 'utf8')
    expect(route.indexOf('cookies.set(')).toBeLessThan(route.indexOf('signalerVisite('))
    expect(route).toContain('after(() => signalerVisite(identifiant))')
  })
})
