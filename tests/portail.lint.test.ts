import { describe, expect, it } from 'vitest'
import type { BlocNotion } from '@/lib/domaine/document'
import { ADRESSE_DU_CADRAGE, PHRASE_DE_CLÔTURE, contrôlerLaLettre } from '@/lib/portail/lint'
import { BLOCS_RÉELS, DOSSIERS_RÉELS } from './fixtures/lettre-reelle'

const texte = (contenu: string) => [{ plain_text: contenu }]
let n = 0
const bloc = (type: string, contenu = ''): BlocNotion => ({
  id: `b${(n += 1)}`,
  type,
  [type]: { rich_text: texte(contenu) },
})
const h1 = (t: string) => bloc('heading_1', t)
const h2 = (t: string) => bloc('heading_2', t)
const p = (t: string) => bloc('paragraph', t)
const encadré = (t: string) => bloc('callout', t)
const trait = () => bloc('divider')

const CLÔTURE =
  `${PHRASE_DE_CLÔTURE}. Pour demander vous-même une modification du cadrage — ajouter ou ` +
  `retirer un sujet suivi, une source, un acteur, un territoire, ou changer ce qui doit compter ` +
  `comme important — écrivez à ${ADRESSE_DU_CADRAGE}.`

/** Une lettre au contrat, telle que la page « Tâche — Lettres de veille » la prescrit. */
function lettreConforme(): BlocNotion[] {
  return [
    p('Brouillon à relire — ne pas transférer avant relecture.'),
    h1('L’essentiel'),
    p('Le décret est paru le 12 septembre.'),
    h1('Actualités par axe'),
    h2('① Commande publique — FORT'),
    p('Le règlement marchés publics est présenté le 9 septembre.'),
    h2('② Financements — MOYEN'),
    p('La circulaire DETR 2027 est attendue vers le 20 octobre.'),
    h2('③ Gouvernance — RAS'),
    // Le RAS motivé s'écrit en encadré : ce n'est pas un fait (convention du
    // 21 septembre 2026), et le portail ne le cite nulle part hors de la lettre.
    encadré('La CADA n’a rien publié depuis le 3 juillet.'),
    h1('La recommandation de la période'),
    p('Écrire à la préfecture avant le vendredi 18 septembre.'),
    h1('Ajustements du cadrage de cette veille'),
    p('Aucun ajustement n’est proposé cette période.'),
    p(CLÔTURE),
    trait(),
    p('Dossiers suivis : règlement marchés publics, CADA, circulaire DETR 2027.'),
  ]
}

const DOSSIERS_CONFORMES =
  'règlement marchés publics (0) · CADA (1, rapporteurs identifiés) · circulaire DETR 2027 (2, non publiée)'

describe('contrôlerLaLettre — une lettre au contrat', () => {
  const rapport = contrôlerLaLettre({
    titre: 'Veille Test — Écosystème — jeudi 17 septembre 2026',
    blocs: lettreConforme(),
    dossiersBruts: DOSSIERS_CONFORMES,
  })

  it('est conforme, sans rupture ni avertissement', () => {
    expect(rapport.ruptures).toEqual([])
    expect(rapport.avertissements).toEqual([])
    expect(rapport.conforme).toBe(true)
  })

  it('rend les axes tels que le portail les lira : numéro, nom, niveau', () => {
    expect(rapport.aperçu.axes).toEqual([
      { numéro: 1, titre: 'Commande publique', niveau: 'FORT' },
      { numéro: 2, titre: 'Financements', niveau: 'MOYEN' },
      { numéro: 3, titre: 'Gouvernance', niveau: 'RAS' },
    ])
  })

  it('rend les dossiers avec compteur, et dit qu’ils sont nommés dans le corps', () => {
    expect(rapport.aperçu.dossiers.map((d) => [d.nom, d.compteur, d.nommé])).toEqual([
      ['règlement marchés publics', 0, true],
      ['CADA', 1, true],
      ['circulaire DETR 2027', 2, true],
    ])
    expect(rapport.avertissements).toEqual([])
  })

  it('voit le cadrage présent, clos par le trait, avec la phrase de clôture', () => {
    expect(rapport.aperçu.cadrage).toEqual({ présent: true, clos: true, phraseDeClôture: true })
  })
})

describe('contrôlerLaLettre — les ruptures du 11 septembre 2026, nommées avant l’envoi', () => {
  it('un corps sans aucun H2 : aucun axe', () => {
    const blocs = lettreConforme().filter((b) => b.type !== 'heading_2')
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.conforme).toBe(false)
    expect(rapport.ruptures.map((r) => r.code)).toContain('aucun-axe')
  })

  it('des dossiers au format « nom — précision — compteur » : aucun compteur exploitable', () => {
    const rapport = contrôlerLaLettre({
      titre: 't',
      blocs: lettreConforme(),
      dossiersBruts: 'CADA — rapporteurs identifiés — 1 | Loi Résilience — au Sénat — 0',
    })
    const codes = rapport.ruptures.map((r) => r.code)
    expect(codes).toContain('dossier-sans-compteur')
    // Une seule rupture globale, pas une par dossier en plus.
    expect(codes.filter((c) => c === 'dossier-sans-compteur')).toHaveLength(1)
  })

  it('un seul dossier illisible parmi d’autres est nommé lui-même', () => {
    const rapport = contrôlerLaLettre({
      titre: 't',
      blocs: lettreConforme(),
      dossiersBruts: 'CADA (1) · circulaire DETR 2027 — non publiée — 2',
    })
    const ruptures = rapport.ruptures.filter((r) => r.code === 'dossier-sans-compteur')
    expect(ruptures).toHaveLength(1)
    expect(ruptures[0]?.message).toContain('circulaire DETR 2027 — non publiée — 2')
  })

  it('un impact écrit dans la prose et un H2 sans suffixe : axe sans niveau', () => {
    const blocs = lettreConforme().map((b) =>
      b.type === 'heading_2' && (b.heading_2 as { rich_text: Array<{ plain_text: string }> }).rich_text[0]?.plain_text.startsWith('①')
        ? h2('① Commande publique')
        : b,
    )
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    const rupture = rapport.ruptures.find((r) => r.code === 'axe-sans-niveau')
    expect(rupture?.portée).toBe('portail')
    expect(rupture?.message).toContain('Commande publique')
  })

  it('FAIBLE n’existe pas', () => {
    const blocs = lettreConforme().map((b) =>
      b.type === 'heading_2' ? (b.id.endsWith('7') ? h2('② Financements — FAIBLE') : b) : b,
    )
    // Le remplacement ci-dessus dépend des identifiants ; on force un cas sûr.
    blocs.splice(blocs.findIndex((b) => b.type === 'heading_2'), 1, h2('① Commande publique — FAIBLE'))
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    const rupture = rapport.ruptures.find((r) => r.code === 'niveau-faible')
    expect(rupture?.portée).toBe('lettre')
  })
})

describe('contrôlerLaLettre — le bloc de cadrage', () => {
  it('absent : rupture, l’écran Cadrage serait vide', () => {
    const blocs = lettreConforme()
    const début = blocs.findIndex((b) => b.type === 'heading_1' && (b.heading_1 as { rich_text: Array<{ plain_text: string }> }).rich_text[0]?.plain_text.includes('cadrage'))
    blocs.splice(début, 4)
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.ruptures.map((r) => r.code)).toContain('cadrage-absent')
    expect(rapport.aperçu.cadrage.présent).toBe(false)
  })

  it('sans trait horizontal : rupture, le pied de lettre partirait avec le cadrage', () => {
    const blocs = lettreConforme().filter((b) => b.type !== 'divider')
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.ruptures.map((r) => r.code)).toContain('cadrage-non-clos')
    expect(rapport.aperçu.cadrage).toMatchObject({ présent: true, clos: false })
  })

  it('sans la phrase de clôture : rupture de portée lettre', () => {
    const blocs = lettreConforme().map((b) =>
      b.type === 'paragraph' && (b.paragraph as { rich_text: Array<{ plain_text: string }> }).rich_text[0]?.plain_text === CLÔTURE
        ? p('Écrivez-nous pour toute modification.')
        : b,
    )
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    const rupture = rapport.ruptures.find((r) => r.code === 'cadrage-sans-adresse')
    expect(rupture?.portée).toBe('lettre')
    expect(rapport.aperçu.cadrage.phraseDeClôture).toBe(false)
  })

  it('accepte l’apostrophe droite comme la typographique dans la phrase verbatim', () => {
    const blocs = lettreConforme().map((b) =>
      b.type === 'paragraph' && (b.paragraph as { rich_text: Array<{ plain_text: string }> }).rich_text[0]?.plain_text === CLÔTURE
        ? p(CLÔTURE.replaceAll('’', "'"))
        : b,
    )
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.aperçu.cadrage.phraseDeClôture).toBe(true)
  })
})

describe('contrôlerLaLettre — les avertissements', () => {
  it('un dossier que le corps ne nomme pas', () => {
    const rapport = contrôlerLaLettre({
      titre: 't',
      blocs: lettreConforme(),
      dossiersBruts: `${DOSSIERS_CONFORMES} · Maison de santé (3)`,
    })
    expect(rapport.conforme).toBe(true)
    const avertissement = rapport.avertissements.find((a) => a.code === 'dossier-non-nommé')
    expect(avertissement?.message).toContain('Maison de santé')
    expect(rapport.aperçu.dossiers.find((d) => d.nom === 'Maison de santé')?.nommé).toBe(false)
  })

  it('des axes hors de « Actualités par axe »', () => {
    const blocs = lettreConforme()
    blocs.splice(2, 0, h2('⓪ Hors rubrique — MOYEN'), p('Un fait.'))
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.conforme).toBe(true)
    expect(rapport.avertissements.map((a) => a.code)).toContain('axes-hors-rubrique')
  })

  it('un axe RAS dont le corps est en prose : absence en prose, non bloquant', () => {
    // Le cas du 21 septembre 2026 : le RAS motivé écrit en paragraphes était
    // rendu sur la page de l'axe et cité sur la page de chaque acteur nommé,
    // comme un fait. Le contrat de forme ne casse pas — la lettre s'affiche —,
    // mais la relectrice doit le savoir avant l'envoi.
    const blocs = lettreConforme()
    const rang = blocs.findIndex((b) => b.type === 'callout')
    blocs[rang] = p('La CADA n’a rien publié depuis le 3 juillet.')
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.conforme).toBe(true)
    const avertissement = rapport.avertissements.find((a) => a.code === 'absence-en-prose')
    expect(avertissement?.message).toContain('Gouvernance')
    expect(avertissement?.message).toContain('encadré')
  })

  it('un axe FORT dont le corps mêle un fait et un encadré : rien à signaler', () => {
    const blocs = lettreConforme()
    const rang = blocs.findIndex((b) => b.type === 'heading_2' && String((b['heading_2'] as { rich_text: { plain_text: string }[] }).rich_text[0]?.plain_text).includes('Commande'))
    blocs.splice(rang + 2, 0, encadré('Le site du ministère ne s’est pas ouvert pendant ce relevé.'))
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.avertissements.map((a) => a.code)).not.toContain('absence-en-prose')
  })

  it('une numérotation interne citée dans le corps', () => {
    const blocs = lettreConforme()
    blocs.splice(3, 0, p('Voir le §2 du référentiel.'))
    const rapport = contrôlerLaLettre({ titre: 't', blocs, dossiersBruts: DOSSIERS_CONFORMES })
    expect(rapport.avertissements.find((a) => a.code === 'référence-interne')?.message).toContain('§2')
  })
})

describe('contrôlerLaLettre — sur la lettre réelle d’Infralliance', () => {
  it('lit les mêmes dossiers que le portail et nomme ce qui manque', () => {
    const rapport = contrôlerLaLettre({
      titre: 'Veille Infralliance — Écosystème — mardi 8 septembre 2026',
      blocs: BLOCS_RÉELS,
      dossiersBruts: DOSSIERS_RÉELS,
    })
    expect(rapport.aperçu.dossiers).toHaveLength(10)
    expect(rapport.aperçu.dossiers.every((d) => d.compteur !== null)).toBe(true)
    // La lettre du 8 septembre porte son bloc de cadrage, clos par le trait,
    // mais elle est antérieure à la phrase de clôture du 10 septembre : c'est
    // exactement ce que le rapport doit dire, et rien d'autre.
    expect(rapport.ruptures.map((r) => r.code)).toEqual(['cadrage-sans-adresse'])
    expect(rapport.aperçu.cadrage).toMatchObject({ présent: true, clos: true })
    // Ses axes sont sous « Actualités par famille », l'ancien titre : avertissement, pas rupture.
    expect(rapport.avertissements.map((a) => a.code)).toContain('axes-hors-rubrique')
  })
})
