import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { lireLesUrls } from '@/scripts/collecte/lire-sources'

const PAGE = `<html><body><h1>Actualités</h1><p>Le programme d’accompagnement a été publié le 12 octobre 2026, avec un appel ouvert aux entreprises patrimoniales du territoire.</p><p>Une seconde phrase assez longue pour que la page soit comptée comme ouverte et lisible par la collecte en code.</p></body></html>`

const fauxFetch = (async (entrée: string | URL | Request) =>
  String(entrée).includes('ferme')
    ? new Response('', { status: 403 })
    : new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch

let dossier = ''
afterEach(() => {
  if (dossier) rmSync(dossier, { recursive: true, force: true })
})

describe('lireLesUrls', () => {
  it('écrit le texte de chaque page ouverte et l’index du lot, prêt pour la grille', async () => {
    dossier = mkdtempSync(join(tmpdir(), 'lot-'))
    const index = await lireLesUrls(['https://www.ouvert.fr/actus', 'https://ferme.fr/'], dossier, { avecNavigateur: false, fetch: fauxFetch })
    expect(index).toContain('2 source(s), 1 ouverte(s), 1 non ouverte(s).')
    expect(index).toContain('| 1 | https://www.ouvert.fr/actus | OUVERTE |')
    expect(index).toContain('dernière date visible : 12/10/2026')
    expect(index).toContain('| 2 | https://ferme.fr/ | NON OUVERTE | après requête simple et navigateur : http-403 |')
    expect(readdirSync(dossier).sort()).toEqual(['01-ouvert.fr.txt', 'index.md'])
    const page = readFileSync(join(dossier, '01-ouvert.fr.txt'), 'utf8')
    expect(page.split('\n')[0]).toBe('https://www.ouvert.fr/actus')
    expect(page).toContain('publié le 12 octobre 2026')
    expect(page).not.toContain('<p>')
  })

  it('refuse un lot vide', async () => {
    dossier = mkdtempSync(join(tmpdir(), 'lot-'))
    await expect(lireLesUrls([], dossier, { avecNavigateur: false })).rejects.toThrow('aucune adresse')
  })
})
