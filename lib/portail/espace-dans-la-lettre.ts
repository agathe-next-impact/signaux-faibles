import type { Base } from '@/lib/base/client'
import { liensDeLEspace, type LienDEspace } from '@/lib/domaine/espace-dans-la-lettre'
import { marchésDeLEspace } from '@/lib/portail/marches'
import { bornée, organisationDuRegistre, synthèseDeLEspace } from '@/lib/portail/strategie'

/**
 * Les liens du pied « Dans votre espace » d'un courriel de lettre (12 novembre
 * 2026, piste 4) : seule orchestration, seule lecture, appelée par les
 * compositeurs du courriel d'une lettre (`POST /api/veille/courriel`, l'envoi
 * des lettres à publier).
 *
 * La clé est le registre que porte la relation `Organisation` de l'édition
 * (règle 2), jamais le slug que la tâche annonce : le slug n'est qu'un
 * contrôle, et une organisation qui n'y répond pas n'a pas de pied. Rien n'est
 * montré hors du pilote des outils ni hors de l'espace réorganisé, où ces
 * écrans répondraient 404 ; seules les périodes publiées sont lues, par les
 * lectures mêmes des écrans. Bornée et muette : dans le doute, aucun lien, et
 * le courriel part comme avant.
 */
export async function espaceDansLaLettre(
  entrée: { readonly registre: string; readonly slug: string },
  db?: Base,
): Promise<readonly LienDEspace[]> {
  const liens = await bornée('lecture de l’espace pour le courriel de la lettre', async () => {
    const organisation = await organisationDuRegistre(entrée.registre, db)
    if (!organisation?.outilsStratégiques || !organisation.espaceRéorganisé) return null
    if (organisation.slug !== entrée.slug) {
      console.warn(`[courriel] le slug annoncé ne répond pas au registre de l’édition, pied de l’espace non posé.`)
      return null
    }
    const [synthèse, marchés] = await Promise.all([
      synthèseDeLEspace({ registre: entrée.registre, numéros: new Map() }, db),
      marchésDeLEspace({ registre: entrée.registre }, db),
    ])
    return liensDeLEspace({ slug: organisation.slug, synthèse, marchés })
  })
  return liens ?? []
}
