import { describe, expect, it } from 'vitest'
import { annoncesBodacc, clauseBodacc, ficheEnLignes, fichesEntreprises, ligneDAnnonce, sirenNormalisé } from '@/scripts/collecte/registres'

/** Deux annonces telles que le jeu de données les rend (relevées le 26 octobre 2026). */
const COLLECTIVE = {
  dateparution: '2026-10-25',
  familleavis: 'collective',
  familleavis_lib: 'Procédures collectives',
  typeavis: 'annonce',
  registre: ['905030433', '905 030 433'],
  commercant: 'KAOLY',
  numerodepartement: '06',
  ville: 'Cannes',
  jugement: '{"type": "initial", "famille": "Jugement prononçant", "nature": "Jugement de conversion en liquidation judiciaire", "date": "2026-10-13"}',
  listeetablissements: null,
  url_complete: 'https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:A202602052536',
}
const CRÉATION = {
  dateparution: '2026-10-25',
  familleavis: 'creation',
  familleavis_lib: 'Créations',
  registre: ['131478968', '131 478 968'],
  commercant: 'Exemple Conseil',
  numerodepartement: '75',
  ville: 'Paris',
  jugement: null,
  acte: { creation: { categorieCreation: 'Immatriculation d’une personne physique suite à création d’un établissement principal' } },
  listeetablissements: { etablissement: { origineFonds: 'Création', activite: 'Conseil et accompagnement des entreprises' } },
  url_complete: 'https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:A202602051360',
}

describe('clauseBodacc', () => {
  it('assemble date, familles, SIREN et départements contrôlés un à un', () => {
    expect(clauseBodacc({ depuis: '2026-10-19', sirens: ['905 030 433', '509856076'], familles: ['collective', 'vente'] })).toBe(
      `dateparution >= date'2026-10-19' and familleavis in ("collective", "vente") and (registre = "905030433" or registre = "509856076")`,
    )
    expect(clauseBodacc({ depuis: '2026-10-19', departements: ['75', '2a'], familles: ['creation'], texte: 'formation "commerciale"' })).toBe(
      `dateparution >= date'2026-10-19' and familleavis in ("creation") and numerodepartement in ("75", "2A") and "formation commerciale"`,
    )
  })

  it('refuse ce qui sortirait de la requête prévue', () => {
    expect(() => clauseBodacc({ depuis: '19/10/2026', sirens: ['905030433'] })).toThrow(/AAAA-MM-JJ/)
    expect(() => clauseBodacc({ depuis: '2026-10-19', sirens: ['905030433" or 1=1'] })).toThrow(/neuf chiffres/)
    expect(() => clauseBodacc({ depuis: '2026-10-19', departements: ['75") or ("1'] })).toThrow(/département/)
    expect(() => clauseBodacc({ depuis: '2026-10-19' })).toThrow(/nationale sans filtre/)
  })

  it('normalise un SIREN recopié avec ses espaces', () => {
    expect(sirenNormalisé(' 905 030 433 ')).toBe('905030433')
    expect(sirenNormalisé('90503043')).toBeNull()
  })
})

describe('ligneDAnnonce', () => {
  it('lit un jugement sérialisé, et une activité imbriquée', () => {
    expect(ligneDAnnonce(COLLECTIVE)).toBe(
      '2026-10-25 · Procédures collectives · KAOLY · SIREN 905030433 · Cannes (06) · Jugement de conversion en liquidation judiciaire, jugement du 2026-10-13 · https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:A202602052536',
    )
    const ligne = ligneDAnnonce(CRÉATION)
    expect(ligne).toContain('Créations · Exemple Conseil · SIREN 131478968 · Paris (75)')
    expect(ligne).toContain('activité : Conseil et accompagnement des entreprises')
  })
})

describe('annoncesBodacc', () => {
  it('interroge le jeu de données, les plus récentes d’abord, et rend une ligne par annonce', async () => {
    let appel = ''
    const f = (async (url: string) => {
      appel = url
      return new Response(JSON.stringify({ total_count: 3, results: [COLLECTIVE, CRÉATION] }), { status: 200 })
    }) as unknown as typeof fetch
    const sortie = await annoncesBodacc({ depuis: '2026-10-19', sirens: ['905030433'], limite: 2 }, f)
    const url = new URL(appel)
    expect(url.hostname).toBe('bodacc-datadila.opendatasoft.com')
    expect(url.searchParams.get('order_by')).toBe('dateparution desc')
    expect(url.searchParams.get('limit')).toBe('2')
    expect(sortie.split('\n')[0]).toBe('BODACC depuis le 2026-10-19 : 3 annonce(s), les 2 plus récentes ci-dessous.')
    expect(sortie.split('\n')).toHaveLength(3)
  })

  it('un résultat vide est un constat daté, pas un silence', async () => {
    const f = (async () => new Response(JSON.stringify({ total_count: 0, results: [] }), { status: 200 })) as unknown as typeof fetch
    expect(await annoncesBodacc({ depuis: '2026-10-19', departements: ['15'] }, f)).toMatch(/0 annonce\(s\)\. Aucune annonce : constat/)
  })
})

describe('fichesEntreprises', () => {
  const FICHE = {
    siren: '905030433',
    nom_complet: 'KAOLY',
    date_creation: '2021-11-09',
    etat_administratif: 'A',
    activite_principale: '56.10C',
    categorie_entreprise: 'PME',
    tranche_effectif_salarie: 'NN',
    nombre_etablissements_ouverts: 2,
    siege: { libelle_commune: 'CANNES' },
    dirigeants: [{ nom: 'DUPONT', prenoms: 'MARIE', qualite: 'Gérant', type_dirigeant: 'personne physique' }],
    finances: { '2023': { ca: 120000, resultat_net: -8000 }, '2024': { ca: 150000, resultat_net: 2000 } },
    complements: { est_ess: true, est_qualiopi: false },
    date_mise_a_jour_rne: '2026-10-20T13:28:06',
  }

  it('met une fiche en quelques lignes, exercice le plus récent d’abord', () => {
    const lignes = ficheEnLignes(FICHE).split('\n')
    expect(lignes[0]).toContain('KAOLY (SIREN 905030433) : active, créée le 2021-11-09, NAF 56.10C, PME')
    expect(lignes[1]).toMatch(/^ {2}comptes : 2024 : CA 150\s000 €, résultat 2\s000 € ; 2023 : CA 120\s000 €, résultat -8\s000 €$/)
    expect(lignes[2]).toBe('  dirigeants : Gérant : MARIE DUPONT')
    expect(lignes[3]).toBe('  marqueurs : ess')
    expect(lignes[4]).toContain('https://annuaire-entreprises.data.gouv.fr/entreprise/905030433')
  })

  it('nomme chaque échec sans interrompre les autres SIREN', async () => {
    let n = 0
    const f = (async () => {
      n += 1
      if (n === 1) return new Response(JSON.stringify({ results: [FICHE] }), { status: 200 })
      return new Response('trop de requêtes', { status: 429 })
    }) as unknown as typeof fetch
    const sortie = await fichesEntreprises(['905 030 433', '509856076', 'abc'], f, async () => undefined)
    expect(sortie).toContain('KAOLY (SIREN 905030433)')
    expect(sortie).toContain('509856076 : NON OUVERTE, HTTP 429')
    expect(sortie).toContain('abc : SIREN invalide')
    expect(n).toBe(2)
  })
})
