/**
 * Les parutions (programme du 22 octobre 2026, §4, et décision du 22 octobre
 * sur la file de travaux).
 *
 *   · **Les lettres des organisations** sortent de la file de travaux du
 *     portail (`lib/portail/file.ts`), qui décide seule quelle lettre produire,
 *     avec quel numéro et pour quelle parution. `vider-la-file` passe toutes
 *     les heures ouvrées : elle prend les travaux prenables un à un et confie
 *     chacun à `produire-la-lettre`, qui lit le dossier du travail, produit,
 *     et remet au portail avec l'identifiant du travail et de la session. C'est
 *     le portail qui conclut : accepté et publié, ou refusé et remis en file.
 *     Un run qui échoue ne reprend pas de lui-même (`maxAttempts: 1`) : le
 *     travail revient de lui-même dans la file après trois heures, et la
 *     troisième tentative l'abandonne, visible dans `/espaces/file`.
 *   · **Les lettres de filière** restent hors de la file : une par filière
 *     active, le lundi à 6 h, heure de Paris, décidée par le portail
 *     (`mode=selection`). Les faire entrer dans la file est la cible quand les
 *     filières dépasseront cinq ou que Cowork sera retiré.
 */
import { logger, schedules, task } from '@trigger.dev/sdk'
import { produireDepuisLeDossier, remiseDe } from './moteur'
import { lireLaSélectionDuJour, lireLeDossier, lireLeDossierDuTravail, prendreUnTravail, remettreLÉdition } from './portail'

function dateDuJour(timestamp: Date, timezone: string): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp)
}

/** Garde-fou contre une file qui ne se viderait pas : au-delà, le passage suivant reprendra. */
const PRISES_PAR_PASSAGE = 20

export const viderLaFile = schedules.task({
  id: 'vider-la-file',
  cron: { pattern: '0 6-20 * * 1-5', timezone: 'Europe/Paris' },
  run: async (_payload, { ctx }) => {
    const confiés: string[] = []
    for (let i = 0; i < PRISES_PAR_PASSAGE; i += 1) {
      const session = `${ctx.run.id}:${i + 1}`
      const pris = await prendreUnTravail(session)
      if (!pris) break
      if (pris.travail.type !== 'lettre' && pris.travail.type !== 'premiere_lettre') {
        logger.warn('travail d’un type que le moteur ne produit pas, laissé pris jusqu’à sa reprise', { travail: pris.travail.id, type: pris.travail.type })
        continue
      }
      await produireLaLettre.trigger({ travail: pris.travail.id, session, slug: pris.travail.organisation.slug })
      confiés.push(pris.travail.id)
    }
    logger.info('file vidée', { confiés: confiés.length })
    return { confiés }
  },
})

export const produireLaLettre = task({
  id: 'produire-la-lettre',
  maxDuration: 20 * 60,
  retry: { maxAttempts: 1 },
  run: async (payload: { travail: string; session: string; slug?: string; mode?: 'decouverte' }, { ctx }) => {
    const début = new Date()
    const dossier = await lireLeDossierDuTravail(payload.travail, payload.mode)
    logger.info('dossier du travail', { travail: payload.travail, slug: payload.slug, mode: dossier.travail.mode, numéro: dossier.sélection.numéro })
    const { production } = await produireDepuisLeDossier(dossier, { journal: (ligne) => logger.info(ligne) })
    const remise = {
      ...remiseDe(production, { organisation: dossier.organisation.id, filiere: null }, dossier.travail.mode, ctx.run.id, début),
      travail: payload.travail,
      session: payload.session,
    }
    const accusé = await remettreLÉdition(remise)
    logger.info('édition remise', { accusé, acceptée: production.acceptée, coût: production.mesures.coût, reprises: production.mesures.reprises })
    if (accusé.statut !== 'publiee') {
      // Le portail a refusé ou abandonné le travail : le run est en échec,
      // visible dans Trigger.dev, et la file garde la décision.
      throw new Error(`Travail ${payload.travail} non accepté par le portail (${'état' in accusé ? String(accusé.état) : accusé.statut}).`)
    }
    return { accusé, acceptée: production.acceptée, coût: production.mesures.coût, faits: production.mesures.faits, couverture: production.mesures.couverture.taux }
  },
})

export const lettresDeFilière = schedules.task({
  id: 'lettres-de-filiere',
  cron: { pattern: '0 6 * * 1', timezone: 'Europe/Paris' },
  run: async (payload) => {
    const dateÉdition = dateDuJour(payload.timestamp, payload.timezone)
    const sélection = await lireLaSélectionDuJour(dateÉdition)
    logger.info('filières du jour', { dateÉdition, filieres: sélection.filieres.length })
    if (sélection.filieres.length > 0) {
      await produireLaLettreDeFilière.batchTrigger(sélection.filieres.map((filiere) => ({ payload: { filiere, dateEdition: dateÉdition } })))
    }
    return { dateÉdition, filieres: sélection.filieres.length }
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
