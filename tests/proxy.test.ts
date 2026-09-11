import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

/**
 * Le proxy écarte les requêtes sans jeton valide. Ce qui se joue ici n'est pas
 * la décision — évidente — mais le **code de la redirection**.
 *
 * `NextResponse.redirect` redirige en 307 par défaut, et un 307 conserve la
 * méthode : un POST écarté était rejoué en POST sur « recevoir mon lien », qui
 * répondait 405. Observé en production le 11 septembre 2026, sur le bouton
 * « quitter » d'un onglet dont la session venait d'être effacée.
 */
function requête(chemin: string, méthode = 'GET'): NextRequest {
  return new NextRequest(new URL(chemin, 'https://signauxfaibles.io'), { method: méthode })
}

describe('proxy', () => {
  it('laisse passer les chemins publics', () => {
    expect(proxy(requête('/recevoir-mon-lien')).status).toBe(200)
    expect(proxy(requête('/acces/nimporte')).status).toBe(200)
    expect(proxy(requête('/')).status).toBe(200)
  })

  it('écarte une lecture sans jeton en 307, vers le formulaire', () => {
    const réponse = proxy(requête('/hermitage'))
    expect(réponse.status).toBe(307)
    expect(réponse.headers.get('location')).toContain('/recevoir-mon-lien')
  })

  it("écarte un POST sans jeton en 303, pour qu'il retombe en GET", () => {
    const réponse = proxy(requête('/quitter', 'POST'))
    expect(réponse.status).toBe(303)
    expect(réponse.headers.get('location')).toContain('/recevoir-mon-lien')
  })

  it('écarte une action serveur postée sur une page en 303', () => {
    expect(proxy(requête('/hermitage', 'POST')).status).toBe(303)
  })
})
