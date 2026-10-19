import { ADRESSE_D_ABONNEMENT, PRIX_ANNUEL_HT, PRIX_EARLY_ADOPTER_HT, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import type { Offre, Étape } from '@/lib/domaine/parcours'

/**
 * Les deux courriers du parcours d'essai (18 octobre 2026), en fonctions pures.
 *
 * Avant eux, un client découvrait la fin de son essai en ouvrant le portail :
 * rien ne le prévenait que la lettre allait être réduite à « L'essentiel », ni
 * que son espace serait suspendu. Deux moments, et deux seulement :
 *   · **la dernière parution complète** (troisième semaine de l'essai, J+14) :
 *     il est encore temps de s'abonner sans rien perdre ;
 *   · **la parution réduite** (quatrième semaine, J+21) : la lettre est réduite
 *     à « L'essentiel », l'espace sera suspendu la semaine suivante.
 * Aucun courrier à la suspension elle-même : le client a été prévenu deux fois,
 * et un troisième message relèverait de la relance commerciale, qui se décide
 * ailleurs.
 *
 * Une organisation abonnée, historique, de test ou suspendue à la main n'est
 * jamais à l'une de ces étapes (`étapeDuParcours`) : elle ne reçoit rien.
 */

export type SorteDeParcours = 'essai_derniere_parution' | 'essai_tronquee'

export function courrierDuParcours(étape: Étape): SorteDeParcours | null {
  if (étape.étape === 'essai' && étape.parution === étape.parutions) return 'essai_derniere_parution'
  if (étape.étape === 'tronquee') return 'essai_tronquee'
  return null
}

const EN_LETTRES = ['une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit']

/** « trois parutions », « quatre parutions » : le nombre réglé pour l'organisation, en lettres. */
export function parutionsEnLettres(parutions: number): string {
  return EN_LETTRES[parutions - 1] ?? String(parutions)
}

/** Le prix écrit dans le courrier, selon l'offre posée sur l'organisation. */
export function prixDeLOffre(offre: Offre): string {
  return offre === 'early_adopter'
    ? `${PRIX_EARLY_ADOPTER_HT} € HT par mois, tarif early adopter`
    : `${PRIX_MENSUEL_HT} € HT par mois, ou ${PRIX_ANNUEL_HT} € HT par an`
}

export function composerCourrierDeParcours(entrée: {
  readonly sorte: SorteDeParcours
  readonly prénomOuNom: string
  readonly organisation: string
  readonly slug: string
  readonly portailUrl: string
  /** Parutions complètes de l'essai de cette organisation. */
  readonly parutions: number
  readonly offre: Offre
}): { readonly sujet: string; readonly texte: string } {
  const prix = prixDeLOffre(entrée.offre)
  const racine = entrée.portailUrl.replace(/\/+$/, '')
  const espace = `${racine}/${entrée.slug}`
  const salutation = entrée.prénomOuNom.trim().length > 0 ? `Bonjour ${entrée.prénomOuNom.trim()},` : 'Bonjour,'

  const corps =
    entrée.sorte === 'essai_derniere_parution'
      ? {
          sujet: 'Votre essai signauxfaibles : dernière parution complète cette semaine',
          lignes: [
            `L'essai de la veille signauxfaibles pour ${entrée.organisation} comprend`,
            `${parutionsEnLettres(entrée.parutions)} parutions complètes. Celle de cette semaine est la dernière.`,
            '',
            'La semaine prochaine, sans abonnement, chaque lettre sera réduite à sa',
            'rubrique « L’essentiel », puis votre espace sera suspendu. Vos lettres et',
            'vos archives restent conservées.',
          ],
        }
      : {
          sujet: 'Votre veille signauxfaibles est réduite à « L’essentiel » cette semaine',
          lignes: [
            `L'essai de la veille signauxfaibles pour ${entrée.organisation} est terminé.`,
            'Cette semaine, chaque lettre est réduite à sa rubrique « L’essentiel ».',
            '',
            'Sans abonnement, votre espace sera suspendu la semaine prochaine. Vos',
            'lettres et vos archives restent conservées et redeviennent lisibles dès',
            'votre abonnement.',
          ],
        }

  return {
    sujet: corps.sujet,
    texte: [
      salutation,
      '',
      ...corps.lignes,
      '',
      `L'abonnement couvre votre organisation, ses deux veilles et trois lecteurs :`,
      `${prix}. Vous pouvez vous abonner depuis votre espace :`,
      '',
      espace,
      '',
      'Si votre lien ne s’ouvre plus, demandez-en un nouveau :',
      `${racine}/recevoir-mon-lien`,
      '',
      `Pour un bon de commande ou un virement, écrivez à ${ADRESSE_D_ABONNEMENT}.`,
      '',
      'signauxfaibles',
    ].join('\n'),
  }
}
