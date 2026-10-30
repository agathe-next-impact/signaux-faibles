import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * L'échelle d'espacement de la charte (§04, amendement du 30 octobre 2026) :
 * sept valeurs, 4, 8, 12, 16, 24, 32 et 48 px, soit les utilitaires Tailwind
 * 1, 2, 3, 4, 6, 8 et 12 (plus 0 et `px`). Un marge, un retrait ou un écart
 * hors de l'échelle réintroduirait les écarts de quelques pixels d'un écran à
 * l'autre. Les valeurs entre crochets restent admises : elles alignent sur la
 * police (`em`) ou sur l'appareil (`env()`, `var()`), pas sur la grille.
 */
const ÉCHELLE = new Set(['0', '1', '2', '3', '4', '6', '8', '12'])
const UTILITAIRE =
  /(?<![\w.[-])-?(?:[a-z0-9]+:)*(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)(?![\w.\]/-])/g

function fichiersTsx(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiersTsx(chemin)
    return nom.endsWith('.tsx') ? [chemin] : []
  })
}

describe('échelle d’espacement', () => {
  it('aucun écart, marge ni retrait hors des sept valeurs de la charte', () => {
    const écarts = ['components', 'app'].flatMap((d) =>
      fichiersTsx(join(process.cwd(), d)).flatMap((f) =>
        [...readFileSync(f, 'utf8').matchAll(UTILITAIRE)]
          .filter((m) => !ÉCHELLE.has(m[1]!))
          .map((m) => `${relative(process.cwd(), f)} : ${m[0]}`),
      ),
    )
    expect(écarts).toEqual([])
  })
})
