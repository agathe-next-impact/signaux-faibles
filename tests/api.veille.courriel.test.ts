import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLOCS_CONCURRENTIELS, DOSSIERS_CONCURRENTIELS } from './fixtures/lettre-concurrentielle'

const travail = vi.hoisted(() => ({ lireÉditionDeTravail: vi.fn() }))
const editions = vi.hoisted(() => ({ lireBlocsDePage: vi.fn() }))
vi.mock('@/lib/notion/travail', () => travail)
vi.mock('@/lib/notion/editions', () => editions)
vi.mock('@/lib/env', () => ({ env: () => ({ PORTAIL_URL: 'https://www.signauxfaibles.io' }) }))
const gmail = vi.hoisted(() => ({ déposerChezLOpératrice: vi.fn() }))
vi.mock('@/lib/email/gmail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email/gmail')>()),
  déposerChezLOpératrice: gmail.déposerChezLOpératrice,
}))

const { POST } = await import('@/app/api/veille/courriel/route')

const PAGE = '3d5fe829ce718107af65f4fccf8089ab'

/** L'extrait de lettre, sa phrase de clôture complétée de l'adresse que le validateur exige. */
const BLOCS_CONFORMES = JSON.parse(
  JSON.stringify(BLOCS_CONCURRENTIELS).replace('écrivez-nous.', 'écrivez à agathe@signauxfaibles.io.'),
)
const appel = (corps: unknown, jeton = 'secret-de-test') =>
  POST(
    new NextRequest('https://www.signauxfaibles.io/api/veille/courriel', {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    }),
  )

const édition = {
  pageId: PAGE,
  titre: 'Konica Minolta : veille concurrentielle n° 7',
  statut: 'Brouillon',
  famille: 'Concurrentiel',
  veille: 'Concurrentiel',
  dateÉdition: '2026-10-19',
  numéro: 7,
  périodeCouverte: 'du 12 au 18 octobre 2026',
  fenêtreÉlargie: false,
  dossiersOuvertsBruts: DOSSIERS_CONCURRENTIELS,
  actionDeLaSemaine: '',
  amendements: '',
  livraison: '',
  organisationIds: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  vi.stubEnv('ADRESSE_POSTALE', '')
  vi.stubEnv('GMAIL_BOITE_OPERATRICE', '')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/veille/courriel', () => {
  it('exige le jeton, et ne lit rien sans lui', async () => {
    expect((await appel({ sorte: 'lettre', page: PAGE, slug: 'konica' }, 'mauvais')).status).toBe(401)
    expect(travail.lireÉditionDeTravail).not.toHaveBeenCalled()
  })

  it('refuse une demande mal formée en nommant le champ', async () => {
    const réponse = await appel({ sorte: 'lettre', page: 'pas-un-id', slug: 'Konica Minolta' })
    expect(réponse.status).toBe(400)
    const corps = await réponse.json()
    expect(corps.raison).toContain('page')
    expect(corps.raison).toContain('slug')
  })

  it('met une lettre conforme à la charte, objet donné par la tâche', async () => {
    travail.lireÉditionDeTravail.mockResolvedValue(édition)
    editions.lireBlocsDePage.mockResolvedValue(BLOCS_CONFORMES)
    const réponse = await appel({ sorte: 'lettre', page: PAGE, slug: 'konica', organisation: 'Konica Minolta France', objet: 'Veille Konica : Concurrentiel, lundi 19 octobre' })
    expect(réponse.status).toBe(200)
    const corps = await réponse.json()
    expect(corps).toMatchObject({ état: 'composé', objet: 'Veille Konica : Concurrentiel, lundi 19 octobre' })
    expect(corps.html).toContain('Ajustements du cadrage de cette veille')
    expect(corps.texte).toContain('[À surveiller] 1. Recomposition')
    expect(corps.octets).toBeGreaterThan(5000)
    expect(corps.avertissement).toBeUndefined()
    expect(travail.lireÉditionDeTravail).toHaveBeenCalledWith('3d5fe829-ce71-8107-af65-f4fccf8089ab')
  })

  it('ne met pas en forme une lettre que le portail ne sait pas lire', async () => {
    travail.lireÉditionDeTravail.mockResolvedValue({ ...édition, dossiersOuvertsBruts: 'Ricoh — en cours — 2' })
    editions.lireBlocsDePage.mockResolvedValue([{ id: 'p', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Impact fort.' }] } }])
    const réponse = await appel({ sorte: 'lettre', page: PAGE, slug: 'konica' })
    expect(réponse.status).toBe(422)
    expect((await réponse.json()).état).toBe('non-conforme')
  })

  it('404 pour une page qui n’est pas une édition', async () => {
    travail.lireÉditionDeTravail.mockResolvedValue(null)
    expect((await appel({ sorte: 'lettre', page: PAGE, slug: 'konica' })).status).toBe(404)
  })

  it('compose le point mensuel champ par champ, sans lire Notion', async () => {
    const réponse = await appel({
      sorte: 'message',
      slug: 'konica',
      organisation: 'Konica Minolta France',
      objet: 'Votre veille Konica Minolta France : point mensuel d’octobre 2026',
      préheader: 'Ce qui change dans votre veille ce mois-ci, et deux questions.',
      surtitre: 'Point mensuel',
      titre: 'Votre veille en octobre.',
      salutation: 'Bonjour,',
      paragraphes: ['Deux sources changent ce mois-ci.'],
      points: [{ niveau: 'MOYEN', titre: 'Une question pour vous', texte: 'Faut-il suivre Sharp ?' }],
      intituléDesPoints: 'Vos réponses attendues',
      action: { libellé: 'Répondre aux questions', url: 'https://forms.exemple.fr/validation' },
    })
    expect(réponse.status).toBe(200)
    const corps = await réponse.json()
    expect(corps.html).toContain('Votre veille en octobre.')
    expect(corps.html).toContain('>À surveiller</td>')
    expect(corps.html).toContain('Bien à vous,')
    expect(corps.html).toContain('Vos réponses attendues')
    expect(travail.lireÉditionDeTravail).not.toHaveBeenCalled()
  })

  it('refuse un message qui sortirait de la charte : quatre points, un lien non https', async () => {
    const point = { titre: 'x', texte: 'y' }
    const réponse = await appel({
      sorte: 'message',
      slug: 'konica',
      objet: 'o',
      préheader: 'p',
      surtitre: 's',
      titre: 't',
      paragraphes: ['a'],
      points: [point, point, point, point],
      action: { libellé: 'Voir', url: 'http://exemple.fr' },
    })
    expect(réponse.status).toBe(400)
    const { raison } = await réponse.json()
    expect(raison).toContain('points')
    expect(raison).toContain('action.url')
  })

  it('compose un email de prospection pour Gmail, et exige l’essentiel à l’étape 1', async () => {
    const réponse = await appel({ sorte: 'prospection', étape: 1, prénom: 'Serge', entreprise: 'Suneido', essentiel: 'Un fait daté.' })
    expect(réponse.status).toBe(200)
    const corps = await réponse.json()
    expect(corps.objet).toBe('Suneido : ce que votre veille a relevé cette semaine')
    expect(corps.html).toContain('répondez STOP')
    const sansEssentiel = await appel({ sorte: 'prospection', étape: 1, entreprise: 'Suneido' })
    expect(sansEssentiel.status).toBe(400)
    expect((await sansEssentiel.json()).raison).toContain('essentiel')
  })

  describe('brouillon déposé par le portail', () => {
    const DEMANDE = {
      sorte: 'lettre',
      page: PAGE,
      slug: 'konica',
      organisation: 'Konica Minolta France',
      objet: 'Veille Konica : Concurrentiel, lundi 19 octobre',
      brouillon: { à: ['lecteur@konica.fr'] },
    }
    beforeEach(() => {
      travail.lireÉditionDeTravail.mockResolvedValue(édition)
      editions.lireBlocsDePage.mockResolvedValue(BLOCS_CONFORMES)
    })

    it('dépose le brouillon dans la boîte de l’opératrice et ne rend pas le HTML', async () => {
      vi.stubEnv('GMAIL_BOITE_OPERATRICE', 'agathe@next-impact.digital')
      gmail.déposerChezLOpératrice.mockResolvedValue({ idBrouillon: 'r-1', idMessage: 'm-1' })
      const réponse = await appel(DEMANDE)
      expect(réponse.status).toBe(200)
      const corps = await réponse.json()
      expect(corps).toMatchObject({ état: 'brouillon', objet: DEMANDE.objet, idBrouillon: 'r-1', idMessage: 'm-1', destinataires: 1 })
      expect(corps.html).toBeUndefined()
      expect(corps.texte).toBeUndefined()
      expect(corps.octets).toBeGreaterThan(5000)
      const [message, boîte] = gmail.déposerChezLOpératrice.mock.calls[0]!
      expect(boîte).toBe('agathe@next-impact.digital')
      expect(message).toMatchObject({ destinataire: 'lecteur@konica.fr', sujet: DEMANDE.objet })
      expect(message.html).toContain('Ajustements du cadrage de cette veille')
      // Jamais d'adresse de lecteur dans le journal.
      const journal = vi.mocked(console.info).mock.calls.flat().join(' ')
      expect(journal).not.toContain('lecteur@konica.fr')
    })

    it('accepte un brouillon sans destinataire', async () => {
      vi.stubEnv('GMAIL_BOITE_OPERATRICE', 'agathe@next-impact.digital')
      gmail.déposerChezLOpératrice.mockResolvedValue({ idBrouillon: 'r-2', idMessage: null })
      const corps = await (await appel({ ...DEMANDE, brouillon: { à: [] } })).json()
      expect(corps).toMatchObject({ état: 'brouillon', destinataires: 0 })
      expect(gmail.déposerChezLOpératrice.mock.calls[0]![0].destinataire).toBe('')
    })

    it('rend le courriel composé quand la boîte n’est pas configurée', async () => {
      const corps = await (await appel(DEMANDE)).json()
      expect(corps.état).toBe('composé')
      expect(corps.html).toContain('Ajustements du cadrage de cette veille')
      expect(corps.brouillon).toMatchObject({ état: 'indisponible' })
      expect(gmail.déposerChezLOpératrice).not.toHaveBeenCalled()
    })

    it('rend le courriel composé quand Gmail refuse, avec le seul statut', async () => {
      vi.stubEnv('GMAIL_BOITE_OPERATRICE', 'agathe@next-impact.digital')
      const { ErreurDEnvoi } = await import('@/lib/email/gmail')
      gmail.déposerChezLOpératrice.mockRejectedValue(new ErreurDEnvoi(403, 'refus pour lecteur@konica.fr'))
      const corps = await (await appel(DEMANDE)).json()
      expect(corps).toMatchObject({ état: 'composé', brouillon: { état: 'échec', statut: 403 } })
      expect(corps.html).toBeTruthy()
      expect(vi.mocked(console.error).mock.calls.flat().join(' ')).not.toContain('lecteur@konica.fr')
    })

    it('refuse une adresse qui injecterait un en-tête, et plus de dix destinataires', async () => {
      vi.stubEnv('GMAIL_BOITE_OPERATRICE', 'agathe@next-impact.digital')
      expect((await appel({ ...DEMANDE, brouillon: { à: ['x@y.fr\r\nBcc: z@w.fr'] } })).status).toBe(400)
      const onze = Array.from({ length: 11 }, (_, i) => `l${i}@konica.fr`)
      expect((await appel({ ...DEMANDE, brouillon: { à: onze } })).status).toBe(400)
      expect(gmail.déposerChezLOpératrice).not.toHaveBeenCalled()
    })

    it('ne dépose rien pour une lettre non conforme', async () => {
      vi.stubEnv('GMAIL_BOITE_OPERATRICE', 'agathe@next-impact.digital')
      travail.lireÉditionDeTravail.mockResolvedValue({ ...édition, dossiersOuvertsBruts: 'Ricoh — en cours — 2' })
      editions.lireBlocsDePage.mockResolvedValue([{ id: 'p', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Impact fort.' }] } }])
      expect((await appel(DEMANDE)).status).toBe(422)
      expect(gmail.déposerChezLOpératrice).not.toHaveBeenCalled()
    })
  })
})
