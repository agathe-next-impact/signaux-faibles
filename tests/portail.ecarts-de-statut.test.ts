import { describe, expect, it } from 'vitest'
import { contrôlerLesStatuts, statutDuRegistre, type OrganisationDuPortail } from '@/lib/portail/ecarts-de-statut'

/** Une chaîne dit l'état d'une organisation non archivée ; un objet dit tout. */
const états = (entrées: Record<string, string | OrganisationDuPortail>) =>
  new Map(
    Object.entries(entrées).map(([slug, valeur]) => [
      slug,
      typeof valeur === 'string' ? { état: valeur, archivée: false } : valeur,
    ]),
  )
const archivée = (état: string): OrganisationDuPortail => ({ état, archivée: true })

describe('statutDuRegistre', () => {
  it('lit le chiffre en tête du libellé Notion, ou le chiffre seul', () => {
    expect(statutDuRegistre('0 · Écartée')).toBe(0)
    expect(statutDuRegistre('4 · Première lettre produite — à valider')).toBe(4)
    expect(statutDuRegistre('  6 · Veille active')).toBe(6)
    expect(statutDuRegistre(5)).toBe(5)
  })

  it('refuse ce qui ne se devine pas', () => {
    expect(statutDuRegistre('Écartée')).toBeNull()
    expect(statutDuRegistre('')).toBeNull()
    expect(statutDuRegistre('10 · Quelque chose')).toBeNull()
    expect(statutDuRegistre('7 · Inconnu')).toBeNull()
    expect(statutDuRegistre(7)).toBeNull()
    expect(statutDuRegistre(-1)).toBeNull()
    expect(statutDuRegistre(2.5)).toBeNull()
  })
})

describe('contrôlerLesStatuts', () => {
  it('un registre et un portail d’accord ne donnent aucun défaut', () => {
    expect(
      contrôlerLesStatuts(
        [
          { slug: 'acme', statut: '6 · Veille active' },
          { slug: 'vieille', statut: '0 · Écartée' },
          { slug: 'neuve', statut: '2 · Référentiels générés' },
        ],
        états({ acme: 'abonnee', vieille: 'ecartee' }),
      ),
    ).toEqual([])
  })

  it('« 0 · Écartée » au registre d’une organisation encore en service au portail', () => {
    for (const état of ['demande', 'generation', 'essai', 'abonnee']) {
      const défauts = contrôlerLesStatuts([{ slug: 'acme', statut: '0 · Écartée' }], états({ acme: état }))
      expect(défauts).toHaveLength(1)
      expect(défauts[0]).toMatchObject({ slug: 'acme', code: 'statut-ecartee-registre' })
      expect(défauts[0]?.message).toContain(`état ${état}`)
      expect(défauts[0]?.message).toContain('/espaces/abonnements/acme')
    }
  })

  it('une abonnée écartée au registre rappelle que la décision ne résilie pas Stripe', () => {
    const [abonnée] = contrôlerLesStatuts([{ slug: 'acme', statut: 0 }], états({ acme: 'abonnee' }))
    expect(abonnée?.message).toContain('Stripe')
    const [essai] = contrôlerLesStatuts([{ slug: 'acme', statut: 0 }], états({ acme: 'essai' }))
    expect(essai?.message).not.toContain('Stripe')
  })

  it('une organisation déjà suspendue ou de test n’est pas un écart avec « 0 · Écartée »', () => {
    expect(contrôlerLesStatuts([{ slug: 'a', statut: 0 }, { slug: 'b', statut: 0 }], états({ a: 'suspendue', b: 'test' }))).toEqual([])
  })

  it('écartée au portail, mais le registre la montre en service', () => {
    const défauts = contrôlerLesStatuts([{ slug: 'acme', statut: '6 · Veille active' }], états({ acme: 'ecartee' }))
    expect(défauts).toEqual([
      expect.objectContaining({ slug: 'acme', code: 'statut-ecartee-portail' }),
    ])
    expect(défauts[0]?.message).toContain('6 · Veille active')
    expect(défauts[0]?.message).toContain('0 · Écartée')
  })

  it('archivée au portail, registre « 0 · Écartée » : d’accord, quel que soit l’état resté en base', () => {
    for (const état of ['essai', 'abonnee', 'ecartee', 'suspendue']) {
      expect(contrôlerLesStatuts([{ slug: 'acme', statut: '0 · Écartée' }], états({ acme: archivée(état) }))).toEqual([])
    }
  })

  it('archivée au portail, mais le registre la montre en service : les tâches la traitent encore', () => {
    for (const statut of [3, 4, 5, 6]) {
      const défauts = contrôlerLesStatuts([{ slug: 'acme', statut }], états({ acme: archivée('essai') }))
      expect(défauts).toEqual([expect.objectContaining({ slug: 'acme', code: 'statut-archivee-portail' })])
    }
    const [défaut] = contrôlerLesStatuts([{ slug: 'acme', statut: '6 · Veille active' }], états({ acme: archivée('abonnee') }))
    expect(défaut?.message).toContain('6 · Veille active')
    expect(défaut?.message).toContain('ne la sort pas des tâches')
  })

  it('archivée et écartée au portail : un seul défaut, celui de l’archivage', () => {
    const défauts = contrôlerLesStatuts([{ slug: 'acme', statut: 6 }], états({ acme: archivée('ecartee') }))
    expect(défauts.map((d) => d.code)).toEqual(['statut-archivee-portail'])
  })

  it('suspendue au portail : le registre n’a pas d’équivalent, jamais un écart', () => {
    expect(contrôlerLesStatuts([{ slug: 'acme', statut: '6 · Veille active' }], états({ acme: 'suspendue' }))).toEqual([])
  })

  it('du statut 4 au statut 6 sans organisation au portail : l’entrée en essai manque', () => {
    for (const statut of [4, 5, 6]) {
      const défauts = contrôlerLesStatuts([{ slug: 'eclairion', statut }], états({}))
      expect(défauts).toEqual([expect.objectContaining({ slug: 'eclairion', code: 'organisation-absente-du-portail' })])
    }
  })

  it('avant le statut 4, l’absence du portail est le cours normal de l’onboarding', () => {
    expect(contrôlerLesStatuts([1, 2, 3, 0].map((statut, i) => ({ slug: `o${i}`, statut })), états({}))).toEqual([])
  })

  it('un statut illisible se dit, et ne bloque pas les autres lignes', () => {
    const défauts = contrôlerLesStatuts(
      [
        { slug: 'floue', statut: 'Écartée' },
        { slug: 'acme', statut: '0 · Écartée' },
      ],
      états({ floue: 'essai', acme: 'essai' }),
    )
    expect(défauts.map((d) => [d.slug, d.code])).toEqual([
      ['floue', 'statut-registre-illisible'],
      ['acme', 'statut-ecartee-registre'],
    ])
    expect(défauts[0]?.message).toContain('« Écartée »')
  })

  it('le slug est comparé sans casse ni espaces, et une ligne sans slug est ignorée', () => {
    const défauts = contrôlerLesStatuts(
      [
        { slug: '  Acme ', statut: 0 },
        { slug: '   ', statut: 0 },
      ],
      états({ acme: 'essai' }),
    )
    expect(défauts).toEqual([expect.objectContaining({ slug: 'acme', code: 'statut-ecartee-registre' })])
  })

  it('ne dit rien d’une organisation que le registre ne donne pas', () => {
    expect(contrôlerLesStatuts([], états({ acme: 'ecartee', autre: 'essai' }))).toEqual([])
  })

  it('aucun message ne porte de tiret cadratin', () => {
    const défauts = contrôlerLesStatuts(
      [
        { slug: 'a', statut: 0 },
        { slug: 'b', statut: 6 },
        { slug: 'c', statut: 4 },
        { slug: 'd', statut: 'x' },
        { slug: 'e', statut: 6 },
      ],
      états({ a: 'abonnee', b: 'ecartee', e: archivée('essai') }),
    )
    expect(défauts).toHaveLength(5)
    for (const d of défauts) expect(d.message).not.toContain('—')
  })
})
