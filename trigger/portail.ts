/**
 * Le client du portail pour les tâches Trigger.dev : lecture du dossier et
 * remise des résultats, par les routes `/api/veille/*`, jeton d'activation.
 * Les tâches n'ont ni base, ni secret Payload, ni secret HMAC : seulement
 * `PORTAIL_URL` et `ACTIVATION_SECRET`.
 */
import type { AccuséDeRemise, DossierDeParution, ModeDeProduction, RemiseDÉdition, RemiseDeRéférentiel } from '@/lib/moteur/remise'

function portail(): { url: string; jeton: string } {
  const url = process.env['PORTAIL_URL']
  const jeton = process.env['ACTIVATION_SECRET']
  if (!url || !jeton) throw new Error('PORTAIL_URL et ACTIVATION_SECRET sont requis dans l’environnement Trigger.dev.')
  return { url: url.replace(/\/$/, ''), jeton }
}

async function appeler<T>(méthode: 'GET' | 'POST', chemin: string, corps?: unknown): Promise<T> {
  const { url, jeton } = portail()
  const réponse = await fetch(`${url}${chemin}`, {
    method: méthode,
    headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json', accept: 'application/json' },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })
  if (!réponse.ok) {
    const texte = await réponse.text().catch(() => '')
    throw new Error(`${méthode} ${chemin} : ${réponse.status} ${texte.slice(0, 300)}`)
  }
  return (await réponse.json()) as T
}

export type CibleDeProduction = { organisation: string; filiere?: undefined } | { filiere: string; organisation?: undefined }

/** Le dossier d'une parution : référentiel, sélection, gel des sources. */
export function lireLeDossier(cible: CibleDeProduction, mode: ModeDeProduction, dateÉdition?: string): Promise<DossierDeParution> {
  const paramètres = new URLSearchParams({ mode })
  if (cible.organisation) paramètres.set('organisation', cible.organisation)
  if (cible.filiere) paramètres.set('filiere', cible.filiere)
  if (dateÉdition) paramètres.set('dateEdition', dateÉdition)
  return appeler<DossierDeParution>('GET', `/api/veille/dossier?${paramètres.toString()}`)
}

export type DossierDUnTravail = DossierDeParution & {
  readonly travail: { readonly id: string; readonly type: 'lettre' | 'premiere_lettre'; readonly état: string; readonly mode: ModeDeProduction }
}

/** Le dossier du travail pris : l'organisation, le numéro et la date que la file a décidés. Le mode n'est forcé que pour la découverte. */
export function lireLeDossierDuTravail(travail: string, mode?: 'decouverte'): Promise<DossierDUnTravail> {
  const paramètres = new URLSearchParams({ travail })
  if (mode) paramètres.set('mode', mode)
  return appeler<DossierDUnTravail>('GET', `/api/veille/dossier?${paramètres.toString()}`)
}

// ── La file de travaux ───────────────────────────────────────────────────────

export type TravailPris = {
  readonly état: 'pris'
  readonly travail: {
    readonly id: string
    readonly type: 'lettre' | 'premiere_lettre' | string
    readonly tentatives: number
    readonly organisation: { readonly id: string; readonly slug: string; readonly registreNotion: string | null }
    readonly contexte: { readonly numéro?: number; readonly parution?: { readonly date: string; readonly semaine: string } }
  }
}

/**
 * Prend le prochain travail de la file, ou, avec `travail`, celui-là
 * précisément (onboarding, découverte). `null` quand la file est vide ou que
 * le travail désigné n'est pas prenable. La session est l'identifiant du run :
 * c'est elle qui devra conclure.
 */
export async function prendreUnTravail(session: string, travail?: string): Promise<TravailPris | null> {
  const { url, jeton } = portail()
  const réponse = await fetch(`${url}/api/veille/travaux`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action: 'prendre', session, ...(travail ? { travail } : {}) }),
  })
  if (réponse.status === 409) return null
  if (!réponse.ok) throw new Error(`POST /api/veille/travaux (prendre) : ${réponse.status}`)
  const corps = (await réponse.json()) as TravailPris | { état: 'vide' }
  return corps.état === 'pris' ? corps : null
}

/** Pose un travail de lettre pour une veille d'une organisation, à une date de parution ; rend son identifiant (créé ou déjà en file). */
export async function poserUnTravail(entrée: { slug: string; veille: string; type: 'lettre' | 'premiere_lettre'; parution: string }): Promise<{ état: string; travailId: string | null }> {
  const { url, jeton } = portail()
  const réponse = await fetch(`${url}/api/veille/travaux`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ action: 'poser', ...entrée }),
  })
  const corps = (await réponse.json().catch(() => ({}))) as { état?: string; travailId?: string }
  if (réponse.status !== 200 && réponse.status !== 201) throw new Error(`POST /api/veille/travaux (poser) : ${réponse.status} ${corps.état ?? ''}`)
  return { état: corps.état ?? 'inconnu', travailId: corps.travailId ?? null }
}

export function remettreLÉdition(remise: RemiseDÉdition): Promise<AccuséDeRemise> {
  return appeler<AccuséDeRemise>('POST', '/api/veille/editions', remise)
}

export function remettreLeRéférentiel(remise: RemiseDeRéférentiel): Promise<AccuséDeRemise> {
  return appeler<AccuséDeRemise>('POST', '/api/veille/referentiels', remise)
}

/** Les filières à produire ce jour : ce que le portail a décidé, la tâche ne décide rien. Les organisations passent par la file. */
export function lireLaSélectionDuJour(dateÉdition: string): Promise<{ organisations: string[]; filieres: string[] }> {
  return appeler('GET', `/api/veille/dossier?mode=selection&dateEdition=${dateÉdition}`)
}

/** Ouvre l'espace d'une organisation (lien d'accès), règle du 20 octobre 2026 : seulement après une lettre publiée. */
export async function ouvrirLEspace(email: string): Promise<void> {
  const { url, jeton } = portail()
  const réponse = await fetch(`${url}/api/acces/ouvrir`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!réponse.ok) throw new Error(`POST /api/acces/ouvrir : ${réponse.status}`)
}
