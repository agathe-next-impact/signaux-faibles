/**
 * L'envoi d'une édition publiée (programme du 22 octobre 2026) : la lettre
 * unique aux lecteurs actifs de l'organisation, ou la lettre de filière aux
 * prospects de la filière, chacun avec son bloc personnalisé en tête.
 *
 * Tout courrier passe par `envoyerCourrier` (journal avant Gmail). Une
 * organisation en relecture reçoit sa lettre à l'adresse de relecture, comme
 * les courriers de parcours. Aucune adresse n'est journalisée en clair.
 */
import { destinatairesDUneLettre } from '@/lib/base/parution'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { composerLettre } from '@/lib/email/lettre'
import { marquerLaLettreEnvoyée, prospectsDeLaFilière } from '@/lib/payload/dispositif'
import { cléDeCloisonnement } from '@/lib/payload/portail'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { empreinte } from '@/lib/portail/debit'

export type ÉditionÀDiffuser = {
  readonly id: string
  readonly titre: string
  readonly numéro: number
  readonly dateÉdition: string
  readonly périodeCouverte: string
}

export type BilanDEnvoi = { readonly destinataires: number; readonly envoyés: number; readonly issues: readonly string[] }

function portailUrl(): string {
  return process.env['PORTAIL_URL'] ?? 'https://www.signauxfaibles.io'
}

function adressePostale(): string | null {
  const valeur = process.env['ADRESSE_POSTALE']?.trim()
  return valeur ? valeur : null
}

export async function envoyerLaLettreAuxLecteurs(entrée: { organisationPayload: string; édition: ÉditionÀDiffuser; markdown: string }): Promise<BilanDEnvoi> {
  const organisation = await destinatairesDUneLettre(cléDeCloisonnement(entrée.organisationPayload))
  if (!organisation) return { destinataires: 0, envoyés: 0, issues: ['organisation-hors-portail'] }

  const relecteur = organisation.relectureRequise ? (organisation.emailRelecture ?? process.env['RELECTEUR_EMAIL'] ?? null) : null
  const destinataires = organisation.relectureRequise
    ? relecteur
      ? [{ lecteurId: null as string | null, adresse: relecteur, relecture: true }]
      : []
    : organisation.lecteurs.map((l) => ({ lecteurId: l.id as string | null, adresse: l.email, relecture: false }))
  if (destinataires.length === 0) return { destinataires: 0, envoyés: 0, issues: ['sans-destinataire'] }

  const lettre = composerLettre({
    édition: { pageId: entrée.édition.id, titre: entrée.édition.titre, veille: 'Veille', numéro: entrée.édition.numéro, dateÉdition: entrée.édition.dateÉdition, périodeCouverte: entrée.édition.périodeCouverte },
    blocs: markdownVersBlocs(entrée.markdown),
    slug: organisation.slug,
    organisation: organisation.nom,
    portailUrl: portailUrl(),
    adressePostale: adressePostale(),
  })

  const issues: string[] = []
  let envoyés = 0
  for (const d of destinataires) {
    try {
      const résultat = await envoyerCourrier({
        message: { destinataire: d.adresse, sujet: d.relecture ? `[Relecture, pour ${organisation.slug}] ${lettre.courriel.objet}` : lettre.courriel.objet, texte: lettre.texte, html: lettre.html },
        sorte: 'lettre',
        déclencheur: 'moteur',
        organisation: { id: organisation.organisationId },
        lecteurId: d.lecteurId,
        unique: false,
      })
      if (résultat.sorte === 'envoyé') envoyés += 1
      else issues.push(`${empreinte(d.adresse)}:${résultat.sorte}`)
    } catch (erreur) {
      issues.push(`${empreinte(d.adresse)}:échec`)
      console.error(`[parution] ${organisation.slug} : lettre vers ${empreinte(d.adresse)} en échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    }
  }
  return { destinataires: destinataires.length, envoyés, issues }
}

/** La lettre de filière : le bloc du prospect en tête, en encadré, puis la lettre. */
export async function envoyerLaLettreDeFilière(entrée: { filière: string; édition: ÉditionÀDiffuser; markdown: string }): Promise<BilanDEnvoi> {
  const prospects = await prospectsDeLaFilière(entrée.filière)
  if (prospects.length === 0) return { destinataires: 0, envoyés: 0, issues: ['sans-prospect'] }
  const issues: string[] = []
  const envoyésÀ: string[] = []
  for (const prospect of prospects) {
    const bloc = prospect.bloc.length > 0 ? `# Pour ${prospect.organisation}\n\n${prospect.bloc.map((l) => `- ${l}`).join('\n')}\n\n` : ''
    const lettre = composerLettre({
      édition: { pageId: entrée.édition.id, titre: entrée.édition.titre, veille: 'Veille', numéro: entrée.édition.numéro, dateÉdition: entrée.édition.dateÉdition, périodeCouverte: entrée.édition.périodeCouverte },
      blocs: markdownVersBlocs(bloc + entrée.markdown),
      slug: 'recevoir-mon-lien',
      organisation: prospect.organisation,
      portailUrl: portailUrl(),
      adressePostale: adressePostale(),
    })
    try {
      const résultat = await envoyerCourrier({
        message: { destinataire: prospect.email, sujet: lettre.courriel.objet, texte: lettre.texte, html: lettre.html },
        sorte: 'lettre_filiere',
        déclencheur: 'moteur',
        organisation: null,
        lecteurId: null,
        unique: false,
      })
      if (résultat.sorte === 'envoyé') envoyésÀ.push(prospect.id)
      else issues.push(`${empreinte(prospect.email)}:${résultat.sorte}`)
    } catch (erreur) {
      issues.push(`${empreinte(prospect.email)}:échec`)
      console.error(`[parution] filière ${entrée.filière} : lettre vers ${empreinte(prospect.email)} en échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    }
  }
  if (envoyésÀ.length > 0) await marquerLaLettreEnvoyée(envoyésÀ, entrée.édition.dateÉdition)
  return { destinataires: prospects.length, envoyés: envoyésÀ.length, issues }
}
