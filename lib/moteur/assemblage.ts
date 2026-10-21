/**
 * De la sortie structurée à la lettre : le Markdown au contrat de forme, les
 * propriétés de l'édition, les blocs que le portail lit (programme du
 * 22 octobre 2026, §3, étape 4). Aucun modèle ici : la forme est du code.
 */
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import type { BlocNotion } from '@/lib/domaine/document'
import type { SortieRédigée, Sélection } from '@/lib/moteur/redaction'
import { CERCLÉS, type RéférentielUnique } from '@/lib/moteur/referentiel'

export type PropriétésDÉdition = {
  readonly titre: string
  readonly numéro: number
  readonly dateÉdition: string
  readonly périodeCouverte: string
  readonly fenêtreÉlargie: boolean
  readonly dossiersOuvertsSuivis: string
  readonly actionDeLaSemaine: string
}

export type LettreAssemblée = {
  readonly markdown: string
  readonly blocs: BlocNotion[]
  readonly propriétés: PropriétésDÉdition
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function dateEnToutesLettres(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  if (!a || !m || !j) return iso
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`
}

const DATE_LISIBLE = /\b\d{1,2}(?:er)?\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i

/** Un fait dont le texte ne porte pas sa date la reçoit en tête : le validateur l'exige, le lecteur aussi. */
export function phraseDatée(texte: string, dateIso: string): string {
  const propre = texte.trim().replace(/\s+/g, ' ')
  if (DATE_LISIBLE.test(propre)) return propre
  const [, m, j] = dateIso.split('-').map(Number)
  if (!m || !j) return propre
  const date = `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`
  return `Le ${date}, ${propre.charAt(0).toLowerCase()}${propre.slice(1)}`
}

function texteDeLien(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'source'
  }
}

function ligneDeDossiers(sortie: SortieRédigée): string {
  return sortie.dossiers.map((d) => `${d.nom} (${d.compteur}${d.précision.trim() ? `, ${d.précision.trim()}` : ''})`).join(' · ')
}

export function titreDÉdition(organisation: string, numéro: number, dateÉdition: string): string {
  return `Veille ${organisation}, édition n° ${numéro} du ${dateEnToutesLettres(dateÉdition)}`
}

export function assemblerLaLettre(sortie: SortieRédigée, référentiel: RéférentielUnique, sélection: Sélection): LettreAssemblée {
  const lignes: string[] = ["# L'essentiel", '']
  for (const l of sortie.essentiel) lignes.push(`- ${l.trim()}`)
  lignes.push('', '# Actualités par axe', '')

  const parNuméro = new Map(sortie.axes.map((a) => [a.numéro, a]))
  for (const axe of référentiel.axes) {
    const rédigé = parNuméro.get(axe.numéro)
    const niveau = rédigé?.niveau ?? 'RAS'
    lignes.push(`## ${CERCLÉS[axe.numéro - 1] ?? `${axe.numéro}.`} ${axe.nom} — ${niveau}`, '')
    if (niveau === 'RAS' || !rédigé || rédigé.faits.length === 0) {
      const ras = rédigé?.ras?.trim() || `Rien de neuf sur cet axe pendant la période ; les sources nommées ont été relues sans fait daté.`
      lignes.push(`> ${ras}`, '')
      continue
    }
    for (const fait of rédigé.faits) {
      const phrase = phraseDatée(fait.texte, fait.date)
      const contexte = fait.contexte ? ' (élément de contexte, non nouveau)' : ''
      lignes.push(`${phrase}${contexte} ([${texteDeLien(fait.url)}](${fait.url}))`, '')
    }
  }

  if (sortie.dossiers.length > 0) {
    lignes.push('# Dossiers suivis', '')
    for (const d of sortie.dossiers) {
      const suivi = d.suivi.trim()
      lignes.push(suivi.includes(d.nom) ? suivi : `${d.nom} : ${suivi}`, '')
    }
  }

  const markdown = lignes.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
  const propriétés: PropriétésDÉdition = {
    titre: titreDÉdition(référentiel.organisation, sélection.numéro, sélection.dateÉdition),
    numéro: sélection.numéro,
    dateÉdition: sélection.dateÉdition,
    périodeCouverte: `du ${dateEnToutesLettres(sélection.période.début)} au ${dateEnToutesLettres(sélection.période.fin)}`,
    fenêtreÉlargie: sortie.axes.some((a) => a.faits.some((f) => f.contexte)),
    dossiersOuvertsSuivis: ligneDeDossiers(sortie),
    actionDeLaSemaine: sortie.actionDeLaSemaine.trim(),
  }
  return { markdown, blocs: markdownVersBlocs(markdown), propriétés }
}
