/**
 * Ce que toutes les tâches de production partagent : le client Anthropic de
 * production, le navigateur de la machine Trigger.dev, la conversion d'une
 * production du moteur en remise pour le portail.
 */
import Anthropic from '@anthropic-ai/sdk'
import { navigateurPlaywright, type Gel } from '@/lib/moteur/collecte'
import { produireLaLettre, type Production } from '@/lib/moteur/produire'
import type { Sélection } from '@/lib/moteur/redaction'
import { lireRéférentielUnique } from '@/lib/moteur/referentiel'
import type { DossierDeParution, ModeDeProduction, RemiseDÉdition } from '@/lib/moteur/remise'

export function clientAnthropic(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY est requise dans l’environnement Trigger.dev.')
  return new Anthropic({ apiKey, maxRetries: 3 })
}

export function gelDuDossier(dossier: DossierDeParution): Map<string, Gel> {
  return new Map(dossier.gel.map((g) => [g.url, { empreinte: g.empreinte, phrases: g.phrases }]))
}

export async function produireDepuisLeDossier(
  dossier: DossierDeParution,
  options: { journal?: (ligne: string) => void; reprisesMax?: number } = {},
): Promise<{ production: Production; sélection: Sélection }> {
  const référentiel = lireRéférentielUnique(dossier.référentiel)
  const sélection: Sélection = dossier.sélection
  const production = await produireLaLettre(
    { référentiel, sélection },
    {
      anthropic: clientAnthropic(),
      gel: gelDuDossier(dossier),
      ouvrirNavigateur: () => navigateurPlaywright(),
      effort: 'medium',
      journal: options.journal,
      ...(options.reprisesMax !== undefined ? { reprisesMax: options.reprisesMax } : {}),
    },
  )
  return { production, sélection }
}

export function remiseDe(
  production: Production,
  cible: { organisation: string | null; filiere: string | null },
  mode: ModeDeProduction,
  run: string,
  début: Date,
): RemiseDÉdition {
  const { lettre, contrôle, mesures, collecte } = production
  return {
    organisation: cible.organisation,
    filiere: cible.filiere,
    mode,
    run,
    proprietes: {
      titre: lettre.propriétés.titre,
      numero: lettre.propriétés.numéro,
      dateEdition: lettre.propriétés.dateÉdition,
      periodeCouverte: lettre.propriétés.périodeCouverte,
      fenetreElargie: lettre.propriétés.fenêtreÉlargie,
      dossiersOuvertsSuivis: lettre.propriétés.dossiersOuvertsSuivis,
      actionDeLaSemaine: lettre.propriétés.actionDeLaSemaine,
    },
    markdown: lettre.markdown,
    acceptee: production.acceptée,
    controle: {
      manquements: contrôle.manquements.map((m) => ({ code: m.code, message: m.message })),
      avertissements: contrôle.rapport.avertissements.map((a) => ({ code: a.code, message: a.message })),
    },
    mesures: {
      couverture: { nommees: mesures.couverture.nommées, ouvertes: mesures.couverture.ouvertes, taux: mesures.couverture.taux },
      faits: mesures.faits,
      reprises: mesures.reprises,
      recherches: mesures.recherches,
      cout: mesures.coût,
      dureeMs: mesures.duréeMs,
      modele: mesures.modèle,
    },
    collecte: {
      lectures: collecte.lectures.map((l) => ({ url: l.url, etat: l.état, changee: l.changée, nouveautes: l.nouveautés })),
      gelSuivant: [...collecte.gelSuivant.entries()].map(([url, g]) => ({ url, empreinte: g.empreinte, phrases: [...g.phrases] })),
    },
    debut: début.toISOString(),
    fin: new Date().toISOString(),
  }
}
