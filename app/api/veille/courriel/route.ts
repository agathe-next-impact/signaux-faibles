import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { SEUIL_GMAIL_OCTETS } from '@/lib/email/gabarit'
import { adressePostale } from '@/lib/email/gmail'
import { composerLettre } from '@/lib/email/lettre'
import { SCHÉMA_MESSAGE, composerMessageClient } from '@/lib/email/message'
import { env } from '@/lib/env'
import { lireBlocsDePage } from '@/lib/notion/editions'
import { lireÉditionDeTravail } from '@/lib/notion/travail'
import { identifiantAvecTirets, identifiantNotionValide, refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
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
 * Les règles de la charte sont dans le schéma (`lib/email/message.ts`).
 *
 * Au-delà de 102 Ko, Gmail masque la fin du message : `octets` est rendu, et
 * un dépassement est signalé par `avertissement`.
 */

const LETTRE = z.object({
  sorte: z.literal('lettre'),
  page: z.string().refine(identifiantNotionValide, 'identifiant de page invalide'),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  organisation: z.string().trim().min(1).max(120).nullish(),
  /** L'objet du brouillon, tel que la tâche l'a composé ; à défaut, le titre de l'édition. */
  objet: z.string().trim().min(1).max(160).nullish(),
})

const DEMANDE = z.discriminatedUnion('sorte', [LETTRE, SCHÉMA_MESSAGE.extend({ sorte: z.literal('message') })])

function réponse(objet: string, html: string, texte: string): NextResponse {
  const octets = Buffer.byteLength(html, 'utf8')
  return NextResponse.json({
    état: 'composé',
    objet,
    html,
    texte,
    octets,
    ...(octets > SEUIL_GMAIL_OCTETS * 0.9
      ? { avertissement: `courriel de ${Math.round(octets / 1024)} Ko : Gmail masque la fin au-delà de 102 Ko` }
      : {}),
  })
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
    const portailUrl = env().PORTAIL_URL

    if (demande.sorte === 'message') {
      const { html, texte } = composerMessageClient(demande, { portailUrl, adressePostale: adressePostale() })
      console.info(`[veille/courriel] message pour ${demande.slug} composé.`)
      return réponse(demande.objet, html, texte)
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
    return réponse(objet, lettre.html, lettre.texte)
  } catch (erreur) {
    console.error(`[veille/courriel] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
