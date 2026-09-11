'use server'

import { refresh, updateTag } from 'next/cache'
import { notFound } from 'next/navigation'
import { exigerAccès } from '@/lib/auth/appartenance'
import { sourcesDeDonnées } from '@/lib/notion/client'
import { listerÉditionsPubliées } from '@/lib/notion/editions'

/**
 * Relire Notion maintenant, sans attendre le webhook ni l'heure de revalidation.
 *
 * Le portail n'a pas de base : « synchroniser » ne copie rien, cela vide des
 * entrées de cache. Trois chemins y mènent, et celui-ci est le troisième :
 *
 * 1. le **webhook** Notion, automatique, à la seconde ;
 * 2. le **temps** — profil `notion`, une heure ;
 * 3. ce geste, quand les deux premiers ne suffisent pas : webhook débranché
 *    après un changement de secret, édition faite hors de Notion (import,
 *    duplication), ou simple besoin de vérifier tout de suite.
 *
 * `updateTag` et non `revalidateTag` : le second marque périmé et sert
 * l'ancienne version pendant la régénération — la personne qui vient de
 * cliquer verrait encore l'ancienne page, ce qui est exactement ce qu'elle
 * cherchait à éviter. `updateTag` expire immédiatement et n'est utilisable que
 * depuis une action serveur, ce qui est le cas ici. `refresh` achève le geste
 * côté navigateur : sans lui, le routeur client garderait son propre rendu
 * pendant les cinq minutes de `stale`.
 */
export type RésultatSynchro =
  | { readonly état: 'repos' }
  | { readonly état: 'fait'; readonly lettres: number }
  | { readonly état: 'erreur' }

export async function resynchroniser(
  _précédent: RésultatSynchro,
  données: FormData,
): Promise<RésultatSynchro> {
  const slug = données.get('slug')
  if (typeof slug !== 'string' || slug.length === 0) notFound()

  // Le slug vient du formulaire, donc du navigateur. Il n'est pas cru sur
  // parole : `exigerAccès` est le même contrôle que celui des écrans — la
  // personne est chez elle, ou elle est opératrice, ou c'est `notFound`.
  const accès = await exigerAccès(slug)

  // Réservé au privilège opérateur, et non à la visite opérateur : sur son
  // propre espace, l'opératrice a `enOpérateur` à faux et doit pourtant
  // disposer du bouton. Fermé aux clients pour une raison de débit : Notion
  // tient trois requêtes par seconde, et un bouton « rafraîchir » offert à
  // tout le monde est un bouton sur lequel on tape.
  if (!accès.tousLesEspaces) notFound()

  try {
    const sources = await sourcesDeDonnées()

    // Relevé **avant** d'invalider la liste : ce sont les corps de notes déjà
    // en cache, donc ceux qu'il faut expirer. Une lettre parue depuis n'a
    // jamais été lue, elle n'a rien à invalider.
    const lettres = await listerÉditionsPubliées(accès.organisationId)

    updateTag(`liste:${sources.éditions}`)
    updateTag(`liste:${sources.accès}`)
    for (const lettre of lettres) updateTag(`page:${lettre.pageId}`)

    // `schema:notion` n'est délibérément pas invalidé. Il porte la garde de
    // contrat, qui refuse de servir si une propriété manque : le relancer
    // pendant qu'une propriété est en cours de renommage dans Notion
    // couperait le portail pour tous les clients. Un vrai changement de schéma
    // arrive par le webhook, qui porte l'événement correspondant.
    refresh()

    console.warn(
      `[synchro] ${accès.nom} resynchronise « ${accès.slug} » : ` +
        `${lettres.length} lettre(s).`,
    )

    return { état: 'fait', lettres: lettres.length }
  } catch (erreur) {
    // Règle 4 : pas de page d'erreur. Le bouton le dit, l'espace reste servi
    // depuis son cache, et le monitoring reçoit la trace.
    console.error('[synchro] échec de la resynchronisation', erreur)
    return { état: 'erreur' }
  }
}
