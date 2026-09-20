import { describe, expect, it } from 'vitest'
import type { LigneDAccèsContrôlée } from '@/lib/notion/acces'
import type { Édition } from '@/lib/notion/editions'
import { composerCourrierDÉtat, contrôlerUnEspace, regrouperParSlug } from '@/lib/portail/etat'
import { vérifierJetonCowork } from '@/lib/portail/jeton-cowork'
import type { Rapport } from '@/lib/portail/lint'

const ligne = (extras: Partial<LigneDAccèsContrôlée> = {}): LigneDAccèsContrôlée => ({
  nom: 'Jean',
  emailRenseigné: true,
  slug: 'hermitage',
  organisationId: '3d5fe829ce71810da651f3783a725bd8',
  actif: true,
  tousLesEspaces: false,
  identifiantVide: false,
  identifiantEnDoublon: false,
  ...extras,
})

const lettre = (extras: Partial<Édition> = {}): Édition => ({
  pageId: 'p1',
  titre: 'Veille Tiers-Lieux — lundi 14 septembre 2026',
  veille: 'Écosystème',
  dateÉdition: '2026-09-14',
  numéro: 13,
  périodeCouverte: '07/09 – 13/09',
  fenêtreÉlargie: false,
  actionDeLaSemaine: '',
  dossiersOuvertsBruts: 'WIP (2)',
  ...extras,
})

const rapportSain: Rapport = {
  conforme: true,
  ruptures: [],
  avertissements: [],
  aperçu: { titre: 't', rubriques: [], axes: [], dossiers: [], cadrage: { présent: true, clos: true, phraseDeClôture: true } },
}

describe('contrôlerUnEspace', () => {
  it('un espace sain n’a aucun défaut', () => {
    const espace = contrôlerUnEspace({ slug: 'hermitage', lignes: [ligne()], lettres: [lettre()], rapport: rapportSain })
    expect(espace.défauts).toEqual([])
    expect(espace).toMatchObject({ lecteursActifs: 1, lettresPubliées: 1, organisationId: '3d5fe829ce71810da651f3783a725bd8' })
    expect(espace.dernièreLettre).toEqual({ pageId: 'p1', titre: lettre().titre, date: '2026-09-14' })
  })

  it('la panne des 10, 11 et 16 septembre : identifiant d’organisation qui ne rencontre aucune lettre', () => {
    const espace = contrôlerUnEspace({ slug: 'dalious', lignes: [ligne({ slug: 'dalious', organisationId: 'mauvaise' })], lettres: [], rapport: null })
    const codes = espace.défauts.map((d) => d.code)
    expect(codes).toContain('aucune-lettre-publiée')
    // Et le message nomme d'abord la cause la plus fréquente, le Brouillon.
    expect(espace.défauts.find((d) => d.code === 'aucune-lettre-publiée')?.message).toMatch(/Brouillon.*identifiant/s)
  })

  it('deux lignes du même slug avec deux identifiants : au plus une est juste', () => {
    const espace = contrôlerUnEspace({
      slug: 'hermitage',
      lignes: [ligne(), ligne({ nom: 'Agathe', organisationId: 'autre' })],
      lettres: [lettre()],
      rapport: rapportSain,
    })
    expect(espace.défauts.map((d) => d.code)).toEqual(['identifiant-organisation-divergent'])
    expect(espace.organisationId).toBeNull()
  })

  it('la panne du 11 septembre : ligne dupliquée, identifiant d’accès partagé', () => {
    const espace = contrôlerUnEspace({
      slug: 'hermitage',
      lignes: [ligne({ identifiantEnDoublon: true }), ligne({ nom: 'Agathe', identifiantEnDoublon: true })],
      lettres: [lettre()],
      rapport: rapportSain,
    })
    expect(espace.défauts.map((d) => d.code)).toEqual(['identifiant-acces-doublon'])
  })

  it('des lettres publiées et aucun accès actif : personne ne peut entrer', () => {
    const espace = contrôlerUnEspace({ slug: 'ccpm', lignes: [ligne({ slug: 'ccpm', actif: false })], lettres: [lettre()], rapport: rapportSain })
    expect(espace.défauts.map((d) => d.code)).toEqual(['aucun-acces-actif'])
  })

  it('un accès actif sans adresse', () => {
    const espace = contrôlerUnEspace({ slug: 'ccpm', lignes: [ligne({ emailRenseigné: false })], lettres: [lettre()], rapport: rapportSain })
    expect(espace.défauts.map((d) => d.code)).toEqual(['email-manquant'])
  })

  it('la panne du 11 septembre sur Mauriac : la dernière lettre rompt le contrat de forme', () => {
    const rapport: Rapport = {
      ...rapportSain,
      conforme: false,
      ruptures: [
        { code: 'aucun-axe', portée: 'portail', message: 'aucun axe.' },
        { code: 'cadrage-sans-adresse', portée: 'lettre', message: 'pas d’adresse.' },
      ],
    }
    const espace = contrôlerUnEspace({ slug: 'ccpm', lignes: [ligne()], lettres: [lettre()], rapport })
    const défaut = espace.défauts.find((d) => d.code === 'contrat-rompu')
    // Seules les ruptures de portée « portail » comptent ici : c'est ce que le client voit.
    expect(défaut?.message).toContain('aucun axe.')
    expect(défaut?.message).not.toContain('pas d’adresse.')
  })

  it('un identifiant d’accès vide', () => {
    const espace = contrôlerUnEspace({ slug: 'x', lignes: [ligne({ identifiantVide: true })], lettres: [lettre()], rapport: rapportSain })
    expect(espace.défauts.map((d) => d.code)).toEqual(['identifiant-acces-vide'])
  })
})

describe('regrouperParSlug', () => {
  it('groupe par slug et compte les lignes sans slug sans les perdre en silence', () => {
    const { parSlug, sansSlug } = regrouperParSlug([ligne(), ligne({ nom: 'Agathe' }), ligne({ slug: '' }), ligne({ slug: 'dalious' })])
    expect([...parSlug.keys()]).toEqual(['hermitage', 'dalious'])
    expect(parSlug.get('hermitage')).toHaveLength(2)
    expect(sansSlug).toBe(1)
  })
})

describe('composerCourrierDÉtat', () => {
  it('une ligne par défaut, groupées par espace, l’objet compte les défauts', () => {
    const courrier = composerCourrierDÉtat({
      date: '2026-09-17',
      espaces: [],
      défauts: [
        { slug: 'dalious', code: 'aucune-lettre-publiée', message: 'accès actif, aucune lettre publiée.' },
        { slug: 'dalious', code: 'email-manquant', message: 'pas d’adresse.' },
        { slug: 'ccpm', code: 'contrat-rompu', message: 'aucun axe.' },
      ],
      lignesSansSlug: 0,
    })
    expect(courrier.objet).toBe('[Veille] Espaces clients — 3 défaut(s) à corriger')
    expect(courrier.texte).toContain('dalious\n  · accès actif, aucune lettre publiée.\n  · pas d’adresse.')
    expect(courrier.texte).toContain('ccpm\n  · aucun axe.')
  })
})

describe('vérifierJetonCowork', () => {
  it('sans aucun secret configuré, la route est fermée, pas la demande refusée', () => {
    expect(vérifierJetonCowork({ autorisation: 'Bearer x', secrets: [undefined, ''] })).toEqual({ sorte: 'non-configurée' })
  })

  it('accepte l’un ou l’autre des secrets', () => {
    expect(vérifierJetonCowork({ autorisation: 'Bearer cron', secrets: ['activation', 'cron'] })).toEqual({ sorte: 'acceptée' })
    expect(vérifierJetonCowork({ autorisation: 'Bearer activation', secrets: ['activation', 'cron'] })).toEqual({ sorte: 'acceptée' })
  })

  it('refuse un jeton faux, un en-tête absent ou mal formé', () => {
    expect(vérifierJetonCowork({ autorisation: 'Bearer faux', secrets: ['activation'] }).sorte).toBe('refusée')
    expect(vérifierJetonCowork({ autorisation: null, secrets: ['activation'] }).sorte).toBe('refusée')
    expect(vérifierJetonCowork({ autorisation: 'activation', secrets: ['activation'] }).sorte).toBe('refusée')
  })
})
