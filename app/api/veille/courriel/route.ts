import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { SEUIL_GMAIL_OCTETS } from '@/lib/email/gabarit'
import { adressePostale, adresseDeRéponseSûre, boîteOpératrice, déposerChezLOpératrice, ErreurDEnvoi } from '@/lib/email/gmail'
import { composerProspection } from '@/lib/email/lemlist'
import { composerLettre } from '@/lib/email/lettre'
import { SCHÉMA_MESSAGE, composerMessageClient } from '@/lib/email/message'
import { env } from '@/lib/env'
import { lireBlocsDePage } from '@/lib/notion/editions'
import { lireÉditionDeTravail } from '@/lib/notion/travail'
import { identifiantAvecTirets, identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { empreinte } from '@/lib/portail/debit'
import { contrôlerLaLettre } from '@/lib/portail/lint'

/**
 * Mettre un courriel client à la charte (20 octobre 2026).
 *
 *   POST /api/veille/courriel
 *   Authorization: Bearer <ACTIVATION_SECRET>
 *
 *   { "sorte": "lettre", "page": "<page_id de l'édition>", "slug": "acme", "organisation": "Acme", "objet": "…" }
 *   { "sorte": "message", "slug": "acme", "objet": "…", "titre": "…", "paragraphes": ["…"], … }
 *
 * Rend `{ état: "composé", objet, html, texte, octets }`. La tâche Cowork pose
 * `html` dans `htmlBody` et `texte` dans `body` de `mcp__Gmail__create_draft` :
 * elle n'écrit plus de HTML elle-même. **La route n'envoie rien** et n'écrit
 * nulle part ; le brouillon reste relu et envoyé par l'opératrice.
 *
 * `lettre` : la page est lue avec le parseur de production (lecture de
 * travail, tous statuts : la lettre est encore en Brouillon), puis contrôlée
 * comme par `/api/veille/lint`. **Une lettre non conforme n'est pas mise en
 * forme** (422, avec ses ruptures) : ce qui part chez le client est ce que le
 * portail sait lire. À appeler après un lint conforme, qui a déjà expiré le
 * cache de la page : cette route ne tient aucun pouvoir d'invalidation.
 *
 * `message` : le template rempli champ par champ (point mensuel de la revue).
 *
 * `prospection` : l'un des trois emails de la séquence (lettre 1, relance J+4,
 * relance J+10), rempli pour un prospect, à déposer en brouillon Gmail quand
 * la prospection se fait sans lemlist. Désinscription par réponse « STOP ».
 *   { "sorte": "prospection", "étape": 1, "prénom": "Serge", "entreprise": "Suneido",
 *     "essentiel": "…", "faitMarquant": "…" }
 * Les règles de la charte sont dans le schéma (`lib/email/message.ts`).
 *
 * Au-delà de 102 Ko, Gmail masque la fin du message : `octets` est rendu, et
 * un dépassement est signalé par `avertissement`.
 *
 * **Le brouillon déposé par le portail** (23 octobre 2026). Avec
 * `"brouillon": { "à": ["client@exemple.fr"] }` (zéro à dix adresses, jamais de
 * copie), le portail dépose lui-même le courriel en brouillon dans la boîte de
 * l'opératrice (`GMAIL_BOITE_OPERATRICE`) et rend
 * `{ état: "brouillon", objet, idBrouillon, idMessage, octets }`, **sans le
 * HTML** : la tâche n'a plus à recopier 68 Ko par lettre dans `create_draft`.
 * Rien ne part : l'opératrice relit et envoie. Si la boîte n'est pas configurée
 * ou si Gmail refuse, la route rend le courriel composé comme sans `brouillon`,
 * avec `brouillon: { état: "indisponible" | "échec", … }` : la tâche dépose
 * alors le brouillon elle-même, comme avant.
 */

/** Les destinataires d'un brouillon : des adresses simples, sans retour à la ligne. */
const BROUILLON = z.object({
  à: z
    .array(z.string().trim().refine((a) => adresseDeRéponseSûre(a) !== null, 'adresse illisible'))
    .max(10),
})

const LETTRE = z.object({
  sorte: z.literal('lettre'),
  page: z.string().refine(identifiantNotionValide, 'identifiant de page invalide'),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  organisation: z.string().trim().min(1).max(120).nullish(),
  /** L'objet du brouillon, tel que la tâche l'a composé ; à défaut, le titre de l'édition. */
  objet: z.string().trim().min(1).max(160).nullish(),
  brouillon: BROUILLON.nullish(),
})

/** Un email de prospection rempli pour Gmail (pilote sans lemlist, 20 octobre 2026). */
const PROSPECTION = z
  .object({
    sorte: z.literal('prospection'),
    étape: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    prénom: z.string().trim().max(60).nullish(),
    entreprise: z.string().trim().min(1).max(120),
    essentiel: z.string().trim().max(1400).nullish(),
    faitMarquant: z.string().trim().max(300).nullish(),
    brouillon: BROUILLON.nullish(),
  })
  .refine((d) => d.étape !== 1 || Boolean(d.essentiel), { message: 'requis pour l’étape 1', path: ['essentiel'] })
  .refine((d) => d.étape !== 2 || Boolean(d.faitMarquant), { message: 'requis pour l’étape 2', path: ['faitMarquant'] })

const DEMANDE = z.discriminatedUnion('sorte', [
  LETTRE,
  SCHÉMA_MESSAGE.extend({ sorte: z.literal('message'), brouillon: BROUILLON.nullish() }),
  PROSPECTION,
])

type Brouillon = z.infer<typeof BROUILLON>

/**
 * Le courriel composé, rendu à la tâche ; ou, si elle demande un brouillon et
 * que la boîte de l'opératrice le permet, déposé par le portail et rendu sans
 * son HTML.
 */
async function réponse(
  objet: string,
  html: string,
  texte: string,
  brouillon: Brouillon | null | undefined,
  nomExpéditeur: string,
): Promise<NextResponse> {
  const octets = Buffer.byteLength(html, 'utf8')
  const avertissement =
    octets > SEUIL_GMAIL_OCTETS * 0.9
      ? { avertissement: `courriel de ${Math.round(octets / 1024)} Ko : Gmail masque la fin au-delà de 102 Ko` }
      : {}
  const composé = (extra: Record<string, unknown> = {}) =>
    NextResponse.json({ état: 'composé', objet, html, texte, octets, ...avertissement, ...extra })

  if (!brouillon) return composé()
  const boîte = boîteOpératrice()
  if (!boîte) {
    return composé({ brouillon: { état: 'indisponible', raison: 'boîte de l’opératrice non configurée' } })
  }
  try {
    const { idBrouillon, idMessage } = await déposerChezLOpératrice(
      { destinataire: brouillon.à.join(', '), sujet: objet, texte, html },
      boîte,
      nomExpéditeur,
    )
    // Jamais d'adresse dans le journal : l'empreinte de huit caractères.
    const pour = brouillon.à.length ? brouillon.à.map(empreinte).join(', ') : 'aucun destinataire'
    console.info(`[veille/courriel] brouillon ${idBrouillon ?? '?'} déposé pour ${pour}.`)
    return NextResponse.json({ état: 'brouillon', objet, idBrouillon, idMessage, destinataires: brouillon.à.length, octets, ...avertissement })
  } catch (erreur) {
    const statut = erreur instanceof ErreurDEnvoi ? erreur.statut : null
    // Le statut seul, comme le journal des courriers : le corps d'un refus de
    // Gmail peut reprendre une adresse.
    console.error(`[veille/courriel] brouillon non déposé : ${statut ? `Gmail ${statut}` : erreur instanceof Error ? erreur.name : 'erreur'}`)
    return composé({ brouillon: { état: 'échec', statut } })
  }
}

export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'courriel')
  if (refus) return refus

  let charge: unknown
  try {
    charge = await requête.json()
  } catch {
    return NextResponse.json({ état: 'refusée', raison: 'corps illisible' }, { status: 400 })
  }

  const lu = DEMANDE.safeParse(charge)
  if (!lu.success) {
    return NextResponse.json(
      {
        état: 'refusée',
        raison: lu.error.issues.map((i) => `${i.path.join('.') || 'corps'} : ${i.message}`).join(' ; '),
      },
      { status: 400 },
    )
  }
  const demande = lu.data

  try {
    const configuration = env()
    const portailUrl = configuration.PORTAIL_URL
    const nomExpéditeur = configuration.GMAIL_EXPEDITEUR_NOM ?? 'signauxfaibles'

    if (demande.sorte === 'prospection') {
      const courriel = composerProspection(
        {
          étape: demande.étape,
          prénom: demande.prénom ?? null,
          entreprise: demande.entreprise,
          essentiel: demande.essentiel ?? null,
          faitMarquant: demande.faitMarquant ?? null,
        },
        { portailUrl, adressePostale: adressePostale() },
      )
      console.info(`[veille/courriel] prospection, étape ${demande.étape}, composée.`)
      return réponse(courriel.objet, courriel.html, courriel.texte, demande.brouillon, nomExpéditeur)
    }

    if (demande.sorte === 'message') {
      const { html, texte } = composerMessageClient(demande, { portailUrl, adressePostale: adressePostale() })
      console.info(`[veille/courriel] message pour ${demande.slug} composé.`)
      return réponse(demande.objet, html, texte, demande.brouillon, nomExpéditeur)
    }

    const pageId = identifiantAvecTirets(demande.page)
    const édition = await lireÉditionDeTravail(pageId)
    if (!édition) {
      return NextResponse.json({ état: 'introuvable', raison: 'aucune page d’édition à cet identifiant' }, { status: 404 })
    }
    const blocs = await lireBlocsDePage(pageId)

    const rapport = contrôlerLaLettre({
      titre: édition.titre,
      blocs,
      dossiersBruts: édition.dossiersOuvertsBruts,
      numéro: édition.numéro,
    })
    if (!rapport.conforme) {
      console.warn(`[veille/courriel] ${pageId} non conforme : ${rapport.ruptures.length} rupture(s), non mise en forme.`)
      return NextResponse.json({ état: 'non-conforme', ruptures: rapport.ruptures }, { status: 422 })
    }

    const objet = demande.objet ?? édition.titre
    const lettre = composerLettre({
      objet,
      édition,
      blocs,
      slug: demande.slug,
      organisation: demande.organisation ?? null,
      portailUrl,
      adressePostale: adressePostale(),
    })
    console.info(`[veille/courriel] lettre ${pageId} pour ${demande.slug} composée (${lettre.axes} axe(s)).`)
    return réponse(objet, lettre.html, lettre.texte, demande.brouillon, nomExpéditeur)
  } catch (erreur) {
    console.error(`[veille/courriel] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
