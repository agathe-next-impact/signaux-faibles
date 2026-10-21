import { dater, décaler, paraîtLe, type Cadence, type Jour, JOURS } from '@/lib/domaine/calendrier'
import { lundiDeLaSemaine } from '@/lib/domaine/semaines'

/**
 * Ce que la file de travaux calcule sans toucher ni à la base ni à Notion :
 * quelles parutions tombent dans l'horizon, et quelle famille Notion porte
 * chaque type de veille.
 *
 * La règle de parution est celle de `paraîtLe`, la seule copie testée de la
 * cadence ; ce module ne la réécrit pas, il traduit les colonnes Postgres
 * (`jour_parution` 1 à 7, `cadence` en enum) vers son vocabulaire.
 */

export type CadenceDeVeille = 'hebdomadaire' | 'bimensuelle' | 'mensuelle'

export type VeilleÀPlanifier = {
  readonly id: string
  readonly type: string
  readonly jourParution: number
  /** `HH:MM` ou `HH:MM:SS`, heure de Paris. */
  readonly heureParution: string
  readonly cadence: CadenceDeVeille
}

export type ParutionÀPlanifier = {
  readonly veilleId: string
  /** La date de parution, à Paris. */
  readonly date: string
  /** Le lundi de sa semaine ISO. */
  readonly semaine: string
}

const CADENCE_DU_REGISTRE: Record<CadenceDeVeille, Cadence> = {
  hebdomadaire: 'Hebdomadaire',
  bimensuelle: 'Quinzaine (semaines paires)',
  mensuelle: 'Mensuelle (1re occurrence du mois)',
}

/** Le jour de parution d'une veille, dans le vocabulaire du calendrier. */
export function jourDeParution(veille: Pick<VeilleÀPlanifier, 'jourParution'>): Jour {
  const jour = JOURS[veille.jourParution - 1]
  if (!jour) throw new Error(`Jour de parution hors de 1 à 7 : ${veille.jourParution}`)
  return jour
}

/**
 * Les parutions des veilles données qui tombent d'`aujourdHui` (inclus) à
 * `horizonJours` jours plus tard : une par veille et par date, dans l'ordre
 * des dates. Sept jours d'horizon : la file montre la semaine qui vient, et
 * le passage quotidien, rejouable, n'y ajoute que ce qui manque.
 */
export function parutionsÀPlanifier(
  veilles: readonly VeilleÀPlanifier[],
  aujourdHui: string,
  horizonJours = 7,
): ParutionÀPlanifier[] {
  const parutions: ParutionÀPlanifier[] = []
  for (let écart = 0; écart < horizonJours; écart++) {
    const date = décaler(aujourdHui, écart)
    const datation = dater(date)
    for (const veille of veilles) {
      const organisation = { slug: veille.id, jour: jourDeParution(veille), cadence: CADENCE_DU_REGISTRE[veille.cadence] }
      if (paraîtLe(organisation, datation)) {
        parutions.push({ veilleId: veille.id, date, semaine: lundiDeLaSemaine(date) })
      }
    }
  }
  return parutions
}

/**
 * La famille Notion (`Famille`, clé interne à deux valeurs de la base
 * Éditions) que porte un type de veille. Tant que les éditions existent dans
 * Notion, c'est elle que le contexte d'un run et le contrôle du résultat
 * comparent ; un type sans famille est servi tel quel, et la porte
 * `famille-différente` ne s'applique pas.
 */
export function familleDuType(type: string): string | null {
  switch (type) {
    case 'ecosysteme':
      return 'Écosystème'
    case 'concurrentielle':
      return 'Concurrentiel'
    default:
      return null
  }
}
