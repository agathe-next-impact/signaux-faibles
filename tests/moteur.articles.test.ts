import { describe, expect, it } from 'vitest'
import { dateDePublication, liensDe, suivreLesArticles, type Lecture } from '@/lib/moteur/collecte'
import { dateSeLit, dossiersEnDouble } from '@/lib/moteur/portes'
import { lireLesRésultats } from '@/lib/moteur/recherche'
import { blocDuDossier, type Sélection } from '@/lib/moteur/redaction'
import { lireRéférentielUnique, écrireRéférentielUnique } from '@/lib/moteur/referentiel'

const INDEX = `
<html><body>
<nav><a href="/blog/">Blog</a><a href="/contact">Nous contacter</a></nav>
<a href="/blog/faille-updraftcentral-octobre-2026">Les clés UpdraftCentral volées servent à piéger des sites WordPress</a>
<a href="https://exemple.fr/blog/wordpress-7-2-bêta">WordPress 7.2 entre en bêta, sortie prévue le 8 décembre</a>
<a href="https://autre.example/blog/hors-site-pas-suivi-du-tout">Un article d'un autre site qui ne doit pas être suivi</a>
<a href="/blog/tag/securite-wordpress-et-autres-sujets">Étiquette sécurité WordPress (pagination)</a>
<a href="/blog/faille-updraftcentral-octobre-2026#commentaires">Les clés UpdraftCentral volées servent à piéger des sites WordPress</a>
<a href="/blog/ancien-billet-de-septembre-sur-la-maintenance">Un ancien billet de septembre sur la maintenance des sites</a>
<a href="/blog/billet-sans-date-lisible-dans-la-page">Un billet dont la page ne porte aucune date lisible</a>
</body></html>`

const page = (date: string | null, corps: string) =>
  `<html><head>${date ? `<meta property="article:published_time" content="${date}T08:00:00+02:00">` : ''}</head><body><article>${corps}</article></body></html>`

const ARTICLES: Record<string, string> = {
  'https://exemple.fr/blog/faille-updraftcentral-octobre-2026': page('2026-10-19', 'Le 19 octobre, TeamUpdraft confirme la compromission de clés UpdraftCentral. '.repeat(8)),
  'https://exemple.fr/blog/wordpress-7-2-bêta': page('2026-10-20', 'WordPress 7.2 entre en bêta le 20 octobre, la version finale est prévue le 8 décembre. '.repeat(8)),
  'https://exemple.fr/blog/ancien-billet-de-septembre-sur-la-maintenance': page('2026-09-02', 'Un ancien billet sur la maintenance des sites WordPress des PME. '.repeat(8)),
  'https://exemple.fr/blog/billet-sans-date-lisible-dans-la-page': page(null, 'Un billet sans date de publication lisible dans ses métadonnées. '.repeat(8)),
}

const fauxFetch = (async (entrée: string | URL | Request) => {
  const url = String(entrée)
  const corps = ARTICLES[decodeURI(url)]
  if (!corps) return new Response('', { status: 404 })
  return new Response(corps, { status: 200, headers: { 'content-type': 'text/html' } })
}) as typeof fetch

describe('liensDe', () => {
  it('garde les titres d’articles du même site, dans l’ordre, sans menu, étiquette, doublon ni ancre', () => {
    const liens = liensDe(INDEX, 'https://exemple.fr/blog/')
    expect(liens.map((l) => l.url)).toEqual([
      'https://exemple.fr/blog/faille-updraftcentral-octobre-2026',
      'https://exemple.fr/blog/wordpress-7-2-b%C3%AAta',
      'https://exemple.fr/blog/ancien-billet-de-septembre-sur-la-maintenance',
      'https://exemple.fr/blog/billet-sans-date-lisible-dans-la-page',
    ])
    expect(liens[0]!.texte).toContain('UpdraftCentral')
  })
})

describe('dateDePublication', () => {
  it('lit les métadonnées, le JSON-LD et la balise time ; rien sinon', () => {
    expect(dateDePublication('<meta property="article:published_time" content="2026-10-19T08:00:00+02:00">')).toBe('2026-10-19')
    expect(dateDePublication('<meta content="2026-10-18" name="date">')).toBe('2026-10-18')
    expect(dateDePublication('<script type="application/ld+json">{"datePublished":"2026-10-17T10:00:00Z"}</script>')).toBe('2026-10-17')
    expect(dateDePublication('<time datetime="2026-10-16">16 octobre</time>')).toBe('2026-10-16')
    expect(dateDePublication('<p>Publié récemment</p>')).toBeNull()
  })
})

describe('suivreLesArticles', () => {
  const lecture: Lecture = {
    url: 'https://exemple.fr/blog/',
    état: 'ouverte',
    luLe: '2026-10-21T08:00:00Z',
    texte: 'x'.repeat(300),
    empreinte: 'e',
    nouveautés: [],
    changée: null,
    liens: liensDe(INDEX, 'https://exemple.fr/blog/'),
  }

  it('ne garde que les articles que leurs métadonnées datent dans la période, les plus récents d’abord', async () => {
    const articles = await suivreLesArticles([lecture], { début: '2026-10-14', fin: '2026-10-21' }, { fetch: fauxFetch })
    expect(articles.map((a) => [a.date, a.url])).toEqual([
      ['2026-10-20', 'https://exemple.fr/blog/wordpress-7-2-b%C3%AAta'],
      ['2026-10-19', 'https://exemple.fr/blog/faille-updraftcentral-octobre-2026'],
    ])
    expect(articles[0]!.source).toBe('https://exemple.fr/blog/')
    expect(articles[0]!.extrait.length).toBeLessThanOrEqual(1_800)
  })

  it('une source fermée n’est pas suivie, et la limite par source est tenue', async () => {
    const fermée: Lecture = { ...lecture, état: 'http-503' }
    expect(await suivreLesArticles([fermée], { début: '2026-10-14', fin: '2026-10-21' }, { fetch: fauxFetch })).toEqual([])
    expect(await suivreLesArticles([lecture], { début: '2026-10-14', fin: '2026-10-21' }, { fetch: fauxFetch, parSource: 1 })).toHaveLength(1)
  })
})

describe('lireLesRésultats', () => {
  const ouvertes = ['https://exemple.fr/a', 'https://exemple.fr/b']
  it('écarte un résultat mal formé sans perdre les autres, coupe ce qui déborde, annule une date mal formée', () => {
    const texte = JSON.stringify({
      resultats: [
        { axe: 1, titre: 'T'.repeat(500), url: 'https://exemple.fr/a', date: '19 octobre', extrait: 'E'.repeat(900) },
        { axe: 2, titre: 'ok', url: 'https://exemple.fr/b', date: '2026-10-19T10:00:00Z', extrait: 'ok' },
        { axe: 3, titre: 'url inventée', url: 'https://ailleurs.example/x', date: null, extrait: 'x' },
        { titre: 'sans axe', url: 'https://exemple.fr/a', date: null, extrait: 'x' },
      ],
    })
    const { retenus, rendus } = lireLesRésultats(`Voici :\n\`\`\`json\n${texte}\n\`\`\``, ouvertes)
    expect(rendus).toBe(4)
    expect(retenus.map((r) => r.url)).toEqual(['https://exemple.fr/a', 'https://exemple.fr/b'])
    expect(retenus[0]!.titre).toHaveLength(200)
    expect(retenus[0]!.extrait).toHaveLength(600)
    expect(retenus[0]!.date).toBeNull()
    expect(retenus[1]!.date).toBe('2026-10-19')
  })

  it('une réponse tronquée garde les résultats complets qui précèdent la coupure', () => {
    const texte = '{"resultats":[{"axe":1,"titre":"a","url":"https://exemple.fr/a","date":null,"extrait":"x"},{"axe":2,"titre":"b","url":"https://exemple.fr/b","date":null,"extra'
    const { retenus } = lireLesRésultats(texte, ouvertes)
    expect(retenus.map((r) => r.url)).toEqual(['https://exemple.fr/a'])
  })

  it('aucun JSON : aucun résultat, sans exception', () => {
    expect(lireLesRésultats('rien à signaler', ouvertes)).toEqual({ retenus: [], rendus: 0 })
  })
})

describe('dateSeLit', () => {
  it('reconnaît les écritures françaises, anglaises, numériques et ISO', () => {
    expect(dateSeLit('Publié le 18 octobre 2026', '2026-10-18')).toBe(true)
    expect(dateSeLit('Published Oct 18, 2026', '2026-10-18')).toBe(true)
    expect(dateSeLit('18 October 2026', '2026-10-18')).toBe(true)
    expect(dateSeLit('Mis à jour le 18/10/2026', '2026-10-18')).toBe(true)
    expect(dateSeLit('2026-10-18T08:00', '2026-10-18')).toBe(true)
    expect(dateSeLit('1er octobre', '2026-10-01')).toBe(true)
    expect(dateSeLit('Le 8 décembre', '2026-12-08')).toBe(true)
  })
  it('refuse une autre date, un autre mois, un jour qui n’est qu’un fragment', () => {
    expect(dateSeLit('Publié le 22 septembre 2026', '2026-10-18')).toBe(false)
    expect(dateSeLit('18 septembre', '2026-10-18')).toBe(false)
    expect(dateSeLit('Le 118 octobre', '2026-10-18')).toBe(false)
    expect(dateSeLit('Claude Opus 5.5 est sorti le 22 septembre', '2026-10-18')).toBe(false)
  })
})

describe('dossiersEnDouble', () => {
  it('relève un même litige écrit sous deux noms', () => {
    const doubles = dossiersEnDouble([
      { nom: 'Automattic', suivi: "Le litige d'Automattic avec WP Engine n'a pas bougé cette semaine ; le procès reste fixé au 19 octobre 2027." },
      { nom: 'WP Engine', suivi: "Le litige de WP Engine avec Automattic n'a pas bougé cette semaine ; on attend la suite avant le procès du 19 octobre 2027." },
      { nom: 'Sicollab', suivi: 'La grille de Sicollab reste à 1 000 à 1 500 € HT pour une journée.' },
    ])
    expect(doubles).toEqual([['Automattic', 'WP Engine']])
  })
  it('deux dossiers sans rapport, même rédigés sur le même modèle, ne sont pas des doublons', () => {
    expect(
      dossiersEnDouble([
        { nom: 'DGCCRF', suivi: "Les contrôles d'accessibilité de la DGCCRF n'ont pas bougé cette semaine." },
        { nom: 'Challenge My Project', suivi: "L'offre de direction technique de Challenge My Project n'a pas bougé cette semaine." },
      ]),
    ).toEqual([])
  })
})

describe('blocDuDossier avec des articles', () => {
  it('range chaque article sous l’axe dont la source l’a mené', () => {
    const référentiel = lireRéférentielUnique(
      écrireRéférentielUnique('Next Impact', {
        fiche: 'Studio web.',
        axes: Array.from({ length: 10 }, (_, i) => ({
          nom: `Thème ${i + 1}`,
          sorte: 'thème' as const,
          critères: 'FORT si un texte s’applique.',
          sources: [{ libellé: `Source ${i + 1}`, url: i === 0 ? 'https://exemple.fr/blog/' : `https://exemple.fr/s${i}` }],
          requêtes: [],
          acteurs: [],
        })),
        dossiers: [],
      }),
    )
    const sélection: Sélection = { numéro: 1, dateÉdition: '2026-10-21', période: { début: '2026-10-14', fin: '2026-10-21' }, éditionPrécédente: null }
    const bloc = blocDuDossier(référentiel, sélection, {
      lectures: [],
      résultats: [],
      articles: [{ source: 'https://exemple.fr/blog/', url: 'https://exemple.fr/blog/a', titre: 'Titre A', date: '2026-10-19', extrait: 'Texte de l’article.' }],
    })
    expect(bloc).toMatch(/<axe numero="1"[^>]*>[\s\S]*<article url="https:\/\/exemple.fr\/blog\/a" date="2026-10-19"[^>]*>Titre A : Texte de l’article\.<\/article>[\s\S]*<\/axe>\n<axe numero="2"/)
    expect(bloc.match(/<article /g)).toHaveLength(1)
  })
})
