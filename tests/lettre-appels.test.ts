import { describe, expect, it } from 'vitest'
import type { BlocNotion } from '@/lib/domaine/document'
import { CADENCE_DES_APPELS, sélectionnerLesAppels } from '@/lib/domaine/calendrier'
import { TÂCHE_DE_LA_CONSIGNE, lireUneConsigne } from '@/lib/domaine/onboarding'
import { tronquerÀLEssentiel } from '@/lib/domaine/troncature'
import { construireDocument } from '@/lib/domaine/document'
import { contexteDesFamilles, estFamilleDAppels, FAMILLE_DES_APPELS, FAMILLES } from '@/lib/portail/contexte'
import { contrôlerLaLettre, datesDUnTexte } from '@/lib/portail/lint'
import type { ÉditionDeTravail } from '@/lib/notion/travail'
import { CONSIGNE_DE_LA_LETTRE_D_APPELS, CONSIGNE_DES_APPELS, texteDeLaConsigne } from '../scripts/taches/pointeurs'
import { lireLaCommande } from '../scripts/taches/executer'

/**
 * La lettre d'appels à projets (17 novembre 2026, `docs/lettre-appels-a-projets.md`,
 * lots 1 et 2) : une troisième famille, à la quinzaine, avec quatre règles du lint
 * qui ne valent que pour elle.
 */

type Morceau = { plain_text: string; href?: string | null; annotations?: { bold?: boolean } }
let n = 0
const bloc = (type: string, morceaux: Morceau[] = []): BlocNotion => ({ id: `a${(n += 1)}`, type, [type]: { rich_text: morceaux } })
const t = (texte: string): Morceau => ({ plain_text: texte })
const gras = (texte: string): Morceau => ({ plain_text: texte, annotations: { bold: true } })
const lien = (texte: string, href: string): Morceau => ({ plain_text: texte, href })
const h1 = (texte: string) => bloc('heading_1', [t(texte)])
const h2 = (texte: string) => bloc('heading_2', [t(texte)])
const p = (...morceaux: Morceau[]) => bloc('paragraph', morceaux)
const puce = (texte: string) => bloc('bulleted_list_item', [t(texte)])
const encadré = (texte: string) => bloc('callout', [t(texte)])

const APPEL_URL = 'https://www.auvergnerhonealpes.fr/aides/appel-a-projets-tiers-lieux'

/** Un appel au format de la lettre : phrase-titre en gras, pourquoi vous, arguments, pièces. */
function appel(options: { titre?: string; url?: string | null; arguments?: boolean } = {}): BlocNotion[] {
  const blocs: BlocNotion[] = [
    p(gras(options.titre ?? 'Région Auvergne-Rhône-Alpes, appel à projets « Tiers-lieux 2027 », 30 000 € au plus, clôture le 15 janvier 2027.')),
    p(t('Pourquoi vous : établissement public du Cantal, porteur d’actions d’animation territoriale (à vérifier : cofinancement de 20 %).')),
  ]
  if (options.arguments !== false) {
    blocs.push(p(t('Arguments :')))
    blocs.push(puce('Le programme d’accompagnement des commerces ruraux, lancé le 4 novembre 2026.'))
    blocs.push(puce('La force publiée du Diagnostic : présence dans les quinze bassins de vie.'))
  }
  blocs.push(
    options.url === null
      ? p(t('Pièces et calendrier : dossier en ligne, délibération du bureau.'))
      : p(t('Pièces et calendrier : dossier en ligne, délibération du bureau ('), lien('page de l’appel', options.url ?? APPEL_URL), t(').')),
  )
  return blocs
}

function lettreDAppels(appels: BlocNotion[] = appel()): BlocNotion[] {
  return [
    h1('L’essentiel'),
    p(t('Tiers-lieux 2027 : dépôt avant le 15 janvier 2027.')),
    h1('Actualités par axe'),
    h2('① Région et fonds européens — FORT'),
    ...appels,
    h2('② État et opérateurs nationaux — RAS'),
    encadré('Aucun appel ouvert à un établissement consulaire sur les pages de l’ANCT et de l’ADEME, relevées le 16 novembre.'),
    h1('Action de la semaine'),
    p(t('Réunir le bureau avant le 10 décembre pour délibérer sur le dépôt.')),
  ]
}

const contrôler = (blocs: BlocNotion[], dossiersBruts = '', dateÉdition: string | null = '2026-11-20') =>
  contrôlerLaLettre({ titre: 'Veille CCI du Cantal — Appels à projets — 20 novembre 2026', blocs, dossiersBruts, numéro: 1, famille: FAMILLE_DES_APPELS, dateÉdition })

describe('la troisième famille', () => {
  it('est connue du contexte et numérotée à part', () => {
    expect(FAMILLES).toContain('Appels à projets')
    expect(estFamilleDAppels('Appels à projets')).toBe(true)
    expect(estFamilleDAppels('Écosystème')).toBe(false)
    expect(estFamilleDAppels(null)).toBe(false)
    const édition = (pageId: string, famille: string | null, numéro: number): ÉditionDeTravail =>
      ({ pageId, famille, numéro, titre: pageId, statut: 'Envoyé', veille: famille, dateÉdition: '2026-11-20', dossiersOuvertsBruts: '' }) as unknown as ÉditionDeTravail
    const contexte = contexteDesFamilles([édition('e1', 'Écosystème', 12), édition('a1', 'Appels à projets', 1), édition('c1', 'Concurrentiel', 11)])
    expect(contexte.familles['Appels à projets']).toMatchObject({ éditions: 1, dernierNuméro: 1, prochainNuméro: 2 })
    expect(contexte.familles['Écosystème']).toMatchObject({ prochainNuméro: 13 })
    // Avant, une lettre d'appels tombait ici et cassait la numérotation.
    expect(contexte.sansFamille).toEqual([])
  })
})

describe('le calendrier de la lettre d’appels', () => {
  const registre = [
    { slug: 'cci-cantal', jour: 'Vendredi' as const, cadence: 'Hebdomadaire' as const, appels: { jour: 'Vendredi' as const } },
    { slug: 'hermitage', jour: 'Vendredi' as const, cadence: 'Hebdomadaire' as const },
  ]

  it('paraît à la quinzaine par défaut, les semaines ISO paires', () => {
    expect(CADENCE_DES_APPELS).toBe('Quinzaine (semaines paires)')
    // Vendredi 20 novembre 2026 : semaine ISO 47, impaire. Vendredi 27 : semaine 48.
    expect(sélectionnerLesAppels(registre, '2026-11-20').parutionsAppels).toEqual([])
    expect(sélectionnerLesAppels(registre, '2026-11-27').parutionsAppels.map((o) => o.slug)).toEqual(['cci-cantal'])
  })

  it('rend la prochaine parution des seules organisations qui ont la lettre', () => {
    expect(sélectionnerLesAppels(registre, '2026-11-20').prochainesAppels).toEqual([{ slug: 'cci-cantal', date: '2026-11-27', jour: 'Vendredi' }])
  })

  it('suit la cadence donnée quand le registre la porte', () => {
    const hebdo = [{ ...registre[0]!, appels: { jour: 'Vendredi' as const, cadence: 'Hebdomadaire' as const } }]
    expect(sélectionnerLesAppels(hebdo, '2026-11-20').parutionsAppels.map((o) => o.slug)).toEqual(['cci-cantal'])
  })
})

describe('le lint de la lettre d’appels', () => {
  it('une lettre au contrat est conforme, sans dossier ni avertissement « aucun-dossier »', () => {
    const rapport = contrôler(lettreDAppels())
    expect(rapport.ruptures).toEqual([])
    expect(rapport.avertissements.map((a) => a.code)).not.toContain('aucun-dossier')
    expect(rapport.conforme).toBe(true)
  })

  it('clôture-absente : la phrase-titre ne porte aucune date', () => {
    const rapport = contrôler(lettreDAppels(appel({ titre: 'Région Auvergne-Rhône-Alpes, appel à projets « Tiers-lieux 2027 », 30 000 € au plus.' })))
    expect(rapport.ruptures.map((r) => r.code)).toEqual(['clôture-absente'])
  })

  it('clôture-passée : la clôture précède la date de l’édition', () => {
    const rapport = contrôler(lettreDAppels(appel({ titre: 'ANCT, AMI « Manufactures de proximité », clôture le 3 novembre 2026.' })))
    expect(rapport.ruptures.map((r) => r.code)).toEqual(['clôture-passée'])
    // Sans date d'édition, la règle ne conclut pas.
    expect(contrôler(lettreDAppels(appel({ titre: 'ANCT, AMI « Manufactures de proximité », clôture le 3 novembre 2026.' })), '', null).conforme).toBe(true)
  })

  it('source-de-l-appel-absente : aucune adresse dans l’appel', () => {
    expect(contrôler(lettreDAppels(appel({ url: null }))).ruptures.map((r) => r.code)).toEqual(['source-de-l-appel-absente'])
  })

  it('arguments-absents : pas de paragraphe « Arguments »', () => {
    expect(contrôler(lettreDAppels(appel({ arguments: false }))).ruptures.map((r) => r.code)).toEqual(['arguments-absents'])
  })

  it('des dossiers ouverts sont signalés, sans bloquer', () => {
    const rapport = contrôler(lettreDAppels(), 'Tiers-lieux 2027 (1, dépôt en préparation)')
    expect(rapport.avertissements.map((a) => a.code)).toContain('dossiers-dans-la-lettre-d-appels')
  })

  it('les quatre règles ne valent que pour cette famille', () => {
    const rapport = contrôlerLaLettre({ titre: 'Veille — Écosystème', blocs: lettreDAppels(appel({ url: null, arguments: false })), dossiersBruts: '', famille: 'Écosystème', dateÉdition: '2026-11-20' })
    expect(rapport.ruptures.map((r) => r.code)).toEqual([])
  })

  it('lit une date sans année comme la prochaine occurrence', () => {
    expect(datesDUnTexte('clôture le 15 janvier', '2026-11-20')).toEqual(['2027-01-15'])
    expect(datesDUnTexte('clôture le 30 novembre', '2026-11-20')).toEqual(['2026-11-30'])
    expect(datesDUnTexte('du 1er octobre 2026 au 12/02/2027', '2026-11-20')).toEqual(['2026-10-01', '2027-02-12'])
  })

  it('se tronque à « L’essentiel » comme les deux autres lettres', () => {
    const tronqué = tronquerÀLEssentiel(construireDocument(lettreDAppels()))
    expect(tronqué.rubriques.map((r) => r.titre)).toEqual(['L’essentiel'])
  })
})

describe('la consigne « appels » (lot 2)', () => {
  it('se lit, et ne vaut que pour le balayage d’une organisation', () => {
    expect(lireUneConsigne('appels')).toEqual({ sorte: 'appels' })
    expect(TÂCHE_DE_LA_CONSIGNE.appels).toBe('balayage')
    expect(lireLaCommande(['balayage', '--organisation', 'cci-cantal', '--consigne', 'appels']).consigne).toEqual({ sorte: 'appels' })
    expect(() => lireLaCommande(['premiere-lettre', '--organisation', 'cci-cantal', '--consigne', 'appels'])).toThrow(/balayage/)
    expect(() => lireLaCommande(['balayage', '--consigne', 'appels'])).toThrow(/organisation/)
  })

  it('porte les décisions du 17 novembre 2026', () => {
    const texte = texteDeLaConsigne({ sorte: 'appels' })
    expect(texte).toBe(CONSIGNE_DES_APPELS.join('\n'))
    expect(texte).toContain('LETTRE D’APPELS À PROJETS')
    expect(texte).toContain('elle-même porteuse')
    expect(texte).toContain('marchés publics sont exclus')
    expect(texte).toContain('AUCUN PROJET A PRIORI')
    expect(texte).toContain('Quinzaine (semaines paires)')
    expect(texte).toContain('fiches_entreprises')
    expect(texte).toContain('Ne crée aucune édition')
    expect(texte).not.toContain('—')
  })
})

describe('la consigne « lettre-appels » (première lettre hors calendrier)', () => {
  it('se lit, et ne vaut que pour les lettres d’une organisation', () => {
    expect(lireUneConsigne('lettre-appels')).toEqual({ sorte: 'lettre-appels' })
    expect(TÂCHE_DE_LA_CONSIGNE['lettre-appels']).toBe('lettres')
    expect(lireLaCommande(['lettres', '--organisation', 'cci-cantal', '--consigne', 'lettre-appels']).consigne).toEqual({ sorte: 'lettre-appels' })
    expect(() => lireLaCommande(['balayage', '--organisation', 'cci-cantal', '--consigne', 'lettre-appels'])).toThrow(/lettres/)
    expect(() => lireLaCommande(['lettres', '--consigne', 'lettre-appels'])).toThrow(/organisation/)
  })

  it('ne produit qu’une lettre, au contrat de la page', () => {
    const texte = texteDeLaConsigne({ sorte: 'lettre-appels' })
    expect(texte).toBe(CONSIGNE_DE_LA_LETTRE_D_APPELS.join('\n'))
    expect(texte).toContain('ne produis aucune lettre de « parutions »')
    expect(texte).toContain('LETTRE D’APPELS À PROJETS » de la fin de l’étape 3')
    expect(texte).not.toContain('—')
  })
})
