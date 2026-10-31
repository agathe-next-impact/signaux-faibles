import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import { courriersDeParcoursEnSouffrance, type SorteCourrier } from '@/lib/base/courriers'
import { migrationsEnAttente } from '@/lib/base/migrer'
import { sonderLaBase } from '@/lib/base/ecriture-lecteurs'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { lignesDAccèsPourContrôle } from '@/lib/notion/acces'
import { listerÉditionsPubliées, lireBlocsDePage } from '@/lib/notion/editions'
import { normaliserIdentifiant } from '@/lib/notion/proprietes'
import {
  contrôlerLesOpérateurs,
  contrôlerUnEspace,
  regrouperParSlug,
  type Défaut,
  type EspaceContrôlé,
  type ÉtatDuDispositif,
} from '@/lib/portail/etat'
import { contrôlerLÉtiquetage } from '@/lib/portail/strategie'
import { CONTRAT_DE_FORME_DEPUIS, contrôlerLaLettre, type Rapport } from '@/lib/portail/lint'

/** Les brouillons que prépare le webhook Stripe : aucun passage ne les retente. */
const SORTES_DU_WEBHOOK = new Set<SorteCourrier>(['abonnement_confirme', 'paiement_echec', 'abonnement_resilie'])
export type ÉtatDesAccès = {
  readonly source: ReturnType<typeof sourceAccès>
  readonly base: 'non configurée' | 'joignable' | 'injoignable'
  readonly lecteursActifs: number | null
}

/**
 * Le contrôle des espaces clients, sorti de `GET /api/veille/etat` le
 * 31 octobre 2026 pour que la colonne « santé » du tableau de l'opératrice le
 * lise tel quel : la route le notifie le soir, l'écran le montre. Pour chaque
 * espace : les lignes d'accès (identifiants, doublons, adresses), les lettres
 * publiées, et le contrat de forme de la dernière, par le même validateur que
 * `/api/veille/lint` ; puis la base, les migrations, les courriers en
 * souffrance et l'étiquetage du pilote. Coût Notion : une requête sur
 * « Accès », une par organisation sur « Éditions », un corps de note par
 * organisation. Toutes cachées. N'écrit rien et n'envoie rien.
 */
export async function contrôlerLeDispositif(): Promise<{ readonly état: ÉtatDuDispositif; readonly accès: ÉtatDesAccès }> {
  const { parSlug, sansSlug, opérateurs } = regrouperParSlug(await lignesDAccèsPourContrôle())
  const espaces: EspaceContrôlé[] = []
  const lettresParRegistre = new Map<string, Awaited<ReturnType<typeof listerÉditionsPubliées>>>()

  for (const [slug, lignes] of parSlug) {
    // L'identifiant contrôlé est celui que les lignes portent — s'il diverge,
    // `contrôlerUnEspace` le dira, et on regarde le premier non vide pour
    // savoir au moins ce que ce lecteur-là voit.
    const organisationId = lignes.map((l) => l.organisationId).find((id) => id.length > 0)
    const lettres = organisationId ? await listerÉditionsPubliées(organisationId) : []
    if (organisationId) lettresParRegistre.set(normaliserIdentifiant(organisationId), lettres)

    let rapport: Rapport | null = null
    const dernière = lettres[0]
    // Le contrat de forme date du 11 septembre 2026 ; une dernière lettre
    // antérieure le rompt forcément, et le dirait chaque soir jusqu'à la
    // parution suivante. On ne contrôle que ce qui a été écrit sous le contrat.
    if (dernière && dernière.dateÉdition >= CONTRAT_DE_FORME_DEPUIS) {
      try {
        rapport = contrôlerLaLettre({
          titre: dernière.titre,
          blocs: await lireBlocsDePage(dernière.pageId),
          dossiersBruts: dernière.dossiersOuvertsBruts,
        })
      } catch (erreur) {
        console.warn(
          `[veille/etat] corps de ${dernière.pageId} illisible : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
        )
      }
    }

    espaces.push(contrôlerUnEspace({ slug, lignes, lettres, rapport }))
  }

  // La source des accès et l'état de la base, chaque soir (palier 1a-bis) :
  // un indicateur lisible plutôt qu'un silence à interpréter. Une base
  // injoignable alors qu'elle sert les accès est un défaut, pas un constat.
  const source = sourceAccès()
  const sonde = baseConfigurée() ? await sonderLaBase() : null
  const accès: ÉtatDesAccès = {
    source,
    base: sonde === null ? 'non configurée' : sonde.joignable ? 'joignable' : 'injoignable',
    lecteursActifs: sonde?.lecteursActifs ?? null,
  }
  const défautsDeBase: Défaut[] =
    source === 'postgres' && !sonde?.joignable
      ? [
          {
            slug: '(base)',
            code: 'base-injoignable',
            message: `SOURCE_ACCES vaut postgres et la base ne répond pas${sonde?.code ? ` (SQLSTATE ${sonde.code})` : ''} : personne ne peut se connecter.`,
          },
        ]
      : []

  // Les migrations du dépôt absentes de la base (18 octobre 2026) : le build
  // de production les applique, mais un écart rendrait les routes qui en
  // dépendent en 500 sans autre signe. Lu seulement quand la base répond.
  const défautsDeMigrations: Défaut[] = []
  if (sonde?.joignable) {
    try {
      const manquantes = await migrationsEnAttente()
      if (manquantes.length > 0) {
        défautsDeMigrations.push({
          slug: '(base)',
          code: 'migrations-en-attente',
          message: `${manquantes.length === 1 ? 'une migration du dépôt n’est pas appliquée' : `${manquantes.length} migrations du dépôt ne sont pas appliquées`} à la base (${manquantes.join(', ')}) : les routes qui en dépendent échouent. Appeler POST /api/veille/migrer.`,
        })
      }
    } catch (erreur) {
      console.warn(`[veille/etat] registre des migrations illisible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    }
  }

  // Les courriers de fin d'essai en souffrance (18 octobre 2026) : un échec de
  // Gmail ou une ligne restée `prevu` laisserait un client sans nouvelles, en
  // silence. Lus seulement quand la base sert le parcours.
  const défautsDeCourriers: Défaut[] = []
  if (source !== 'notion' && sonde?.joignable) {
    try {
      for (const c of await courriersDeParcoursEnSouffrance(new Date())) {
        défautsDeCourriers.push({
          slug: c.slug ?? '(courriers)',
          code: c.état === 'echec' ? 'courrier-parcours-echec' : 'courrier-parcours-incertain',
          message:
            c.état === 'echec'
              ? `courrier commercial (${c.sorte}) en échec le ${c.prévuLe.toISOString().slice(0, 10)} : ${
                  SORTES_DU_WEBHOOK.has(c.sorte)
                    ? 'préparé par le webhook Stripe, il ne sera pas retenté, à rédiger à la main.'
                    : 'il sera retenté au prochain passage.'
                }`
              : `courrier commercial (${c.sorte}) resté sans issue depuis le ${c.prévuLe.toISOString().slice(0, 10)} : vérifier dans les brouillons et la boîte d'envoi, il ne sera pas retenté.`,
        })
      }
    } catch (erreur) {
      console.warn(`[veille/etat] journal des courriers illisible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    }
  }

  // Les éditions du pilote des outils stratégiques sans étiquettes (lot 4) :
  // une étape 4ter passée en silence se verrait sinon à la revue du mois.
  const défautsDÉtiquetage: Défaut[] = []
  if (sonde?.joignable) {
    try {
      défautsDÉtiquetage.push(...(await contrôlerLÉtiquetage(lettresParRegistre)))
    } catch (erreur) {
      console.warn(`[veille/etat] étiquetage illisible : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    }
  }

  const état: ÉtatDuDispositif = {
    date: aujourdHuiÀParis(),
    espaces,
    défauts: [...espaces.flatMap((e) => e.défauts), ...contrôlerLesOpérateurs(opérateurs), ...défautsDeBase, ...défautsDeMigrations, ...défautsDeCourriers, ...défautsDÉtiquetage],
    lignesSansSlug: sansSlug,
    opérateursActifs: opérateurs.filter((l) => l.actif).length,
  }

  return { état, accès }
}
