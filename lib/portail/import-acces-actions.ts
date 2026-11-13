'use server'

import { refresh } from 'next/cache'
import { exigerOpérateur } from '@/lib/auth/appartenance'
import type { Écart } from '@/lib/base/import-acces'
import { importerLesAccès, type IssueDeLImport } from '@/lib/portail/import-acces'

/**
 * Le bouton « Synchroniser les accès depuis Notion » du tableau des abonnements
 * (13 novembre 2026, demande de l'opératrice) : le même import que
 * `pnpm base:importer-acces` et que `POST /api/veille/importer-acces`, sans
 * terminal ni jeton.
 *
 * Deux temps, et c'est la confirmation : **« Prévisualiser »** joue l'import
 * dans une transaction annulée et montre ce qu'il ferait (créés, mis à jour,
 * désactivés, écartés) ; **« Confirmer et écrire »** n'apparaît qu'ensuite, et
 * porte le nombre de désactivations vu à l'aperçu. Si Notion a changé entre
 * les deux au point d'en désactiver davantage, rien n'est écrit et l'écran
 * demande un nouvel aperçu.
 *
 * Le privilège est vérifié **avant** toute lecture (`exigerOpérateur`). Un
 * second clic pendant qu'un import tourne sur la même instance est refusé
 * (`occupé`), en plus du bouton désactivé côté navigateur ; l'import étant
 * rejouable, deux passages sur deux instances écriraient la même chose.
 *
 * Rien ne part : ni lien d'accès, ni courrier. Le lien d'un lecteur importé
 * s'envoie ensuite, s'il le faut, depuis sa fiche (« Renvoyer le lien »).
 */

export type ComptesAffichés = {
  readonly lignesLues: number
  readonly organisations: number
  readonly organisationsCréées: number
  readonly lecteursCréés: number
  readonly lecteursMisÀJour: number
  readonly lecteursDésactivés: number
  readonly opérateurs: number
  readonly préservés: number
  readonly écartés: ReadonlyArray<Écart>
}

export type ÉtatDeLaSynchroDesAccès =
  | { readonly état: 'repos' }
  | { readonly état: 'aperçu'; readonly comptes: ComptesAffichés }
  | { readonly état: 'écrit'; readonly comptes: ComptesAffichés }
  | { readonly état: 'refusé'; readonly message: string }
  | { readonly état: 'échec' }

let importEnCours = false

export async function synchroniserLesAccès(
  _précédent: ÉtatDeLaSynchroDesAccès,
  données: FormData,
): Promise<ÉtatDeLaSynchroDesAccès> {
  const opératrice = await exigerOpérateur()

  const geste = données.get('geste')
  if (geste !== 'apercu' && geste !== 'ecrire') return { état: 'repos' }

  // Écrire sans aperçu n'est pas permis : c'est l'aperçu qui donne le plafond
  // des désactivations, et il n'a pas de valeur par défaut.
  let désactivationsAuPlus: number | undefined
  if (geste === 'ecrire') {
    const brut = Number(données.get('desactivations'))
    if (!Number.isInteger(brut) || brut < 0) {
      return { état: 'refusé', message: 'Prévisualisez d’abord : l’écriture se confirme sur un aperçu.' }
    }
    désactivationsAuPlus = brut
  }

  if (importEnCours) return { état: 'refusé', message: 'Une synchronisation est déjà en cours : attendez sa fin.' }
  importEnCours = true
  try {
    const issue = await importerLesAccès({ àBlanc: geste === 'apercu', désactivationsAuPlus })
    const état = enÉtat(issue)

    if (issue.état === 'écrit') {
      console.warn(
        `[synchro-accès] ${opératrice.nom} : écrit · ${issue.comptes.lecteursCréés} créé(s), ` +
          `${issue.comptes.lecteursMisÀJour} mis à jour, ${issue.comptes.lecteursDésactivés} désactivé(s), ` +
          `${issue.comptes.écartés.length} écarté(s).`,
      )
      // Le tableau compte les lecteurs actifs : il doit les recompter tout de suite.
      refresh()
    } else if (issue.état !== 'à blanc') {
      console.warn(`[synchro-accès] ${opératrice.nom} : ${issue.état}${'raison' in issue ? ` (${issue.raison})` : ''}.`)
    }
    return état
  } finally {
    importEnCours = false
  }
}

function enÉtat(issue: IssueDeLImport): ÉtatDeLaSynchroDesAccès {
  switch (issue.état) {
    case 'à blanc':
    case 'écrit': {
      const comptes: ComptesAffichés = {
        lignesLues: issue.résumé.lignesLues,
        organisations: issue.comptes.organisationsÉcrites,
        organisationsCréées: issue.comptes.organisationsCréées,
        lecteursCréés: issue.comptes.lecteursCréés,
        lecteursMisÀJour: issue.comptes.lecteursMisÀJour,
        lecteursDésactivés: issue.comptes.lecteursDésactivés,
        opérateurs: issue.résumé.opérateurs,
        préservés: issue.résumé.préservés,
        écartés: issue.comptes.écartés,
      }
      return issue.état === 'écrit' ? { état: 'écrit', comptes } : { état: 'aperçu', comptes }
    }
    case 'refusé':
      return { état: 'refusé', message: motifDuRefus(issue) }
    case 'échec':
      return { état: 'échec' }
  }
}

function motifDuRefus(issue: Extract<IssueDeLImport, { état: 'refusé' }>): string {
  switch (issue.raison) {
    case 'postgres-fait-foi':
      return 'SOURCE_ACCES vaut « postgres » : Postgres fait foi et la base Notion « Accès » est gelée. Un import désactiverait les lecteurs créés depuis le portail ; il est refusé.'
    case 'base-notion-vide':
      return 'La base Notion « Accès » ne rend aucune ligne : l’intégration a sans doute perdu son accès. Rien n’est écrit.'
    case 'sans-base':
      return 'La base Postgres n’est pas configurée sur cet environnement (DATABASE_URL absente).'
    case 'plan-changé':
      return `Notion a changé depuis l’aperçu : l’import désactiverait ${issue.constatées} lecteur(s) au lieu de ${issue.attendues}. Rien n’est écrit ; prévisualisez de nouveau.`
  }
}
