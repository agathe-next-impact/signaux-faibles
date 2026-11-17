import { describe, expect, it, vi } from 'vitest'
import { appelsDeLaPage, domainesDeLaSection, estUneSourceDuRéférentiel, lignesDuRelevé, releverLesAppels } from '../scripts/collecte/appels'

/**
 * L'outil `appels_ouverts` (17 novembre 2026, lot 3 de
 * `docs/lettre-appels-a-projets.md`) : il n'ouvre que les sources de la section
 * « Appels à projets » du référentiel, et n'en rend que les appels.
 */

const SECTION = `# Appels à projets
Familles : Région et fonds européens.
- Région : https://www.auvergnerhonealpes.fr/aides (relève hebdomadaire)
- Europe : https://www.europe-en-auvergnerhonealpes.eu/appels
- Agrégateur : https://aides-territoires.beta.gouv.fr/aides/?perimeter=cantal.`

const PAGE = `<html><body>
<ul>
  <li><a href="/aides/appel-a-projets-tiers-lieux">Appel à projets « Tiers-lieux 2027 »</a> <span>Clôture le 15 janvier 2027</span></li>
  <li><a href="https://www.auvergnerhonealpes.fr/aides/ami-commerce">AMI Revitalisation du commerce rural</a> du 1er décembre au 28 février</li>
  <li><a href="/marches/consultation-123">Consultation : marché public de nettoyage</a> 12/12/2026</li>
  <li><a href="/contact">Nous contacter</a></li>
  <li><a href="/aides/appel-a-projets-tiers-lieux">Appel à projets « Tiers-lieux 2027 » (rappel)</a></li>
</ul></body></html>`

/** Une réponse de page, à l'adresse finale donnée (après redirection). */
const réponse = (url: string) => ({ ok: true, status: 200, url, text: async () => PAGE })

describe('la garde des sources', () => {
  it('ne connaît que les domaines cités dans la section', () => {
    const domaines = domainesDeLaSection(SECTION)
    expect([...domaines].sort()).toEqual(['aides-territoires.beta.gouv.fr', 'auvergnerhonealpes.fr', 'europe-en-auvergnerhonealpes.eu'])
    expect(estUneSourceDuRéférentiel('https://auvergnerhonealpes.fr/aides/x', domaines)).toBe(true)
    expect(estUneSourceDuRéférentiel('https://www.ademe.fr/appels', domaines)).toBe(false)
    expect(estUneSourceDuRéférentiel('https://auvergnerhonealpes.fr.exemple.net/', domaines)).toBe(false)
    expect(estUneSourceDuRéférentiel('ftp://auvergnerhonealpes.fr/', domaines)).toBe(false)
  })

  it('n’ouvre aucune adresse hors de la section', async () => {
    const récupérer = vi.fn(async (url: string | URL | Request) => réponse(String(url))) as unknown as typeof fetch
    const relevé = await releverLesAppels(
      { section: SECTION, sources: ['https://www.auvergnerhonealpes.fr/aides', 'https://www.ademe.fr/appels', 'https://evil.example/'] },
      récupérer,
    )
    const ouvertes = (récupérer as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]))
    expect(ouvertes).toEqual(['https://www.auvergnerhonealpes.fr/aides'])
    expect(relevé.refusées).toEqual(['https://www.ademe.fr/appels', 'https://evil.example/'])
    expect(lignesDuRelevé(relevé)).toContain('Refusées')
  })

  it('écarte une page redirigée hors des domaines de la section', async () => {
    const récupérer = vi.fn(async () => réponse('https://ailleurs.example/aides')) as unknown as typeof fetch
    const relevé = await releverLesAppels({ section: SECTION, sources: ['https://www.auvergnerhonealpes.fr/aides'] }, récupérer)
    expect(relevé.appels).toEqual([])
    expect(relevé.nonOuvertes[0]?.raison).toMatch(/hors du référentiel/)
  })
})

describe('les appels d’une page', () => {
  it('relève les appels, pas les marchés publics ni les autres liens, une fois chacun', () => {
    const appels = appelsDeLaPage(PAGE, 'https://www.auvergnerhonealpes.fr/aides')
    expect(appels.map((a) => a.intitulé)).toEqual(['Appel à projets « Tiers-lieux 2027 »', 'AMI Revitalisation du commerce rural'])
    expect(appels[0]).toMatchObject({ url: 'https://www.auvergnerhonealpes.fr/aides/appel-a-projets-tiers-lieux', dates: ['15 janvier 2027'] })
    expect(appels[1]?.dates).toEqual(['1er decembre', '28 fevrier'])
  })

  it('filtre par mots-clés quand il y en a', () => {
    expect(appelsDeLaPage(PAGE, 'https://www.auvergnerhonealpes.fr/aides', ['commerce']).map((a) => a.intitulé)).toEqual(['AMI Revitalisation du commerce rural'])
  })
})
