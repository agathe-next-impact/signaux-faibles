'use server'

import { notFound, redirect } from 'next/navigation'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import { archiver, désarchiver } from '@/lib/portail/archivage'

/**
 * Les deux gestes d'archivage de l'opératrice (13 novembre 2026) : sur la fiche
 * d'une organisation, et sous le tableau des abonnements pour la désarchiver.
 * Le privilège passe d'abord, avant toute lecture ; le résultat revient par
 * l'URL, en un code que l'écran traduit.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugDu(données: FormData): string {
  const slug = données.get('slug')
  if (typeof slug !== 'string' || !SLUG.test(slug)) notFound()
  return slug
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}

export async function archiverLOrganisationDepuisLaFiche(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const accès = await exigerOpérateur()
  let code: string
  try {
    const { sorte } = await archiver(slug)
    // Le code « abonnée-stripe » de la fiche parle déjà de la mise en parcours.
    code = sorte === 'abonnée-stripe' ? 'archivage-abonnée-stripe' : sorte
  } catch (erreur) {
    console.error(`[gestion] ${slug} : archivage impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, archivage, ${code}.`)
  if (code === 'archivée') redirect(`/espaces/abonnements?reglage=archivée&slug=${encodeURIComponent(slug)}`)
  redirect(`/espaces/abonnements/${encodeURIComponent(slug)}?gestion=${encodeURIComponent(code)}&section=archivage#archivage`)
}

export async function désarchiverLOrganisationDepuisLeTableau(données: FormData): Promise<void> {
  const slug = slugDu(données)
  const accès = await exigerOpérateur()
  let code: string
  try {
    code = (await désarchiver(slug)).sorte
  } catch (erreur) {
    console.error(`[gestion] ${slug} : désarchivage impossible (${messageDe(erreur)}).`)
    code = 'échec'
  }
  console.info(`[gestion] ${accès.nom} : ${slug}, désarchivage, ${code}.`)
  redirect(`/espaces/abonnements?reglage=${encodeURIComponent(code)}&slug=${encodeURIComponent(slug)}`)
}
