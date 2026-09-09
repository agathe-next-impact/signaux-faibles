import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import { vérifierJeton } from '@/lib/auth/jeton'

/**
 * La session du portail.
 *
 * Le cookie ne contient que le jeton, c'est-à-dire l'identifiant d'accès et sa
 * signature — rien d'autre, et surtout aucune donnée du client. Douze mois,
 * `httpOnly`, `Secure`, `SameSite=Lax` : la veille est hebdomadaire, une
 * session courte obligerait à retrouver le lien chaque semaine.
 */
export const NOM_DU_COOKIE = 'sf_acces'

const DOUZE_MOIS = 60 * 60 * 24 * 365

export async function poserLaSession(jeton: string): Promise<void> {
  const magasin = await cookies()
  magasin.set(NOM_DU_COOKIE, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DOUZE_MOIS,
  })
}

export async function effacerLaSession(): Promise<void> {
  const magasin = await cookies()
  magasin.delete(NOM_DU_COOKIE)
}

/**
 * L'identifiant d'accès porté par la session, si la signature tient.
 *
 * Cette fonction ne dit **pas** que l'accès est valide : elle dit que le jeton
 * n'a pas été fabriqué. La révocation se lit dans Notion, et c'est le rôle de
 * `lib/auth/appartenance.ts`.
 */
export async function identifiantDeLaSession(): Promise<string | null> {
  const magasin = await cookies()
  const jeton = magasin.get(NOM_DU_COOKIE)?.value
  if (!jeton) return null
  return vérifierJeton(jeton, env().ACCES_SECRET_HMAC)
}
