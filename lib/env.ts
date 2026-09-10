import { z } from 'zod'

/**
 * Variables d'environnement du portail.
 *
 * La lecture est paresseuse et mémoïsée : à la compilation, Next.js évalue les
 * modules sans que les secrets soient présents, et une validation au moment de
 * l'import ferait échouer le build. La validation a donc lieu au premier accès,
 * c'est-à-dire à la première requête servie.
 */
const schema = z.object({
  NOTION_TOKEN: z.string().min(1),
  NOTION_BASE_EDITIONS: z.string().min(1),
  NOTION_BASE_ACCES: z.string().min(1),
  NOTION_WEBHOOK_SECRET: z.string().min(1),
  ACCES_SECRET_HMAC: z.string().min(32),
  PORTAIL_URL: z.url(),
  GOOGLE_COMPTE_SERVICE_EMAIL: z.email(),
  GOOGLE_COMPTE_SERVICE_CLE_PRIVEE: z.string().min(1),
  GMAIL_EXPEDITEUR: z.email(),
  GMAIL_EXPEDITEUR_NOM: z.string().min(1).default('signauxfaibles'),
})

export type Env = z.infer<typeof schema>

let memo: Env | undefined

export function env(): Env {
  if (memo) return memo

  const resultat = schema.safeParse(process.env)
  if (!resultat.success) {
    const manquantes = resultat.error.issues
      .map((probleme) => `  ${probleme.path.join('.')} — ${probleme.message}`)
      .join('\n')
    throw new Error(
      `Le portail ne peut pas démarrer : variables d'environnement invalides.\n${manquantes}\n` +
        'Voir .env.example pour la liste attendue.',
    )
  }

  // La clé privée est conservée telle qu'elle arrive. Sa remise en forme vit
  // dans lib/email/gmail.ts, là où elle est employée, parce qu'elle doit lever
  // un message utile et non se contenter d'un remplacement silencieux.
  memo = resultat.data
  return memo
}

/** Réservé aux tests. */
export function reinitialiserEnv(): void {
  memo = undefined
}
