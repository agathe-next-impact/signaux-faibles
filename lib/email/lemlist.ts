import {
  COULEURS,
  Html,
  composerCourriel,
  composerTexte,
  joindre,
  échapper,
  paragraphe,
  type Courriel,
} from '@/lib/email/gabarit'

/**
 * Les trois emails de la séquence lemlist « SF · [secteur] » (prospection,
 * `docs/prospection-lemlist.md`), composés par le gabarit commun.
 *
 * lemlist ne connaît pas le portail : ces pages sont générées une fois
 * (`pnpm emails:lemlist`, dans `docs/emails/lemlist/`) puis collées dans la vue
 * Code de chaque étape. `tests/email.lemlist.test.ts` vérifie que les fichiers
 * du dépôt sont ceux que le gabarit produit : une correction de charte se
 * propage en régénérant, jamais en retouchant un fichier à la main.
 *
 * Les variables sont celles de lemlist, entre doubles accolades : `firstName`,
 * `companyName`, et les trois champs que la tâche de prospection écrit
 * (`sfEssentiel`, `sfFaitMarquant`, `sfUrl`). `sfEssentiel` arrive en texte
 * brut sur plusieurs lignes : il est posé dans un bloc `white-space:pre-line`,
 * qui garde ses retours à la ligne sans exiger de HTML dans la variable.
 *
 * **Le lien de désinscription** est le seul que lemlist doit poser lui-même :
 * après collage, sélectionner « Se désinscrire en un clic » dans l'éditeur,
 * puis « + Add » › « Add unsubscribe link ». Le fichier porte une ancre
 * `#desinscription-lemlist` pour qu'on ne puisse pas l'oublier sans le voir.
 *
 * Le jeton d'accès ne voyage jamais dans lemlist (règle 8) : le bouton mène à
 * « recevoir mon lien », qui l'envoie par le portail.
 */

export const ANCRE_DE_DÉSINSCRIPTION = '#desinscription-lemlist'

const SERIF = `Lora, Georgia, 'Times New Roman', serif`
const MONO = `'IBM Plex Mono', Menlo, Consolas, 'Courier New', monospace`

/** Une carte au fond neutre, avec son label mono, pour un texte de variable. */
function carteDeVariable(label: string, variable: string, police: 'sans' | 'serif'): Html {
  const style =
    police === 'serif'
      ? `font-family:${SERIF}; font-size:18px; line-height:28px; font-style:italic; font-weight:500;`
      : 'font-size:15px; line-height:25px;'
  return joindre(
    new Html(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COULEURS.fondNeutre}; border:1px solid ${COULEURS.ligne}; border-radius:10px; border-collapse:separate; margin:8px 0 24px 0;"><tr><td style="padding:22px 24px;"><p class="mono" style="margin:0 0 10px 0; font-family:${MONO}; font-size:11px; line-height:16px; font-weight:500; letter-spacing:1.5px; text-transform:uppercase; color:${COULEURS.ardoise};">`,
    ),
    label,
    new Html(`</p><p${police === 'serif' ? ' class="serif"' : ''} style="margin:0; ${style} color:${COULEURS.encre}; white-space:pre-line;">`),
    new Html(`{{${variable}}}`),
    new Html('</p></td></tr></table>'),
  )
}

type ÉtapeLemlist = {
  readonly fichier: string
  readonly étape: string
  readonly objet: string
  readonly courriel: Courriel
}

/** Comment le prospect se désinscrit : lien en un clic de lemlist, ou réponse STOP par Gmail. */
export type Désinscription = {
  readonly url: string
  readonly libellé: string
  /** Phrase ajoutée au motif du pied. */
  readonly consigne: string | null
}

const DÉSINSCRIPTION_LEMLIST: Désinscription = { url: ANCRE_DE_DÉSINSCRIPTION, libellé: 'Se désinscrire en un clic', consigne: null }

export function étapesLemlist(
  racinePortail: string,
  adressePostale: string | null,
  désinscription: Désinscription = DÉSINSCRIPTION_LEMLIST,
): readonly ÉtapeLemlist[] {
  const racine = racinePortail.replace(/\/+$/, '')
  const action = { libellé: 'Lire ma lettre complète', url: `${racine}/recevoir-mon-lien` }
  const réassurance = 'Indiquez votre adresse : votre lien personnel arrive par email, sans mot de passe ni carte bancaire.'
  const commun = {
    typeEnvoi: 'Lettre de veille',
    date: 'Offerte',
    salutation: 'Bonjour {{firstName}},',
    action,
    réassurance,
    signature: { formule: 'Bien à vous,', nom: 'Agathe', rôle: 'Fondatrice' },
    pied: {
      sorte: 'prospect' as const,
      motif: [
        'Vous recevez cet email parce qu’une lettre de veille a été préparée pour {{companyName}} à partir de son site public. Votre adresse ne sert qu’à cet envoi.',
        désinscription.consigne,
      ]
        .filter(Boolean)
        .join(' '),
      désinscription: désinscription.url,
      libelléDésinscription: désinscription.libellé,
    },
    racine,
    adressePostale,
  }

  return [
    {
      fichier: 'sf-1-lettre.html',
      étape: 'Étape 1 · J0 · lettre 1',
      objet: '{{companyName}} : ce que votre veille a relevé cette semaine',
      courriel: {
        ...commun,
        objet: '{{companyName}} : ce que votre veille a relevé cette semaine',
        préheader: 'Une première lettre de veille préparée pour {{companyName}}, offerte.',
        surtitre: 'Votre veille de la semaine',
        titre: 'Ce que nous avons relevé pour vous.',
        accroche: 'Une lettre rédigée à partir de votre site, sans engagement.',
        corps: {
          html: joindre(
            paragraphe(
              'Nous avons préparé une première lettre de veille pour {{companyName}}, à partir de votre site et des sources publiques de votre secteur. En voici l’essentiel.',
            ),
            carteDeVariable('L’essentiel', 'sfEssentiel', 'sans'),
            paragraphe(
              'La lettre complète, avec ses sources datées et le suivi de vos concurrents, vous attend dans un espace personnel. Il reste ouvert un mois à compter de votre première visite, sans engagement.',
              true,
            ),
          ),
          texte: [
            'Nous avons préparé une première lettre de veille pour {{companyName}}, à partir de votre site et des sources publiques de votre secteur. En voici l’essentiel.',
            'L’ESSENTIEL',
            '{{sfEssentiel}}',
            'La lettre complète, avec ses sources datées et le suivi de vos concurrents, vous attend dans un espace personnel. Il reste ouvert un mois à compter de votre première visite, sans engagement.',
          ].join('\n\n'),
        },
      },
    },
    {
      fichier: 'sf-2-relance-j4.html',
      étape: 'Étape 2 · J+4 · le fait marquant',
      objet: 'Un fait daté pour {{companyName}}',
      courriel: {
        ...commun,
        objet: 'Un fait daté pour {{companyName}}',
        préheader: 'Un fait de votre lettre de veille, et l’espace qui l’attend.',
        surtitre: 'Dans votre lettre',
        titre: 'Un fait qui mérite votre attention.',
        accroche: null,
        corps: {
          html: joindre(
            paragraphe('Dans la lettre préparée pour {{companyName}}, un fait daté mérite votre attention :'),
            carteDeVariable('Le fait marquant', 'sfFaitMarquant', 'serif'),
            paragraphe(
              'Il est sourcé dans votre lettre complète, avec les autres faits de la semaine et vos concurrents suivis. Votre espace est prêt.',
              true,
            ),
          ),
          texte: [
            'Dans la lettre préparée pour {{companyName}}, un fait daté mérite votre attention :',
            '{{sfFaitMarquant}}',
            'Il est sourcé dans votre lettre complète, avec les autres faits de la semaine et vos concurrents suivis. Votre espace est prêt.',
          ].join('\n\n'),
        },
      },
    },
    {
      fichier: 'sf-3-relance-j10.html',
      étape: 'Étape 3 · J+10 · dernier message',
      objet: 'Votre lettre pour {{companyName}} reste disponible',
      courriel: {
        ...commun,
        objet: 'Votre lettre pour {{companyName}} reste disponible',
        préheader: 'Votre espace reste ouvert quinze jours, puis nous n’écrirons plus.',
        surtitre: 'Dernier message',
        titre: 'Votre lettre reste disponible.',
        accroche: 'Quinze jours encore, puis nous n’écrirons plus.',
        corps: {
          html: joindre(
            paragraphe(
              'La lettre de veille préparée pour {{companyName}} reste disponible quinze jours. Passé ce délai, nous la retirons et nous ne vous écrirons plus.',
            ),
            paragraphe(
              'Si la veille vous intéresse, votre espace est à un clic, et le mois d’essai ne commence qu’à votre première visite.',
              true,
            ),
          ),
          texte: [
            'La lettre de veille préparée pour {{companyName}} reste disponible quinze jours. Passé ce délai, nous la retirons et nous ne vous écrirons plus.',
            'Si la veille vous intéresse, votre espace est à un clic, et le mois d’essai ne commence qu’à votre première visite.',
          ].join('\n\n'),
        },
      },
    },
  ]
}

/** Le fichier HTML d'une étape, précédé du mode d'emploi en commentaire. */
export function fichierLemlist(étape: ÉtapeLemlist): string {
  const html = composerCourriel(étape.courriel)
  const notice = `<!--
  Signaux Faibles · séquence lemlist « SF · [secteur] » · ${étape.étape}
  Généré par le gabarit du portail (pnpm emails:lemlist) : ne pas retoucher à la main.
  Objet de l'étape : ${étape.objet}
  1. Coller ce fichier dans la vue Code de l'étape.
  2. Sélectionner « Se désinscrire en un clic », puis + Add › Add unsubscribe link
     (l'ancre ${ANCRE_DE_DÉSINSCRIPTION} doit disparaître).
  3. Prévisualiser sur un contact qui porte sfEssentiel, sfFaitMarquant et companyName.
-->
`
  return html.replace('<!DOCTYPE html>\n', `<!DOCTYPE html>\n${notice}`)
}

export function texteLemlist(étape: ÉtapeLemlist): string {
  return composerTexte(étape.courriel)
}

// ── Le pilote par Gmail (20 octobre 2026) ──────────────────────────────────────

/**
 * Les mêmes trois emails, remplis pour un prospect et prêts à déposer en
 * brouillon Gmail, quand la prospection se fait sans lemlist.
 *
 * Seule la désinscription change : pas de lien en un clic, mais une réponse
 * « STOP » à l'expéditeur, que l'opératrice reporte au registre ; c'est le
 * moyen d'opposition simple qu'admet la prospection entre entreprises. Les
 * valeurs remplacent les variables lemlist après composition, échappées comme
 * tout texte du gabarit : un nom d'entreprise ne peut pas injecter de HTML.
 */
export type ValeursDeProspection = {
  readonly étape: 1 | 2 | 3
  readonly prénom: string | null
  readonly entreprise: string
  readonly essentiel: string | null
  readonly faitMarquant: string | null
}

export const ADRESSE_DE_PROSPECTION = 'agathe@signauxfaibles.io'

function désinscriptionGmail(): Désinscription {
  return {
    url: `mailto:${ADRESSE_DE_PROSPECTION}?subject=STOP`,
    libellé: 'Se désinscrire',
    consigne: 'Pour ne plus recevoir de message, répondez STOP.',
  }
}

export function composerProspection(
  valeurs: ValeursDeProspection,
  contexte: { readonly portailUrl: string; readonly adressePostale: string | null },
): { readonly objet: string; readonly html: string; readonly texte: string } {
  const étape = étapesLemlist(contexte.portailUrl, contexte.adressePostale, désinscriptionGmail())[valeurs.étape - 1]
  if (!étape) throw new Error(`étape ${valeurs.étape} inconnue`)
  if (valeurs.étape === 1 && !valeurs.essentiel?.trim()) throw new Error('« essentiel » requis pour l’étape 1')
  if (valeurs.étape === 2 && !valeurs.faitMarquant?.trim()) throw new Error('« faitMarquant » requis pour l’étape 2')

  const prénom = valeurs.prénom?.trim() ?? ''
  const remplir = (texte: string, échapperValeur: (v: string) => string) =>
    texte
      .replaceAll('Bonjour {{firstName}},', prénom ? `Bonjour ${échapperValeur(prénom)},` : 'Bonjour,')
      .replaceAll('{{firstName}}', échapperValeur(prénom))
      .replaceAll('{{companyName}}', échapperValeur(valeurs.entreprise.trim()))
      .replaceAll('{{sfEssentiel}}', échapperValeur(valeurs.essentiel?.trim() ?? ''))
      .replaceAll('{{sfFaitMarquant}}', échapperValeur(valeurs.faitMarquant?.trim() ?? ''))

  return {
    objet: remplir(étape.objet, (v) => v),
    html: remplir(composerCourriel(étape.courriel), échapper),
    texte: remplir(composerTexte(étape.courriel), (v) => v),
  }
}
