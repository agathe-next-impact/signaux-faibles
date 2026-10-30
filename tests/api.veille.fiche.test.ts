import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fiche = vi.hoisted(() => ({ recevoirLaFiche: vi.fn(), lireLaFicheDuPilote: vi.fn(), publierLaFicheDuPilote: vi.fn() }))
const client = vi.hoisted(() => ({ baseConfigurée: vi.fn() }))
vi.mock('@/lib/portail/fiche-veille', () => fiche)
vi.mock('@/lib/base/client', () => client)

const route = await import('@/app/api/veille/fiche/route')

/** La route de la fiche de veille (lot 6, 30 octobre 2026) : le jeton, la forme, puis l'orchestration. */
const URL = 'https://www.signauxfaibles.io/api/veille/fiche'
const entêtes = (jeton = 'secret-de-test') => ({ authorization: `Bearer ${jeton}`, 'content-type': 'application/json' })
const envoyer = (corps: unknown, jeton?: string) => route.POST(new NextRequest(URL, { method: 'POST', headers: entêtes(jeton), body: JSON.stringify(corps) }))
const régler = (corps: unknown) => route.PATCH(new NextRequest(URL, { method: 'PATCH', headers: entêtes(), body: JSON.stringify(corps) }))

const FICHE = {
  themes: [{ veille: 'ecosysteme', numero: 1, suit: 'Les règlements européens.', fort: 'Un texte adopté.' }],
  sources: [{ veille: 'ecosysteme', numero: 1, nom: 'EUR-Lex', site: 'https://eur-lex.europa.eu' }, { veille: 'concurrentiel', numero: 1, nom: 'Sites des concurrents', site: '' }],
  niches: [{ enonce: 'Les décisions de la CNIL.', signal: 'Une sanction publiée.' }],
  echeances: [{ date: '2026-12-01', libelle: 'Entrée en application', veille: 'ecosysteme', numero: 1 }, { date: '2027-01-15', libelle: 'Salon' }],
}
const corps = { slug: 'hermitage', grilleVersion: 1, fiche: FICHE }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  client.baseConfigurée.mockReturnValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('/api/veille/fiche', () => {
  it('exige le jeton et une base avant de rien lire', async () => {
    expect((await envoyer(corps, 'mauvais')).status).toBe(401)
    client.baseConfigurée.mockReturnValue(false)
    expect((await envoyer(corps)).status).toBe(503)
    expect(fiche.recevoirLaFiche).not.toHaveBeenCalled()
  })

  it('rejette un corps mal formé en nommant le champ', async () => {
    const réponse = await envoyer({ ...corps, fiche: { ...FICHE, themes: [{ ...FICHE.themes[0], veille: 'autre' }] } })
    expect(réponse.status).toBe(400)
    expect(await réponse.json()).toEqual({ état: 'invalide', raison: 'champ « fiche.themes.0.veille »' })
    expect(fiche.recevoirLaFiche).not.toHaveBeenCalled()
  })

  it('traduit la fiche vers le domaine : site vide nul, famille d’échéance absente nulle', async () => {
    fiche.recevoirLaFiche.mockResolvedValue({ sorte: 'enregistrée', version: 3, texte: 'Fiche de veille' })
    const réponse = await envoyer(corps)
    expect(réponse.status).toBe(201)
    expect(await réponse.json()).toEqual({ état: 'enregistrée', sorte: 'enregistrée', version: 3, texte: 'Fiche de veille' })
    expect(fiche.recevoirLaFiche).toHaveBeenCalledWith({
      slug: 'hermitage',
      grilleVersion: 1,
      fiche: {
        thèmes: [{ veille: 'ecosysteme', numéro: 1, suit: 'Les règlements européens.', fort: 'Un texte adopté.' }],
        sources: [
          { veille: 'ecosysteme', numéro: 1, nom: 'EUR-Lex', site: 'https://eur-lex.europa.eu' },
          { veille: 'concurrentiel', numéro: 1, nom: 'Sites des concurrents', site: null },
        ],
        niches: [{ énoncé: 'Les décisions de la CNIL.', signal: 'Une sanction publiée.' }],
        échéances: [
          { date: '2026-12-01', libellé: 'Entrée en application', veille: 'ecosysteme', numéro: 1 },
          { date: '2027-01-15', libellé: 'Salon', veille: null, numéro: null },
        ],
      },
    })
  })

  it('une fiche refusée répond 422 avec ses refus et le message de reprise', async () => {
    fiche.recevoirLaFiche.mockResolvedValue({ sorte: 'refusée', refus: [{ code: 'famille-inconnue', message: 'x' }], message: '[famille-inconnue] : x' })
    const réponse = await envoyer(corps)
    expect(réponse.status).toBe(422)
    expect(await réponse.json()).toMatchObject({ état: 'refusée', message: '[famille-inconnue] : x' })
  })

  it('PATCH : seuls publie, retire et propose ; la version réglée revient', async () => {
    expect((await régler({ slug: 'hermitage', etat: 'efface' })).status).toBe(400)
    fiche.publierLaFicheDuPilote.mockResolvedValue({ sorte: 'réglée', version: 2, état: 'publie' })
    const réponse = await régler({ slug: 'hermitage', etat: 'publie' })
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toEqual({ état: 'réglée', version: 2, publication: 'publie' })
    expect(fiche.publierLaFicheDuPilote).toHaveBeenCalledWith({ slug: 'hermitage', état: 'publie' })
  })
})
