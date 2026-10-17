import { z } from 'zod'

/**
 * Variables d'environnement du portail.
 *
 * La lecture est paresseuse et mémoïsée : à la compilation, Next.js évalue les
 * modules sans que les secrets soient présents, et une validation au moment de
 * l'import ferait échouer le build. La validation a donc lieu au premier accès,
 * c'est-à-dire à la première requête servie.
 */
/**
 * Une variable facultative **définie à vide** vaut une variable absente.
 *
 * Vercel et `.env.example` écrivent volontiers `GOOGLE_COMPTE_SERVICE_EMAIL=`
 * sans valeur ; or `z.string().min(1).optional()` accepte `undefined` et refuse
 * `""`. Le 14 octobre 2026, cette différence faisait tomber toutes les pages du
 * portail dès qu'une variable facultative était posée vide dans l'hébergeur,
 * avec un message qui accusait la variable plutôt que la chaîne vide.
 */
const facultative = <T extends z.ZodType>(type: T) =>
  z.preprocess((valeur) => (valeur === '' ? undefined : valeur), type.optional())

const schema = z.object({
  NOTION_TOKEN: z.string().min(1),
  NOTION_BASE_EDITIONS: z.string().min(1),
  NOTION_BASE_ACCES: z.string().min(1),
  // Lu par le seul webhook, et directement dans `process.env` pour que la
  // vérification de signature n'ait pas à charger l'environnement complet.
  // Il reste déclaré ici pour la documentation du contrat, mais une page n'a
  // pas à tomber parce que l'abonnement au webhook n'a pas encore eu lieu.
  NOTION_WEBHOOK_SECRET: facultative(z.string().min(1)),
  ACCES_SECRET_HMAC: z.string().min(32),
  PORTAIL_URL: z.url(),
  // Trois façons de fournir le compte de service, de la plus sûre à la plus
  // fragile. Le fichier JSON entier est à préférer : il tient sur une ligne,
  // ses retours à la ligne y sont déjà échappés, et rien ne peut se perdre au
  // collage. Les deux variables séparées restent acceptées.
  GOOGLE_COMPTE_SERVICE_JSON: facultative(z.string().min(1)),
  GOOGLE_COMPTE_SERVICE_EMAIL: facultative(z.email()),
  GOOGLE_COMPTE_SERVICE_CLE_PRIVEE: facultative(z.string().min(1)),
  // Palier 1 : lues directement dans `process.env` par `lib/base/client.ts` et
  // `lib/auth/source-acces.ts`, pour qu'une base pas encore créée ou une faute
  // de frappe ne fasse pas tomber toutes les pages. Déclarées ici pour le contrat.
  DATABASE_URL: facultative(z.string().min(1)),
  // Volontairement une chaîne et non une énumération : la façade valide la
  // valeur et retombe sur `notion` en le journalisant. Une énumération ici
  // ferait d'une faute de frappe dans l'hébergeur une panne de tout le portail.
  SOURCE_ACCES: facultative(z.string()),
  // Palier 1c : lu directement dans `process.env` par le webhook Stripe, comme le
  // secret du webhook Notion. Le portail ne tombe pas tant que le compte Stripe
  // n'existe pas : le webhook refuse simplement les livraisons.
  STRIPE_WEBHOOK_SECRET: facultative(z.string().min(1)),
  // `reel` en production réelle ; toute autre valeur, ou rien, vaut le mode test.
  // Le webhook n'applique que les événements du mode déclaré.
  STRIPE_MODE: facultative(z.string()),
  // Souscription en ligne : lues dans `process.env` par `lib/stripe/souscription.ts`,
  // qui les valide et rend la souscription indisponible s'il en manque une.
  STRIPE_CLE_SECRETE: facultative(z.string().min(1)),
  STRIPE_PRIX_MENSUEL: facultative(z.string().min(1)),
  STRIPE_PRIX_ANNUEL: facultative(z.string().min(1)),
  STRIPE_TAUX_TVA: facultative(z.string().min(1)),
  GMAIL_EXPEDITEUR: z.email(),
  GMAIL_EXPEDITEUR_NOM: z.preprocess(
    (valeur) => (valeur === '' ? undefined : valeur),
    z.string().min(1).default('signauxfaibles'),
  ),
}).refine(
  (valeurs) =>
    Boolean(valeurs.GOOGLE_COMPTE_SERVICE_JSON) ||
    Boolean(valeurs.GOOGLE_COMPTE_SERVICE_EMAIL && valeurs.GOOGLE_COMPTE_SERVICE_CLE_PRIVEE),
  {
    message:
      'Renseigner GOOGLE_COMPTE_SERVICE_JSON — le fichier de clé entier, la voie ' +
      'recommandée — ou bien GOOGLE_COMPTE_SERVICE_EMAIL et ' +
      'GOOGLE_COMPTE_SERVICE_CLE_PRIVEE tous les deux.',
    path: ['GOOGLE_COMPTE_SERVICE_JSON'],
  },
)

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
