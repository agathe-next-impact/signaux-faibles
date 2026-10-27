import { ADRESSE_D_ABONNEMENT, enEuros, PRIX_ANNUEL_HT, PRIX_FONDATEUR_HT, PRIX_MENSUEL_HT } from '@/lib/domaine/offre'
import { dateLongueDeParis, type Offre, type Étape } from '@/lib/domaine/parcours'
import { composerCourriel, corpsDeParagraphes, dateDuJour, racineDuPortail, type Courriel } from '@/lib/email/gabarit'

/**
 * Les courriers du parcours d'essai (18 octobre 2026) et de l'abonnement
 * (23 octobre 2026), en fonctions pures.
 *
 * Avant eux, un client découvrait la fin de son essai en ouvrant le portail :
 * rien ne le prévenait que la lettre allait être réduite à « L'essentiel », ni
 * que son espace serait suspendu. Deux moments, et deux seulement :
 *   · **la dernière parution complète** (J+7 pour l'essai de deux parutions,
 *     défaut depuis le 24 octobre 2026) : il est encore temps de s'abonner sans
 *     rien perdre ;
 *   · **la parution réduite** (la semaine suivante, J+14) : la lettre est
 *     réduite à « L'essentiel », l'espace sera suspendu la semaine suivante.
 *
 * Le 23 octobre 2026, Agathe a ajouté les courriers commerciaux, **tous déposés
 * en brouillon Gmail** et envoyés par elle après relecture :
 *   · **le rappel de la deuxième parution** (J+7), quand l'essai en compte au
 *     moins trois : ce que l'espace contient, et que l'essai a une fin ;
 *   · **la suspension** (la semaine qui suit la parution réduite), une seule
 *     fois : rien n'est supprimé, l'abonnement rouvre l'espace ;
 *   · ce que dit Stripe : abonnement actif, paiement refusé, renouvellement
 *     annuel à venir, résiliation (`courrierDuChangementDAbonnement`).
 *
 * Une organisation abonnée, historique, de test ou suspendue à la main n'est
 * jamais à l'une des étapes d'essai (`étapeDuParcours`) : elle n'en reçoit aucun.
 */

export type SorteDeParcours = 'essai_rappel_j7' | 'essai_derniere_parution' | 'essai_tronquee' | 'essai_suspendu'

export function courrierDuParcours(
  étape: Étape,
  /** Vrai la première semaine de suspension, et elle seule : un essai suspendu depuis des mois ne reçoit rien. */
  premièreSemaineDeSuspension = false,
): SorteDeParcours | null {
  if (étape.étape === 'essai' && étape.parution === étape.parutions) return 'essai_derniere_parution'
  if (étape.étape === 'essai' && étape.parution === 2 && étape.parutions >= 3) return 'essai_rappel_j7'
  if (étape.étape === 'tronquee') return 'essai_tronquee'
  if (étape.étape === 'suspendue' && !étape.manuelle && premièreSemaineDeSuspension) return 'essai_suspendu'
  return null
}

export type SorteDAbonnement = 'abonnement_confirme' | 'paiement_echec' | 'abonnement_renouvellement' | 'abonnement_resilie'

const ÉTATS_OUVERTS = new Set(['trialing', 'active', 'past_due'])

/**
 * Le courrier qu'appelle un changement d'état d'un abonnement Stripe, lu par le
 * webhook (l'état d'avant, celui d'après), ou `null`. Le renouvellement n'en
 * fait pas partie : il dépend de la date, et le passage quotidien le prépare.
 *   · ouvert (`trialing`, `active`) depuis un état non ouvert : la confirmation ;
 *     `past_due` vers `active` est un paiement régularisé, pas un abonnement neuf ;
 *   · `past_due` depuis un autre état : le paiement refusé ;
 *   · `canceled` depuis un autre état : la résiliation.
 */
export function courrierDuChangementDAbonnement(précédent: string | null, nouveau: string): SorteDAbonnement | null {
  if (précédent === nouveau) return null
  if ((nouveau === 'active' || nouveau === 'trialing') && !(précédent !== null && ÉTATS_OUVERTS.has(précédent))) {
    return 'abonnement_confirme'
  }
  if (nouveau === 'past_due') return 'paiement_echec'
  if (nouveau === 'canceled') return 'abonnement_resilie'
  return null
}

const EN_LETTRES = ['une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit']

/** « trois parutions », « quatre parutions » : le nombre réglé pour l'organisation, en lettres. */
export function parutionsEnLettres(parutions: number): string {
  return EN_LETTRES[parutions - 1] ?? String(parutions)
}

/** Le prix écrit dans le courrier, selon l'offre posée sur l'organisation. */
export function prixDeLOffre(offre: Offre): string {
  return offre === 'fondateur'
    ? `${enEuros(PRIX_FONDATEUR_HT)} € HT par mois, tarif fondateur`
    : `${enEuros(PRIX_MENSUEL_HT)} € HT par mois, ou ${enEuros(PRIX_ANNUEL_HT)} € HT par an`
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
  const restantes = Math.max(entrée.parutions - 2, 0)

  const corps =
    entrée.sorte === 'essai_rappel_j7'
      ? {
        sujet: 'Votre essai signauxfaibles : deuxième parution cette semaine',
        préheader: 'Vos lettres, leurs archives et le suivi des acteurs sont dans votre espace.',
        titre: 'Deuxième parution de votre essai.',
        accroche: 'Tout ce que la veille a relevé est dans votre espace.',
        lignes: [
          `L'essai de la veille signauxfaibles pour ${entrée.organisation} comprend`,
          `${parutionsEnLettres(entrée.parutions)} parutions complètes. Celle de cette semaine est la deuxième.`,
          '',
          'Votre espace rassemble chaque lettre, ses archives, les axes suivis et',
          'les acteurs qui bougent. Après l’essai, sans abonnement, la lettre est',
          'réduite à « L’essentiel », puis l’espace est suspendu.',
        ],
        paragraphes: [
          `L'essai de la veille Signaux Faibles pour ${entrée.organisation} comprend ${parutionsEnLettres(entrée.parutions)} parutions complètes. Celle de cette semaine est la deuxième.`,
          'Votre espace rassemble chaque lettre, ses archives, les axes suivis et les acteurs qui bougent. Après l’essai, sans abonnement, la lettre est réduite à « L’essentiel », puis l’espace est suspendu.',
        ],
        points: [
          { niveau: null, titre: 'Cette semaine', texte: 'Votre deuxième lettre complète.' },
          {
            niveau: null,
            titre: 'D’ici la fin de l’essai',
            texte: `Encore ${parutionsEnLettres(restantes)} parution${restantes > 1 ? 's' : ''} complète${restantes > 1 ? 's' : ''}.`,
          },
          { niveau: null, titre: 'Après l’essai', texte: 'Sans abonnement, chaque lettre réduite à « L’essentiel ».' },
        ],
        action: { libellé: 'Ouvrir mon espace', url: espace },
      }
      : entrée.sorte === 'essai_suspendu'
      ? {
        sujet: 'Votre espace signauxfaibles est suspendu',
        préheader: 'Vos lettres et vos archives sont conservées : l’abonnement rouvre votre espace.',
        titre: 'Votre espace est suspendu.',
        accroche: 'Rien n’est supprimé ; tout rouvre dès votre abonnement.',
        lignes: [
          `L'essai de la veille signauxfaibles pour ${entrée.organisation} est terminé,`,
          'et votre espace est désormais suspendu. Rien n’est supprimé : vos',
          'lettres, vos archives et le suivi des acteurs sont conservés.',
          '',
          'Dès votre abonnement, l’espace rouvre tel que vous l’avez laissé. Si vous',
          'souhaitez en parler avant de décider, répondez simplement à ce courriel.',
        ],
        paragraphes: [
          `L'essai de la veille Signaux Faibles pour ${entrée.organisation} est terminé, et votre espace est désormais suspendu. Rien n’est supprimé : vos lettres, vos archives et le suivi des acteurs sont conservés.`,
          'Dès votre abonnement, l’espace rouvre tel que vous l’avez laissé. Si vous souhaitez en parler avant de décider, répondez simplement à ce courriel.',
        ],
        points: [
          { niveau: null, titre: 'Aujourd’hui', texte: 'Votre espace suspendu, vos lettres conservées.' },
          { niveau: null, titre: 'Dès votre abonnement', texte: 'Vos lettres complètes et vos archives, à nouveau lisibles.' },
        ],
        action: { libellé: 'M’abonner', url: abonnement },
      }
      : dernière
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
        action: { libellé: 'M’abonner', url: abonnement },
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
        action: { libellé: 'M’abonner', url: abonnement },
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
    action: corps.action,
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

/** La formule en clair, telle que Stripe la donne ; rien si Stripe ne la dit pas. */
function formuleEnClair(formule: 'mensuelle' | 'annuelle' | null): string {
  if (formule === 'annuelle') return ', formule annuelle'
  if (formule === 'mensuelle') return ', formule mensuelle'
  return ''
}

/**
 * Les quatre courriers de l'abonnement (23 octobre 2026), à la charte, déposés
 * en brouillon. Aucun ne parle de prix, sauf le renouvellement annuel : le
 * montant facturé est celui de Stripe, et un prix recopié ici pourrait le
 * contredire (tarif fondateur, taxe, remise).
 */
export function composerCourrierDAbonnement(entrée: {
  readonly sorte: SorteDAbonnement
  readonly prénomOuNom: string
  readonly organisation: string
  readonly slug: string
  readonly portailUrl: string
  readonly formule: 'mensuelle' | 'annuelle' | null
  /** L'échéance de la période en cours ; seul le renouvellement l'écrit. */
  readonly périodeFin: Date | null
  readonly destinataire?: string | null
  readonly adressePostale?: string | null
  readonly aujourdHui?: Date
}): { readonly sujet: string; readonly texte: string; readonly html: string } {
  const racine = racineDuPortail(entrée.portailUrl)
  const espace = `${racine}/${entrée.slug}`
  const abonnement = `${espace}/abonnement`
  const nom = entrée.prénomOuNom.trim()
  const salutation = nom.length > 0 ? `Bonjour ${nom},` : 'Bonjour,'
  const échéance = entrée.périodeFin ? dateLongueDeParis(entrée.périodeFin) : null
  const org = entrée.organisation

  const corps: {
    readonly sujet: string
    readonly préheader: string
    readonly titre: string
    readonly accroche: string
    readonly paragraphes: readonly string[]
    readonly action: { readonly libellé: string; readonly url: string }
    readonly secondaire: { readonly libellé: string; readonly url: string } | null
  } = (() => {
    switch (entrée.sorte) {
      case 'abonnement_confirme':
        return {
          sujet: 'Votre abonnement signauxfaibles est actif',
          préheader: 'Merci : votre veille continue, complète, sans interruption.',
          titre: 'Merci, votre abonnement est actif.',
          accroche: 'Votre veille continue sans interruption.',
          paragraphes: [
            `Votre abonnement à la veille Signaux Faibles pour ${org} est enregistré${formuleEnClair(entrée.formule)}. Vos lettres restent complètes, et votre espace reste ouvert à vos lecteurs.`,
            'Vos factures et votre moyen de paiement se gèrent depuis la page « Mon abonnement » de votre espace. Pour toute question, répondez simplement à ce courriel.',
          ],
          action: { libellé: 'Ouvrir mon espace', url: espace },
          secondaire: { libellé: 'Mon abonnement', url: abonnement },
        }
      case 'paiement_echec':
        return {
          sujet: 'Votre paiement signauxfaibles n’a pas abouti',
          préheader: 'Votre espace reste ouvert : il suffit de mettre à jour votre moyen de paiement.',
          titre: 'Le dernier paiement n’a pas abouti.',
          accroche: 'Votre espace reste ouvert le temps de régulariser.',
          paragraphes: [
            `Le paiement de votre abonnement à la veille Signaux Faibles pour ${org} a été refusé. Cela arrive le plus souvent avec une carte expirée ou un plafond atteint.`,
            'Votre espace reste ouvert pendant que le paiement est présenté à nouveau. Pour éviter toute interruption, mettez à jour votre moyen de paiement depuis la page « Mon abonnement ».',
          ],
          action: { libellé: 'Mettre à jour mon paiement', url: abonnement },
          secondaire: null,
        }
      case 'abonnement_renouvellement':
        return {
          sujet: échéance
            ? `Votre abonnement signauxfaibles se renouvelle le ${échéance}`
            : 'Votre abonnement signauxfaibles se renouvelle bientôt',
          préheader: 'Rien à faire pour continuer : le renouvellement est automatique.',
          titre: échéance ? `Votre abonnement se renouvelle le ${échéance}.` : 'Votre abonnement se renouvelle bientôt.',
          accroche: 'Rien à faire pour continuer.',
          paragraphes: [
            `Votre abonnement annuel à la veille Signaux Faibles pour ${org} sera renouvelé automatiquement${échéance ? ` le ${échéance}` : ''}, au tarif de ${enEuros(PRIX_ANNUEL_HT)} € HT par an.`,
            'Pour changer de formule, mettre à jour votre moyen de paiement ou ne pas renouveler, rendez-vous sur la page « Mon abonnement » avant cette date. Pour toute question, répondez simplement à ce courriel.',
          ],
          action: { libellé: 'Mon abonnement', url: abonnement },
          secondaire: { libellé: 'Ouvrir mon espace', url: espace },
        }
      case 'abonnement_resilie':
        return {
          sujet: 'Votre abonnement signauxfaibles est résilié',
          préheader: 'Vos lettres et vos archives sont conservées : vous pouvez revenir à tout moment.',
          titre: 'Votre abonnement est résilié.',
          accroche: 'Merci pour ces semaines de veille.',
          paragraphes: [
            `La résiliation de votre abonnement à la veille Signaux Faibles pour ${org} est effective. Vos lettres et vos archives sont conservées.`,
            'Vous pouvez vous réabonner à tout moment depuis votre espace. Et si quelque chose dans la veille ne vous a pas convenu, une réponse à ce courriel nous aiderait beaucoup.',
          ],
          action: { libellé: 'Me réabonner', url: abonnement },
          secondaire: null,
        }
    }
  })()

  const courriel: Courriel = {
    objet: corps.sujet,
    préheader: corps.préheader,
    typeEnvoi: 'Abonnement',
    date: dateDuJour(entrée.aujourdHui),
    surtitre: 'Votre abonnement',
    titre: corps.titre,
    accroche: corps.accroche,
    salutation,
    corps: corpsDeParagraphes([...corps.paragraphes, `Pour un bon de commande ou un virement, écrivez à ${ADRESSE_D_ABONNEMENT}.`]),
    action: corps.action,
    lienSecondaire: corps.secondaire,
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
      ...corps.paragraphes.flatMap((p) => [p, '']),
      `${corps.action.libellé} : ${corps.action.url}`,
      '',
      `Pour un bon de commande ou un virement, écrivez à ${ADRESSE_D_ABONNEMENT}.`,
      '',
      'signauxfaibles',
    ].join('\n'),
    html: composerCourriel(courriel),
  }
}
