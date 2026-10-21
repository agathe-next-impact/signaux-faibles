/**
 * La parution hebdomadaire (programme du 22 octobre 2026, §4) : le lundi à
 * 6 h, heure de Paris, une tâche par organisation active et une par filière
 * active, décidées par le portail. Chaque tâche produit, passe les portes et
 * remet ; le portail publie et envoie.
 */
import { logger, schedules, task } from '@trigger.dev/sdk'
import { produireDepuisLeDossier, remiseDe } from './moteur'
import { lireLaSélectionDuJour, lireLeDossier, remettreLÉdition } from './portail'

function dateDuJour(timestamp: Date, timezone: string): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp)
}

export const parutionHebdomadaire = schedules.task({
  id: 'parution-hebdomadaire',
  cron: { pattern: '0 6 * * 1', timezone: 'Europe/Paris' },
  run: async (payload) => {
    const dateÉdition = dateDuJour(payload.timestamp, payload.timezone)
    const sélection = await lireLaSélectionDuJour(dateÉdition)
    logger.info('sélection du jour', { dateÉdition, organisations: sélection.organisations.length, filieres: sélection.filieres.length })
    if (sélection.organisations.length > 0) {
      await produireLaLettre.batchTrigger(sélection.organisations.map((organisation) => ({ payload: { organisation, dateEdition: dateÉdition, mode: 'parution' as const } })))
    }
    if (sélection.filieres.length > 0) {
      await produireLaLettreDeFilière.batchTrigger(sélection.filieres.map((filiere) => ({ payload: { filiere, dateEdition: dateÉdition } })))
    }
    return { dateÉdition, organisations: sélection.organisations.length, filieres: sélection.filieres.length }
  },
})

export const produireLaLettre = task({
  id: 'produire-la-lettre',
  maxDuration: 20 * 60,
  retry: { maxAttempts: 2 },
  run: async (payload: { organisation: string; dateEdition?: string; mode: 'parution' | 'decouverte' | 'onboarding' }, { ctx }) => {
    const début = new Date()
    const dossier = await lireLeDossier({ organisation: payload.organisation }, payload.mode, payload.dateEdition)
    const { production } = await produireDepuisLeDossier(dossier, { journal: (ligne) => logger.info(ligne) })
    const remise = remiseDe(production, { organisation: payload.organisation, filiere: null }, payload.mode, ctx.run.id, début)
    const accusé = await remettreLÉdition(remise)
    logger.info('édition remise', { accusé, acceptée: production.acceptée, coût: production.mesures.coût, reprises: production.mesures.reprises })
    return { accusé, acceptée: production.acceptée, coût: production.mesures.coût, faits: production.mesures.faits, couverture: production.mesures.couverture.taux }
  },
})

export const produireLaLettreDeFilière = task({
  id: 'produire-la-lettre-de-filiere',
  maxDuration: 20 * 60,
  retry: { maxAttempts: 2 },
  run: async (payload: { filiere: string; dateEdition?: string }, { ctx }) => {
    const début = new Date()
    const dossier = await lireLeDossier({ filiere: payload.filiere }, 'filiere', payload.dateEdition)
    const { production } = await produireDepuisLeDossier(dossier, { journal: (ligne) => logger.info(ligne) })
    const remise = remiseDe(production, { organisation: null, filiere: payload.filiere }, 'filiere', ctx.run.id, début)
    const accusé = await remettreLÉdition(remise)
    return { accusé, acceptée: production.acceptée, coût: production.mesures.coût }
  },
})
