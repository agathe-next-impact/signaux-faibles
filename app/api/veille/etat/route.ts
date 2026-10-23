import { NextResponse, type NextRequest } from 'next/server'
import { sourceAccès } from '@/lib/auth/source-acces'
import { baseConfigurée } from '@/lib/base/client'
import { courriersDeParcoursEnSouffrance, type SorteCourrier } from '@/lib/base/courriers'
import { migrationsEnAttente } from '@/lib/base/migrer'
import { sonderLaBase } from '@/lib/base/ecriture-lecteurs'
import { aujourdHuiÀParis } from '@/lib/domaine/calendrier'
import { lignesDAccèsPourContrôle } from '@/lib/notion/acces'
import { listerÉditionsPubliées, lireBlocsDePage } from '@/lib/notion/editions'
import {
  composerCourrierDÉtat,
  contrôlerLesOpérateurs,
  contrôlerUnEspace,
  regrouperParSlug,
  type Défaut,
  type EspaceContrôlé,
  type ÉtatDuDispositif,
} from '@/lib/portail/etat'
import { envoyerCourrier } from '@/lib/portail/courriers'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { CONTRAT_DE_FORME_DEPUIS, contrôlerLaLettre, type Rapport } from '@/lib/portail/lint'


/** Les brouillons que prépare le webhook Stripe : aucun passage ne les retente. */
const SORTES_DU_WEBHOOK = new Set<SorteCourrier>(['abonnement_confirme', 'paiement_echec', 'abonnement_resilie'])
/**
 * Le contrôle des espaces clients — l'étape 3bis de la réconciliation, en code.
 *
 *   GET /api/veille/etat              → l'état, en JSON
 *   GET /api/veille/etat?notifier=1   → idem, et un courriel au relecteur
 *                                        SEULEMENT s'il y a un défaut
 *   Authorization: Bearer <ACTIVATION_SECRET ou CRON_SECRET>
 *
 * Le cron Vercel (en-tête `x-vercel-cron-schedule`) vaut `notifier=1` et
 * appelle la route chaque soir. Le silence est le
 * comportement normal : un courriel quotidien qui dit « tout va bien » n'est
 * plus lu au bout d'une semaine.
 *
 * Pour chaque espace : les lignes d'accès (identifiants, doublons, adresses),
 * les lettres publiées, et le contrat de forme de la dernière — par le même
 * validateur que `/api/veille/lint`. Coût Notion : une requête sur « Accès »,
 * une par organisation sur « Éditions », un corps de note par organisation.
 * Toutes cachées.
 */
export async function GET(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'etat')
  if (refus) return refus

  // Le cron Vercel ne porte pas de paramètre, mais il signe chaque appel de
  // l'en-tête `x-vercel-cron-schedule` : c'est lui qui vaut « notifier ». Un
  // appel à la main obtient la même chose avec `?notifier=1`.
  const notifier =
    requête.nextUrl.searchParams.get('notifier') === '1' ||
    requête.headers.get('x-vercel-cron-schedule') !== null

  try {
    const { parSlug, sansSlug, opérateurs } = regrouperParSlug(await lignesDAccèsPourContrôle())
    const espaces: EspaceContrôlé[] = []

    for (const [slug, lignes] of parSlug) {
      // L'identifiant contrôlé est celui que les lignes portent — s'il diverge,
      // `contrôlerUnEspace` le dira, et on regarde le premier non vide pour
      // savoir au moins ce que ce lecteur-là voit.
      const organisationId = lignes.map((l) => l.organisationId).find((id) => id.length > 0)
      const lettres = organisationId ? await listerÉditionsPubliées(organisationId) : []

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
    const accès = {
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

    const état: ÉtatDuDispositif = {
      date: aujourdHuiÀParis(),
      espaces,
      défauts: [...espaces.flatMap((e) => e.défauts), ...contrôlerLesOpérateurs(opérateurs), ...défautsDeBase, ...défautsDeMigrations, ...défautsDeCourriers],
      lignesSansSlug: sansSlug,
      opérateursActifs: opérateurs.filter((l) => l.actif).length,
    }

    for (const défaut of état.défauts) console.warn(`[veille/etat] ${défaut.slug} : ${défaut.message}`)

    let notification: 'envoyée' | 'silence' | 'sans-destinataire' | 'échec' = 'silence'
    if (notifier && état.défauts.length > 0) {
      const destinataire = process.env['RELECTEUR_EMAIL']
      if (!destinataire) {
        notification = 'sans-destinataire'
        console.error('[veille/etat] RELECTEUR_EMAIL absent : défauts constatés, personne à prévenir.')
      } else {
        try {
          const courrier = composerCourrierDÉtat(état)
          await envoyerCourrier({
            message: { destinataire, sujet: courrier.objet, texte: courrier.texte },
            sorte: 'alerte_espaces',
            déclencheur: requête.headers.get('x-vercel-cron-schedule') !== null ? 'cron' : 'manuel',
            organisation: null,
            lecteurId: null,
            unique: false,
          })
          notification = 'envoyée'
        } catch (erreur) {
          notification = 'échec'
          console.error(
            `[veille/etat] courriel non envoyé : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
          )
        }
      }
    }

    return NextResponse.json({ état: 'contrôlé', notification, accès, ...état })
  } catch (erreur) {
    console.error(`[veille/etat] échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 502 })
  }
}
