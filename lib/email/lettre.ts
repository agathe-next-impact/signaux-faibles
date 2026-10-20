import type { Bloc, BlocNotion, Segment, ÉlémentDeLettre } from '@/lib/domaine/document'
import { suiteDeLaLettre } from '@/lib/domaine/document'
import type { NiveauImpact } from '@/lib/domaine/impact'
import { sansAccent } from '@/lib/domaine/texte'
import {
  COULEURS,
  Html,
  attribut,
  badge,
  composerCourriel,
  composerTexte,
  dateCourte,
  dateDuJour,
  joindre,
  racineDuPortail,
  urlSûre,
  type Courriel,
  type Impulsion,
} from '@/lib/email/gabarit'

/**
 * Le courriel d'une lettre de veille, rendu depuis sa page Notion.
 *
 * Avant le 20 octobre 2026, la tâche des lettres écrivait elle-même le HTML du
 * brouillon : chaque lettre avait sa mise en forme, et aucune n'était celle de
 * la charte. Le portail la rend désormais depuis les blocs de la page, avec le
 * gabarit commun (`lib/email/gabarit.ts`) et les conversions du parseur de
 * production (`suiteDeLaLettre`) : ce que le lint vient de valider est ce qui
 * part, mot pour mot.
 *
 * Les correspondances de forme :
 *   · un titre de niveau 1 ouvre une rubrique (titre Lora, filet au-dessus) ;
 *   · un titre de niveau 2 est un axe : badge d'impact lu dans son suffixe,
 *     numéro en indice mono, nom en Lora — un suffixe inconnu n'a pas de badge ;
 *   · un encadré (la prose de méthode et d'absence) devient une carte au fond
 *     neutre, comme dans le template : il se montre, il ne se cache pas ;
 *   · une image n'est jamais incluse : son URL Notion expire en une heure
 *     (règle 5). Sa légende, si elle en a une, renvoie à l'espace.
 *   · un encadré de méthode interne (`estEncadréInterne`) et tout lien vers
 *     Notion sont retirés : la règle d'envoi du 18 octobre 2026 (étape 6 de
 *     « Tâche — Lettres de veille ») les exclut du courriel, quand le RAS
 *     motivé et le cadrage, eux, sont dus au lecteur.
 * Les puces sont carrées, comme partout dans la charte. Aucun texte n'est en
 * rose : les liens de la lettre sont à l'encre, soulignés.
 */

const SERIF = `Lora, Georgia, 'Times New Roman', serif`
const MONO = `'IBM Plex Mono', Menlo, Consolas, 'Courier New', monospace`

// ── Ce qui ne part pas chez le client ───────────────────────────────────────

/**
 * Les encadrés de méthode interne, reconnus à leur intitulé d'ouverture.
 *
 * Convention d'écriture des lettres (contrat de forme, point 4) : le pied de
 * lettre range en encadré « Sources vérifiées », « Sources non ouvertes »,
 * « Requêtes non lancées » et « Méthode et réserves », et une note de méthode
 * peut ouvrir la lettre. La règle d'envoi du 18 octobre 2026 en retire trois
 * familles du courriel : la note de méthode, les sources non ouvertes et les
 * requêtes non lancées ; « Méthode et réserves » est de la même nature. Les
 * sources vérifiées et le RAS motivé restent : ils prouvent que le silence
 * est un constat. Seul endroit où cette liste est écrite.
 */
const INTITULÉS_INTERNES = ['note de methode', 'sources non ouvertes', 'requetes non lancees', 'methode et reserves']

export function estEncadréInterne(bloc: Bloc): boolean {
  if (bloc.type !== 'encadré') return false
  const début = sansAccent(bloc.segments.map((s) => s.texte).join(''))
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 40)
  return INTITULÉS_INTERNES.some((intitulé) => début.startsWith(intitulé))
}

/** Un lien vers l'espace Notion de l'opératrice : jamais dans un courriel client. */
function estLienNotion(url: string): boolean {
  return /^https:\/\/([a-z0-9-]+\.)*(notion\.so|notion\.site|notion\.com)(\/|$)/i.test(url)
}

// ── Segments ─────────────────────────────────────────────────────────────────

function segmentsHtml(segments: readonly Segment[]): Html {
  return joindre(
    ...segments.map((segment) => {
      let rendu: Html = joindre(segment.texte)
      if (segment.code) {
        rendu = joindre(
          new Html(`<code class="mono" style="font-family:${MONO}; font-size:0.9em; background:${COULEURS.fondNeutre}; padding:1px 4px; border-radius:4px;">`),
          rendu,
          new Html('</code>'),
        )
      }
      if (segment.gras) rendu = joindre(new Html('<strong style="font-weight:600;">'), rendu, new Html('</strong>'))
      if (segment.italique) rendu = joindre(new Html('<em>'), rendu, new Html('</em>'))
      if (segment.barré) rendu = joindre(new Html('<s>'), rendu, new Html('</s>'))
      const url = segment.lien ? urlSûre(segment.lien) : null
      if (url && !estLienNotion(url)) {
        rendu = joindre(
          new Html(`<a href="${attribut(url)}" target="_blank" style="color:${COULEURS.encre}; text-decoration:underline;">`),
          rendu,
          new Html('</a>'),
        )
      }
      return rendu
    }),
  )
}

function segmentsTexte(segments: readonly Segment[]): string {
  return segments
    .map((s) => (s.lien && urlSûre(s.lien) && !estLienNotion(s.lien) && s.lien !== s.texte ? `${s.texte} (${s.lien})` : s.texte))
    .join('')
}

// ── Blocs ────────────────────────────────────────────────────────────────────

function blocHtml(bloc: Bloc): Html {
  switch (bloc.type) {
    case 'paragraphe':
      return joindre(new Html('<p style="margin:0 0 16px 0;">'), segmentsHtml(bloc.segments), new Html('</p>'))
    case 'titre':
      return joindre(
        new Html(`<h4 class="serif" style="margin:24px 0 8px 0; font-family:${SERIF}; font-size:17px; line-height:24px; font-weight:600; color:${COULEURS.encre};">`),
        segmentsHtml(bloc.segments),
        new Html('</h4>'),
      )
    case 'liste': {
      const balise = bloc.ordonnée ? 'ol' : 'ul'
      const puce = bloc.ordonnée ? 'decimal' : 'square'
      return joindre(
        new Html(`<${balise} style="margin:0 0 16px 0; padding:0 0 0 22px; list-style-type:${puce};">`),
        ...bloc.éléments.map((élément) =>
          joindre(new Html('<li style="margin:0 0 8px 0; padding-left:2px;">'), segmentsHtml(élément), new Html('</li>')),
        ),
        new Html(`</${balise}>`),
      )
    }
    case 'citation':
      return joindre(
        new Html(
          `<blockquote class="serif" style="margin:0 0 16px 0; padding:0 0 0 16px; border-left:3px solid ${COULEURS.ligne}; font-family:${SERIF}; font-style:italic; font-size:17px; line-height:27px; color:${COULEURS.encre};">`,
        ),
        segmentsHtml(bloc.segments),
        new Html('</blockquote>'),
      )
    case 'encadré':
      return joindre(
        new Html(
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COULEURS.fondNeutre}; border:1px solid ${COULEURS.ligne}; border-radius:10px; border-collapse:separate; margin:0 0 16px 0;"><tr><td style="padding:14px 18px; font-size:15px; line-height:24px; color:${COULEURS.encre};">`,
        ),
        segmentsHtml(bloc.segments),
        new Html('</td></tr></table>'),
      )
    case 'code':
      return joindre(
        new Html(
          `<pre class="mono" style="margin:0 0 16px 0; padding:12px 14px; background:${COULEURS.fondNeutre}; border:1px solid ${COULEURS.ligne}; border-radius:8px; font-family:${MONO}; font-size:13px; line-height:20px; white-space:pre-wrap; word-break:break-word;">`,
        ),
        bloc.texte,
        new Html('</pre>'),
      )
    case 'tableau': {
      const lignes = bloc.lignes.map((cellules, rang) => {
        const entête = bloc.enTête && rang === 0
        const balise = entête ? 'th' : 'td'
        const fond = entête ? ` background:${COULEURS.fondNeutre}; font-weight:600;` : ''
        return joindre(
          new Html('<tr>'),
          ...cellules.map((cellule) =>
            joindre(
              new Html(
                `<${balise} align="left" valign="top" style="border:1px solid ${COULEURS.ligne}; padding:8px 10px; text-align:left; vertical-align:top;${fond}">`,
              ),
              segmentsHtml(cellule),
              new Html(`</${balise}>`),
            ),
          ),
          new Html('</tr>'),
        )
      })
      return joindre(
        new Html(
          `<div class="defile" style="margin:0 0 16px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; font-size:14px; line-height:21px; color:${COULEURS.encre};">`,
        ),
        ...lignes,
        new Html('</table></div>'),
      )
    }
    case 'séparateur':
      return new Html(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td height="1" style="height:1px; background:${COULEURS.ligne}; font-size:0; line-height:0;">&nbsp;</td></tr></table>`,
      )
    case 'image':
      return bloc.légende
        ? joindre(
            new Html(`<p style="margin:0 0 16px 0; font-size:13px; line-height:20px; font-style:italic; color:${COULEURS.ardoise};">`),
            `Illustration dans votre espace : ${bloc.légende}`,
            new Html('</p>'),
          )
        : new Html('')
  }
}

function blocTexte(bloc: Bloc): string {
  switch (bloc.type) {
    case 'paragraphe':
    case 'titre':
    case 'citation':
    case 'encadré':
      return segmentsTexte(bloc.segments)
    case 'liste':
      return bloc.éléments.map((é, rang) => `${bloc.ordonnée ? `${rang + 1}.` : '-'} ${segmentsTexte(é)}`).join('\n')
    case 'code':
      return bloc.texte
    case 'tableau':
      return bloc.lignes.map((cellules) => cellules.map(segmentsTexte).join(' | ')).join('\n')
    case 'séparateur':
      return '---'
    case 'image':
      return bloc.légende ? `[Illustration dans votre espace : ${bloc.légende}]` : ''
  }
}

const LIBELLÉ: Record<NiveauImpact, string> = { FORT: 'Signal fort', MOYEN: 'À surveiller', RAS: 'RAS' }

function élémentHtml(élément: ÉlémentDeLettre, premier: boolean): Html {
  if (élément.type === 'rubrique') {
    if (élément.titre.trim().length === 0) return new Html('')
    const filet = premier ? '' : ` padding-top:24px; border-top:1px solid ${COULEURS.ligne};`
    return joindre(
      new Html(
        `<h2 class="serif" style="margin:${premier ? 8 : 32}px 0 14px 0;${filet} font-family:${SERIF}; font-size:23px; line-height:30px; font-weight:700; color:${COULEURS.encre}; letter-spacing:-0.2px;">`,
      ),
      élément.titre,
      new Html('</h2>'),
    )
  }
  if (élément.type === 'axe') {
    const numéro =
      élément.numéro !== null
        ? `<span class="mono" style="font-family:${MONO}; font-size:13px; font-weight:500; color:${COULEURS.ardoise}; letter-spacing:0.5px;">${String(élément.numéro).padStart(2, '0')}</span>&nbsp;&nbsp;`
        : ''
    return joindre(
      new Html('<div style="margin:24px 0 10px 0;">'),
      élément.niveau ? badge(élément.niveau) : null,
      new Html(
        `<h3 class="serif" style="margin:${élément.niveau ? 10 : 0}px 0 0 0; font-family:${SERIF}; font-size:19px; line-height:26px; font-weight:600; color:${COULEURS.encre};">${numéro}`,
      ),
      élément.titre,
      new Html('</h3></div>'),
    )
  }
  return blocHtml(élément)
}

function élémentTexte(élément: ÉlémentDeLettre): string {
  if (élément.type === 'rubrique') return élément.titre.trim() ? `\n${élément.titre.toUpperCase()}\n` : ''
  if (élément.type === 'axe') {
    const badgeTexte = élément.niveau ? `[${LIBELLÉ[élément.niveau]}] ` : ''
    return `${badgeTexte}${élément.numéro !== null ? `${élément.numéro}. ` : ''}${élément.titre}`
  }
  return blocTexte(élément)
}

/**
 * Les impulsions de la ligne de signaux, lues dans la lettre : une par axe qui
 * bouge, rose pour un signal fort, ardoise pour un axe à surveiller ; un axe
 * RAS n'en a pas. Sept au plus (charte) : les signaux forts d'abord, dans
 * l'ordre de la lettre. Une lettre sans mouvement garde son axe nu, ce qui
 * dit la même chose qu'elle.
 */
export function impulsionsDeLaLettre(suite: readonly ÉlémentDeLettre[]): Impulsion[] {
  const axes = suite.flatMap((é, rang) =>
    é.type === 'axe' && (é.niveau === 'FORT' || é.niveau === 'MOYEN') ? [{ niveau: é.niveau, rang }] : [],
  )
  const fortes = axes.filter((a) => a.niveau === 'FORT')
  const retenus = [...fortes, ...axes.filter((a) => a.niveau === 'MOYEN')].slice(0, 7).sort((a, b) => a.rang - b.rang)
  return retenus.map((a, i) => ({ forte: a.niveau === 'FORT', hauteur: a.niveau === 'FORT' ? (i % 2 === 0 ? 26 : 20) : 13 }))
}

export type ÉditionÀEnvoyer = {
  readonly pageId: string
  readonly titre: string
  readonly veille: string | null
  readonly numéro: number | null
  readonly dateÉdition: string | null
  readonly périodeCouverte: string
}

export function composerLettre(entrée: {
  /** L'objet du courriel ; à défaut, le titre de l'édition. */
  readonly objet?: string
  readonly édition: ÉditionÀEnvoyer
  readonly blocs: readonly BlocNotion[]
  readonly slug: string
  readonly organisation: string | null
  readonly portailUrl: string
  readonly adressePostale: string | null
  readonly aujourdHui?: Date
}): { readonly html: string; readonly texte: string; readonly courriel: Courriel; readonly axes: number } {
  const racine = racineDuPortail(entrée.portailUrl)
  const espace = `${racine}/${entrée.slug}`
  const suite = suiteDeLaLettre(entrée.blocs).filter((é) => é.type === 'rubrique' || é.type === 'axe' || !estEncadréInterne(é))

  const premièreRubrique = suite.findIndex((é) => é.type === 'rubrique' && é.titre.trim().length > 0)
  const html = joindre(...suite.map((élément, rang) => élémentHtml(élément, rang === premièreRubrique && rang === 0)))
  const texte = suite
    .map(élémentTexte)
    .filter((t) => t.length > 0)
    .join('\n\n')

  const { édition } = entrée
  const veille = édition.veille?.trim() || 'Veille'
  const surtitre = édition.numéro !== null ? `${veille} · n° ${édition.numéro}` : veille
  const période = édition.périodeCouverte.trim()
  const premierParagraphe = suite.find((é): é is Extract<Bloc, { type: 'paragraphe' }> => é.type === 'paragraphe')
  const aperçu = premierParagraphe ? segmentsTexte(premierParagraphe.segments).slice(0, 90) : `${veille} : la lettre de la semaine.`

  const courriel: Courriel = {
    objet: entrée.objet ?? édition.titre,
    préheader: aperçu,
    typeEnvoi: 'Lettre de veille',
    date: édition.dateÉdition ? dateCourte(édition.dateÉdition) : dateDuJour(entrée.aujourdHui),
    surtitre,
    titre: édition.titre,
    accroche: période.length > 0 ? `Période couverte : ${période}` : null,
    salutation: null,
    corps: { html, texte },
    action: { libellé: 'Ouvrir mon espace', url: espace },
    lienSecondaire: { libellé: 'Toutes mes lettres', url: `${espace}/lettres` },
    réassurance: 'Cette lettre rejoint votre espace le soir de son envoi, avec les précédentes et le suivi des acteurs.',
    pied: {
      sorte: 'client',
      destinataire: null,
      organisation: entrée.organisation,
      gestion: `${espace}/abonnement`,
      versionWeb: null,
    },
    racine,
    adressePostale: entrée.adressePostale,
    impulsions: impulsionsDeLaLettre(suite),
  }

  return {
    html: composerCourriel(courriel),
    texte: composerTexte(courriel),
    courriel,
    axes: suite.filter((é) => é.type === 'axe').length,
  }
}
