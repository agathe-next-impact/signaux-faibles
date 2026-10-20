import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANCRE_DE_DÉSINSCRIPTION, composerProspection, fichierLemlist, étapesLemlist } from '@/lib/email/lemlist'

const dossier = join(process.cwd(), 'docs', 'emails', 'lemlist')

/** L'adresse postale avec laquelle les fichiers du dépôt ont été générés, s'il y en a une. */
function adresseDuFichier(html: string): string | null {
  return /Next Impact Digital<\/a> · ([^\n<]+)\n/.exec(html)?.[1]?.trim() ?? null
}

describe('les emails lemlist', () => {
  it('les fichiers du dépôt sont ceux que le gabarit produit (pnpm emails:lemlist)', () => {
    const premier = readFileSync(join(dossier, 'sf-1-lettre.html'), 'utf8')
    for (const étape of étapesLemlist('https://www.signauxfaibles.io', adresseDuFichier(premier))) {
      expect(readFileSync(join(dossier, étape.fichier), 'utf8')).toBe(fichierLemlist(étape))
    }
  })

  it('portent les variables de la prospection, la désinscription à poser et aucun jeton', () => {
    const [lettre, relance, dernier] = étapesLemlist('https://www.signauxfaibles.io', null).map(fichierLemlist)
    expect(lettre).toContain('{{sfEssentiel}}')
    expect(lettre).toContain('white-space:pre-line')
    expect(relance).toContain('{{sfFaitMarquant}}')
    for (const html of [lettre, relance, dernier].map((h) => h ?? '')) {
      expect(html).toContain('Bonjour {{firstName}},')
      expect(html).toContain(`href="${ANCRE_DE_DÉSINSCRIPTION}"`)
      expect(html).toContain('href="https://www.signauxfaibles.io/recevoir-mon-lien"')
      expect(html).not.toContain('/acces/')
      expect(html.match(/class="btn-primary/g)).toHaveLength(1)
      expect(html).not.toContain('Gérer mon abonnement')
    }
  })
})

describe('les emails de prospection par Gmail', () => {
  const contexte = { portailUrl: 'https://www.signauxfaibles.io', adressePostale: null }
  const valeurs = { prénom: 'Serge', entreprise: 'Suneido & fils', essentiel: 'Ligne une.\nLigne <deux>.', faitMarquant: 'Le 14 octobre, un fait.' }

  it('remplit les variables, échappe les valeurs et ne laisse aucune accolade', () => {
    const un = composerProspection({ étape: 1, ...valeurs }, contexte)
    expect(un.objet).toBe('Suneido & fils : ce que votre veille a relevé cette semaine')
    expect(un.html).toContain('Bonjour Serge,')
    expect(un.html).toContain('Suneido &amp; fils')
    expect(un.html).toContain('Ligne une.\nLigne &lt;deux&gt;.')
    expect(un.html).not.toContain('{{')
    expect(un.texte).toContain('Ligne <deux>.')
    expect(un.texte).not.toContain('{{')
  })

  it('remplace la désinscription en un clic par une réponse STOP', () => {
    for (const étape of [1, 2, 3] as const) {
      const { html } = composerProspection({ étape, ...valeurs }, contexte)
      expect(html).toContain('href="mailto:agathe@signauxfaibles.io?subject=STOP"')
      expect(html).toContain('répondez STOP')
      expect(html).not.toContain('en un clic')
      expect(html).not.toContain(ANCRE_DE_DÉSINSCRIPTION)
      expect(html).toContain('href="https://www.signauxfaibles.io/recevoir-mon-lien"')
    }
  })

  it('salue sans prénom, et exige le texte propre à chaque étape', () => {
    expect(composerProspection({ étape: 3, ...valeurs, prénom: null }, contexte).html).toContain('Bonjour,')
    expect(() => composerProspection({ étape: 1, ...valeurs, essentiel: ' ' }, contexte)).toThrow()
    expect(() => composerProspection({ étape: 2, ...valeurs, faitMarquant: null }, contexte)).toThrow()
  })
})
