import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANCRE_DE_DÉSINSCRIPTION, fichierLemlist, étapesLemlist } from '@/lib/email/lemlist'

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
