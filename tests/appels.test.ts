import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Base } from '@/lib/base/client'
import { ouvrirEnEssai } from '@/lib/base/organisations'
import { réglerLEspaceRéorganisé, réglerLesOutilsStratégiques } from '@/lib/base/strategie'
import { appelsDeLaLettre, cléDAppel, sixMois, vueDesAppels, type AppelDUneÉdition, type LettreDAppels } from '@/lib/domaine/appels'
import { construireDocument, type BlocNotion } from '@/lib/domaine/document'
import type { ÉditionDeTravail } from '@/lib/notion/travail'
import { appelsDeLEspace, ongletDesAppels, releverLesAppels, éditionsDAppelsDeLEspace } from '@/lib/portail/appels'
import type { SemaineDÉditions } from '@/lib/portail/semaine'
import { baseEnMémoire } from './aide/base-en-memoire'

/**
 * Les appels à projets relevés (18 novembre 2026, option A) : extraits en code
 * d'une lettre d'appels conforme, rangés dans `appels_a_projets`, suivis à la
 * lecture sur les seules lettres que le lecteur peut lire.
 */

type Morceau = { plain_text: string; href?: string | null; annotations?: { bold?: boolean } }
let n = 0
const bloc = (type: string, morceaux: Morceau[] = []): BlocNotion => ({ id: `b${(n += 1)}`, type, [type]: { rich_text: morceaux } })
const t = (texte: string): Morceau => ({ plain_text: texte })
const gras = (texte: string): Morceau => ({ plain_text: texte, annotations: { bold: true } })
const lien = (texte: string, href: string): Morceau => ({ plain_text: texte, href })
const h1 = (texte: string) => bloc('heading_1', [t(texte)])
const h2 = (texte: string) => bloc('heading_2', [t(texte)])
const p = (...morceaux: Morceau[]) => bloc('paragraph', morceaux)
const puce = (texte: string) => bloc('bulleted_list_item', [t(texte)])
const encadré = (texte: string) => bloc('callout', [t(texte)])

const TIERS_LIEUX = 'https://www.auvergnerhonealpes.fr/aides/appel-a-projets-tiers-lieux'
const LEADER = 'https://www.europe-en-auvergne-rhone-alpes.eu/leader-cantal'

function appel(o: { titre: string; url: string | null; pourquoi?: string; impact?: string }): BlocNotion[] {
  return [
    p(gras(o.titre)),
    p(t(o.pourquoi ?? `Pourquoi vous : établissement public du Cantal. ${o.impact ?? 'Impact fort.'}`)),
    p(t('Arguments :')),
    puce('Le programme d’accompagnement des commerces ruraux.'),
    o.url
      ? p(t('Pièces et calendrier : dossier en ligne ('), lien('source', 'https://www.cantal.fr/actualites'), t(', '), lien('page de l’appel', o.url), t(').'))
      : p(t('Pièces et calendrier : dossier en ligne.')),
  ]
}

const lettre = (): BlocNotion[] => [
  h1('L’essentiel'),
  p(t('Deux appels à instruire.')),
  h1('Actualités par axe'),
  h2('① Région et fonds européens — FORT'),
  ...appel({
    titre: 'Région Auvergne-Rhône-Alpes : appel à projets « Tiers-lieux 2027 », 30 000 € au plus, clôture le 15 janvier 2027.',
    url: TIERS_LIEUX,
    pourquoi: 'Pourquoi vous : porteur d’actions d’animation territoriale (à vérifier : cofinancement de 20 %). Impact fort.',
  }),
  ...appel({ titre: 'GAL du Cantal : LEADER, coopération interterritoriale, clôture le 28 février 2027.', url: LEADER, impact: 'Impact moyen.' }),
  ...appel({ titre: 'Même fiche, phrase reformulée, clôture le 15 janvier 2027.', url: `${TIERS_LIEUX}/` }),
  ...appel({ titre: 'Un appel sans date de clôture lisible.', url: 'https://exemple.fr/sans-date' }),
  h2('② État et opérateurs nationaux — RAS'),
  encadré('Aucun appel ouvert à un établissement consulaire, relevé le 16 novembre.'),
]

describe('appelsDeLaLettre', () => {
  it('relève financeur, intitulé, clôture, adresse, impact et « à vérifier », en code', () => {
    const appels = appelsDeLaLettre(construireDocument(lettre()), '2026-11-18')
    expect(appels).toHaveLength(2)
    expect(appels[0]).toMatchObject({
      rang: 1,
      financeur: 'Région Auvergne-Rhône-Alpes',
      clôture: '2027-01-15',
      adresse: TIERS_LIEUX,
      impact: 'fort',
      àVérifier: true,
      clé: 'auvergnerhonealpes.fr/aides/appel-a-projets-tiers-lieux',
    })
    expect(appels[0]?.intitulé).toBe('appel à projets « Tiers-lieux 2027 », 30 000 € au plus')
    expect(appels[1]).toMatchObject({ rang: 2, financeur: 'GAL du Cantal', clôture: '2027-02-28', adresse: LEADER, impact: 'moyen', àVérifier: false })
  })

  it('lit aussi la phrase-titre à virgules de la première lettre réelle (18 novembre 2026)', () => {
    const titres = [
      'Région Auvergne-Rhône-Alpes, label « formations du Campus Région du numérique », sans dotation financière, dépôt avant le 1er mars 2027.',
      'Commission européenne, actions d’information sur la politique de cohésion, environ 200 000 € par projet financés à 80 %, clôture le 13 janvier 2027.',
      'Agence de la transition écologique (ADEME), opérations collectives pour la décarbonation des entreprises, subvention d’ingénierie, dépôt avant le 30 décembre 2026 à 23 h 59.',
    ]
    const blocs = [h1('Actualités par axe'), h2('① Région — FORT'), ...titres.flatMap((titre, i) => appel({ titre, url: `https://exemple.fr/appel-${i}` }))]
    const appels = appelsDeLaLettre(construireDocument(blocs), '2026-11-18')
    expect(appels.map((a) => [a.financeur, a.clôture])).toEqual([
      ['Région Auvergne-Rhône-Alpes', '2027-03-01'],
      ['Commission européenne', '2027-01-13'],
      ['Agence de la transition écologique (ADEME)', '2026-12-30'],
    ])
    expect(appels.map((a) => a.intitulé)).toEqual([
      'label « formations du Campus Région du numérique », sans dotation financière',
      'actions d’information sur la politique de cohésion, environ 200 000 € par projet financés à 80 %',
      'opérations collectives pour la décarbonation des entreprises, subvention d’ingénierie',
    ])
  })

  it('la clé ignore le protocole, « www. » et la barre finale, et retombe sur l’intitulé sans adresse', () => {
    expect(cléDAppel('https://www.a.fr/x/', 'peu importe')).toBe('a.fr/x')
    expect(cléDAppel(null, 'Appel « Énergie » 2027 !')).toBe('appel energie 2027')
  })
})

describe('vueDesAppels', () => {
  const ligne = (o: Partial<AppelDUneÉdition> & Pick<AppelDUneÉdition, 'clé' | 'édition' | 'dateÉdition' | 'clôture'>): AppelDUneÉdition => ({
    rang: 1,
    intitulé: o.clé,
    financeur: null,
    adresse: null,
    impact: 'moyen',
    àVérifier: false,
    ...o,
  })
  const lettres: LettreDAppels[] = [
    { édition: 'e1', dateÉdition: '2026-11-04', titre: 'n° 1', actionDeLaSemaine: 'Ancienne action', aperçu: false },
    { édition: 'e2', dateÉdition: '2026-11-18', titre: 'n° 2', actionDeLaSemaine: 'Déposer Tiers-lieux', aperçu: false },
  ]
  const lignes = [
    ligne({ clé: 'a', édition: 'e1', dateÉdition: '2026-11-04', clôture: '2027-01-15', intitulé: 'ancien titre' }),
    ligne({ clé: 'a', édition: 'e2', dateÉdition: '2026-11-18', clôture: '2027-01-15', intitulé: 'titre récent', impact: 'fort' }),
    ligne({ clé: 'b', édition: 'e2', dateÉdition: '2026-11-18', clôture: '2026-12-01' }),
    ligne({ clé: 'c', édition: 'e1', dateÉdition: '2026-11-04', clôture: '2026-11-10' }),
    ligne({ clé: 'd', édition: 'brouillon', dateÉdition: '2026-11-18', clôture: '2026-12-20' }),
    ligne({ clé: 'e', édition: 'e2', dateÉdition: '2026-11-18', clôture: '2027-09-30' }),
  ]

  it('suit un appel d’une lettre à l’autre, trie par clôture et range les clos à part', () => {
    const vue = vueDesAppels(lignes, lettres, '2026-11-18')
    expect(vue.dernière?.actionDeLaSemaine).toBe('Déposer Tiers-lieux')
    expect(vue.ouverts.map((a) => a.clé)).toEqual(['b', 'a', 'e'])
    expect(vue.clos.map((a) => a.clé)).toEqual(['c'])
    const a = vue.ouverts.find((x) => x.clé === 'a')
    expect(a).toMatchObject({ intitulé: 'titre récent', impact: 'fort', premièreVue: '2026-11-04', dernièreVue: '2026-11-18', nouveau: false, dansLaDernière: true, joursAvantClôture: 58 })
    expect(vue.ouverts.find((x) => x.clé === 'b')?.nouveau).toBe(true)
    expect(vue.lettres).toBe(2)
  })

  it('n’atteint jamais un lecteur par une lettre qu’il ne peut pas lire (règle 3)', () => {
    const vue = vueDesAppels(lignes, lettres, '2026-11-18')
    expect([...vue.ouverts, ...vue.clos].some((x) => x.clé === 'd')).toBe(false)
  })

  it('la frise compte six mois civils, et un appel au-delà n’y figure pas', () => {
    expect(sixMois('2026-11-18')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'])
    const vue = vueDesAppels(lignes, lettres, '2026-11-18')
    expect(vue.mois.map((m) => m.libellé)).toEqual(['nov. 2026', 'déc. 2026', 'janv. 2027', 'févr. 2027', 'mars 2027', 'avr. 2027'])
    expect(vue.mois.flatMap((m) => m.appels.map((x) => x.clé))).toEqual(['b', 'a'])
  })
})

describe('relevé et lecture, sur une vraie base', () => {
  const REGISTRE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
  const PAGE = '0123456789abcdef0123456789abcdef'
  const édition = (o: Partial<ÉditionDeTravail> = {}): ÉditionDeTravail => ({
    pageId: PAGE,
    titre: 'Appels à projets n° 1',
    statut: 'Brouillon',
    famille: 'Appels à projets',
    veille: 'Appels à projets',
    dateÉdition: '2026-11-18',
    numéro: 1,
    périodeCouverte: '',
    fenêtreÉlargie: false,
    dossiersOuvertsBruts: '',
    actionDeLaSemaine: '',
    amendements: '',
    livraison: '',
    organisationIds: [REGISTRE],
    ...o,
  })
  const semaines = (aperçu = false): SemaineDÉditions[] =>
    [{ éditions: [{ pageId: `${PAGE.slice(0, 8)}-${PAGE.slice(8, 12)}-${PAGE.slice(12, 16)}-${PAGE.slice(16, 20)}-${PAGE.slice(20)}`, dateÉdition: '2026-11-18', titre: 'Appels à projets n° 1', actionDeLaSemaine: 'Déposer Tiers-lieux', aperçu }] }] as unknown as SemaineDÉditions[]

  let db: Base
  let fermer: () => Promise<void>
  beforeEach(async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('DATABASE_URL', 'postgres://en-memoire')
    vi.stubEnv('SOURCE_ACCES', 'double')
    ;({ db, fermer } = await baseEnMémoire())
    await ouvrirEnEssai({ slug: 'cci', nom: 'CCI', registreNotion: REGISTRE }, db)
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    await fermer()
  })

  it('ignore ce qui n’est pas une lettre d’appels, ou une édition à plusieurs organisations', async () => {
    expect(await releverLesAppels({ pageId: PAGE, édition: édition({ famille: 'Écosystème' }), blocs: lettre() }, db)).toMatchObject({ sorte: 'ignorée' })
    expect(await releverLesAppels({ pageId: PAGE, édition: édition({ organisationIds: [REGISTRE, PAGE] }), blocs: lettre() }, db)).toEqual({
      sorte: 'ignorée',
      raison: 'organisation ambiguë',
    })
  })

  it('remplace les appels de l’édition à chaque lint conforme, et l’écran ne les montre que dans l’espace réorganisé', async () => {
    expect(await releverLesAppels({ pageId: PAGE, édition: édition(), blocs: lettre() }, db)).toEqual({ sorte: 'relevés', nombre: 2 })
    // Corrigée, la lettre ne garde qu'un appel : l'autre disparaît.
    expect(await releverLesAppels({ pageId: PAGE, édition: édition(), blocs: lettre().slice(0, 4 + 5) }, db)).toEqual({ sorte: 'relevés', nombre: 1 })

    const entrée = { registre: REGISTRE, semaines: semaines(), aujourdhui: '2026-11-18' }
    expect(await appelsDeLEspace(entrée, db)).toBeNull()
    expect(await éditionsDAppelsDeLEspace(REGISTRE, db)).toBeNull()

    await réglerLesOutilsStratégiques({ slug: 'cci', actif: true }, db)
    await réglerLEspaceRéorganisé({ slug: 'cci', actif: true }, db)
    const vue = await appelsDeLEspace(entrée, db)
    expect(vue?.ouverts.map((a) => a.financeur)).toEqual(['Région Auvergne-Rhône-Alpes'])
    expect(vue?.dernière?.actionDeLaSemaine).toBe('Déposer Tiers-lieux')

    const éditions = await éditionsDAppelsDeLEspace(REGISTRE, db)
    expect(éditions).toEqual([PAGE])
    expect(ongletDesAppels(éditions, semaines())).toBe(true)
    expect(ongletDesAppels(éditions, [])).toBe(false)
    expect(ongletDesAppels([], semaines())).toBe(false)
  })
})
