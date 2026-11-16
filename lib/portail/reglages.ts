'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import { réglerLeParcours, type Réglage, type RésultatDuRéglage } from '@/lib/base/organisations'
import { cléDeLot, estUneCléDeCible, lireUnLot, type Lot } from '@/lib/domaine/placement'

/**
 * Les réglages du parcours depuis le tableau des abonnements (19 octobre 2026).
 *
 * Ce sont **les mêmes réglages** que `PATCH /api/veille/organisations`, par le
 * même `réglerLeParcours` : prolonger l'essai d'une à trois semaines, envoyer
 * les courriers de fin d'essai à la relecture plutôt qu'au client. La route
 * reste celle de la tâche Cowork ; ces actions sont celles de l'opératrice,
 * depuis son navigateur. Rien d'autre ne se règle ici : l'abonnement lui-même
 * se modifie chez Stripe, et l'état de l'organisation par ses propres chemins.
 *
 * Le slug vient du formulaire, donc du navigateur : la garde passe d'abord,
 * par `exigerOpérateur`, avant toute écriture ; `tests/architecture.test.ts`
 * tient l'ordre. Le résultat est rendu au tableau par l'URL, sans message
 * libre : un code que l'écran traduit.
 */
function slugDu(données: FormData): string {
  const slug = données.get('slug')
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound()
  return slug
}

/**
 * Le formulaire de la fiche d'une organisation y revient, dans la section de
 * son bouton (16 novembre 2026 : « parcours », « cycle », « envois ») ; celui
 * du tableau, au tableau.
 */
function retourDu(données: FormData, slug: string, sorte: string, section: string): string {
  return données.get('retour') === 'fiche'
    ? `/espaces/abonnements/${encodeURIComponent(slug)}?reglage=${encodeURIComponent(sorte)}&section=${section}#${section}`
    : `/espaces/abonnements?reglage=${encodeURIComponent(sorte)}&slug=${encodeURIComponent(slug)}`
}

async function appliquer(
  données: FormData,
  slug: string,
  action: string,
  réglage: Réglage,
  section = 'parcours',
): Promise<never> {
  const accès = await exigerOpérateur()

  let sorte: RésultatDuRéglage['sorte'] | 'échec'
  try {
    sorte = (await réglerLeParcours(slug, réglage)).sorte
  } catch (erreur) {
    console.error(`[réglage] ${slug} : ${action} impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    sorte = 'échec'
  }
  console.info(`[réglage] ${accès.nom} : ${slug}, ${action}, ${sorte}.`)
  // `redirect` lève une exception de contrôle : hors de tout `try`.
  redirect(retourDu(données, slug, sorte, section))
}

/**
 * Placer une organisation à une étape nommée (16 novembre 2026) : l'opératrice
 * dit l'étape, `réglerLeParcours` calcule le J0 qui la produit cette semaine.
 * L'écran en a montré l'effet avant ce geste.
 */
export async function placerÀLÉtape(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const cible = données.get('cible')
  if (!estUneCléDeCible(cible)) notFound()
  await appliquer(données, slug, `placer à ${cible}`, { sorte: 'placer', cible })
}

export async function prolongerLEssai(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const semaines = Number(données.get('semaines'))
  if (semaines !== 1 && semaines !== 2 && semaines !== 3) notFound()
  await appliquer(données, slug, `prolonger de ${semaines}`, { sorte: 'prolonger', semaines })
}

export async function poserLOffre(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const offre = données.get('offre')
  if (offre !== 'standard' && offre !== 'fondateur' && offre !== 'gratuite') notFound()
  await appliquer(données, slug, `offre ${offre}`, { sorte: 'offre', offre }, 'cycle')
}

export async function réglerLesParutions(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const parutions = Number(données.get('parutions'))
  if (!Number.isInteger(parutions) || parutions < 1 || parutions > 8) notFound()
  await appliquer(données, slug, `${parutions} parutions d'essai`, { sorte: 'parutions', parutions })
}

/** Un client historique entre dans le parcours : date de sa prochaine lettre, parutions complètes qu'il lui reste. */
export async function mettreEnParcours(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const prochaineLettre = données.get('prochaineLettre')
  const restantes = Number(données.get('restantes'))
  if (typeof prochaineLettre !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(prochaineLettre)) notFound()
  if (!Number.isInteger(restantes) || restantes < 1 || restantes > 8) notFound()
  await appliquer(données, slug, `mise en parcours, lettre du ${prochaineLettre}, ${restantes} restante(s)`, {
    sorte: 'parcours',
    prochaineLettre,
    restantes,
  })
}

export async function réglerLaRelecture(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const requise = données.get('requise')
  if (requise !== 'oui' && requise !== 'non') notFound()
  await appliquer(
    données,
    slug,
    requise === 'oui' ? 'lettres à la relecture' : 'lettres aux lecteurs',
    { sorte: 'relecture', requise: requise === 'oui' },
    'envois',
  )
}

/**
 * Suspendre, écarter ou réactiver une organisation (31 octobre 2026). L'espace
 * se ferme à la lecture, la file et le calendrier des tâches la sautent ; aucun
 * courrier ne part : l'opératrice prévient le client elle-même. Retour à la page
 * de gestion de l'organisation.
 */
export async function déciderDeLOrganisation(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const décision = données.get('decision')
  if (décision !== 'suspendre' && décision !== 'ecarter' && décision !== 'reactiver') notFound()
  const accès = await exigerOpérateur()

  let sorte: RésultatDuRéglage['sorte'] | 'échec'
  try {
    sorte = (await réglerLeParcours(slug, { sorte: 'décision', décision })).sorte
  } catch (erreur) {
    console.error(`[réglage] ${slug} : ${décision} impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    sorte = 'échec'
  }
  console.info(`[réglage] ${accès.nom} : ${slug}, ${décision}, ${sorte}.`)
  redirect(`/espaces/abonnements/${encodeURIComponent(slug)}?reglage=${encodeURIComponent(sorte)}&section=cycle#cycle`)
}

/**
 * L'aperçu avant envoi (1er novembre 2026) : tant qu'il est actif, ni le lien
 * d'accès ni une lettre du moteur ne partent sans le geste de l'opératrice, qui
 * lit d'abord l'édition dans l'espace. Retour à la section « Envois » de la fiche.
 */
export async function réglerLAperçu(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const actif = données.get('actif')
  if (actif !== 'oui' && actif !== 'non') notFound()
  const accès = await exigerOpérateur()

  let sorte: RésultatDuRéglage['sorte'] | 'échec'
  try {
    sorte = (await réglerLeParcours(slug, { sorte: 'apercu', actif: actif === 'oui' })).sorte
  } catch (erreur) {
    console.error(`[réglage] ${slug} : aperçu impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
    sorte = 'échec'
  }
  console.info(`[réglage] ${accès.nom} : ${slug}, aperçu avant envoi ${actif === 'oui' ? 'actif' : 'levé'}, ${sorte}.`)
  redirect(`/espaces/abonnements/${encodeURIComponent(slug)}?reglage=${encodeURIComponent(sorte)}&section=envois#envois`)
}

const SLUG_DE_SÉRIE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Au-delà, l'opératrice procède en deux fois : l'URL de retour porte chaque slug. */
const SÉRIE_MAX = 50

function réglageDuLot(lot: Lot): Réglage {
  if (lot.sorte === 'placer') return { sorte: 'placer', cible: lot.cible }
  if (lot.sorte === 'prolonger') return { sorte: 'prolonger', semaines: lot.semaines }
  return { sorte: 'relecture', requise: lot.requise }
}

const RÉUSSITES = new Set<RésultatDuRéglage['sorte'] | 'échec'>(['placée', 'prolongé', 'relecture-réglée'])

/**
 * Le même geste sur plusieurs organisations (16 novembre 2026, lot 2) : placer
 * à une étape, prolonger, régler la relecture. Le tableau en a montré l'effet
 * organisation par organisation ; ici, la garde passe d'abord, puis chaque
 * organisation est réglée par le même `réglerLeParcours`, une transaction
 * chacune : un refus n'empêche pas les autres, et le retour dit lesquelles ont
 * été réglées et pourquoi les autres ne l'ont pas été.
 */
export async function appliquerEnSérie(données: FormData): Promise<void> {
  const lot = lireUnLot(données.get('lot'))
  const slugs = [...new Set(données.getAll('o').filter((o): o is string => typeof o === 'string' && SLUG_DE_SÉRIE.test(o)))]
  if (!lot || slugs.length === 0 || slugs.length > SÉRIE_MAX) notFound()
  const accès = await exigerOpérateur()

  const réglage = réglageDuLot(lot)
  const réglées: string[] = []
  const refusées: string[] = []
  for (const slug of slugs) {
    let sorte: RésultatDuRéglage['sorte'] | 'échec'
    try {
      sorte = (await réglerLeParcours(slug, réglage)).sorte
    } catch (erreur) {
      console.error(`[réglage] ${slug} : ${cléDeLot(lot)} impossible (${erreur instanceof Error ? erreur.message : String(erreur)}).`)
      sorte = 'échec'
    }
    if (RÉUSSITES.has(sorte)) réglées.push(slug)
    else refusées.push(`${slug}:${sorte}`)
  }
  console.info(`[réglage] ${accès.nom} : série ${cléDeLot(lot)}, ${réglées.length} réglée(s), ${refusées.length} refusée(s).`)
  const requête = new URLSearchParams({ serie: cléDeLot(lot), ok: réglées.join(','), ko: refusées.join(',') })
  redirect(`/espaces/abonnements?${requête.toString()}`)
}
