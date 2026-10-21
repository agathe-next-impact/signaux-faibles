/**
 * Le contrat entre les tâches Trigger.dev et le portail (programme du
 * 22 octobre 2026, §4) : ce qu'une tâche lit (`GET /api/veille/dossier`) et ce
 * qu'elle remet (`POST /api/veille/editions`, `POST /api/veille/referentiels`).
 * Ces types sont le seul endroit où la forme des deux côtés est écrite ; les
 * routes les valident avec les schémas zod ci-dessous, les tâches les importent.
 */
import { z } from 'zod'

export type ModeDeProduction = 'parution' | 'decouverte' | 'filiere' | 'onboarding'

/** Ce que le portail donne à une tâche pour produire une édition. */
export type DossierDeParution = {
  readonly organisation: { readonly id: string; readonly nom: string; readonly slug: string | null }
  readonly filière: { readonly id: string; readonly nom: string } | null
  /** Le référentiel unique, Markdown, lu par `lireRéférentielUnique`. */
  readonly référentiel: string
  readonly sélection: {
    readonly numéro: number
    readonly dateÉdition: string
    readonly période: { readonly début: string; readonly fin: string }
    readonly éditionPrécédente: { readonly dateÉdition: string; readonly essentiel: readonly string[]; readonly dossiersBruts: string } | null
  }
  /** Le gel des sources à la dernière parution : URL, empreinte, phrases. */
  readonly gel: ReadonlyArray<{ readonly url: string; readonly empreinte: string; readonly phrases: readonly string[] }>
}

export const schémaDeRemiseDÉdition = z.object({
  organisation: z.string().min(1).nullable(),
  filiere: z.string().min(1).nullable(),
  mode: z.enum(['parution', 'decouverte', 'filiere', 'onboarding']),
  run: z.string().min(1).describe('Identifiant du run Trigger.dev'),
  proprietes: z.object({
    titre: z.string().min(1),
    numero: z.number().int().min(1),
    dateEdition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodeCouverte: z.string(),
    fenetreElargie: z.boolean(),
    dossiersOuvertsSuivis: z.string(),
    actionDeLaSemaine: z.string(),
  }),
  markdown: z.string().min(1),
  acceptee: z.boolean(),
  controle: z.object({
    manquements: z.array(z.object({ code: z.string(), message: z.string() })),
    avertissements: z.array(z.object({ code: z.string(), message: z.string() })),
  }),
  mesures: z.object({
    couverture: z.object({ nommees: z.number(), ouvertes: z.number(), taux: z.number() }),
    faits: z.number(),
    reprises: z.number(),
    recherches: z.number(),
    cout: z.number(),
    dureeMs: z.number(),
    modele: z.string(),
  }),
  collecte: z.object({
    lectures: z.array(z.object({ url: z.string(), etat: z.string(), changee: z.boolean().nullable(), nouveautes: z.number() })),
    gelSuivant: z.array(z.object({ url: z.string(), empreinte: z.string(), phrases: z.array(z.string()) })),
  }),
  debut: z.string(),
  fin: z.string(),
})

export type RemiseDÉdition = z.infer<typeof schémaDeRemiseDÉdition>

export const schémaDeRemiseDeRéférentiel = z.object({
  organisation: z.string().min(1).nullable(),
  filiere: z.string().min(1).nullable(),
  run: z.string().min(1),
  titre: z.string().min(1),
  markdown: z.string().min(1),
  fiche: z.string().nullable(),
  cout: z.number(),
})

export type RemiseDeRéférentiel = z.infer<typeof schémaDeRemiseDeRéférentiel>

/** La réponse du portail à une remise acceptée. */
export type AccuséDeRemise = { readonly edition?: string; readonly referentiel?: string; readonly run: string; readonly statut: 'publiee' | 'brouillon' | 'actif' }

/** Ce que le portail donne à la tâche d'onboarding ou de découverte. */
export type DossierDOnboarding = {
  readonly organisation: { readonly id: string; readonly nom: string; readonly slug: string | null; readonly site: string | null; readonly contactEmail: string | null }
  readonly filière: { readonly id: string; readonly nom: string; readonly référentiel: string | null } | null
  readonly fiche: string | null
  /** Le référentiel unique déjà en base, Markdown, ou `null` s'il reste à produire. */
  readonly référentielUnique: string | null
  /** Pour un client historique : ses deux référentiels Notion, importés, ou `null`. */
  readonly référentielsNotion: { readonly écosystème: string; readonly concurrentiel: string; readonly dernièresÉditions: string } | null
}

/** Ce que le portail donne à la tâche du bloc personnalisé. */
export type DossierDeProspect = {
  readonly prospect: { readonly id: string; readonly organisation: string; readonly site: string | null }
  readonly filière: { readonly nom: string; readonly référentiel: string | null } | null
  readonly dernièreLettreDeFilière: string | null
}

export const schémaDeRemiseDeBloc = z.object({
  prospect: z.string().min(1),
  run: z.string().min(1),
  bloc: z.array(z.string().min(1).max(200)).min(1).max(8),
})
