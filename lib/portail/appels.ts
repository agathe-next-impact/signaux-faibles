import { baseConfigurée, type Base } from '@/lib/base/client'
import { appelsDeLOrganisation, éditionsDAppels, remplacerLesAppelsDeLÉdition } from '@/lib/base/appels'
import { appelsDeLaLettre, vueDesAppels, type LettreDAppels, type VueDesAppels } from '@/lib/domaine/appels'
import { construireDocument, type BlocNotion } from '@/lib/domaine/document'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import type { ÉditionDeTravail } from '@/lib/notion/travail'
import { estFamilleDAppels } from '@/lib/portail/contexte'
import type { SemaineDÉditions } from '@/lib/portail/semaine'
import { bornée, organisationDuRegistre } from '@/lib/portail/strategie'

/**
 * Les appels à projets de l'écran « Appels à projets » (18 novembre 2026,
 * décision de l'opératrice, option A) : seule orchestration de
 * `lib/base/appels.ts`.
 *
 *   · `releverLesAppels` : quand `POST /api/veille/lint` trouve conforme une
 *     lettre d'appels, le portail en extrait les appels **en code**
 *     (`appelsDeLaLettre`) et remplace ceux de l'édition. Aucun modèle ne
 *     fournit une ligne ; la tâche n'a rien de plus à faire que son lint.
 *   · `appelsDeLEspace` : l'écran, par la clé de cloisonnement de la session,
 *     sur les seules lettres que le lecteur peut lire (règle 3), sans lecture
 *     Notion de plus que la liste des éditions déjà faite par le layout.
 */

/**
 * Relève les appels d'une lettre d'appels conforme. Ne lève jamais : un relevé
 * manqué se rattrape au lint suivant, et le lint ne doit pas en dépendre.
 */
export async function releverLesAppels(
  entrée: { readonly pageId: string; readonly édition: ÉditionDeTravail; readonly blocs: readonly BlocNotion[] },
  db?: Base,
): Promise<{ readonly sorte: 'relevés'; readonly nombre: number } | { readonly sorte: 'ignorée'; readonly raison: string }> {
  try {
    if (!estFamilleDAppels(entrée.édition.famille)) return { sorte: 'ignorée', raison: 'pas une lettre d’appels' }
    if (!db && !baseConfigurée()) return { sorte: 'ignorée', raison: 'base absente' }
    const date = entrée.édition.dateÉdition
    if (!date) return { sorte: 'ignorée', raison: 'sans date d’édition' }
    // Une édition à plusieurs organisations est une anomalie (règle 2) : rien n'est relevé.
    if (entrée.édition.organisationIds.length !== 1) return { sorte: 'ignorée', raison: 'organisation ambiguë' }
    const organisation = await organisationDuRegistre(entrée.édition.organisationIds[0] as string, db)
    if (!organisation) return { sorte: 'ignorée', raison: 'organisation absente du portail' }
    const appels = appelsDeLaLettre(construireDocument(entrée.blocs), date.slice(0, 10))
    const { relevés } = await remplacerLesAppelsDeLÉdition(
      { organisationId: organisation.id, édition: normaliserIdentifiant(entrée.pageId), dateÉdition: date.slice(0, 10), appels },
      db,
    )
    console.info(`[appels] ${organisation.slug} : ${relevés} appel(s) relevé(s) dans ${normaliserIdentifiant(entrée.pageId)}.`)
    return { sorte: 'relevés', nombre: relevés }
  } catch (erreur) {
    console.warn(`[appels] relevé impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return { sorte: 'ignorée', raison: 'erreur' }
  }
}

/**
 * Les éditions de l'organisation de la session qui portent des appels relevés :
 * le layout les croise avec les lettres lisibles pour montrer, ou non, l'onglet
 * « Appels à projets ». Une requête, bornée ; `null` dans le doute, et l'onglet
 * n'est pas montré.
 */
export async function éditionsDAppelsDeLEspace(registre: string, db?: Base): Promise<readonly string[] | null> {
  return bornée('lecture des éditions d’appels', async () => {
    const organisation = await organisationDuRegistre(registre, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    return éditionsDAppels(organisation.id, db)
  })
}

/** L'onglet paraît dès qu'une lettre que le lecteur peut lire porte un appel relevé. */
export function ongletDesAppels(éditions: readonly string[] | null, semaines: readonly SemaineDÉditions[]): boolean {
  if (!éditions || éditions.length === 0) return false
  const avecAppels = new Set(éditions)
  return semaines.some((s) => s.éditions.some((é) => avecAppels.has(normaliserIdentifiant(é.pageId))))
}

/**
 * L'écran « Appels à projets ». `null` hors de l'espace réorganisé ou dans le
 * doute (base absente, délai) ; une vue vide si aucune lettre lisible ne porte
 * d'appel relevé.
 */
export async function appelsDeLEspace(
  entrée: { readonly registre: string; readonly semaines: readonly SemaineDÉditions[]; readonly aujourdhui: string },
  db?: Base,
): Promise<VueDesAppels | null> {
  return bornée('lecture des appels à projets', async () => {
    const organisation = await organisationDuRegistre(entrée.registre, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    const lignes = await appelsDeLOrganisation(organisation.id, db)
    const avecAppels = new Set(lignes.map((l) => l.édition))
    const lettres: LettreDAppels[] = entrée.semaines
      .flatMap((s) => s.éditions)
      .filter((é) => avecAppels.has(normaliserIdentifiant(é.pageId)))
      .map((é) => ({
        édition: normaliserIdentifiant(é.pageId),
        dateÉdition: é.dateÉdition.slice(0, 10),
        titre: é.titre,
        actionDeLaSemaine: é.actionDeLaSemaine,
        aperçu: é.aperçu === true,
      }))
    return vueDesAppels(lignes, lettres, entrée.aujourdhui)
  })
}
