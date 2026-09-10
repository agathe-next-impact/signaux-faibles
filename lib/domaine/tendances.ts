import { lireDossiersOuverts } from '@/lib/domaine/dossiers'
import type { CléDeSemaine, Semaine } from '@/lib/domaine/semaines'

/**
 * L'évolution des dossiers, semaine après semaine.
 *
 * Le compteur d'un dossier est le nombre de semaines où il a été rouvert sans
 * avoir bougé. Suivi d'une semaine sur l'autre, il dit lesquels s'enlisent et
 * lesquels viennent de bouger.
 *
 * Tout se lit dans la propriété texte des éditions : cet écran ne demande donc
 * **aucune lecture du corps des notes**, et reste à une requête Notion pour
 * toute la profondeur de l'archive.
 */
export type PointDeSuivi = {
  readonly semaine: CléDeSemaine
  readonly libellé: string
  readonly compteur: number | null
  readonly précision: string | null
}

export type SuiviDeDossier = {
  readonly nom: string
  /** De la semaine la plus ancienne à la plus récente. */
  readonly points: readonly PointDeSuivi[]
  readonly compteurActuel: number | null
  readonly précisionActuelle: string | null
  /** `true` quand le compteur est retombé : le dossier a bougé. */
  readonly aBougé: boolean
  /** Nombre de semaines consécutives sans mouvement, à la dernière édition. */
  readonly semainesSansMouvement: number
}

type AvecDossiers = { readonly dossiersOuvertsBruts: string }

export function suivreLesDossiers<T extends AvecDossiers>(
  semaines: readonly Semaine<T & { dateÉdition: string }>[],
): SuiviDeDossier[] {
  // Les semaines arrivent de la plus récente à la plus ancienne ; on suit le
  // temps dans l'autre sens.
  const chronologique = [...semaines].reverse()
  const parNom = new Map<string, PointDeSuivi[]>()

  for (const semaine of chronologique) {
    // Un dossier peut figurer dans les deux notes de la semaine : on retient la
    // mention la plus avancée, comme dans la synthèse.
    const deLaSemaine = new Map<string, { compteur: number | null; précision: string | null }>()
    for (const édition of semaine.éditions) {
      for (const dossier of lireDossiersOuverts(édition.dossiersOuvertsBruts)) {
        const connu = deLaSemaine.get(dossier.nom)
        if (!connu || (dossier.compteur ?? -1) > (connu.compteur ?? -1)) {
          deLaSemaine.set(dossier.nom, {
            compteur: dossier.compteur,
            précision: dossier.précision,
          })
        }
      }
    }

    for (const [nom, valeur] of deLaSemaine) {
      const points = parNom.get(nom) ?? []
      points.push({
        semaine: semaine.clé,
        libellé: semaine.libellé,
        compteur: valeur.compteur,
        précision: valeur.précision,
      })
      parNom.set(nom, points)
    }
  }

  return [...parNom.entries()]
    .map(([nom, points]) => {
      const dernier = points.at(-1)
      const avantDernier = points.at(-2)
      const compteurActuel = dernier?.compteur ?? null

      return {
        nom,
        points,
        compteurActuel,
        précisionActuelle: dernier?.précision ?? null,
        aBougé:
          avantDernier !== undefined &&
          (compteurActuel ?? 0) < (avantDernier.compteur ?? 0),
        semainesSansMouvement: compteurActuel ?? 0,
      }
    })
    // Les dossiers qui s'enlisent d'abord ; à égalité, l'ordre alphabétique,
    // pour que la liste ne danse pas d'une semaine à l'autre.
    .sort(
      (a, b) =>
        b.semainesSansMouvement - a.semainesSansMouvement || a.nom.localeCompare(b.nom, 'fr'),
    )
}
