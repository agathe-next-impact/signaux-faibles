import { describe, expect, it } from 'vitest'
import { interpréterDemande } from '@/lib/portail/activation'

/**
 * La route d'ouverture est appelée par une tâche qui vit hors du dépôt, et elle
 * envoie un courrier à un vrai lecteur. Toute la décision — configuration,
 * authentification, forme de la demande — tient dans une fonction pure, testée
 * ici sans serveur, comme celle du webhook.
 */
const SECRET = 'un-secret-d-activation-assez-long-pour-etre-credible'

const demander = (
  corps: unknown,
  options: { autorisation?: string | null; sansSecret?: boolean } = {},
) =>
  interpréterDemande({
    brut: typeof corps === 'string' ? corps : JSON.stringify(corps),
    autorisation:
      'autorisation' in options ? (options.autorisation ?? null) : `Bearer ${SECRET}`,
    secret: options.sansSecret ? undefined : SECRET,
  })

describe('interpréterDemande', () => {
  it('ouvre pour une demande authentique', () => {
    expect(demander({ email: 'jean@hermitagelelab.com' })).toEqual({
      sorte: 'ouvrir',
      email: 'jean@hermitagelelab.com',
    })
  })

  it('normalise l’adresse, casse et espaces compris', () => {
    const décision = demander({ email: '  Jean@Hermitagelelab.COM ' })
    expect(décision).toEqual({ sorte: 'ouvrir', email: 'jean@hermitagelelab.com' })
  })

  it('se déclare non configurée plutôt que de refuser, sans secret', () => {
    // 503 et non 401 : l'onboarding doit chercher la variable manquante, pas
    // un mauvais jeton.
    expect(demander({ email: 'jean@hermitagelelab.com' }, { sansSecret: true })).toEqual({
      sorte: 'non-configurée',
    })
  })

  it('refuse un jeton faux', () => {
    const décision = demander(
      { email: 'jean@hermitagelelab.com' },
      { autorisation: 'Bearer faux' },
    )
    expect(décision.sorte).toBe('refusée')
  })

  it('refuse un jeton qui n’est qu’un préfixe du bon', () => {
    // La comparaison porte sur des empreintes : une longueur différente ne
    // doit ni lever ni renseigner.
    const décision = demander(
      { email: 'jean@hermitagelelab.com' },
      { autorisation: `Bearer ${SECRET.slice(0, 10)}` },
    )
    expect(décision.sorte).toBe('refusée')
  })

  it('refuse un en-tête absent ou mal formé', () => {
    expect(demander({ email: 'x@y.fr' }, { autorisation: null }).sorte).toBe('refusée')
    expect(demander({ email: 'x@y.fr' }, { autorisation: SECRET }).sorte).toBe('refusée')
    expect(demander({ email: 'x@y.fr' }, { autorisation: 'Basic abc' }).sorte).toBe('refusée')
  })

  it('refuse un corps illisible', () => {
    expect(demander('{ pas du json').sorte).toBe('refusée')
  })

  it('refuse une demande sans adresse exploitable', () => {
    expect(demander({}).sorte).toBe('refusée')
    expect(demander({ email: '' }).sorte).toBe('refusée')
    expect(demander({ email: 'pas-une-adresse' }).sorte).toBe('refusée')
    expect(demander({ email: 42 }).sorte).toBe('refusée')
  })

  it('n’accepte pas un identifiant d’accès à la place de l’adresse', () => {
    // L'identifiant est le secret que le portail signe. Il n'a aucune raison de
    // circuler entre Cowork et le portail, et la route ne doit pas s'y prêter.
    expect(demander({ identifiant: '9b03ef9c2424cfc893792f92adb5ba9d' }).sorte).toBe('refusée')
  })

  it('vérifie le jeton avant de regarder le corps', () => {
    // Un corps illisible avec un mauvais jeton doit être refusé pour le jeton :
    // sinon la route renseigne un appelant anonyme sur la forme attendue.
    const décision = interpréterDemande({
      brut: '{ pas du json',
      autorisation: 'Bearer faux',
      secret: SECRET,
    })
    expect(décision).toEqual({ sorte: 'refusée', raison: 'jeton invalide' })
  })
})
