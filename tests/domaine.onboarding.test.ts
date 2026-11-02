import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import {
  alertesDUnOnboarding,
  commandeCoworkDeLaDemande,
  contrôlerLaDemande,
  domaineDuSite,
  lundiDeParis,
  nomComparable,
  SLUGS_RÉSERVÉS,
  débutDuMoisDeParis,
  gesteDisponible,
  PLAFONDS_DES_TÂCHES,
  déciderDuBudget,
  dépenseDuMois,
  estBloqué,
  estClos,
  étapeDeLOnboarding,
  étapeDuStatut,
  étatMontré,
  lireLeBudget,
  moisDeParis,
  lireUneConsigne,
  TÂCHE_DE_LA_CONSIGNE,
  écrireUneConsigne,
} from '@/lib/domaine/onboarding'

const sans = { statutRapporté: null, organisation: null, lecteursActifs: 0, dernierLienEnvoyéLe: null }
const jour = (iso: string) => new Date(iso)

describe('l’étape d’un onboarding', () => {
  it('traduit le statut du registre, et 4 à 6 valent au moins « première lettre produite »', () => {
    expect([1, 2, 3, 4, 5, 6].map(étapeDuStatut)).toEqual([
      'demande',
      'referentiels_generes',
      'referentiels_valides',
      'en_essai',
      'en_essai',
      'en_essai',
    ])
    expect(étapeDuStatut(null)).toBeNull()
    expect(étapeDuStatut(0)).toBeNull()
    expect(étapeDuStatut(7)).toBeNull()
  })

  it('une ligne sans rapport ni organisation est une demande', () => {
    const é = étapeDeLOnboarding(sans)
    expect(é.étape).toBe('demande')
    expect(é.provenances.demande).toBe('constatée')
    expect(é.provenances.referentiels_generes).toBe('à-venir')
  })

  it('constate l’essai, J0 et l’ouverture dans Postgres, et ne recule jamais sur un rapport en retard', () => {
    const essai = { ...sans, statutRapporté: 2, organisation: { état: 'essai', activéeLe: null, essaiOuvertLe: jour('2026-10-26') } }
    const é = étapeDeLOnboarding(essai)
    expect(é.étape).toBe('en_essai')
    expect(é.provenances).toMatchObject({
      demande: 'rapportée',
      referentiels_generes: 'rapportée',
      referentiels_valides: 'non-rapportée',
      en_essai: 'constatée',
      premiere_lettre_publiee: 'à-venir',
    })

    const publiée = { ...essai, organisation: { ...essai.organisation, activéeLe: jour('2026-10-27') } }
    expect(étapeDeLOnboarding(publiée).étape).toBe('premiere_lettre_publiee')
    // Un lecteur actif sans lien parti n'ouvre pas l'espace : il faut les deux.
    expect(étapeDeLOnboarding({ ...publiée, lecteursActifs: 1 }).étape).toBe('premiere_lettre_publiee')
    const ouverte = étapeDeLOnboarding({ ...publiée, lecteursActifs: 1, dernierLienEnvoyéLe: jour('2026-10-28') })
    expect(ouverte.étape).toBe('espace_ouvert')
    expect(ouverte.rang).toBe(5)
  })

  it('un statut rapporté plus avancé que ce qui est constaté l’emporte', () => {
    const é = étapeDeLOnboarding({ ...sans, statutRapporté: 3 })
    expect(é.étape).toBe('referentiels_valides')
    expect(é.provenances.referentiels_valides).toBe('rapportée')
  })

  it('une organisation entrée par prospection, encore en demande, ne compte pas comme en essai', () => {
    expect(étapeDeLOnboarding({ ...sans, organisation: { état: 'demande', activéeLe: null, essaiOuvertLe: null } }).étape).toBe('demande')
  })
})

describe('l’état d’un run', () => {
  const maintenant = jour('2026-11-01T12:00:00Z')
  it('un run en cours muet depuis plus de trois heures est sans nouvelles', () => {
    expect(étatMontré({ état: 'en_cours', début: jour('2026-11-01T10:00:00Z'), fin: null, crééLe: jour('2026-11-01T10:00:00Z') }, maintenant)).toBe('en_cours')
    expect(étatMontré({ état: 'en_cours', début: jour('2026-11-01T08:00:00Z'), fin: null, crééLe: jour('2026-11-01T08:00:00Z') }, maintenant)).toBe('sans_nouvelles')
    expect(étatMontré({ état: 'reussi', début: jour('2026-10-01T08:00:00Z'), fin: jour('2026-10-01T09:00:00Z'), crééLe: jour('2026-10-01T08:00:00Z') }, maintenant)).toBe('reussi')
  })

  it('bloqué : un motif, un échec, un refus ou un run sans nouvelles', () => {
    const run = (état: 'reussi' | 'echec' | 'refuse') => ({ état, début: maintenant, fin: maintenant, crééLe: maintenant })
    expect(estBloqué({ motifDeBlocage: null, dernierRun: null }, maintenant)).toBe(false)
    expect(estBloqué({ motifDeBlocage: 'email manquant', dernierRun: run('reussi') }, maintenant)).toBe(true)
    expect(estBloqué({ motifDeBlocage: null, dernierRun: run('reussi') }, maintenant)).toBe(false)
    expect(estBloqué({ motifDeBlocage: null, dernierRun: run('echec') }, maintenant)).toBe(true)
    expect(estBloqué({ motifDeBlocage: null, dernierRun: run('refuse') }, maintenant)).toBe(true)
  })

  it('clos quatorze jours après l’ouverture de l’espace, pas avant', () => {
    expect(estClos('espace_ouvert', jour('2026-10-20T12:00:00Z'), jour('2026-11-01T12:00:00Z'))).toBe(false)
    expect(estClos('espace_ouvert', jour('2026-10-15T12:00:00Z'), jour('2026-11-01T12:00:00Z'))).toBe(true)
    expect(estClos('premiere_lettre_publiee', jour('2026-09-01T12:00:00Z'), jour('2026-11-01T12:00:00Z'))).toBe(false)
  })
})

describe('le budget des onboardings', () => {
  it('lit la variable : absente ou vide, aucun blocage ; illisible, aucun blocage et signalée', () => {
    expect(lireLeBudget(undefined)).toEqual({ budgetUsd: null, illisible: false })
    expect(lireLeBudget('  ')).toEqual({ budgetUsd: null, illisible: false })
    expect(lireLeBudget('150')).toEqual({ budgetUsd: 150, illisible: false })
    expect(lireLeBudget('150,5')).toEqual({ budgetUsd: 150.5, illisible: false })
    expect(lireLeBudget('beaucoup')).toEqual({ budgetUsd: null, illisible: true })
    expect(lireLeBudget('-3')).toEqual({ budgetUsd: null, illisible: true })
  })

  it('n’accepte un run que si son plafond tient dans ce qui reste', () => {
    expect(déciderDuBudget({ dépenséUsd: 80, plafondUsd: 30, budgetUsd: null }).sorte).toBe('sans-budget')
    expect(déciderDuBudget({ dépenséUsd: 70, plafondUsd: 30, budgetUsd: 100 }).sorte).toBe('accepté')
    expect(déciderDuBudget({ dépenséUsd: 70.01, plafondUsd: 30, budgetUsd: 100 }).sorte).toBe('refusé')
    // Un budget nul refuse tout run qui peut dépenser.
    expect(déciderDuBudget({ dépenséUsd: 0, plafondUsd: 30, budgetUsd: 0 }).sorte).toBe('refusé')
  })

  it('compte le coût mesuré, le plafond des runs en cours, et ni les refus ni les runs muets', () => {
    const maintenant = jour('2026-11-01T12:00:00Z')
    const base = { début: jour('2026-11-01T11:00:00Z'), crééLe: jour('2026-11-01T11:00:00Z') }
    expect(
      dépenseDuMois(
        [
          { ...base, état: 'reussi', coûtUsd: 4.82, plafondUsd: 30, fin: maintenant },
          { ...base, état: 'en_cours', coûtUsd: null, plafondUsd: 40, fin: null },
          { ...base, état: 'refuse', coûtUsd: 0, plafondUsd: 30, fin: maintenant },
          { début: jour('2026-11-01T01:00:00Z'), crééLe: jour('2026-11-01T01:00:00Z'), état: 'en_cours', coûtUsd: null, plafondUsd: 30, fin: null },
        ],
        maintenant,
      ),
    ).toBe(44.82)
  })

  it('le mois est celui de Paris, et commence à minuit heure de Paris', () => {
    expect(moisDeParis(jour('2026-10-31T23:30:00Z'))).toBe('2026-11')
    expect(débutDuMoisDeParis(jour('2026-11-15T10:00:00Z')).toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(débutDuMoisDeParis(jour('2026-07-15T10:00:00Z')).toISOString()).toBe('2026-06-30T22:00:00.000Z')
  })
})

describe('le geste de l’opératrice (lot 2)', () => {
  type Montré = NonNullable<Parameters<typeof gesteDisponible>[0]['dernierRun']>['montré']
  const run = (tâche: 'balayage' | 'premiere_lettre', montré: Montré) => ({ tâche, montré })

  it('un seul geste par étape, sans validation entre référentiels et première lettre (lot 6)', () => {
    expect(gesteDisponible({ étape: 'demande', exécuteur: 'api', bloqué: false, dernierRun: null })).toEqual({ sorte: 'geste', geste: 'referentiels', tâche: 'balayage', libellé: 'Lancer l’onboarding' })
    // Plus de validation dans Notion : la première lettre suit les référentiels.
    expect(gesteDisponible({ étape: 'referentiels_generes', exécuteur: 'api', bloqué: false, dernierRun: run('balayage', 'reussi') })).toMatchObject({ sorte: 'geste', geste: 'premiere-lettre', tâche: 'premiere-lettre' })
    expect(gesteDisponible({ étape: 'referentiels_valides', exécuteur: 'api', bloqué: false, dernierRun: run('balayage', 'reussi') })).toMatchObject({ sorte: 'geste', geste: 'premiere-lettre', tâche: 'premiere-lettre' })
    // La première lettre produite, lue dans l'espace : le portail l'envoie, quel que soit l'exécuteur.
    expect(gesteDisponible({ étape: 'en_essai', exécuteur: 'api', bloqué: false, dernierRun: run('premiere_lettre', 'reussi') })).toEqual({ sorte: 'envoyer', libellé: 'Envoyer les lettres' })
    expect(gesteDisponible({ étape: 'en_essai', exécuteur: 'cowork', bloqué: false, dernierRun: null })).toEqual({ sorte: 'envoyer', libellé: 'Envoyer les lettres' })
    expect(gesteDisponible({ étape: 'espace_ouvert', exécuteur: 'api', bloqué: false, dernierRun: null })).toEqual({ sorte: 'aucun', raison: 'terminé' })
  })

  it('un run en cours ferme tout geste ; Cowork ne se lance pas d’ici ; un blocage relance la tâche du dernier run', () => {
    for (const montré of ['demande', 'lance', 'en_cours'] as const) {
      expect(gesteDisponible({ étape: 'demande', exécuteur: 'api', bloqué: false, dernierRun: run('balayage', montré) })).toEqual({ sorte: 'aucun', raison: 'en-cours' })
    }
    expect(gesteDisponible({ étape: 'demande', exécuteur: 'cowork', bloqué: false, dernierRun: null })).toEqual({ sorte: 'aucun', raison: 'cowork' })
    expect(gesteDisponible({ étape: 'referentiels_valides', exécuteur: 'api', bloqué: true, dernierRun: run('premiere_lettre', 'echec') })).toMatchObject({ sorte: 'geste', geste: 'relancer', tâche: 'premiere-lettre', libellé: 'Relancer premiere-lettre' })
    // Un run sans nouvelles ne bloque pas les gestes : il est relançable.
    expect(gesteDisponible({ étape: 'demande', exécuteur: 'api', bloqué: true, dernierRun: run('balayage', 'sans_nouvelles') })).toMatchObject({ geste: 'relancer', tâche: 'balayage' })
  })

  it('les plafonds affichés et réservés sont ceux du harnais', async () => {
    const { PARAMÈTRES } = await import('@/scripts/taches/executer')
    expect(PLAFONDS_DES_TÂCHES.balayage).toBe(PARAMÈTRES.balayage.plafondUsd)
    expect(PLAFONDS_DES_TÂCHES['premiere-lettre']).toBe(PARAMÈTRES['premiere-lettre'].plafondUsd)
    // Le moteur (lot 5) lit ce même plafond dans `trigger/onboarding.ts`.
    expect(PLAFONDS_DES_TÂCHES.onboarding).toBe(40)
  })
})

describe('les alertes du contrôle du soir (lot 2)', () => {
  const maintenant = jour('2026-11-10T20:00:00Z')
  const run = (état: 'demande' | 'lance' | 'en_cours', il: number) => ({ tâche: 'balayage' as const, état, début: état === 'en_cours' ? new Date(maintenant.getTime() - il) : null, fin: null, crééLe: new Date(maintenant.getTime() - il) })
  const H = 60 * 60 * 1000

  it('un lancement sans début au bout d’une heure, un run en cours muet trois heures', () => {
    const base = { étape: 'demande' as const, clos: false, misÀJourLe: maintenant }
    expect(alertesDUnOnboarding({ ...base, dernierRun: run('lance', 0.5 * H) }, maintenant)).toEqual([])
    expect(alertesDUnOnboarding({ ...base, dernierRun: run('lance', 2 * H) }, maintenant).map((a) => a.code)).toEqual(['onboarding-sans-nouvelles'])
    expect(alertesDUnOnboarding({ ...base, dernierRun: run('en_cours', 2 * H) }, maintenant)).toEqual([])
    expect(alertesDUnOnboarding({ ...base, dernierRun: run('en_cours', 4 * H) }, maintenant).map((a) => a.code)).toEqual(['onboarding-sans-nouvelles'])
  })

  it('immobile au-delà de sept jours, sauf une fois l’espace ouvert ou l’onboarding clos', () => {
    const ancien = jour('2026-11-01T12:00:00Z')
    expect(alertesDUnOnboarding({ étape: 'referentiels_generes', clos: false, misÀJourLe: ancien, dernierRun: null }, maintenant).map((a) => a.code)).toEqual(['onboarding-immobile'])
    expect(alertesDUnOnboarding({ étape: 'espace_ouvert', clos: false, misÀJourLe: ancien, dernierRun: null }, maintenant)).toEqual([])
    expect(alertesDUnOnboarding({ étape: 'referentiels_generes', clos: false, misÀJourLe: jour('2026-11-05T12:00:00Z'), dernierRun: null }, maintenant)).toEqual([])
  })
})

describe('la demande du formulaire (lot 3)', () => {
  it('accepte le minimum, complète le schéma et dérive le slug du nom', () => {
    const r = contrôlerLaDemande({ nom: '  L’Hermitage  Tiers-lieu ', site: 'hermitage.example' })
    expect(r).toEqual({
      sorte: 'valide',
      demande: { slug: 'l-hermitage-tiers-lieu', nom: 'L’Hermitage Tiers-lieu', site: 'https://hermitage.example/', exécuteur: 'api', intake: { objectifs: null, lecteurFinal: null, emailDuLecteurFinal: null } },
    })
  })

  it('« à proposer » vaut des objectifs vides ; l’adresse n’est gardée que pour l’API', () => {
    const api = contrôlerLaDemande({ nom: 'Mastora', site: 'https://mastora.example', objectifs: 'à proposer', lecteurNom: 'Camille', lecteurEmail: 'Camille@Mastora.example' })
    expect(api.sorte === 'valide' && api.demande.intake).toEqual({ objectifs: null, lecteurFinal: 'Camille', emailDuLecteurFinal: 'camille@mastora.example' })
    const cowork = contrôlerLaDemande({ nom: 'Mastora', site: 'https://mastora.example', lecteurEmail: 'camille@mastora.example', exécuteur: 'cowork' })
    expect(cowork.sorte === 'valide' && cowork.demande.intake.emailDuLecteurFinal).toBeNull()
  })

  it('refuse et nomme chaque champ en faute', () => {
    const r = contrôlerLaDemande({ nom: '', site: 'pas une adresse', slug: 'Espace Client', lecteurEmail: 'camille', exécuteur: 'autre', objectifs: 'x'.repeat(1501) })
    expect(r.sorte === 'invalide' && [...r.champs].sort()).toEqual(['exécuteur', 'lecteurEmail', 'nom', 'objectifs', 'site', 'slug'])
    expect(contrôlerLaDemande({ nom: 'Tarifs', site: 'https://tarifs.example' })).toEqual({ sorte: 'invalide', champs: ['slug'] })
    expect(contrôlerLaDemande({ nom: 'Mastora', site: 'ftp://mastora.example' })).toEqual({ sorte: 'invalide', champs: ['site'] })
  })

  it('chaque dossier de premier niveau du portail est un slug réservé', () => {
    const dossiers = (racine: string) => readdirSync(racine, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('[') && !e.name.startsWith('(')).map((e) => e.name)
    for (const d of [...dossiers('app/(portail)'), ...dossiers('app/(payload)'), ...dossiers('app')]) expect(SLUGS_RÉSERVÉS.has(d), d).toBe(true)
  })

  it('compare les noms et les domaines comme l’anti-doublon de l’étape 1', () => {
    expect(nomComparable('L’Hermitage')).toBe(nomComparable('l hermitage'))
    expect(domaineDuSite('https://www.Mastora.example/a/b')).toBe('mastora.example')
    expect(domaineDuSite('mastora.example')).toBe('mastora.example')
    expect(domaineDuSite(null)).toBeNull()
  })

  it('la commande Cowork ne porte jamais d’adresse', () => {
    const c = commandeCoworkDeLaDemande({ nom: 'Mastora', site: 'https://mastora.example/', objectifs: null, lecteurFinal: 'Camille' })
    expect(c).toBe('/onboarding-demande Organisation : Mastora · URL : https://mastora.example/ · Objectifs de veille : à proposer · Lecteur final : Camille · Exécuteur : Cowork')
    expect(c).not.toContain('@')
  })

  it('le lundi de Paris, y compris un dimanche soir en UTC', () => {
    // 22 h 30 UTC le dimanche est encore dimanche à Paris ; 23 h 30 UTC est lundi 0 h 30.
    expect(lundiDeParis(jour('2026-11-01T22:30:00Z'))).toBe('2026-10-26')
    expect(lundiDeParis(jour('2026-11-01T23:30:00Z'))).toBe('2026-11-02')
    expect(lundiDeParis(jour('2026-11-01T12:00:00Z'))).toBe('2026-10-26')
  })
})

describe('l’ouverture de l’espace (lot 4)', () => {
  it('à la première lettre publiée, le geste ouvre l’espace et active la veille, que l’exécuteur soit l’API ou Cowork (lot 6)', () => {
    for (const exécuteur of ['api', 'cowork'] as const) {
      expect(gesteDisponible({ étape: 'premiere_lettre_publiee', exécuteur, bloqué: false, dernierRun: null })).toEqual({ sorte: 'ouvrir', libellé: 'Ouvrir l’espace et activer la veille', activation: true })
    }
    // Un run en cours ferme encore tout geste.
    expect(gesteDisponible({ étape: 'premiere_lettre_publiee', exécuteur: 'api', bloqué: false, dernierRun: { tâche: 'balayage', montré: 'en_cours' } })).toEqual({ sorte: 'aucun', raison: 'en-cours' })
  })
})

describe('le geste avec le moteur (lot 5)', () => {
  const g = (étape: Parameters<typeof gesteDisponible>[0]['étape'], plus: Partial<Parameters<typeof gesteDisponible>[0]> = {}) =>
    gesteDisponible({ étape, exécuteur: 'api', bloqué: false, dernierRun: null, moteur: 'trigger', ...plus })

  it('un seul run : « Lancer l’onboarding » avant l’essai, sans étape de validation', () => {
    expect(g('demande')).toEqual({ sorte: 'geste', geste: 'onboarding', tâche: 'onboarding', libellé: 'Lancer l’onboarding' })
    expect(g('referentiels_generes')).toMatchObject({ geste: 'onboarding' })
    expect(g('en_essai')).toEqual({ sorte: 'aucun', raison: 'attente' })
    expect(g('premiere_lettre_publiee')).toEqual({ sorte: 'ouvrir', libellé: 'Ouvrir l’espace', activation: false })
    expect(g('espace_ouvert')).toEqual({ sorte: 'aucun', raison: 'terminé' })
  })

  it('un blocage relance le run complet ; un run en cours ferme tout', () => {
    expect(g('referentiels_generes', { bloqué: true, dernierRun: { tâche: 'onboarding', montré: 'echec' } })).toMatchObject({ geste: 'relancer', tâche: 'onboarding' })
    expect(g('demande', { dernierRun: { tâche: 'onboarding', montré: 'en_cours' } })).toEqual({ sorte: 'aucun', raison: 'en-cours' })
  })
})


describe('les consignes du portail aux tâches (lot 6)', () => {
  const id = '40cfe829ce7181f183d9c46c4777ce00'
  it('s’écrivent et se relisent à l’identique, et rien d’autre ne passe', () => {
    for (const c of [{ sorte: 'sans-validation' }, { sorte: 'activation' }, { sorte: 'publication', éditions: [id, '40cfe829ce71811d919bf29c8c10eecd'] }] as const) {
      expect(lireUneConsigne(écrireUneConsigne(c))).toEqual(c)
    }
    expect(lireUneConsigne('')).toBeNull()
    expect(lireUneConsigne(null)).toBeNull()
    expect(lireUneConsigne('activation; rm -rf')).toBe('illisible')
    expect(lireUneConsigne('publication:')).toBe('illisible')
    expect(lireUneConsigne(`publication:${id.toUpperCase()}`)).toBe('illisible')
    expect(lireUneConsigne(`publication:${Array(7).fill(0).map((_, i) => id.slice(0, 31) + i).join(',')}`)).toBe('illisible')
    // Une édition donnée deux fois n'est publiée qu'une fois.
    expect(lireUneConsigne(`publication:${id},${id}`)).toEqual({ sorte: 'publication', éditions: [id] })
  })
  it('chaque consigne a sa tâche', () => {
    expect(TÂCHE_DE_LA_CONSIGNE).toEqual({ 'sans-validation': 'premiere-lettre', activation: 'balayage', publication: 'reconciliation' })
  })
})
