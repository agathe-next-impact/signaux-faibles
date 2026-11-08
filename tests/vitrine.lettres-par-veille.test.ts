import { describe, expect, it } from 'vitest'
import type { CléDeDémonstration } from '@/lib/domaine/demonstration'
import { détacherLeNuméro } from '@/lib/domaine/impact'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { DÉMONSTRATIONS } from '@/lib/vitrine/demonstrations'
import { lettreDeLaSemaine, titreDeLaLettre, VEILLES_DE_DÉMONSTRATION } from '@/lib/vitrine/lettres-par-veille'

const CLÉS: readonly CléDeDémonstration[] = ['conseil', 'pme', 'ess']

function titresDesAxes(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((ligne) => ligne.startsWith('## '))
    .map((ligne) => ligne.slice(3))
}

describe('les deux lettres de la semaine de chaque démonstration', () => {
  for (const clé of CLÉS) {
    const d = DÉMONSTRATIONS.find((d) => d.clé === clé)!

    it(`${clé} : chaque lettre passe le lint du dispositif en service, sans rupture ni avertissement`, () => {
      for (const veille of VEILLES_DE_DÉMONSTRATION) {
        const lettre = lettreDeLaSemaine(clé, veille)
        const verdict = contrôlerLaLettre({
          titre: titreDeLaLettre(clé, lettre),
          numéro: lettre.numéro,
          blocs: markdownVersBlocs(lettre.markdown),
          dossiersBruts: lettre.dossiers,
        })
        expect(verdict.ruptures, veille).toEqual([])
        expect(verdict.avertissements.map((a) => `${a.code} : ${a.message}`), veille).toEqual([])
      }
    })

    it(`${clé} : les axes de la lettre unique sont répartis selon la grille, chacun dans une seule lettre, renumérotés`, () => {
      const écosystème = lettreDeLaSemaine(clé, 'ecosysteme')
      const concurrentielle = lettreDeLaSemaine(clé, 'concurrentielle')
      const axesUniques = titresDesAxes(d.markdown)
      expect([...écosystème.axesRepris, ...concurrentielle.axesRepris].sort((a, b) => a - b)).toEqual(axesUniques.map((_, i) => i + 1))
      for (const n of concurrentielle.axesRepris) expect('porter' in d.grille.axes[n]!, `axe ${n}`).toBe(true)
      for (const n of écosystème.axesRepris) expect(d.grille.axes[n] === undefined || 'pestel' in d.grille.axes[n]!, `axe ${n}`).toBe(true)
      for (const lettre of [écosystème, concurrentielle]) {
        const titres = titresDesAxes(lettre.markdown)
        titres.forEach((titre, i) => {
          expect(détacherLeNuméro(titre).numéro).toBe(i + 1)
          expect(détacherLeNuméro(titre).reste).toBe(détacherLeNuméro(axesUniques[lettre.axesRepris[i]! - 1]!).reste)
        })
      }
    })

    it(`${clé} : les deux lettres portent le numéro, la date et la période de la dernière lettre unique`, () => {
      for (const veille of VEILLES_DE_DÉMONSTRATION) {
        const lettre = lettreDeLaSemaine(clé, veille)
        expect(lettre.numéro).toBe(d.numéro)
        expect(lettre.dateÉdition).toBe(d.dateÉdition)
        expect(lettre.périodeCouverte).toBe(d.périodeCouverte)
        expect(lettre.markdown).not.toContain('Exemple')
      }
    })
  }
})
