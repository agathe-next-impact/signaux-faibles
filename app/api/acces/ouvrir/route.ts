import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { composerLienDAccès } from '@/lib/auth/jeton'
import { composerCourrierDAccès, envoyerMessage } from '@/lib/email/gmail'
import { env } from '@/lib/env'
import { lireAccèsActifParEmail } from '@/lib/notion/acces'
import { sourcesDeDonnées } from '@/lib/notion/client'
import { listerÉditionsPubliées } from '@/lib/notion/editions'
import { interpréterDemande } from '@/lib/portail/activation'

/**
 * Ouvrir l'espace d'un lecteur, appelée par l'onboarding Cowork.
 *
 * Voir `lib/portail/activation.ts` pour le partage des rôles et pourquoi la
 * demande porte un email et non l'identifiant d'accès.
 *
 * La réponse porte un **diagnostic**, et c'est le second apport de cette route.
 * Le portail est le seul à savoir si l'identifiant d'organisation recopié dans
 * « Accès » rencontre réellement des éditions : c'est lui qui pose le filtre.
 * `lettresPubliées` à zéro juste après l'activation est normal — la première
 * lettre n'est pas encore au statut « Envoyé ». Le même zéro une semaine plus
 * tard est exactement la panne de l'Hermitage, et il se voit désormais dans la
 * réponse plutôt que dans le silence d'un espace vide.
 *
 * Le lien composé n'apparaît jamais dans la réponse ni dans les journaux : il
 * ne vit que dans le courrier, et le jeton ne se lit que dans `/acces/[jeton]`.
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const brut = await requête.text()

  // `process.env` et non `lib/env.ts`, comme le webhook et pour la même classe
  // de raison : le portail refuse de démarrer si une variable manque, et cette
  // route est ouverte. Passer par la validation complète avant d'avoir vérifié
  // le jeton laisserait un appelant anonyme provoquer une 500 en apprenant au
  // passage ce qui est mal configuré. Le contrôle d'abord, l'environnement
  // ensuite — `env()` n'est lu qu'une fois la demande authentifiée.
  const décision = interpréterDemande({
    brut,
    autorisation: requête.headers.get('authorization'),
    secret: process.env['ACTIVATION_SECRET'],
  })

  switch (décision.sorte) {
    case 'non-configurée':
      // 503 et non 401 : la demande n'est pas en cause, la route l'est. Sans
      // cette distinction, l'onboarding conclurait à un mauvais jeton et
      // chercherait au mauvais endroit.
      console.error(
        '[activation] ACTIVATION_SECRET absent : la route est fermée. ' +
          'La définir côté portail et côté tâche Cowork pour ouvrir les espaces ' +
          'automatiquement.',
      )
      return NextResponse.json({ état: 'non-configurée' }, { status: 503 })

    case 'refusée':
      console.warn(`[activation] demande refusée : ${décision.raison}`)
      return NextResponse.json({ état: 'refusée' }, { status: 401 })

    case 'ouvrir':
      return ouvrir(décision.email)
  }
}

async function ouvrir(email: string): Promise<NextResponse> {
  try {
    const accès = await lireAccèsActifParEmail(email)

    if (!accès?.email) {
      // La ligne vient peut-être d'être écrite : le profil `acces` la garde une
      // minute, et le webhook n'a pas forcément encore invalidé. On expire le
      // tag pour que la tentative suivante lise Notion sans attendre, et on
      // répond 404 — l'onboarding réessaie.
      const { accès: sourceId } = await sourcesDeDonnées()
      revalidateTag(`liste:${sourceId}`, { expire: 0 })

      console.warn(
        `[activation] aucun accès actif pour ${email}. Si la ligne vient d'être ` +
          'créée, réessayer dans quelques secondes ; sinon vérifier « Actif » et ' +
          "l'orthographe de l'adresse dans « Accès — portail ».",
      )
      return NextResponse.json({ état: 'introuvable' }, { status: 404 })
    }

    const lien = composerLienDAccès(
      accès.identifiant,
      env().ACCES_SECRET_HMAC,
      env().PORTAIL_URL,
    )
    const courrier = composerCourrierDAccès(accès.nom, lien)
    await envoyerMessage({ ...courrier, destinataire: accès.email })

    // Après l'envoi, pas avant : un diagnostic n'a pas à retarder le courrier,
    // et une liste d'éditions indisponible ne doit pas empêcher l'ouverture.
    const lettres = await listerÉditionsPubliées(accès.organisationId)

    console.info(
      `[activation] espace ouvert pour ${accès.email} (${accès.slug}) : ` +
        `${lettres.length} lettre(s) publiée(s).`,
    )

    return NextResponse.json({
      état: 'envoyé',
      slug: accès.slug,
      organisation: accès.organisationLibellé,
      lettresPubliées: lettres.length,
    })
  } catch (erreur) {
    console.error(
      `[activation] échec de l'ouverture pour ${email} : ` +
        (erreur instanceof Error ? erreur.message : String(erreur)),
    )
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
