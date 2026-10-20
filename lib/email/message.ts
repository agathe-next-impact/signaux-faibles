import { z } from 'zod'
import {
  composerCourriel,
  composerTexte,
  corpsDeParagraphes,
  dateDuJour,
  racineDuPortail,
  urlSûre,
  type Courriel,
} from '@/lib/email/gabarit'

/**
 * Le courriel « message » : le template tel quel, rempli champ par champ.
 *
 * C'est la forme du point mensuel que la revue des référentiels dépose en
 * brouillon chez le client, et de tout courriel client qui n'est ni une lettre
 * ni un courrier du portail. La tâche donne le texte, le portail donne la
 * forme : aucun modèle n'écrit plus de HTML pour un client.
 *
 * Le schéma est la règle de la charte écrite en types : trois points au plus,
 * trois badges au plus, un seul bouton, des adresses https.
 */

const lien = z.object({
  libellé: z.string().trim().min(1).max(60),
  url: z.string().trim().refine((u) => urlSûre(u)?.startsWith('https://') === true, 'adresse https attendue'),
})

export const SCHÉMA_MESSAGE = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  organisation: z.string().trim().min(1).max(120).nullish(),
  objet: z.string().trim().min(1).max(160),
  préheader: z.string().trim().min(1).max(140),
  typeEnvoi: z.string().trim().min(1).max(30).default('Point mensuel'),
  surtitre: z.string().trim().min(1).max(60),
  titre: z.string().trim().min(1).max(120),
  accroche: z.string().trim().max(160).nullish(),
  salutation: z.string().trim().max(80).nullish(),
  paragraphes: z.array(z.string().trim().min(1).max(2000)).min(1).max(8),
  points: z
    .array(
      z.object({
        niveau: z.enum(['FORT', 'MOYEN', 'RAS']).nullish(),
        titre: z.string().trim().min(1).max(120),
        texte: z.string().trim().min(1).max(600),
        méta: z.string().trim().max(60).nullish(),
      }),
    )
    .max(3)
    .default([]),
  intituléDesPoints: z.string().trim().min(1).max(40).nullish(),
  action: lien.nullish(),
  lienSecondaire: lien.nullish(),
  réassurance: z.string().trim().max(200).nullish(),
  destinataire: z.email().nullish(),
})

export type ChampsDuMessage = z.infer<typeof SCHÉMA_MESSAGE>

export function composerMessageClient(
  champs: ChampsDuMessage,
  contexte: { readonly portailUrl: string; readonly adressePostale: string | null; readonly aujourdHui?: Date },
): { readonly html: string; readonly texte: string; readonly courriel: Courriel } {
  const racine = racineDuPortail(contexte.portailUrl)
  const espace = `${racine}/${champs.slug}`
  const courriel: Courriel = {
    objet: champs.objet,
    préheader: champs.préheader,
    typeEnvoi: champs.typeEnvoi,
    date: dateDuJour(contexte.aujourdHui),
    surtitre: champs.surtitre,
    titre: champs.titre,
    accroche: champs.accroche ?? null,
    salutation: champs.salutation ?? null,
    corps: corpsDeParagraphes(champs.paragraphes),
    points: champs.points.map((p) => ({ niveau: p.niveau ?? null, titre: p.titre, texte: p.texte, méta: p.méta ?? null })),
    ...(champs.intituléDesPoints ? { intituléDesPoints: champs.intituléDesPoints } : {}),
    action: champs.action ?? null,
    lienSecondaire: champs.lienSecondaire ?? null,
    réassurance: champs.réassurance ?? null,
    signature: { formule: 'Bien à vous,', nom: 'Agathe', rôle: 'Fondatrice' },
    pied: {
      sorte: 'client',
      destinataire: champs.destinataire ?? null,
      organisation: champs.organisation ?? null,
      gestion: `${espace}/abonnement`,
      versionWeb: null,
    },
    racine,
    adressePostale: contexte.adressePostale,
  }
  return { html: composerCourriel(courriel), texte: composerTexte(courriel), courriel }
}
