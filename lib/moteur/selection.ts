/**
 * La sélection d'une parution, en code (programme du 22 octobre 2026, §3,
 * étape 1) : le numéro suivant, la période couverte, ce que l'édition
 * précédente laisse. Fonctions pures : la route qui sert le dossier lit la
 * base, puis appelle ici.
 */
import type { Sélection } from '@/lib/moteur/redaction'

export type ÉditionPrécédente = {
  readonly dateÉdition: string
  readonly numéro: number
  /** Les lignes de « L'essentiel », pour que la lettre suivante prolonge sans répéter. */
  readonly essentiel: readonly string[]
  readonly dossiersBruts: string
}

export const PÉRIODE_MIN_JOURS = 7
export const PÉRIODE_MAX_JOURS = 14

export function décalerLaDate(iso: string, jours: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

/**
 * La période va du jour de l'édition précédente (que celle-ci ne couvrait pas :
 * elle s'arrêtait la veille) à la veille de la date d'édition ; sept jours au moins (une parution rattrapée le lendemain d'une
 * autre couvrirait sinon une journée), quatorze au plus (au-delà, une lettre
 * n'est plus une lettre de la semaine ; les faits plus anciens entrent comme
 * contexte).
 */
export function périodeDe(dateÉdition: string, précédente: ÉditionPrécédente | null): { début: string; fin: string } {
  const fin = décalerLaDate(dateÉdition, -1)
  const auMoinsSept = décalerLaDate(dateÉdition, -PÉRIODE_MIN_JOURS)
  const auPlusQuatorze = décalerLaDate(dateÉdition, -PÉRIODE_MAX_JOURS)
  let début = précédente ? précédente.dateÉdition : auMoinsSept
  if (début > auMoinsSept) début = auMoinsSept
  if (début < auPlusQuatorze) début = auPlusQuatorze
  return { début, fin: fin < début ? début : fin }
}

export function sélectionDe(dateÉdition: string, précédente: ÉditionPrécédente | null): Sélection {
  return {
    numéro: (précédente?.numéro ?? 0) + 1,
    dateÉdition,
    période: périodeDe(dateÉdition, précédente),
    éditionPrécédente: précédente ? { dateÉdition: précédente.dateÉdition, essentiel: précédente.essentiel, dossiersBruts: précédente.dossiersBruts } : null,
  }
}

/** Les lignes de « L'essentiel » d'une lettre Markdown : puces et paragraphes avant le titre suivant. */
export function essentielDuMarkdown(markdown: string): string[] {
  const lignes = markdown.split(/\r?\n/)
  const début = lignes.findIndex((l) => /^#\s+l[’']?essentiel/i.test(l.normalize('NFD').replace(/[̀-ͯ]/g, '')))
  if (début === -1) return []
  const sortie: string[] = []
  for (let i = début + 1; i < lignes.length; i += 1) {
    const ligne = lignes[i]!
    if (/^#{1,2}\s/.test(ligne)) break
    const texte = ligne.replace(/^\s*[-*•]\s*/, '').trim()
    if (texte.length > 0) sortie.push(texte)
  }
  return sortie
}
