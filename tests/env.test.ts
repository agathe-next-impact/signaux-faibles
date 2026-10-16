import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { env, reinitialiserEnv } from '@/lib/env'

/**
 * Le contrat des variables d'environnement, et surtout sa tolérance.
 *
 * Une variable facultative posée vide dans l'hébergeur doit valoir une
 * variable absente : c'est ce que `.env.example` demande d'écrire, et c'est ce
 * qui faisait tomber toutes les pages avant le 14 octobre 2026.
 */

const COMPLET: Record<string, string> = {
  NOTION_TOKEN: 'ntn_test',
  NOTION_BASE_EDITIONS: 'editions',
  NOTION_BASE_ACCES: 'acces',
  ACCES_SECRET_HMAC: 'x'.repeat(48),
  PORTAIL_URL: 'https://portail.test',
  GOOGLE_COMPTE_SERVICE_JSON: '{"type":"service_account"}',
  GMAIL_EXPEDITEUR: 'acces@portail.test',
}

const CLÉS = [
  ...Object.keys(COMPLET),
  'NOTION_WEBHOOK_SECRET',
  'GOOGLE_COMPTE_SERVICE_EMAIL',
  'GOOGLE_COMPTE_SERVICE_CLE_PRIVEE',
  'GMAIL_EXPEDITEUR_NOM',
]

const sauvegarde = new Map<string, string | undefined>()

function poser(valeurs: Record<string, string | undefined>): void {
  for (const clé of CLÉS) {
    const valeur = valeurs[clé]
    if (valeur === undefined) delete process.env[clé]
    else process.env[clé] = valeur
  }
}

describe('env()', () => {
  beforeEach(() => {
    for (const clé of CLÉS) sauvegarde.set(clé, process.env[clé])
    reinitialiserEnv()
  })

  afterEach(() => {
    poser(Object.fromEntries(sauvegarde))
    reinitialiserEnv()
  })

  it('accepte une configuration complète minimale', () => {
    poser(COMPLET)
    expect(env().PORTAIL_URL).toBe('https://portail.test')
    expect(env().GMAIL_EXPEDITEUR_NOM).toBe('signauxfaibles')
    expect(env().NOTION_WEBHOOK_SECRET).toBeUndefined()
  })

  it('traite une variable facultative vide comme absente', () => {
    poser({
      ...COMPLET,
      NOTION_WEBHOOK_SECRET: '',
      GOOGLE_COMPTE_SERVICE_EMAIL: '',
      GOOGLE_COMPTE_SERVICE_CLE_PRIVEE: '',
      GMAIL_EXPEDITEUR_NOM: '',
    })
    expect(() => env()).not.toThrow()
    expect(env().GOOGLE_COMPTE_SERVICE_EMAIL).toBeUndefined()
    expect(env().GMAIL_EXPEDITEUR_NOM).toBe('signauxfaibles')
  })

  it('refuse un compte de service absent sous ses deux formes', () => {
    poser({ ...COMPLET, GOOGLE_COMPTE_SERVICE_JSON: '' })
    expect(() => env()).toThrow(/GOOGLE_COMPTE_SERVICE_JSON/)
  })

  it('accepte la voie de repli email + clé privée', () => {
    poser({
      ...COMPLET,
      GOOGLE_COMPTE_SERVICE_JSON: '',
      GOOGLE_COMPTE_SERVICE_EMAIL: 'robot@projet.iam.gserviceaccount.com',
      GOOGLE_COMPTE_SERVICE_CLE_PRIVEE: '-----BEGIN PRIVATE KEY-----',
    })
    expect(() => env()).not.toThrow()
  })

  it('refuse un secret de signature trop court', () => {
    poser({ ...COMPLET, ACCES_SECRET_HMAC: 'court' })
    expect(() => env()).toThrow(/ACCES_SECRET_HMAC/)
  })

  it('ne mémoïse pas un échec', () => {
    poser({ ...COMPLET, PORTAIL_URL: 'pas une url' })
    expect(() => env()).toThrow()
    poser(COMPLET)
    expect(() => env()).not.toThrow()
  })
})

describe('variables du palier 1', () => {
  const clés = ['SOURCE_ACCES', 'DATABASE_URL']
  const avant = new Map<string, string | undefined>()

  beforeEach(() => {
    for (const clé of [...CLÉS, ...clés]) avant.set(clé, process.env[clé])
    reinitialiserEnv()
  })

  afterEach(() => {
    for (const [clé, valeur] of avant) {
      if (valeur === undefined) delete process.env[clé]
      else process.env[clé] = valeur
    }
    reinitialiserEnv()
  })

  it('une faute de frappe dans SOURCE_ACCES ne fait pas tomber l’environnement', () => {
    poser(COMPLET)
    process.env.SOURCE_ACCES = 'postgre'
    expect(() => env()).not.toThrow()
  })

  it('une base pas encore créée, variable vide, vaut une base absente', () => {
    poser(COMPLET)
    process.env.DATABASE_URL = ''
    expect(env().DATABASE_URL).toBeUndefined()
  })
})
