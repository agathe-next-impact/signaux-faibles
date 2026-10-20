import { describe, expect, it } from 'vitest'
import { suiteDeLaLettre, type BlocNotion } from '@/lib/domaine/document'
import { SEUIL_GMAIL_OCTETS } from '@/lib/email/gabarit'
import { composerLettre, impulsionsDeLaLettre } from '@/lib/email/lettre'
import { BLOCS_CONCURRENTIELS } from './fixtures/lettre-concurrentielle'
import { BLOCS_RÉELS } from './fixtures/lettre-reelle'

let n = 0
const t = (texte: string, annotations: object = {}, href: string | null = null) => ({ plain_text: texte, href, annotations })
const bloc = (type: string, ...segments: ReturnType<typeof t>[]): BlocNotion => ({ id: `t${(n += 1)}`, type, [type]: { rich_text: segments } })

const édition = {
  pageId: '3d5fe829-ce71-8107-af65-f4fccf8089ab',
  titre: 'Konica Minolta : veille concurrentielle n° 7',
  veille: 'Concurrentiel',
  numéro: 7,
  dateÉdition: '2026-10-19',
  périodeCouverte: 'du 12 au 18 octobre 2026',
}
const composer = (blocs: readonly BlocNotion[]) =>
  composerLettre({ édition, blocs, slug: 'konica', organisation: 'Konica Minolta France', portailUrl: 'https://www.signauxfaibles.io/', adressePostale: null })

describe('la lettre dans l’ordre de la page', () => {
  it('garde le cadrage et les acteurs suivis, que les écrans détachent', () => {
    const suite = suiteDeLaLettre(BLOCS_CONCURRENTIELS)
    const rubriques = suite.flatMap((é) => (é.type === 'rubrique' ? [é.titre] : []))
    expect(rubriques).toContain('Les acteurs que nous suivons pour vous')
    expect(rubriques).toContain('Ajustements du cadrage de cette veille')
    expect(rubriques.indexOf('Les acteurs que nous suivons pour vous')).toBeLessThan(
      rubriques.indexOf('Ajustements du cadrage de cette veille'),
    )
  })

  it('lit les axes comme le parseur de production : numéro, nom, niveau', () => {
    const axes = suiteDeLaLettre(BLOCS_CONCURRENTIELS).filter((é) => é.type === 'axe')
    expect(axes[0]).toEqual({ type: 'axe', titre: 'Recomposition capitalistique et périmètres', numéro: 1, niveau: 'MOYEN' })
  })
})

describe('le courriel d’une lettre', () => {
  const lettre = composer([
    bloc('heading_1', t('L’essentiel')),
    bloc('paragraph', t('La '), t('DGFiP', { bold: true }), t(' a publié la liste : '), t('impots.gouv.fr', {}, 'https://www.impots.gouv.fr/')),
    bloc('heading_1', t('Actualités par axe')),
    bloc('heading_2', t('① Facture électronique — FORT')),
    bloc('bulleted_list_item', t('Open Bee : immatriculée.')),
    bloc('bulleted_list_item', t('Ricoh : en attente.')),
    bloc('heading_2', t('② Recomposition — MOYEN')),
    bloc('paragraph', t('Un fait.')),
    bloc('heading_2', t('③ Marchés publics — RAS')),
    bloc('callout', t('Rien depuis le 12 mars 2026. Vérifié : BOAMP.')),
    bloc('heading_2', t('④ Axe au suffixe inconnu — FAIBLE')),
    bloc('paragraph', t('Un lien piégé', {}, 'javascript:alert(1)')),
    { id: 'img', type: 'image', parent: { type: 'page_id', page_id: 'p' }, image: { type: 'file', file: { url: 'https://prod-files-secure.s3.amazonaws.com/signée' }, caption: [t('Carte des sites')] } },
    bloc('callout', t('Sources non ouvertes : LinkedIn, Les Échos (paywall).')),
    bloc('callout', t('📝 Note de méthode. Fenêtre élargie à quinze jours.')),
    bloc('callout', t('Sources vérifiées : BOAMP, UGAP, Légifrance.')),
    bloc('paragraph', t('Voir la '), t('page de travail', {}, 'https://www.notion.so/3d5fe829ce71810d93abe40cea6f6843')),
    bloc('heading_1', t('Ajustements du cadrage de cette veille')),
    bloc('paragraph', t('Pour demander une modification, écrivez-nous.')),
  ])

  it('pose un badge par niveau connu, et aucun pour un suffixe inconnu', () => {
    expect(lettre.html.match(/>Signal fort<\/td>/g)).toHaveLength(1)
    expect(lettre.html.match(/>À surveiller<\/td>/g)).toHaveLength(1)
    expect(lettre.html.match(/>RAS<\/td>/g)).toHaveLength(1)
    expect(lettre.html).toContain('Axe au suffixe inconnu — FAIBLE')
    expect(lettre.axes).toBe(4)
  })

  it('rend l’encadré en carte et garde le cadrage, dû au lecteur', () => {
    expect(lettre.html).toMatch(/background:#f7f8f9[^>]*><tr><td[^>]*>Rien depuis le 12 mars 2026/)
    expect(lettre.html).toContain('Ajustements du cadrage de cette veille')
  })

  it('retire les encadrés de méthode interne et les liens Notion, garde les sources vérifiées', () => {
    expect(lettre.html).not.toContain('Sources non ouvertes')
    expect(lettre.html).not.toContain('Note de méthode')
    expect(lettre.texte).not.toContain('Sources non ouvertes')
    expect(lettre.html).toContain('Sources vérifiées')
    expect(lettre.html).toContain('page de travail')
    expect(lettre.html).not.toContain('notion.so')
    expect(lettre.texte).not.toContain('notion.so')
  })

  it('garde la mise en forme et les liens sûrs, jamais un lien javascript', () => {
    expect(lettre.html).toContain('<strong style="font-weight:600;">DGFiP</strong>')
    expect(lettre.html).toContain('href="https://www.impots.gouv.fr/"')
    expect(lettre.html).toContain('Un lien piégé')
    expect(lettre.html).not.toContain('javascript:')
  })

  it('n’écrit aucune URL de fichier Notion (règle 5), seulement la légende', () => {
    expect(lettre.html).not.toContain('prod-files-secure')
    expect(lettre.html).toContain('Illustration dans votre espace : Carte des sites')
  })

  it('porte l’en-tête de l’édition et mène à l’espace du client', () => {
    expect(lettre.html).toContain('Concurrentiel · n° 7')
    expect(lettre.html).toContain('19/10/2026')
    expect(lettre.html).toContain('Période couverte : du 12 au 18 octobre 2026')
    expect(lettre.html).toContain('href="https://www.signauxfaibles.io/konica"')
    expect(lettre.html).toContain('href="https://www.signauxfaibles.io/konica/abonnement"')
    expect(lettre.html).toContain('pour Konica Minolta France')
  })

  it('tire les impulsions des axes : rose pour fort, ardoise à surveiller, rien pour RAS', () => {
    expect(lettre.courriel.impulsions).toEqual([
      { forte: true, hauteur: 26 },
      { forte: false, hauteur: 13 },
    ])
    const beaucoup = suiteDeLaLettre(
      Array.from({ length: 9 }, (_, i) => bloc('heading_2', t(`Axe ${i} — ${i % 3 === 0 ? 'FORT' : 'MOYEN'}`))),
    )
    const impulsions = impulsionsDeLaLettre(beaucoup)
    expect(impulsions).toHaveLength(7)
    expect(impulsions.filter((i) => i.forte)).toHaveLength(3)
  })

  it('donne une version texte avec les badges en clair', () => {
    expect(lettre.texte).toContain('[Signal fort] 1. Facture électronique')
    expect(lettre.texte).toContain('- Open Bee : immatriculée.')
    expect(lettre.texte).toContain('impots.gouv.fr (https://www.impots.gouv.fr/)')
  })

  it('reste loin du seuil de Gmail sur une vraie lettre, même triplée', () => {
    const vraie = composer([...BLOCS_RÉELS, ...BLOCS_CONCURRENTIELS, ...BLOCS_RÉELS, ...BLOCS_CONCURRENTIELS])
    expect(Buffer.byteLength(vraie.html)).toBeLessThan(SEUIL_GMAIL_OCTETS / 2)
  })
})
