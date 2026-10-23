import { describe, expect, it } from 'vitest'
import type { Lecture } from '@/lib/moteur/collecte'
import {
  datesVues,
  élargissementsDe,
  fichierDeLecture,
  indexDuLot,
  lignesDuLot,
  lireFaits,
  lireGrille,
  synthèseDuRéférentiel,
} from '@/lib/moteur/grille'

describe('datesVues', () => {
  it('lit les trois écritures françaises et l’ISO, de la plus récente à la plus ancienne', () => {
    const texte = 'Publié le 1er octobre 2026. Mis à jour le 15/10/2026. Archive 2025-08-28. Voir aussi 3.09.2024.'
    expect(datesVues(texte, '2026-10-23')).toEqual(['2026-10-15', '2026-10-01', '2025-08-28', '2024-09-03'])
  })

  it('écarte une date future, qui est une échéance et non une publication', () => {
    expect(datesVues('Clôture le 30 octobre 2026, annonce du 20 octobre 2026', '2026-10-23')).toEqual(['2026-10-20'])
  })

  it('écarte une date impossible et dédoublonne', () => {
    expect(datesVues('31/02/2026, 12 mars 2026 et 12/03/2026', '2026-10-23')).toEqual(['2026-03-12'])
  })

  it('ignore la casse et accepte les mois sans accent', () => {
    expect(datesVues('Le 2 Fevrier 2026 et le 9 AOUT 2025', '2026-10-23')).toEqual(['2026-02-02', '2025-08-09'])
  })
})

describe('le lot lu en code', () => {
  const lecture = (url: string, état: string, texte = ''): Lecture => ({
    url,
    état,
    luLe: '2026-10-23T09:00:00.000Z',
    texte,
    empreinte: '',
    nouveautés: [],
    changée: null,
  })

  it('nomme le fichier d’une source par son rang et son domaine', () => {
    expect(fichierDeLecture(3, 'https://www.boamp.fr/avis/123')).toBe('03-boamp.fr.txt')
    expect(fichierDeLecture(12, 'pas une url')).toBe('12-source.txt')
  })

  it('classe OUVERTE avec la dernière date visible, NON OUVERTE avec les deux essais, jamais RAS', () => {
    const lignes = lignesDuLot(
      [
        lecture('https://a.fr/', 'ouverte', 'Actualité du 12 octobre 2026. '.repeat(10)),
        lecture('https://b.fr/', 'ouverte-navigateur', 'Rien de daté. '.repeat(20)),
        lecture('https://c.fr/', 'http-403+navigateur-403'),
      ],
      '2026-10-23',
    )
    expect(lignes[0]).toMatchObject({ état: 'OUVERTE', fichier: '01-a.fr.txt', dernièreDate: '2026-10-12' })
    expect(lignes[0]!.détail).toContain('requête simple')
    expect(lignes[0]!.détail).toContain('12/10/2026')
    expect(lignes[1]!.détail).toContain('navigateur')
    expect(lignes[1]!.détail).toContain('dernière date visible : aucune')
    expect(lignes[2]).toMatchObject({ état: 'NON OUVERTE', fichier: null })
    expect(lignes[2]!.détail).toContain('http-403+navigateur-403')
    const index = indexDuLot(lignes)
    expect(index).toContain('3 source(s), 2 ouverte(s), 1 non ouverte(s).')
    expect(index).not.toMatch(/\bRAS\b/)
  })

  it('rend « à relancer » une source que l’échéance du lot a empêché d’essayer, jamais « non ouverte »', () => {
    const lignes = lignesDuLot([lecture('https://d.fr/', 'delai-du-lot')], '2026-10-23')
    expect(lignes[0]).toMatchObject({ état: 'À RELANCER', fichier: null })
    expect(indexDuLot(lignes)).toContain('1 source(s), 0 ouverte(s), 0 non ouverte(s), 1 à relancer.')
  })
})

const GRILLE_C1 = `# Grille c1

| Référentiel | Section et famille | Élément (source, requête, entité, dossier, échéance) | État | Détail |
|---|---|---|---|---|
| Concurrentiel | §1 ① | Entreprise et Découverte | OUVERTE | lue le 23/10/2026 |
| Concurrentiel | §1 ① | Requête 1 | REQUÊTÉE | aucun résultat daté |
| Concurrentiel | §1 ② | Pappers Histovery | NON OUVERTE | 403 au navigateur |
| Concurrentiel | §1 ② | Requête 9 |  | |

## Élargissements

- Famille ② : élargie à 90 jours, aucun fait dans la fenêtre.
`

const GRILLE_E1 = `| Référentiel | Section et famille | Élément | État | Détail |
|---|---|---|---|---|
| Écosystème | §1 ① | Région | Ouverte | lue |
| Écosystème | §1 ② | Bpifrance | non ouverte | 403 CloudFront |
`

const FAITS_C1 = `### Emerige et la collection Renault
- Référentiel : Concurrentiel
- Famille : ① projets numériques patrimoniaux des entreprises
- Date du fait : 17/10/2026
- Nouveau ou contexte : nouveau (dans la fenêtre)
- Source : https://exemple.fr/emerige
- Extrait : « … »

### RAS motivé : niche EPV
Vérifié sur la liste des EPV, dernière publication le 19/09/2026.
`

const FAITS_E1 = `### Ici, nos savoir-faire
- Référentiel : Écosystème
- Famille : ① tourisme de savoir-faire
- Nouveau ou contexte : élément de contexte, non nouveau
`

const FAITS_X = `### RAS motivé : base Extraits fournis
- Vérifié : aucune ligne.
`
const GRILLE_X = `| Référentiel | Section et famille | Élément | État | Détail |
|---|---|---|---|---|
| Les deux | canaux | Extraits fournis | REQUÊTÉE | vide |
| Concurrentiel | requêtes générales | Requête 10 | REQUÊTÉE | rien |
`

describe('lireGrille', () => {
  it('lit les lignes au format de la consigne et reconnaît les états, NON OUVERTE avant OUVERTE', () => {
    const lignes = lireGrille(GRILLE_C1)
    expect(lignes.map((l) => l.état)).toEqual(['OUVERTE', 'REQUÊTÉE', 'NON OUVERTE', null])
    expect(lireGrille(GRILLE_E1).map((l) => l.état)).toEqual(['OUVERTE', 'NON OUVERTE'])
  })

  it('lit le bloc des élargissements', () => {
    expect(élargissementsDe(GRILLE_C1)).toEqual(['- Famille ② : élargie à 90 jours, aucun fait dans la fenêtre.'])
    expect(élargissementsDe(GRILLE_E1)).toEqual([])
  })
})

describe('lireFaits', () => {
  it('découpe les blocs et lit leurs champs', () => {
    const faits = lireFaits(FAITS_C1)
    expect(faits).toHaveLength(2)
    expect(faits[0]!.titre).toBe('Emerige et la collection Renault')
    expect(faits[0]!.champs['Date du fait']).toBe('17/10/2026')
    expect(faits[1]!.champs['Référentiel']).toBeUndefined()
  })
})

describe('synthèseDuRéférentiel', () => {
  const grilles = [
    { nom: 'c1', markdown: GRILLE_C1 },
    { nom: 'e1', markdown: GRILLE_E1 },
    { nom: 'x', markdown: GRILLE_X },
  ]
  const faits = [
    ...lireFaits(FAITS_C1).map((fait) => ({ lot: 'c1', fait })),
    ...lireFaits(FAITS_E1).map((fait) => ({ lot: 'e1', fait })),
    ...lireFaits(FAITS_X).map((fait) => ({ lot: 'x', fait })),
  ]

  it('compte la grille de sa lettre et signale la ligne vide', () => {
    const s = synthèseDuRéférentiel(grilles, faits, 'Concurrentiel')
    expect(s.lignes).toBe(5)
    expect(s.vides).toBe(1)
    expect(s.markdown).toContain('1 ligne(s) sans état')
    expect(s.markdown).toContain('Pappers Histovery : 403 au navigateur')
    expect(s.markdown).toContain('c1 : Famille ② : élargie à 90 jours')
  })

  it('range les faits de sa lettre, rattache un RAS à son lot, garde les communs et les seuls titres de l’autre lettre', () => {
    const s = synthèseDuRéférentiel(grilles, faits, 'Concurrentiel')
    expect(s).toMatchObject({ faitsNouveaux: 1, faitsDeContexte: 0, constats: 1 })
    expect(s.markdown).toContain('#### Emerige et la collection Renault')
    expect(s.markdown).toContain('#### RAS motivé : niche EPV')
    // Le lot x porte sur les deux lettres : son RAS est commun.
    expect(s.markdown).toMatch(/Communs aux deux lettres[\s\S]*#### RAS motivé : base Extraits fournis/)
    // L'autre lettre : le titre, jamais le bloc.
    expect(s.markdown).toContain('- Ici, nos savoir-faire (① tourisme de savoir-faire)')
    expect(s.markdown).not.toContain('#### Ici, nos savoir-faire')
  })

  it('accents et casse ignorés sur le nom du référentiel', () => {
    const s = synthèseDuRéférentiel(grilles, faits, 'Écosystème')
    expect(s).toMatchObject({ lignes: 2, vides: 0, faitsNouveaux: 0, faitsDeContexte: 1 })
    expect(s.markdown).toContain('Bpifrance : 403 CloudFront')
    expect(s.markdown).toContain('Aucune ligne vide.')
  })
})
