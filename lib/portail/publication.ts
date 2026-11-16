'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import { publierLesMarchésDuPilote, type PublicationDesMesures } from '@/lib/portail/marches'
import { publierLaSynthèseDuPilote, type RésultatDeLaPublication } from '@/lib/portail/strategie'

/**
 * Publier ou retirer une période de synthèse depuis l'écran des synthèses de
 * l'opératrice (`/espaces/syntheses`, 12 novembre 2026 ; le tableau des
 * abonnements jusque-là, depuis le 29 octobre 2026). C'est **le même geste** que `PATCH /api/veille/syntheses`,
 * par le même `publierLaSynthèseDuPilote` : la route reste celle des tâches, ce
 * bouton est celui de l'opératrice, depuis son navigateur, après relecture du
 * courriel « [Relecture] ». Publier rend la période visible aux lecteurs du
 * client dès la visite suivante ; retirer la leur cache aussitôt.
 *
 * Le slug et la période viennent du formulaire : la garde passe d'abord, par
 * `exigerOpérateur`, avant toute écriture ; `tests/architecture.test.ts` tient
 * l'ordre. Le résultat revient à l'écran des synthèses par l'URL, en code que l'écran traduit.
 */
export async function publierUnePériode(données: FormData): Promise<void> {
  const slug = données.get('slug')
  const période = données.get('periode')
  const état = données.get('etat')
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  if (typeof période !== 'string' || !/^\d{4}-(\d{2}|T[1-4])$/.test(période)) notFound()
  if (état !== 'publie' && état !== 'retire') notFound()

  const accès = await exigerOpérateur()
  let sorte: RésultatDeLaPublication['sorte'] | 'échec'
  try {
    sorte = (await publierLaSynthèseDuPilote({ slug, période, état })).sorte
  } catch (erreur) {
    console.error(`[publication] ${slug} ${période} : ${état} impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    sorte = 'échec'
  }
  console.info(`[publication] ${accès.nom} : ${slug} ${période}, ${état}, ${sorte}.`)
  // `redirect` lève une exception de contrôle : hors de tout `try`.
  redirect(`/espaces/syntheses?synthese=${encodeURIComponent(sorte)}&slug=${encodeURIComponent(slug)}&periode=${encodeURIComponent(période)}`)
}

/**
 * Publier ou retirer les mesures d'un trimestre de « Marchés et niches »
 * (12 novembre 2026), depuis le même écran. C'est le geste de
 * `PATCH /api/veille/marches` (`etat`), par le même `publierLesMarchésDuPilote` :
 * rien n'est montré au client avant lui. La garde passe d'abord.
 */
export async function publierLesMarchés(données: FormData): Promise<void> {
  const slug = données.get('slug')
  const période = données.get('periode')
  const état = données.get('etat')
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  if (typeof période !== 'string' || !/^\d{4}-T[1-4]$/.test(période)) notFound()
  if (état !== 'publie' && état !== 'retire') notFound()

  const accès = await exigerOpérateur()
  let sorte: PublicationDesMesures['sorte'] | 'échec'
  try {
    sorte = (await publierLesMarchésDuPilote({ slug, période, état })).sorte
  } catch (erreur) {
    console.error(`[publication] marchés ${slug} ${période} : ${état} impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    sorte = 'échec'
  }
  console.info(`[publication] ${accès.nom} : marchés ${slug} ${période}, ${état}, ${sorte}.`)
  const code = sorte === 'réglée' ? (état === 'publie' ? 'publiés' : 'retirés') : sorte
  redirect(`/espaces/syntheses?marches=${encodeURIComponent(code)}&slug=${encodeURIComponent(slug)}&periode=${encodeURIComponent(période)}#marches`)
}
