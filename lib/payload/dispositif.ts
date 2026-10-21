/**
 * Les lectures et écritures Payload du dispositif (programme du 22 octobre
 * 2026, §4) : ce que les routes `/api/veille/dossier`, `/editions`,
 * `/referentiels` et `/prospects` font dans le registre et les documents, pour
 * le compte des tâches Trigger.dev. Rien ici n'est caché ni servi à un écran ;
 * les écrans lisent par `lib/documents`. Le portail est le seul écrivain.
 */
import config from '@payload-config'
import { getPayload, type Payload, type Where } from 'payload'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import type { ModeDeProduction, DossierDOnboarding, DossierDeParution, DossierDeProspect, RemiseDÉdition, RemiseDeRéférentiel, AccuséDeRemise } from '@/lib/moteur/remise'
import { essentielDuMarkdown, sélectionDe, type ÉditionPrécédente } from '@/lib/moteur/selection'
import { identifiantDeRelation } from '@/lib/payload/relations'

type Cible = { organisation: string; filiere?: null } | { filiere: string; organisation?: null }

async function instance(): Promise<Payload> {
  return getPayload({ config })
}

function champ(doc: unknown, nom: string): unknown {
  return typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>)[nom] : undefined
}

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.length > 0 ? valeur : null
}

function jourDe(valeur: unknown): string | null {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valeur) ? valeur.slice(0, 10) : null
}

/** Une date de jour, posée à 12 h UTC comme le sélecteur de l'admin. */
function instantDuJour(jour: string): string {
  return `${jour}T12:00:00.000Z`
}

function filtreDeCible(cible: Cible): Where {
  return cible.organisation ? { organisation: { equals: cible.organisation } } : { filiere: { equals: cible.filiere ?? '' } }
}

// ── Lectures ─────────────────────────────────────────────────────────────────

async function référentielActif(payload: Payload, cible: Cible): Promise<string | null> {
  const { docs } = await payload.find({
    collection: 'referentiels',
    where: { and: [filtreDeCible(cible), { actif: { equals: true } }] },
    sort: '-version',
    limit: 1,
    depth: 0,
  })
  return texte(champ(docs[0], 'markdown'))
}

async function dernièreÉditionPubliée(payload: Payload, cible: Cible): Promise<ÉditionPrécédente | null> {
  const { docs } = await payload.find({
    collection: 'editions',
    where: { and: [filtreDeCible(cible), { statut: { equals: 'publiee' } }] },
    sort: '-dateEdition',
    limit: 1,
    depth: 0,
  })
  const doc = docs[0]
  const dateÉdition = jourDe(champ(doc, 'dateEdition'))
  if (!doc || !dateÉdition) return null
  const numéro = champ(doc, 'numero')
  return {
    dateÉdition,
    numéro: typeof numéro === 'number' ? numéro : 0,
    essentiel: essentielDuMarkdown(texte(champ(doc, 'markdown')) ?? ''),
    dossiersBruts: texte(champ(doc, 'dossiersOuvertsSuivis')) ?? '',
  }
}

async function gelDe(payload: Payload, cible: Cible): Promise<DossierDeParution['gel']> {
  const { docs } = await payload.find({ collection: 'gels', where: filtreDeCible(cible), pagination: false, limit: 0, depth: 0 })
  return docs.flatMap((doc) => {
    const url = texte(champ(doc, 'url'))
    const empreinte = texte(champ(doc, 'empreinte'))
    const phrases = champ(doc, 'phrases')
    if (!url || !empreinte) return []
    return [{ url, empreinte, phrases: Array.isArray(phrases) ? (phrases as string[]).filter((p) => typeof p === 'string') : [] }]
  })
}

/** Les organisations et filières à produire ce jour : les actives. La cadence autre qu'hebdomadaire viendra avec le besoin. */
export async function sélectionDuJour(): Promise<{ organisations: string[]; filieres: string[] }> {
  const payload = await instance()
  const [organisations, filieres] = await Promise.all([
    payload.find({ collection: 'organisations', where: { etat: { equals: 'active' } }, pagination: false, limit: 0, depth: 0 }),
    payload.find({ collection: 'filieres', where: { active: { equals: true } }, pagination: false, limit: 0, depth: 0 }),
  ])
  return { organisations: organisations.docs.map((d) => String(d.id)), filieres: filieres.docs.map((d) => String(d.id)) }
}

export type RaisonDAbsence = 'organisation-inconnue' | 'filiere-inconnue' | 'sans-referentiel'

export async function dossierDeParution(
  cible: Cible,
  mode: ModeDeProduction,
  dateÉdition?: string,
  /** Ce que la file de travaux a décidé et que le dossier ne recalcule pas : le numéro à porter. */
  surcharges: { readonly numéro?: number } = {},
): Promise<DossierDeParution | RaisonDAbsence> {
  const payload = await instance()
  let organisation: DossierDeParution['organisation']
  let filière: DossierDeParution['filière'] = null
  if (cible.organisation) {
    const doc = await payload.findByID({ collection: 'organisations', id: cible.organisation, depth: 0, disableErrors: true })
    if (!doc) return 'organisation-inconnue'
    organisation = { id: String(doc.id), nom: doc.nom, slug: doc.slug }
    const filièreId = identifiantDeRelation(doc.filiere)
    if (filièreId) {
      const f = await payload.findByID({ collection: 'filieres', id: filièreId, depth: 0, disableErrors: true })
      if (f) filière = { id: String(f.id), nom: f.nom }
    }
  } else {
    if (!cible.filiere) return 'filiere-inconnue'
    const doc = await payload.findByID({ collection: 'filieres', id: cible.filiere, depth: 0, disableErrors: true })
    if (!doc) return 'filiere-inconnue'
    filière = { id: String(doc.id), nom: doc.nom }
    organisation = { id: String(doc.id), nom: doc.nom, slug: doc.slug }
  }
  const référentiel = await référentielActif(payload, cible)
  if (!référentiel) return 'sans-referentiel'
  const précédente = await dernièreÉditionPubliée(payload, cible)
  const sélection = sélectionDe(dateÉdition ?? aujourdHuiÀParis(), précédente)
  void mode
  return {
    organisation,
    filière,
    référentiel,
    sélection: { ...sélection, numéro: surcharges.numéro ?? sélection.numéro, éditionPrécédente: sélection.éditionPrécédente ?? null },
    gel: await gelDe(payload, cible),
  }
}

export async function dossierDOnboarding(organisationId: string): Promise<DossierDOnboarding | 'organisation-inconnue'> {
  const payload = await instance()
  const doc = await payload.findByID({ collection: 'organisations', id: organisationId, depth: 0, disableErrors: true })
  if (!doc) return 'organisation-inconnue'
  const filièreId = identifiantDeRelation(doc.filiere)
  let filière: DossierDOnboarding['filière'] = null
  if (filièreId) {
    const f = await payload.findByID({ collection: 'filieres', id: filièreId, depth: 0, disableErrors: true })
    if (f) filière = { id: String(f.id), nom: f.nom, référentiel: await référentielActif(payload, { filiere: String(f.id) }) }
  }
  return {
    organisation: { id: String(doc.id), nom: doc.nom, slug: doc.slug, site: texte(doc.site), contactEmail: texte(doc.contact?.email) },
    filière,
    fiche: texte(doc.fiche),
    référentielUnique: await référentielActif(payload, { organisation: String(doc.id) }),
    référentielsNotion: null,
  }
}

export async function dossierDeProspect(prospectId: string): Promise<DossierDeProspect | 'prospect-inconnu'> {
  const payload = await instance()
  const prospect = await payload.findByID({ collection: 'prospects', id: prospectId, depth: 0, disableErrors: true })
  if (!prospect) return 'prospect-inconnu'
  const organisationId = identifiantDeRelation(prospect.organisation)
  const organisation = organisationId ? await payload.findByID({ collection: 'organisations', id: organisationId, depth: 0, disableErrors: true }) : null
  const filièreId = identifiantDeRelation(prospect.filiere) ?? (organisation ? identifiantDeRelation(organisation.filiere) : null)
  let filière: DossierDeProspect['filière'] = null
  let dernièreLettre: string | null = null
  if (filièreId) {
    const f = await payload.findByID({ collection: 'filieres', id: filièreId, depth: 0, disableErrors: true })
    if (f) filière = { nom: f.nom, référentiel: await référentielActif(payload, { filiere: String(f.id) }) }
    const { docs } = await payload.find({ collection: 'editions', where: { and: [{ filiere: { equals: filièreId } }, { statut: { equals: 'publiee' } }] }, sort: '-dateEdition', limit: 1, depth: 0 })
    dernièreLettre = texte(champ(docs[0], 'markdown'))
  }
  return {
    prospect: { id: String(prospect.id), organisation: organisation?.nom ?? 'organisation inconnue', site: texte(organisation?.site) },
    filière,
    dernièreLettreDeFilière: dernièreLettre,
  }
}

// ── Écritures ────────────────────────────────────────────────────────────────

export async function enregistrerLÉdition(remise: RemiseDÉdition, statut: 'publiee' | 'brouillon'): Promise<AccuséDeRemise> {
  const payload = await instance()
  const édition = await payload.create({
    collection: 'editions',
    data: {
      titre: remise.proprietes.titre,
      organisation: remise.organisation,
      filiere: remise.filiere,
      numero: remise.proprietes.numero,
      dateEdition: instantDuJour(remise.proprietes.dateEdition),
      statut,
      periodeCouverte: remise.proprietes.periodeCouverte,
      fenetreElargie: remise.proprietes.fenetreElargie,
      actionDeLaSemaine: remise.proprietes.actionDeLaSemaine,
      dossiersOuvertsSuivis: remise.proprietes.dossiersOuvertsSuivis,
      markdown: remise.markdown,
    },
  })
  const cible: Cible = remise.organisation ? { organisation: remise.organisation } : { filiere: remise.filiere ?? '' }
  await remplacerLeGel(payload, cible, remise.collecte.gelSuivant)
  if (statut === 'publiee' && remise.organisation && (remise.mode === 'onboarding' || remise.mode === 'decouverte')) {
    await payload.update({ collection: 'organisations', id: remise.organisation, data: { etat: 'active' } })
  }
  return { edition: String(édition.id), run: remise.run, statut }
}

async function remplacerLeGel(payload: Payload, cible: Cible, gel: RemiseDÉdition['collecte']['gelSuivant']): Promise<void> {
  const { docs } = await payload.find({ collection: 'gels', where: filtreDeCible(cible), pagination: false, limit: 0, depth: 0 })
  const existants = new Map(docs.map((d) => [texte(champ(d, 'url')) ?? '', String(d.id)]))
  const luLe = new Date().toISOString()
  for (const g of gel) {
    const id = existants.get(g.url)
    const data = { url: g.url, empreinte: g.empreinte, phrases: g.phrases, luLe, organisation: cible.organisation ?? null, filiere: cible.filiere ?? null }
    if (id) await payload.update({ collection: 'gels', id, data })
    else await payload.create({ collection: 'gels', data })
  }
}

export async function enregistrerLeRéférentiel(remise: RemiseDeRéférentiel): Promise<AccuséDeRemise> {
  const payload = await instance()
  const cible: Cible = remise.organisation ? { organisation: remise.organisation } : { filiere: remise.filiere ?? '' }
  const { docs } = await payload.find({ collection: 'referentiels', where: filtreDeCible(cible), sort: '-version', pagination: false, limit: 0, depth: 0 })
  const version = (typeof docs[0]?.version === 'number' ? docs[0].version : 0) + 1
  for (const ancien of docs) if (ancien.actif) await payload.update({ collection: 'referentiels', id: ancien.id, data: { actif: false } })
  const créé = await payload.create({
    collection: 'referentiels',
    data: { titre: remise.titre, markdown: remise.markdown, version, organisation: remise.organisation, filiere: remise.filiere, actif: true },
  })
  if (remise.organisation) {
    const organisation = await payload.findByID({ collection: 'organisations', id: remise.organisation, depth: 0, disableErrors: true })
    if (organisation) {
      await payload.update({
        collection: 'organisations',
        id: remise.organisation,
        data: { ...(remise.fiche ? { fiche: remise.fiche } : {}), ...(organisation.etat === 'a_onboarder' ? { etat: 'en_onboarding' } : {}) },
      })
    }
  }
  return { referentiel: String(créé.id), run: remise.run, statut: 'actif' }
}

export async function enregistrerLeBloc(prospectId: string, run: string, lignes: readonly string[]): Promise<'enregistré' | 'prospect-inconnu'> {
  const payload = await instance()
  const prospect = await payload.findByID({ collection: 'prospects', id: prospectId, depth: 0, disableErrors: true })
  if (!prospect) return 'prospect-inconnu'
  await payload.update({ collection: 'prospects', id: prospectId, data: { bloc: [...lignes], blocLe: new Date().toISOString() } })
  return 'enregistré'
}

/** Les prospects d'une filière à qui la lettre de filière part, avec leur bloc et leur adresse. */
export async function prospectsDeLaFilière(filièreId: string): Promise<Array<{ id: string; organisation: string; email: string; nom: string; bloc: string[] }>> {
  const payload = await instance()
  const { docs } = await payload.find({
    collection: 'prospects',
    where: { and: [{ filiere: { equals: filièreId } }, { statut: { not_in: ['desinscrit', 'abonne'] } }] },
    pagination: false,
    limit: 0,
    depth: 1,
  })
  return docs.flatMap((p) => {
    const email = texte(p.contact?.email)
    if (!email) return []
    const bloc = Array.isArray(p.bloc) ? (p.bloc as unknown[]).filter((l): l is string => typeof l === 'string') : []
    const organisation = typeof p.organisation === 'object' && p.organisation !== null ? p.organisation.nom : 'organisation'
    return [{ id: String(p.id), organisation, email, nom: texte(p.contact?.nom) ?? '', bloc }]
  })
}

export async function marquerLaLettreEnvoyée(prospectIds: readonly string[], jour: string): Promise<void> {
  const payload = await instance()
  for (const id of prospectIds) {
    const prospect = await payload.findByID({ collection: 'prospects', id, depth: 0, disableErrors: true })
    if (!prospect) continue
    const statut = prospect.statut === 'a_contacter' ? 'lettre_1_envoyee' : prospect.statut === 'lettre_1_envoyee' ? 'lettre_2_envoyee' : prospect.statut
    await payload.update({ collection: 'prospects', id, data: { statut, derniereLettreLe: instantDuJour(jour) } })
  }
}
