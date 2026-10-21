import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const file = vi.hoisted(() => ({ recevoirUneÉdition: vi.fn() }))
const dispositif = vi.hoisted(() => ({ enregistrerLÉdition: vi.fn() }))
const parution = vi.hoisted(() => ({ envoyerLaLettreAuxLecteurs: vi.fn(), envoyerLaLettreDeFilière: vi.fn() }))
vi.mock('@/lib/portail/file', () => file)
vi.mock('@/lib/payload/dispositif', () => dispositif)
vi.mock('@/lib/portail/parution', () => parution)

const route = await import('@/app/api/veille/editions/route')

const TRAVAIL = '11111111-2222-4333-8444-555555555555'
const ORGANISATION = 'aaaabbbb-cccc-4ddd-8eee-ffff00005555'

/**
 * Une remise minimale du moteur. Le Markdown ne respecte pas le contrat de
 * forme unique : sur le chemin de la file, c'est `recevoirUneÉdition` (ici
 * simulée) qui le relit ; hors file, la revalidation le refuse et l'édition
 * part en brouillon, ce que le test de filière vérifie.
 */
const remise = (surcharge: Record<string, unknown> = {}) => ({
  organisation: ORGANISATION,
  filiere: null,
  mode: 'parution',
  run: 'run_1',
  travail: TRAVAIL,
  session: 'run_1',
  proprietes: {
    titre: 'Veille Acme n° 4',
    numero: 4,
    dateEdition: '2026-10-26',
    periodeCouverte: 'du 19 au 26 octobre',
    fenetreElargie: false,
    dossiersOuvertsSuivis: 'CADA (1)',
    actionDeLaSemaine: '',
  },
  markdown: '# L’essentiel\n\n- Un fait.\n',
  acceptee: true,
  controle: { manquements: [], avertissements: [] },
  mesures: { couverture: { nommees: 10, ouvertes: 9, taux: 0.9 }, faits: 12, reprises: 0, recherches: 3, cout: 0.42, dureeMs: 1000, modele: 'opus' },
  collecte: { lectures: [], gelSuivant: [] },
  debut: '2026-10-26T04:00:00.000Z',
  fin: '2026-10-26T04:05:00.000Z',
  ...surcharge,
})

const poster = (corps: unknown, jeton = 'secret-de-test') =>
  route.POST(new NextRequest('https://www.signauxfaibles.io/api/veille/editions', { method: 'POST', headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' }, body: JSON.stringify(corps) }))

const portesVides = { portail: [], ruptures: [], avertissements: [] }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('ACTIVATION_SECRET', 'secret-de-test')
  dispositif.enregistrerLÉdition.mockResolvedValue({ edition: 'ed_1', run: 'run_1', statut: 'publiee' })
  parution.envoyerLaLettreAuxLecteurs.mockResolvedValue({ envoyés: 2 })
  parution.envoyerLaLettreDeFilière.mockResolvedValue({ envoyés: 5 })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/veille/editions, par la file de travaux', () => {
  it('exige le jeton et un corps valide : travail et session ensemble, jamais pour une filière', async () => {
    expect((await poster(remise(), 'faux')).status).toBe(401)
    expect((await poster({})).status).toBe(400)
    expect((await poster(remise({ session: undefined }))).status).toBe(400)
    expect((await poster(remise({ travail: undefined }))).status).toBe(400)
    expect((await poster(remise({ organisation: null, filiere: 'fil_1' }))).status).toBe(400)
    expect(file.recevoirUneÉdition).not.toHaveBeenCalled()
    expect(dispositif.enregistrerLÉdition).not.toHaveBeenCalled()
  })

  it('conclut le travail avant d’écrire : acceptée, l’édition est publiée et les courriers partent', async () => {
    file.recevoirUneÉdition.mockResolvedValue({ sorte: 'accepté', conclusion: { sorte: 'accepté', runId: 'r', numéro: 4 }, portes: portesVides, aperçu: null })
    const réponse = await poster(remise())
    expect(réponse.status).toBe(200)
    expect(await réponse.json()).toMatchObject({ edition: 'ed_1', statut: 'publiee', travail: 'accepte', ruptures: [], courriers: { envoyés: 2 } })
    expect(file.recevoirUneÉdition).toHaveBeenCalledWith(
      expect.objectContaining({ travailId: TRAVAIL, session: 'run_1', organisationPayload: ORGANISATION, numéro: 4, acceptéeParLeMoteur: true, exécuteur: 'trigger:run_1' }),
    )
    expect(file.recevoirUneÉdition.mock.invocationCallOrder[0]).toBeLessThan(dispositif.enregistrerLÉdition.mock.invocationCallOrder[0]!)
    expect(dispositif.enregistrerLÉdition).toHaveBeenCalledWith(expect.objectContaining({ run: 'run_1' }), 'publiee')
    expect(parution.envoyerLaLettreAuxLecteurs).toHaveBeenCalledWith(expect.objectContaining({ organisationPayload: ORGANISATION, édition: expect.objectContaining({ id: 'ed_1', numéro: 4 }) }))
    expect(parution.envoyerLaLettreDeFilière).not.toHaveBeenCalled()
  })

  it('refusée ou abandonnée par la file : rien n’est écrit, ni envoyé, et la réponse porte les portes', async () => {
    const portes = { ...portesVides, portail: [{ code: 'numéro-différent', message: 'n° 5 attendu' }] }
    file.recevoirUneÉdition.mockResolvedValueOnce({ sorte: 'refusé', conclusion: { sorte: 'refusé', runId: 'r', tentatives: 1 }, portes, aperçu: null })
    const refus = await poster(remise())
    expect(refus.status).toBe(200)
    expect(await refus.json()).toMatchObject({ état: 'refuse', tentatives: 1, portes: { portail: [{ code: 'numéro-différent' }] } })

    file.recevoirUneÉdition.mockResolvedValueOnce({ sorte: 'abandonné', conclusion: { sorte: 'abandonné', runId: 'r', tentatives: 3 }, portes: portesVides, aperçu: null })
    expect(await (await poster(remise({ acceptee: false }))).json()).toMatchObject({ état: 'abandonne', tentatives: 3 })

    expect(dispositif.enregistrerLÉdition).not.toHaveBeenCalled()
    expect(parution.envoyerLaLettreAuxLecteurs).not.toHaveBeenCalled()
  })

  it('un travail inconnu, non pris ou d’une autre session n’est pas conclu : 404 ou 409, rien d’écrit', async () => {
    file.recevoirUneÉdition.mockResolvedValueOnce({ sorte: 'inconnu' })
    expect((await poster(remise())).status).toBe(404)
    file.recevoirUneÉdition.mockResolvedValueOnce({ sorte: 'pas-pris', état: 'accepte' })
    const pasPris = await poster(remise())
    expect(pasPris.status).toBe(409)
    expect(await pasPris.json()).toMatchObject({ état: 'pas-pris', travail: 'accepte' })
    file.recevoirUneÉdition.mockResolvedValueOnce({ sorte: 'autre-session' })
    expect((await poster(remise())).status).toBe(409)
    expect(dispositif.enregistrerLÉdition).not.toHaveBeenCalled()
  })

  it('une panne de la base rend 500 sans écrire Payload', async () => {
    file.recevoirUneÉdition.mockRejectedValue(new Error('SQLSTATE 08006'))
    expect((await poster(remise())).status).toBe(500)
    expect(dispositif.enregistrerLÉdition).not.toHaveBeenCalled()
  })
})

describe('POST /api/veille/editions, hors file (lettre de filière)', () => {
  it('revalide en forme unique, écrit en brouillon ce qui ne passe pas, et n’envoie rien', async () => {
    dispositif.enregistrerLÉdition.mockResolvedValue({ edition: 'ed_f', run: 'run_1', statut: 'brouillon' })
    const réponse = await poster(remise({ organisation: null, filiere: 'fil_1', mode: 'filiere', travail: undefined, session: undefined }))
    expect(réponse.status).toBe(200)
    const corps = await réponse.json()
    expect(corps).toMatchObject({ edition: 'ed_f', statut: 'brouillon', courriers: null })
    expect(corps.ruptures.length).toBeGreaterThan(0)
    expect(dispositif.enregistrerLÉdition).toHaveBeenCalledWith(expect.objectContaining({ filiere: 'fil_1' }), 'brouillon')
    expect(file.recevoirUneÉdition).not.toHaveBeenCalled()
    expect(parution.envoyerLaLettreDeFilière).not.toHaveBeenCalled()
  })
})
