import type { NiveauImpact } from '@/lib/domaine/impact'

/**
 * Le gabarit des courriels client, traduit du template v1.0 du 20 octobre 2026
 * (`docs/emails/charte/`, aligné sur la charte graphique v1.0).
 *
 * **Tout courriel qui part vers un client ou un prospect est composé ici** :
 * les courriers du portail (lien d'accès, fin d'essai), les lettres et le point
 * mensuel que les tâches déposent en brouillon (par `POST /api/veille/courriel`),
 * et la source des trois emails lemlist (`docs/emails/lemlist/`). Un courriel
 * écrit à la main par un modèle finit toujours par réinventer une couleur, une
 * capitale ou un second bouton ; un gabarit en code ne le peut pas.
 *
 * Fonctions pures, sans environnement : l'appelant donne la racine du portail
 * et l'adresse postale. Le balisage suit le template ligne à ligne (tableaux,
 * styles en ligne, bouton VML pour Outlook, repli des polices) : s'en écarter
 * ici, c'est s'écarter des tests de rendu faits sur le template.
 *
 * Règles de la charte tenues par construction :
 *   · le rose #dd768a ne colore que le curseur du logo, les impulsions et la
 *     flèche des liens, jamais un texte courant (contraste 2,9:1) ;
 *   · un seul bouton primaire, à l'encre ;
 *   · trois badges et trois seulement, ceux des niveaux d'impact (règle 6) ;
 *   · sentence case, seuls les labels mono passent en capitales espacées.
 */

// ── Palette (charte v1.0) ─────────────────────────────────────────────────────
export const COULEURS = {
  encre: '#111418',
  rose: '#dd768a',
  roseFoncé: '#b23f57',
  ardoise: '#5d6b7f',
  ligne: '#dee3e6',
  blanc: '#ffffff',
  fondRose: '#fbeef1',
  fondArdoise: '#eef1f4',
  fondNeutre: '#f7f8f9',
} as const

export const ADRESSE_DE_CONTACT = 'agathe@signauxfaibles.io'

const MONO = `'IBM Plex Mono', Menlo, Consolas, 'Courier New', monospace`
const SERIF = `Lora, Georgia, 'Times New Roman', serif`
const SANS = `'Public Sans', Helvetica, Arial, sans-serif`

// ── HTML sûr ──────────────────────────────────────────────────────────────────

/** Un fragment HTML déjà composé : il ne sera pas échappé une seconde fois. */
export class Html {
  constructor(readonly valeur: string) {}
  toString(): string {
    return this.valeur
  }
}

/** Échappement brut, pour les attributs. */
function échapperBrut(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Les espaces de la typographie française : insécables avant « : ; ? ! » et à
 * l'intérieur des guillemets, pour qu'une ligne ne commence jamais par un
 * deux-points ni ne s'arrête sur un guillemet ouvrant. Le texte des lettres
 * arrive de Notion avec des espaces ordinaires.
 */
export function typographie(texte: string): string {
  return texte
    .replace(/ ([:;?!»])/g, '\u00a0$1')
    .replace(/« /g, '«\u00a0')
}

/** Un texte à poser dans le HTML : typographie, puis échappement. */
export function échapper(texte: string): string {
  return échapperBrut(typographie(texte))
}

/** Concatène des fragments ; une chaîne nue est échappée. */
export function joindre(...parties: ReadonlyArray<Html | string | null | undefined | false>): Html {
  return new Html(parties.map((p) => (p instanceof Html ? p.valeur : typeof p === 'string' ? échapper(p) : '')).join(''))
}

/**
 * Une adresse de lien admise : https, mailto, ou une variable d'outil d'envoi
 * (`{{unsubscribe}}` de lemlist). Tout le reste est refusé — un `javascript:`
 * venu d'une page Notion ne doit pas atteindre une boîte de réception.
 */
export function urlSûre(url: string): string | null {
  const nette = url.trim()
  if (/^https:\/\/[^\s"<>]+$/i.test(nette)) return nette
  if (/^mailto:[^\s"<>]+$/i.test(nette)) return nette
  if (/^\{\{[A-Za-z0-9_]+\}\}$/.test(nette)) return nette
  // Une ancre à remplacer dans l'outil d'envoi (le lien de désinscription lemlist).
  if (/^#[a-z0-9-]+$/.test(nette)) return nette
  return null
}

/** Une adresse sûre, échappée pour un attribut `href`. */
export function attribut(url: string): string {
  return échapperBrut(urlSûre(url) ?? '#')
}

// ── Modules du corps ─────────────────────────────────────────────────────────

/** Un paragraphe du corps (Public Sans 16 px), `dernier` sans marge basse. */
export function paragraphe(contenu: Html | string, dernier = false): Html {
  return joindre(new Html(`<p style="margin:0 0 ${dernier ? 0 : 16}px 0;">`), contenu, new Html('</p>'))
}

/** Un lien dans le texte courant : encre soulignée, jamais rose. */
export function lienCourant(libellé: Html | string, url: string): Html {
  return joindre(
    new Html(`<a href="${attribut(url)}" target="_blank" style="color:${COULEURS.encre}; text-decoration:underline;">`),
    libellé,
    new Html('</a>'),
  )
}

/** Le libellé de badge d'un niveau, tel que la charte l'affiche (`libelléDImpact`). */
const LIBELLÉ_DE_BADGE: Record<NiveauImpact, string> = {
  FORT: 'Signal fort',
  MOYEN: 'À surveiller',
  RAS: 'RAS',
}

/** Le badge d'impact, trois niveaux et trois seulement (règle 6 de CLAUDE.md). */
export function badge(niveau: NiveauImpact): Html {
  const commun = `font-family:${MONO}; font-size:11px; line-height:14px; font-weight:500; letter-spacing:1.2px; text-transform:uppercase;`
  const style =
    niveau === 'FORT'
      ? `background:${COULEURS.fondRose}; border-radius:999px; padding:4px 10px; ${commun} color:${COULEURS.roseFoncé};`
      : niveau === 'MOYEN'
        ? `background:${COULEURS.fondArdoise}; border-radius:999px; padding:4px 10px; ${commun} color:${COULEURS.ardoise};`
        : `background:${COULEURS.blanc}; border:1px solid ${COULEURS.ligne}; border-radius:999px; padding:3px 10px; ${commun} color:${COULEURS.ardoise};`
  return new Html(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td class="mono" style="${style}">${LIBELLÉ_DE_BADGE[niveau]}</td></tr></table>`,
  )
}

export type Point = {
  readonly niveau: NiveauImpact | null
  readonly titre: string
  readonly texte: Html | string
  /** Ligne mono sous le point : une date, une source. */
  readonly méta?: string | null
}

const FILET_DE_CARTE = `<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="height:1px; background:${COULEURS.ligne}; font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>`

/** La carte « Ce qu'il faut retenir » : fond neutre, un à trois points badgés. */
export function carteÀRetenir(points: readonly Point[], intitulé = "Ce qu'il faut retenir"): Html {
  if (points.length === 0) return new Html('')
  const lignes = points.map((point, rang) => {
    const premier = rang === 0
    const dernier = rang === points.length - 1
    const marge = `${premier ? 16 : 20}px 24px ${dernier ? 24 : 20}px 24px`
    return joindre(
      new Html(`<tr><td style="padding:${marge};">`),
      point.niveau ? badge(point.niveau) : null,
      new Html(
        `<h3 class="serif" style="margin:${point.niveau ? 10 : 0}px 0 6px 0; font-family:${SERIF}; font-size:19px; line-height:26px; font-weight:600; color:${COULEURS.encre};">`,
      ),
      point.titre,
      new Html(`</h3><p style="margin:0; font-family:${SANS}; font-size:15px; line-height:24px; color:${COULEURS.encre};">`),
      point.texte,
      new Html('</p>'),
      point.méta
        ? joindre(
            new Html(
              `<p class="mono" style="margin:8px 0 0 0; font-family:${MONO}; font-size:12px; line-height:18px; color:${COULEURS.ardoise}; text-transform:uppercase;">`,
            ),
            point.méta,
            new Html('</p>'),
          )
        : null,
      new Html('</td></tr>'),
      dernier ? null : new Html(FILET_DE_CARTE),
    )
  })
  return joindre(
    new Html(
      `<tr><td class="px" style="padding:32px 40px 0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COULEURS.fondNeutre}; border:1px solid ${COULEURS.ligne}; border-radius:10px; border-collapse:separate;"><tr><td style="padding:24px 24px 4px 24px;"><p class="mono" style="margin:0 0 4px 0; font-family:${MONO}; font-size:11px; line-height:16px; font-weight:500; letter-spacing:1.5px; text-transform:uppercase; color:${COULEURS.ardoise};">`,
    ),
    intitulé,
    new Html('</p></td></tr>'),
    ...lignes,
    new Html('</table></td></tr>'),
  )
}

// ── Ligne de signaux ─────────────────────────────────────────────────────────

export type Impulsion = { readonly forte: boolean; readonly hauteur: number }

/** Les cinq impulsions du template, pour les courriels qui ne portent pas de lettre. */
export const IMPULSIONS_PAR_DÉFAUT: readonly Impulsion[] = [
  { forte: false, hauteur: 10 },
  { forte: true, hauteur: 18 },
  { forte: true, hauteur: 26 },
  { forte: false, hauteur: 10 },
  { forte: true, hauteur: 20 },
]

/**
 * L'axe gris et ses impulsions : rose pour un signal fort, ardoise pour un
 * signal secondaire, sept au plus (charte), hauteur bornée à 10-26 px.
 */
export function ligneDeSignaux(impulsions: readonly Impulsion[]): Html {
  const retenues = impulsions.slice(0, 7)
  const intervalles = retenues.length + 1
  // Les intervalles s'arrêtent à 92 % de la largeur, comme dans le template
  // (93 %) : à 100 %, ils écrasent les colonnes de 3 px qui portent les
  // impulsions, et la ligne n'a plus que son axe.
  const TOTAL = 92
  const largeur = Math.floor(TOTAL / intervalles)
  const vide = (pourcent: number) => `<td width="${pourcent}%" style="font-size:0; line-height:0;">&nbsp;</td>`
  const cellules: string[] = []
  retenues.forEach((impulsion, rang) => {
    const couleur = impulsion.forte ? COULEURS.rose : COULEURS.ardoise
    const hauteur = Math.min(26, Math.max(10, Math.round(impulsion.hauteur)))
    cellules.push(vide(rang === 0 ? TOTAL - largeur * (intervalles - 1) : largeur))
    cellules.push(
      `<td width="3" valign="bottom" style="font-size:0; line-height:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="3" height="${hauteur}" bgcolor="${couleur}" style="width:3px; height:${hauteur}px; background:${couleur}; border-radius:2px 2px 0 0; font-size:0; line-height:0;">&nbsp;</td></tr></table></td>`,
    )
  })
  cellules.push(vide(largeur))
  const colonnes = retenues.length * 2 + 1
  return new Html(
    `<tr><td class="px" style="padding:28px 40px 0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${retenues.length > 0 ? cellules.join('') : '<td style="font-size:0; line-height:0;">&nbsp;</td>'}</tr><tr><td colspan="${retenues.length > 0 ? colonnes : 1}" height="2" bgcolor="${COULEURS.ligne}" style="height:2px; background:${COULEURS.ligne}; font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>`,
  )
}

// ── Le courriel entier ───────────────────────────────────────────────────────

export type Lien = { readonly libellé: string; readonly url: string }

export type Pied =
  /** Un lecteur d'une veille : lettres, point mensuel, fin d'essai. */
  | {
      readonly sorte: 'client'
      readonly destinataire: string | null
      readonly organisation: string | null
      readonly gestion: string | null
      readonly versionWeb: string | null
    }
  /** Le lien d'accès : transactionnel, aucune désinscription à proposer. */
  | { readonly sorte: 'accès'; readonly destinataire: string | null }
  /** Un prospect (lemlist) : désinscription en un clic fournie par l'outil. */
  | {
      readonly sorte: 'prospect'
      readonly motif: string
      readonly désinscription: string
      /** « Se désinscrire en un clic » par défaut (lien lemlist) ; « Se désinscrire » pour un lien mailto. */
      readonly libelléDésinscription?: string
    }

export type Courriel = {
  readonly objet: string
  /** Texte d'aperçu, 40 à 90 caractères. */
  readonly préheader: string
  readonly typeEnvoi: string
  /** JJ/MM/AAAA. */
  readonly date: string
  readonly surtitre: string
  readonly titre: string
  readonly accroche: string | null
  /** « Bonjour Camille, », ou `null` pour un courriel à plusieurs lecteurs. */
  readonly salutation: string | null
  /** Le corps, composé par l'appelant, et sa version texte. */
  readonly corps: { readonly html: Html; readonly texte: string }
  readonly points?: readonly Point[]
  /** L'intitulé de la carte des points ; « Ce qu'il faut retenir » par défaut. */
  readonly intituléDesPoints?: string
  readonly action?: Lien | null
  readonly lienSecondaire?: Lien | null
  readonly réassurance?: string | null
  /** Le lien du bouton recopié en clair sous l'action, pour qui ne peut pas cliquer. */
  readonly lienEnClair?: boolean
  readonly signature?: { readonly formule: string; readonly nom: string; readonly rôle: string }
  readonly pied: Pied
  /** Racine publique du portail (`PORTAIL_URL`), sans barre finale. */
  readonly racine: string
  readonly adressePostale: string | null
  readonly impulsions?: readonly Impulsion[]
}

export const SIGNATURE_PAR_DÉFAUT = { formule: 'Bonne lecture,', nom: 'Agathe', rôle: 'Fondatrice' } as const

export function racineDuPortail(url: string): string {
  return url.replace(/\/+$/, '')
}

function hôte(racine: string): string {
  try {
    return new URL(racine).host.replace(/^www\./, '')
  } catch {
    return 'signauxfaibles.io'
  }
}

function logo(racine: string, taille: 'grand' | 'petit'): Html {
  const [mot, curseur, interligne] = taille === 'grand' ? [26, 28, 32] : [17, 18, 22]
  return new Html(
    `<a href="${attribut(racine)}" target="_blank" style="text-decoration:none; color:${COULEURS.encre};"><span class="serif" style="font-family:${SERIF}; font-size:${mot}px; line-height:${interligne}px; font-weight:700; color:${COULEURS.encre};${taille === 'grand' ? ' letter-spacing:-0.2px;' : ''}">signauxfaibles</span><span style="font-family:Arial, Helvetica, sans-serif; font-size:${curseur}px; line-height:${interligne}px; font-weight:400; color:${COULEURS.rose};">&#124;</span></a>`,
  )
}

function bouton(action: Lien): Html {
  const url = attribut(action.url)
  const libellé = échapper(action.libellé)
  const largeur = Math.max(200, Math.min(480, action.libellé.length * 9 + 56))
  return new Html(
    `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px; v-text-anchor:middle; width:${largeur}px;" arcsize="18%" stroke="f" fillcolor="${COULEURS.encre}"><w:anchorlock/><center style="color:#ffffff; font-family:Arial, sans-serif; font-size:15px; font-weight:bold;">${libellé}</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${url}" target="_blank" class="btn-primary btn-full" style="display:inline-block; background:${COULEURS.encre}; color:#ffffff; font-family:${SANS}; font-size:15px; line-height:20px; font-weight:600; text-decoration:none; padding:13px 24px; border-radius:8px; text-align:center; box-sizing:border-box; mso-hide:all;">${libellé}</a><!--<![endif]-->`,
  )
}

function lienFlèche(lien: Lien): Html {
  return new Html(
    `<a href="${attribut(lien.url)}" target="_blank" class="link-arrow" style="color:${COULEURS.encre}; text-decoration:none;">${échapper(lien.libellé)}&nbsp;<span style="color:${COULEURS.rose}; font-weight:400;">&rarr;</span></a>`,
  )
}

function blocDAction(c: Courriel): Html {
  if (!c.action && !c.lienSecondaire) return new Html('')
  const mention = (texte: string, marge = 12) =>
    `<p style="margin:${marge}px 0 0 0; font-family:${SANS}; font-size:12px; line-height:18px; color:${COULEURS.ardoise};">${texte}</p>`
  const enClair =
    c.action && c.lienEnClair && urlSûre(c.action.url)?.startsWith('https://')
      ? mention(
          `Si le bouton ne s'ouvre pas, copiez ce lien dans votre navigateur :<br><span class="mono" style="font-family:${MONO}; font-size:11px; word-break:break-all;">${échapperBrut(c.action.url)}</span>`,
          8,
        )
      : ''
  const cellules = [
    c.action ? `<td class="stack" valign="middle" style="width:1%; white-space:nowrap;">${bouton(c.action).valeur}</td>` : '',
    c.lienSecondaire
      ? `<td class="stack${c.action ? ' stack-gap' : ''}" valign="middle" style="${c.action ? 'padding-left:24px; ' : ''}font-family:${SANS}; font-size:15px; line-height:20px; font-weight:600;">${lienFlèche(c.lienSecondaire).valeur}</td>`
      : '',
  ].join('')
  return new Html(
    `<tr><td class="px" style="padding:36px 40px 0 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>${cellules}</tr></table>${c.réassurance ? mention(échapper(c.réassurance)) : ''}${enClair}</td></tr>`,
  )
}

function piedDePage(c: Courriel): Html {
  const petit = `margin:24px 0 0 0; font-family:${SANS}; font-size:12px; line-height:19px; color:${COULEURS.ardoise};`
  const lienGris = (libellé: string, url: string) =>
    `<a href="${attribut(url)}" target="_blank" style="color:${COULEURS.ardoise}; text-decoration:underline;">${échapper(libellé)}</a>`
  const sép = '\n          &nbsp;·&nbsp;\n          '
  const contact = `mailto:${ADRESSE_DE_CONTACT}`

  let mentions: string
  switch (c.pied.sorte) {
    case 'client': {
      const qui = c.pied.organisation ? ` pour ${échapper(c.pied.organisation)}` : ''
      const adresse = c.pied.destinataire ? ` (${échapper(c.pied.destinataire)})` : ''
      const désinscription = `mailto:${ADRESSE_DE_CONTACT}?subject=${encodeURIComponent(
        `Désinscription${c.pied.organisation ? ` · ${c.pied.organisation}` : ''}`,
      )}`
      const liens = [
        c.pied.gestion ? lienGris('Gérer mon abonnement', c.pied.gestion) : null,
        lienGris('Se désinscrire', désinscription),
        c.pied.versionWeb ? lienGris('Version web', c.pied.versionWeb) : null,
      ].filter((l): l is string => l !== null)
      mentions = `Vous recevez cet email en tant que lecteur de la veille Signaux Faibles${qui}${adresse}.<br>\n          ${liens.join(sép)}`
      break
    }
    case 'accès':
      mentions =
        `Vous recevez cet email parce qu'un lien d'accès à Signaux Faibles a été demandé${
          c.pied.destinataire ? ` pour ${échapper(c.pied.destinataire)}` : ''
        }. Si vous n'êtes pas à l'origine de cette demande, ignorez-le : le lien ne sert qu'à son destinataire.<br>\n          ` +
        lienGris('Nous écrire', contact)
      break
    case 'prospect':
      mentions = `${échapper(c.pied.motif)}<br>\n          ${lienGris(c.pied.libelléDésinscription ?? 'Se désinscrire en un clic', c.pied.désinscription)}`
      break
  }

  const adressePostale = c.adressePostale ? ` · ${échapper(c.adressePostale)}` : ''
  return new Html(
    `<tr><td class="px" style="padding:48px 40px 0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="height:1px; background:${COULEURS.ligne}; font-size:0; line-height:0;">&nbsp;</td></tr></table></td></tr>
    <tr><td class="px" style="padding:24px 40px 40px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="stack" valign="top" style="font-family:${SERIF};">${logo(c.racine, 'petit').valeur}<p class="serif" style="margin:4px 0 0 0; font-family:${SERIF}; font-size:14px; line-height:20px; font-style:italic; color:${COULEURS.ardoise};">Votre veille, rédigée.</p></td><td class="stack stack-gap mono" valign="top" align="right" style="font-family:${MONO}; font-size:12px; line-height:20px; color:${COULEURS.ardoise};"><a href="${attribut(c.racine)}" target="_blank" style="color:${COULEURS.ardoise}; text-decoration:none;">${échapper(hôte(c.racine))}</a><br><a href="${contact}" style="color:${COULEURS.ardoise}; text-decoration:none;">${ADRESSE_DE_CONTACT}</a></td></tr></table>
        <p style="${petit}">
          ${mentions}
        </p>
        <p style="${petit.replace('margin:24px', 'margin:12px')}">
          Conçu et opéré par <a href="https://www.next-impact.digital" target="_blank" style="color:${COULEURS.ardoise}; text-decoration:underline;">Next Impact Digital</a>${adressePostale}
        </p>
      </td></tr>`,
  )
}

const TÊTE = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{objet}}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>
  table, td, div, p, a, span, h1, h2, h3 { font-family: Arial, Helvetica, sans-serif !important; }
  .serif { font-family: Georgia, 'Times New Roman', serif !important; }
  .mono { font-family: 'Courier New', Courier, monospace !important; }
</style>
<![endif]-->
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Lora:ital,wght@0,500;0,600;0,700;1,500&family=Public+Sans:wght@400;600&display=swap" rel="stylesheet">
<!--<![endif]-->
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: #ffffff; }
  * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { color: #111418; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  u + #body a { color: inherit; text-decoration: none; }
  .btn-primary:hover { background: #2a3038 !important; }
  .link-arrow:hover { text-decoration: underline !important; }
  @media screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .h1 { font-size: 26px !important; line-height: 34px !important; }
    .stack { display: block !important; width: 100% !important; text-align: left !important; }
    .stack-gap { padding-top: 16px !important; padding-left: 0 !important; }
    .btn-full { width: 100% !important; }
    .defile { display: block !important; overflow-x: auto !important; }
  }
</style>
</head>`

/** Compose le courriel entier, prêt à envoyer. */
export function composerCourriel(c: Courriel): string {
  const signature = c.signature ?? SIGNATURE_PAR_DÉFAUT
  const labelMono = `font-family:${MONO}; font-size:11px; line-height:16px; letter-spacing:1.5px; color:${COULEURS.ardoise};`
  const parties: Array<Html | string> = [
    new Html(TÊTE.replace('{{objet}}', () => échapper(c.objet))),
    new Html(`
<body id="body" style="margin:0; padding:0; background:#ffffff; word-spacing:normal;">
<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${échapper(
      c.préheader,
    )}${'&#847;&zwnj;&nbsp;'.repeat(8)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;"><tr><td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
<tr><td class="px" style="padding:28px 40px 0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="mono" style="${labelMono} font-weight:500; text-transform:uppercase;">${échapper(
      c.typeEnvoi,
    )}</td><td align="right" class="mono" style="${labelMono.replace('letter-spacing:1.5px', 'letter-spacing:1px')} font-weight:400;">${échapper(c.date)}</td></tr></table></td></tr>
<tr><td class="px" style="padding:36px 40px 0 40px;">${logo(c.racine, 'grand').valeur}</td></tr>
`),
    ligneDeSignaux(c.impulsions ?? IMPULSIONS_PAR_DÉFAUT),
    new Html(
      `
<tr><td class="px" style="padding:40px 40px 0 40px;"><p class="mono" style="margin:0 0 12px 0; font-family:${MONO}; font-size:12px; line-height:16px; font-weight:500; letter-spacing:1.5px; text-transform:uppercase; color:${COULEURS.ardoise};">${échapper(
        c.surtitre,
      )}</p><h1 class="h1 serif" style="margin:0; font-family:${SERIF}; font-size:32px; line-height:40px; font-weight:700; color:${COULEURS.encre}; letter-spacing:-0.3px;">${échapper(
        c.titre,
      )}</h1>${
        c.accroche
          ? `<p class="serif" style="margin:12px 0 0 0; font-family:${SERIF}; font-size:18px; line-height:26px; font-style:italic; font-weight:500; color:${COULEURS.ardoise};">${échapper(c.accroche)}</p>`
          : ''
      }</td></tr>
<tr><td class="px" style="padding:28px 40px 0 40px; font-family:${SANS}; font-size:16px; line-height:26px; font-weight:400; color:${COULEURS.encre};">`,
    ),
    c.salutation ? paragraphe(c.salutation) : '',
    c.corps.html,
    new Html('</td></tr>\n'),
    carteÀRetenir(c.points ?? [], c.intituléDesPoints),
    blocDAction(c),
    new Html(
      `
<tr><td class="px" style="padding:40px 40px 0 40px; font-family:${SANS}; font-size:16px; line-height:26px; color:${COULEURS.encre};"><p style="margin:0;">${échapper(
        signature.formule,
      )}</p><p style="margin:4px 0 0 0; font-weight:600;">${échapper(signature.nom)}</p><p class="mono" style="margin:2px 0 0 0; font-family:${MONO}; font-size:12px; line-height:18px; color:${COULEURS.ardoise};">${échapper(
        signature.rôle,
      )} · Signaux Faibles</p></td></tr>
`,
    ),
    piedDePage(c),
    new Html(`
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>
`),
  ]
  return joindre(...parties).valeur
}

/** La version texte du même courriel, pour la partie `text/plain`. */
export function composerTexte(c: Courriel): string {
  const signature = c.signature ?? SIGNATURE_PAR_DÉFAUT
  const lignes: string[] = [c.titre, ...(c.accroche ? [c.accroche] : []), '']
  if (c.salutation) lignes.push(c.salutation, '')
  lignes.push(c.corps.texte.trim(), '')
  for (const point of c.points ?? []) {
    const niveau = point.niveau ? `[${LIBELLÉ_DE_BADGE[point.niveau]}] ` : ''
    const texte = point.texte instanceof Html ? texteDeHtml(point.texte.valeur) : point.texte
    lignes.push(`${niveau}${point.titre}`, texte, ...(point.méta ? [point.méta] : []), '')
  }
  if (c.action) lignes.push(`${c.action.libellé} :`, c.action.url, '')
  if (c.lienSecondaire) lignes.push(`${c.lienSecondaire.libellé} :`, c.lienSecondaire.url, '')
  if (c.réassurance) lignes.push(c.réassurance, '')
  lignes.push(signature.formule, signature.nom, `${signature.rôle} · Signaux Faibles`, '', '--', `Signaux Faibles · ${hôte(c.racine)} · ${ADRESSE_DE_CONTACT}`)
  return lignes.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** Le texte d'un fragment HTML court (un point de carte). */
function texteDeHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
}

/** Corps simple : des paragraphes de texte, le dernier sans marge. */
export function corpsDeParagraphes(paragraphes: readonly string[]): { html: Html; texte: string } {
  const gardés = paragraphes.map((p) => p.trim()).filter((p) => p.length > 0)
  return {
    html: joindre(...gardés.map((p, rang) => paragraphe(p, rang === gardés.length - 1))),
    texte: gardés.join('\n\n'),
  }
}

/** JJ/MM/AAAA d'une date ISO (AAAA-MM-JJ). */
export function dateCourte(iso: string): string {
  const [année, mois, jour] = iso.slice(0, 10).split('-')
  return année && mois && jour ? `${jour}/${mois}/${année}` : iso
}

/** JJ/MM/AAAA à Paris, pour le bandeau du courriel. */
export function dateDuJour(maintenant: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }).format(maintenant)
}

/** Seuil de troncature de Gmail : au-delà de 102 Ko, la fin du message est masquée. */
export const SEUIL_GMAIL_OCTETS = 102 * 1024
