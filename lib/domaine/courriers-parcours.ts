import { ADRESSE_D_ABONNEMENT, PRIX_ANNUEL_HT, PRIX_EARLY_ADOPTER_HT, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import type { Offre, Étape } from '@/lib/domaine/parcours'
import { composerCourriel, corpsDeParagraphes, dateDuJour, racineDuPortail, type Courriel } from '@/lib/email/gabarit'

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
  /** Pour le pied du courriel ; absente, le pied ne nomme pas d'adresse. */
  readonly destinataire?: string | null
  readonly adressePostale?: string | null
  readonly aujourdHui?: Date
}): { readonly sujet: string; readonly texte: string; readonly html: string } {
  const prix = prixDeLOffre(entrée.offre)
  const racine = racineDuPortail(entrée.portailUrl)
  const espace = `${racine}/${entrée.slug}`
  const abonnement = `${espace}/abonnement`
  const nom = entrée.prénomOuNom.trim()
  const salutation = nom.length > 0 ? `Bonjour ${nom},` : 'Bonjour,'
  const dernière = entrée.sorte === 'essai_derniere_parution'

  const corps = dernière
    ? {
        sujet: 'Votre essai signauxfaibles : dernière parution complète cette semaine',
        préheader: 'Il est encore temps de vous abonner sans perdre une seule lettre complète.',
        titre: 'Dernière parution complète cette semaine.',
        accroche: 'Il est encore temps de vous abonner sans rien perdre.',
        lignes: [
          `L'essai de la veille signauxfaibles pour ${entrée.organisation} comprend`,
          `${parutionsEnLettres(entrée.parutions)} parutions complètes. Celle de cette semaine est la dernière.`,
          '',
          'La semaine prochaine, sans abonnement, chaque lettre sera réduite à sa',
          'rubrique « L’essentiel », puis votre espace sera suspendu. Vos lettres et',
          'vos archives restent conservées.',
        ],
        paragraphes: [
          `L'essai de la veille Signaux Faibles pour ${entrée.organisation} comprend ${parutionsEnLettres(entrée.parutions)} parutions complètes. Celle de cette semaine est la dernière.`,
          'La semaine prochaine, sans abonnement, chaque lettre sera réduite à sa rubrique « L’essentiel », puis votre espace sera suspendu. Vos lettres et vos archives restent conservées.',
        ],
        points: [
          { niveau: null, titre: 'Cette semaine', texte: 'Votre dernière lettre complète, comme les précédentes.' },
          { niveau: null, titre: 'La semaine prochaine', texte: 'Sans abonnement, chaque lettre réduite à « L’essentiel ».' },
          { niveau: null, titre: 'Ensuite', texte: 'Votre espace suspendu. Vos lettres et vos archives restent conservées.' },
        ],
      }
    : {
        sujet: 'Votre veille signauxfaibles est réduite à « L’essentiel » cette semaine',
        préheader: 'Votre essai est terminé : abonnez-vous pour retrouver vos lettres complètes.',
        titre: 'Votre veille est réduite à l’essentiel.',
        accroche: 'Votre essai est terminé ; vos archives vous attendent.',
        lignes: [
          `L'essai de la veille signauxfaibles pour ${entrée.organisation} est terminé.`,
          'Cette semaine, chaque lettre est réduite à sa rubrique « L’essentiel ».',
          '',
          'Sans abonnement, votre espace sera suspendu la semaine prochaine. Vos',
          'lettres et vos archives restent conservées et redeviennent lisibles dès',
          'votre abonnement.',
        ],
        paragraphes: [
          `L'essai de la veille Signaux Faibles pour ${entrée.organisation} est terminé. Cette semaine, chaque lettre est réduite à sa rubrique « L’essentiel ».`,
          'Sans abonnement, votre espace sera suspendu la semaine prochaine. Vos lettres et vos archives restent conservées et redeviennent lisibles dès votre abonnement.',
        ],
        points: [
          { niveau: null, titre: 'Cette semaine', texte: 'Chaque lettre réduite à sa rubrique « L’essentiel ».' },
          { niveau: null, titre: 'La semaine prochaine', texte: 'Sans abonnement, votre espace suspendu.' },
          { niveau: null, titre: 'Dès votre abonnement', texte: 'Vos lettres complètes et vos archives, à nouveau lisibles.' },
        ],
      }

  const offreEnClair = `L'abonnement couvre votre organisation, ses deux veilles et trois lecteurs : ${prix}.`
  const courriel: Courriel = {
    objet: corps.sujet,
    préheader: corps.préheader,
    typeEnvoi: 'Abonnement',
    date: dateDuJour(entrée.aujourdHui),
    surtitre: 'Votre essai',
    titre: corps.titre,
    accroche: corps.accroche,
    salutation,
    corps: corpsDeParagraphes([
      ...corps.paragraphes,
      `${offreEnClair} Pour un bon de commande ou un virement, écrivez à ${ADRESSE_D_ABONNEMENT}.`,
    ]),
    points: corps.points,
    action: { libellé: 'M’abonner', url: abonnement },
    lienSecondaire: { libellé: 'Recevoir un nouveau lien', url: `${racine}/recevoir-mon-lien` },
    réassurance: 'Votre lien personnel ouvre votre espace sans mot de passe. S’il ne s’ouvre plus, demandez-en un nouveau.',
    signature: { formule: 'Bien à vous,', nom: 'Agathe', rôle: 'Fondatrice' },
    pied: {
      sorte: 'client',
      destinataire: entrée.destinataire ?? null,
      organisation: entrée.organisation,
      gestion: abonnement,
      versionWeb: null,
    },
    racine,
    adressePostale: entrée.adressePostale ?? null,
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
    html: composerCourriel(courriel),
  }
}
