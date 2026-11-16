import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const appartenance = vi.hoisted(() => ({ exigerOpérateur: vi.fn() }))
const organisations = vi.hoisted(() => ({ réglerLeParcours: vi.fn() }))
const veilles = vi.hoisted(() => ({ listerLesVeilles: vi.fn(), déclarerLaVeille: vi.fn() }))
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((adresse: string) => {
    throw new Error(`REDIRECTION ${adresse}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('INTROUVABLE')
  }),
}))
vi.mock('@/lib/auth/appartenance', () => appartenance)
vi.mock('@/lib/base/organisations', () => organisations)
vi.mock('@/lib/base/veilles', () => veilles)
vi.mock('next/navigation', () => navigation)
vi.mock('next/headers', () => ({ headers: vi.fn() }))
// Les autres dépendances des gestes de la fiche ne sont pas en cause ici.
vi.mock('@/lib/base/ecriture-lecteurs', () => ({}))
vi.mock('@/lib/base/gestion', () => ({}))
vi.mock('@/lib/portail/envoi-des-lettres', () => ({}))
vi.mock('@/lib/portail/fiche-veille', () => ({}))
vi.mock('@/lib/portail/lettres-a-publier', () => ({}))
vi.mock('@/lib/portail/onboarding', () => ({}))
vi.mock('@/lib/portail/ouverture', () => ({}))
vi.mock('@/lib/portail/renvoi-courriers', () => ({}))
vi.mock('@/lib/portail/situation', () => ({}))
vi.mock('@/lib/portail/strategie', () => ({}))
vi.mock('@/lib/env', () => ({ env: {} }))

const { appliquerEnSérie, placerÀLÉtape } = await import('@/lib/portail/reglages')
const { réglerLaVeille } = await import('@/lib/portail/gestion-actions')

const formulaire = (champs: Record<string, string | string[]>): FormData => {
  const données = new FormData()
  for (const [nom, valeur] of Object.entries(champs)) for (const v of [valeur].flat()) données.append(nom, v)
  return données
}
/** L'adresse vers laquelle l'action redirige, ou le refus qu'elle lève. */
const issue = async (action: (d: FormData) => Promise<void>, données: FormData): Promise<string> => {
  try {
    await action(données)
    return 'sans redirection'
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : String(erreur)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  appartenance.exigerOpérateur.mockResolvedValue({ nom: 'Agathe' })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('placerÀLÉtape', () => {
  it('vérifie le privilège, place, et revient à la section « Parcours » de la fiche', async () => {
    organisations.réglerLeParcours.mockResolvedValue({ sorte: 'placée', j0: '2026-10-26', étape: 'fin d’essai · l’essentiel seul' })
    const retour = await issue(placerÀLÉtape, formulaire({ slug: 'heritech', cible: 'tronquee', retour: 'fiche' }))
    expect(appartenance.exigerOpérateur).toHaveBeenCalledTimes(1)
    expect(organisations.réglerLeParcours).toHaveBeenCalledWith('heritech', { sorte: 'placer', cible: 'tronquee' })
    expect(retour).toBe(`REDIRECTION /espaces/abonnements/heritech?reglage=${encodeURIComponent('placée')}&section=parcours#parcours`)
  })

  it('une étape ou un slug mal formés n’atteignent ni la garde ni la base', async () => {
    expect(await issue(placerÀLÉtape, formulaire({ slug: 'heritech', cible: 'abonnee' }))).toBe('INTROUVABLE')
    expect(await issue(placerÀLÉtape, formulaire({ slug: '../x', cible: 'tronquee' }))).toBe('INTROUVABLE')
    expect(organisations.réglerLeParcours).not.toHaveBeenCalled()
  })

  it('sans privilège, rien n’est écrit', async () => {
    appartenance.exigerOpérateur.mockRejectedValue(new Error('REFUS'))
    expect(await issue(placerÀLÉtape, formulaire({ slug: 'heritech', cible: 'tronquee' }))).toBe('REFUS')
    expect(organisations.réglerLeParcours).not.toHaveBeenCalled()
  })
})

describe('appliquerEnSérie', () => {
  it('règle chaque organisation une fois, et dit lesquelles ont été refusées et pourquoi', async () => {
    organisations.réglerLeParcours
      .mockResolvedValueOnce({ sorte: 'placée', j0: '2026-10-19', étape: 'x' })
      .mockResolvedValueOnce({ sorte: 'abonnée-stripe' })
      .mockRejectedValueOnce(new Error('40001'))
    const retour = await issue(appliquerEnSérie, formulaire({ lot: 'placer:tronquee', o: ['suneido', 'mastora', 'heritech', 'suneido'] }))
    expect(appartenance.exigerOpérateur).toHaveBeenCalledTimes(1)
    expect(organisations.réglerLeParcours.mock.calls).toEqual([
      ['suneido', { sorte: 'placer', cible: 'tronquee' }],
      ['mastora', { sorte: 'placer', cible: 'tronquee' }],
      ['heritech', { sorte: 'placer', cible: 'tronquee' }],
    ])
    const url = new URL(retour.replace('REDIRECTION ', ''), 'https://x.test')
    expect(url.pathname).toBe('/espaces/abonnements')
    expect(url.searchParams.get('serie')).toBe('placer:tronquee')
    expect(url.searchParams.get('ok')).toBe('suneido')
    expect(url.searchParams.get('ko')).toBe('mastora:abonnée-stripe,heritech:échec')
  })

  it('prolonger et relecture passent par le même réglage', async () => {
    organisations.réglerLeParcours.mockResolvedValue({ sorte: 'prolongé', ancienJ0: 'a', nouveauJ0: 'b' })
    await issue(appliquerEnSérie, formulaire({ lot: 'prolonger:2', o: 'acme' }))
    expect(organisations.réglerLeParcours).toHaveBeenLastCalledWith('acme', { sorte: 'prolonger', semaines: 2 })
    organisations.réglerLeParcours.mockResolvedValue({ sorte: 'relecture-réglée', requise: true })
    const retour = await issue(appliquerEnSérie, formulaire({ lot: 'relecture:oui', o: 'acme' }))
    expect(organisations.réglerLeParcours).toHaveBeenLastCalledWith('acme', { sorte: 'relecture', requise: true })
    expect(new URL(retour.replace('REDIRECTION ', ''), 'https://x.test').searchParams.get('ok')).toBe('acme')
  })

  it('refuse un geste inconnu, aucune organisation, un slug mal formé seul, ou plus de cinquante', async () => {
    expect(await issue(appliquerEnSérie, formulaire({ lot: 'supprimer:tout', o: 'acme' }))).toBe('INTROUVABLE')
    expect(await issue(appliquerEnSérie, formulaire({ lot: 'placer:tronquee' }))).toBe('INTROUVABLE')
    expect(await issue(appliquerEnSérie, formulaire({ lot: 'placer:tronquee', o: '../x' }))).toBe('INTROUVABLE')
    const trop = Array.from({ length: 51 }, (_, i) => `org-${i}`)
    expect(await issue(appliquerEnSérie, formulaire({ lot: 'placer:tronquee', o: trop }))).toBe('INTROUVABLE')
    expect(appartenance.exigerOpérateur).not.toHaveBeenCalled()
    expect(organisations.réglerLeParcours).not.toHaveBeenCalled()
  })

  it('sans privilège, aucune organisation n’est réglée', async () => {
    appartenance.exigerOpérateur.mockRejectedValue(new Error('REFUS'))
    expect(await issue(appliquerEnSérie, formulaire({ lot: 'placer:tronquee', o: ['a', 'b'] }))).toBe('REFUS')
    expect(organisations.réglerLeParcours).not.toHaveBeenCalled()
  })
})

describe('réglerLaVeille', () => {
  const veille = { id: 'v', slug: 'heritech', type: 'unique', libellé: 'Veille Heritech', jourParution: 4, heureParution: '06:30:00', cadence: 'hebdomadaire', numéroCourant: 7, état: 'active', referentielNotion: null }
  const champs = { slug: 'heritech', type: 'unique', jour: '2', heure: '07:15', cadence: 'bimensuelle' }

  it('règle jour, heure et cadence d’une veille existante, sans toucher au libellé ni au numéro', async () => {
    veilles.listerLesVeilles.mockResolvedValue([veille])
    veilles.déclarerLaVeille.mockResolvedValue({ sorte: 'mise-à-jour', veilleId: 'v' })
    const retour = await issue(réglerLaVeille, formulaire(champs))
    expect(veilles.déclarerLaVeille).toHaveBeenCalledWith({
      slug: 'heritech',
      type: 'unique',
      libellé: 'Veille Heritech',
      jourParution: 2,
      heureParution: '07:15',
      cadence: 'bimensuelle',
    })
    expect(retour).toBe(`REDIRECTION /espaces/abonnements/heritech?gestion=${encodeURIComponent('veille-réglée')}&section=veille#veille`)
  })

  it('ne déclare jamais une veille qui n’existe pas', async () => {
    veilles.listerLesVeilles.mockResolvedValue([])
    const retour = await issue(réglerLaVeille, formulaire(champs))
    expect(veilles.déclarerLaVeille).not.toHaveBeenCalled()
    expect(retour).toContain('veille-inconnue')
  })

  it('refuse un jour, une heure ou une cadence hors bornes avant la garde', async () => {
    for (const faux of [{ jour: '8' }, { heure: '25:00' }, { cadence: 'quotidienne' }, { type: 'Unique!' }]) {
      expect(await issue(réglerLaVeille, formulaire({ ...champs, ...faux }))).toBe('INTROUVABLE')
    }
    expect(appartenance.exigerOpérateur).not.toHaveBeenCalled()
    expect(veilles.listerLesVeilles).not.toHaveBeenCalled()
  })

  it('sans privilège, rien n’est lu ni écrit', async () => {
    appartenance.exigerOpérateur.mockRejectedValue(new Error('REFUS'))
    expect(await issue(réglerLaVeille, formulaire(champs))).toBe('REFUS')
    expect(veilles.listerLesVeilles).not.toHaveBeenCalled()
    expect(veilles.déclarerLaVeille).not.toHaveBeenCalled()
  })
})
