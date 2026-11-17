/**
 * Les appels ouverts d'un lot de sources (17 novembre 2026,
 * `docs/lettre-appels-a-projets.md`, lot 3) : l'outil `appels_ouverts` de la
 * tâche des lettres, pour la famille « Appels à projets ».
 *
 * Il ne lit **que les sources inscrites dans la section « Appels à projets » du
 * référentiel** de l'organisation : la tâche lui passe le texte de cette
 * section, tel que Notion le lui a rendu, et les adresses à relever ; une
 * adresse dont le domaine n'y figure pas est refusée sans être ouverte. C'est la
 * garde du lot : les sources sont produites par le prompt à l'activation de la
 * lettre (consigne `appels`), et la collecte ne s'en écarte pas d'elle-même.
 *
 * Rien n'est jugé ici. Le code ouvre chaque page (requête simple, vingt
 * secondes), relève les liens dont l'intitulé ressemble à un appel (appel à
 * projets, AMI, appel à candidatures, prix, concours…), filtrés par les
 * mots-clés s'il y en a, avec les dates lisibles autour, et rend une ligne
 * courte par appel. Le sous-agent lecteur n'ouvre ensuite que les pages des
 * appels retenus, pour leurs critères. Les marchés publics sont écartés : la
 * lettre ne les couvre pas (décision de l'opératrice du 17 novembre 2026).
 */
import { versTexte } from '@/lib/moteur/collecte'
import { urlsDuMarkdown } from '@/lib/moteur/portes'
import { sansAccent } from '@/lib/domaine/texte'

export const SOURCES_PAR_APPEL_MAX = 20
export const APPELS_PAR_SOURCE_MAX = 40
const DÉLAI_MS = 20_000
const PLAFOND_HTML = 2_000_000

/** Un intitulé qui annonce un appel ouvert à une structure. */
const MOTIF_D_APPEL =
  /\b(appels? a (?:projets?|manifestation|candidatures?|initiatives?|propositions?)|ami\b|aap\b|appels? d'offres? de projets|prix\b|concours\b|trophees?\b|dispositif de soutien|programme de financement|subventions?\b)/

/** Ce que la lettre ne couvre pas : la commande publique. */
const MOTIF_DE_MARCHÉ = /\b(marches? publics?|appels? d'offres?\b(?! de projets)|consultation\b|dce\b|boamp\b|avis de marche|accord-cadre)/

const DATE_LISIBLE =
  /\b\d{1,2}(?:er)?\s+(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+\d{4})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g

export type AppelRelevé = {
  readonly source: string
  readonly intitulé: string
  readonly url: string
  readonly dates: readonly string[]
}

/** Les domaines des adresses citées dans la section du référentiel, `www.` retiré. */
export function domainesDeLaSection(section: string): Set<string> {
  const domaines = new Set<string>()
  for (const url of urlsDuMarkdown(section)) {
    try {
      domaines.add(new URL(url).hostname.toLowerCase().replace(/^www\./, ''))
    } catch {
      // une adresse illisible n'ouvre rien
    }
  }
  return domaines
}

/** Vrai si l'adresse est sur un domaine de la section, ou l'un de ses sous-domaines. */
export function estUneSourceDuRéférentiel(url: string, domaines: ReadonlySet<string>): boolean {
  let hôte: string
  try {
    const lue = new URL(url)
    if (lue.protocol !== 'https:' && lue.protocol !== 'http:') return false
    hôte = lue.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return false
  }
  for (const domaine of domaines) if (hôte === domaine || hôte.endsWith(`.${domaine}`)) return true
  return false
}

/** Les liens d'une page dont l'intitulé annonce un appel, avec les dates lisibles autour. */
export function appelsDeLaPage(html: string, source: string, motsClés: readonly string[] = []): AppelRelevé[] {
  const clés = motsClés.map((m) => sansAccent(m).trim()).filter(Boolean)
  const vus = new Set<string>()
  const appels: AppelRelevé[] = []
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const intitulé = versTexte(m[2] ?? '').replace(/\s+/g, ' ').trim()
    if (intitulé.length < 8 || intitulé.length > 300) continue
    const normalisé = sansAccent(intitulé)
    if (!MOTIF_D_APPEL.test(normalisé) || MOTIF_DE_MARCHÉ.test(normalisé)) continue
    // Les dates : dans l'intitulé, puis dans le texte qui suit le lien.
    // La suite s'arrête au lien suivant ou à la fin de l'élément : les dates
    // d'un autre appel de la liste ne sont pas les siennes.
    const après = html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 1_500)
    const fin = après.search(/<a\b|<\/(?:li|tr|p|article|div|h\d)>/i)
    const suite = versTexte(fin === -1 ? après : après.slice(0, fin)).slice(0, 300)
    if (clés.length > 0 && !clés.some((c) => normalisé.includes(c) || sansAccent(suite).includes(c))) continue
    let url: string
    try {
      url = new URL(m[1] ?? '', source).toString()
    } catch {
      continue
    }
    if (vus.has(url)) continue
    vus.add(url)
    const dates = [...new Set([...`${normalisé} ${sansAccent(suite)}`.matchAll(DATE_LISIBLE)].map((d) => d[0]))]
    appels.push({ source, intitulé, url, dates })
    if (appels.length >= APPELS_PAR_SOURCE_MAX) break
  }
  return appels
}

export type RelevéDesAppels = {
  readonly appels: readonly AppelRelevé[]
  readonly refusées: readonly string[]
  readonly nonOuvertes: readonly { readonly url: string; readonly raison: string }[]
}

/**
 * Relève les appels des sources données, après la garde. Les adresses refusées
 * ne sont jamais ouvertes ; une page qui ne s'ouvre pas est dite, avec sa raison.
 */
export async function releverLesAppels(
  entrée: { readonly section: string; readonly sources: readonly string[]; readonly motsClés?: readonly string[] },
  récupérer: typeof fetch = fetch,
): Promise<RelevéDesAppels> {
  const domaines = domainesDeLaSection(entrée.section)
  const admises: string[] = []
  const refusées: string[] = []
  for (const url of [...new Set(entrée.sources)].slice(0, SOURCES_PAR_APPEL_MAX)) {
    if (estUneSourceDuRéférentiel(url, domaines)) admises.push(url)
    else refusées.push(url)
  }
  const appels: AppelRelevé[] = []
  const nonOuvertes: { url: string; raison: string }[] = []
  await Promise.all(
    admises.map(async (url) => {
      try {
        const réponse = await récupérer(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(DÉLAI_MS),
          headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Mozilla/5.0 (compatible; veille)' },
        })
        if (!réponse.ok) {
          nonOuvertes.push({ url, raison: `HTTP ${réponse.status}` })
          return
        }
        const html = (await réponse.text()).slice(0, PLAFOND_HTML)
        // Une redirection hors des domaines de la section ne compte pas.
        const finale = réponse.url && réponse.url.length > 0 ? réponse.url : url
        if (!estUneSourceDuRéférentiel(finale, domaines)) {
          nonOuvertes.push({ url, raison: `redirigée hors du référentiel (${new URL(finale).hostname})` })
          return
        }
        appels.push(...appelsDeLaPage(html, finale, entrée.motsClés ?? []))
      } catch (erreur) {
        nonOuvertes.push({ url, raison: erreur instanceof Error && erreur.name === 'TimeoutError' ? 'délai' : 'réseau' })
      }
    }),
  )
  return { appels, refusées, nonOuvertes }
}

/** Le relevé en lignes courtes, pour le modèle. */
export function lignesDuRelevé(relevé: RelevéDesAppels): string {
  const lignes = relevé.appels.map((a) => `- ${a.intitulé} · ${a.dates.length > 0 ? a.dates.join(', ') : 'date à lire'} · ${a.url} (source : ${a.source})`)
  if (lignes.length === 0) lignes.push('Aucun appel relevé dans les sources ouvertes.')
  if (relevé.nonOuvertes.length > 0) {
    lignes.push('', 'Non ouvertes :', ...relevé.nonOuvertes.map((n) => `- ${n.url} : ${n.raison}`))
  }
  if (relevé.refusées.length > 0) {
    lignes.push('', 'Refusées (domaine absent de la section « Appels à projets » du référentiel) :', ...relevé.refusées.map((u) => `- ${u}`))
  }
  return lignes.join('\n')
}
