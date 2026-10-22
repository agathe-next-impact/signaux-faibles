/**
 * Les paliers commerciaux 3 et 4 (programme du 22 octobre 2026, §5) et le
 * palier 1 côté prospect : l'édition de découverte à la première visite,
 * l'onboarding complet à l'entrée en essai, le bloc personnalisé d'un prospect.
 *
 * Toutes lisent par le portail et remettent au portail ; aucune n'écrit.
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { logger, task } from '@trigger.dev/sdk'
import { z } from 'zod'
import { collecterLesSources, navigateurPlaywright } from '@/lib/moteur/collecte'
import { convertirLesRéférentiels, lireRéférentielUnique, schémaDuRéférentielUnique, écrireRéférentielUnique } from '@/lib/moteur/referentiel'
import type { DossierDOnboarding } from '@/lib/moteur/remise'
import { clientAnthropic, produireDepuisLeDossier, remiseDe } from './moteur'
import { lireLeDossierDuTravail, ouvrirLEspace, poserUnTravail, prendreUnTravail, remettreLÉdition, remettreLeRéférentiel, type DossierDUnTravail } from './portail'

/**
 * Le référentiel unique d'une nouvelle organisation, dérivé du référentiel de
 * sa filière et du gel de son site : un appel, à l'onboarding ou à la
 * découverte. Pour un client existant qui a deux référentiels Notion, c'est
 * `convertirLesRéférentiels` qui s'applique.
 */
async function dériverLeRéférentiel(
  anthropic: Anthropic,
  entrée: { organisation: string; site: string | null; filière: string | null; référentielDeFilière: string | null; fiche: string | null },
): Promise<{ markdown: string; fiche: string; coût: number }> {
  const extraitsDuSite = entrée.site
    ? await collecterLesSources(
        { organisation: entrée.organisation, fiche: '', dossiersBruts: '', dossiers: [], axes: [{ numéro: 1, nom: 'site', sorte: 'thème', critères: '', sources: [{ libellé: 'site', url: entrée.site }], requêtes: [], acteurs: [] }] },
        { ouvrirNavigateur: () => navigateurPlaywright(), tailleExtrait: 12_000 },
      )
    : []
  const système =
    `Tu écris le référentiel unique d'une organisation pour un programme de veille hebdomadaire : dix à quinze axes, ` +
    `thématiques de l'écosystème puis sujets d'offre commerciale (jamais le nom d'une organisation, qui se suit en dossier), chacun avec ses sources nommées (URL réelles, reprises du référentiel de filière ou du site), ` +
    `ses requêtes types, ses acteurs et ses critères FORT et MOYEN. Pars du référentiel de filière quand il existe et spécialise-le à l'organisation ; ` +
    `n'invente aucune URL. La fiche tient en quatre à huit phrases.`
  const utilisateur =
    `<organisation>${entrée.organisation}</organisation>\n<site>${entrée.site ?? 'inconnu'}</site>\n<filiere>${entrée.filière ?? 'aucune'}</filiere>\n` +
    `<fiche_existante>${entrée.fiche ?? ''}</fiche_existante>\n<referentiel_de_filiere>\n${entrée.référentielDeFilière ?? 'aucun'}\n</referentiel_de_filiere>\n` +
    `<extraits_du_site>\n${extraitsDuSite.map((l) => `<page url="${l.url}" etat="${l.état}">\n${l.texte}\n</page>`).join('\n')}\n</extraits_du_site>`
  const réponse = await anthropic.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16_000,
    system: système,
    messages: [{ role: 'user', content: utilisateur }],
    output_format: zodOutputFormat(schémaDuRéférentielUnique),
  })
  const structuré = réponse.parsed_output
  if (!structuré) throw new Error(`Référentiel : aucune sortie structurée (${réponse.stop_reason}).`)
  const markdown = écrireRéférentielUnique(entrée.organisation, structuré)
  lireRéférentielUnique(markdown)
  const u = réponse.usage as { input_tokens?: number; output_tokens?: number }
  return { markdown, fiche: structuré.fiche, coût: ((u.input_tokens ?? 0) * 4 + (u.output_tokens ?? 0) * 20) / 1_000_000 }
}

/**
 * La première lettre passe par la file de travaux comme les suivantes : un
 * travail `premiere_lettre` est posé sur la veille unique de l'organisation,
 * pour aujourd'hui, puis pris tout de suite par ce run, échéance ou non. Le
 * portail attribue le numéro et conclura à la remise. Un travail déjà en file
 * (un run précédent interrompu) est repris, pas doublé.
 */
async function prendreLaPremièreLettre(slug: string, session: string, mode?: 'decouverte'): Promise<{ travail: string; dossier: DossierDUnTravail }> {
  const aujourdHui = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const posé = await poserUnTravail({ slug, veille: 'unique', type: 'premiere_lettre', parution: aujourdHui })
  if (!posé.travailId) throw new Error(`Première lettre de ${slug} : travail non posé (${posé.état}).`)
  const pris = await prendreUnTravail(session, posé.travailId)
  if (!pris) throw new Error(`Première lettre de ${slug} : travail ${posé.travailId} non prenable (déjà pris par un autre run, ou conclu).`)
  return { travail: posé.travailId, dossier: await lireLeDossierDuTravail(posé.travailId, mode) }
}

async function lireLeDossierDOnboarding(organisation: string): Promise<DossierDOnboarding> {
  const url = process.env['PORTAIL_URL']?.replace(/\/$/, '')
  const jeton = process.env['ACTIVATION_SECRET']
  if (!url || !jeton) throw new Error('PORTAIL_URL et ACTIVATION_SECRET sont requis.')
  const réponse = await fetch(`${url}/api/veille/dossier?mode=onboarding-complet&organisation=${encodeURIComponent(organisation)}`, { headers: { authorization: `Bearer ${jeton}` } })
  if (!réponse.ok) throw new Error(`GET /api/veille/dossier (onboarding) : ${réponse.status}`)
  return (await réponse.json()) as DossierDOnboarding
}

/** Palier 4 : fiche, référentiel unique, première lettre (par la file), remise, ouverture de l'espace. */
export const onboarding = task({
  id: 'onboarding',
  maxDuration: 45 * 60,
  retry: { maxAttempts: 1 },
  run: async (payload: { organisation: string; ouvrirLEspace?: boolean }, { ctx }) => {
    const anthropic = clientAnthropic()
    const dossier = await lireLeDossierDOnboarding(payload.organisation)
    let coûtDuRéférentiel = 0
    if (!dossier.référentielUnique) {
      const référentiel = dossier.référentielsNotion
        ? await convertirLesRéférentiels(anthropic, { organisation: dossier.organisation.nom, fiche: dossier.fiche ?? '', ...dossier.référentielsNotion }).then((r) => ({ markdown: r.markdown, fiche: dossier.fiche ?? '', coût: 0 }))
        : await dériverLeRéférentiel(anthropic, {
            organisation: dossier.organisation.nom,
            site: dossier.organisation.site,
            filière: dossier.filière?.nom ?? null,
            référentielDeFilière: dossier.filière?.référentiel ?? null,
            fiche: dossier.fiche,
          })
      coûtDuRéférentiel = référentiel.coût
      await remettreLeRéférentiel({
        organisation: dossier.organisation.id,
        filiere: null,
        run: ctx.run.id,
        titre: `Référentiel unique : ${dossier.organisation.nom}`,
        markdown: référentiel.markdown,
        fiche: référentiel.fiche,
        cout: référentiel.coût,
      })
      logger.info('référentiel remis', { coût: référentiel.coût })
    }
    if (!dossier.organisation.slug) throw new Error(`Onboarding de ${dossier.organisation.nom} : organisation sans slug, aucune veille à poser.`)
    const début = new Date()
    const { travail, dossier: dossierDeParution } = await prendreLaPremièreLettre(dossier.organisation.slug, ctx.run.id)
    const { production } = await produireDepuisLeDossier(dossierDeParution, { journal: (l) => logger.info(l) })
    const accusé = await remettreLÉdition({ ...remiseDe(production, { organisation: dossier.organisation.id, filiere: null }, 'onboarding', ctx.run.id, début), travail, session: ctx.run.id })
    // Règle du 20 octobre 2026 : le lien d'accès ne part qu'après une lettre publiée.
    if (payload.ouvrirLEspace !== false && accusé.statut === 'publiee' && dossier.organisation.contactEmail) {
      await ouvrirLEspace(dossier.organisation.contactEmail)
    }
    return { accusé, acceptée: production.acceptée, coût: coûtDuRéférentiel + production.mesures.coût }
  },
})

/** Palier 3 : l'édition de découverte, à la première visite. Même chemin que l'onboarding, sans ouverture d'espace (il est déjà ouvert). */
export const éditionDeDécouverte = task({
  id: 'edition-de-decouverte',
  maxDuration: 30 * 60,
  retry: { maxAttempts: 1 },
  run: async (payload: { organisation: string }, { ctx }) => {
    const anthropic = clientAnthropic()
    const dossier = await lireLeDossierDOnboarding(payload.organisation)
    if (!dossier.référentielUnique) {
      const référentiel = await dériverLeRéférentiel(anthropic, {
        organisation: dossier.organisation.nom,
        site: dossier.organisation.site,
        filière: dossier.filière?.nom ?? null,
        référentielDeFilière: dossier.filière?.référentiel ?? null,
        fiche: dossier.fiche,
      })
      await remettreLeRéférentiel({ organisation: dossier.organisation.id, filiere: null, run: ctx.run.id, titre: `Référentiel unique : ${dossier.organisation.nom}`, markdown: référentiel.markdown, fiche: référentiel.fiche, cout: référentiel.coût })
    }
    if (!dossier.organisation.slug) throw new Error(`Découverte pour ${dossier.organisation.nom} : organisation sans slug, aucune veille à poser.`)
    const début = new Date()
    const { travail, dossier: dossierDeParution } = await prendreLaPremièreLettre(dossier.organisation.slug, ctx.run.id, 'decouverte')
    const { production } = await produireDepuisLeDossier(dossierDeParution, { journal: (l) => logger.info(l), reprisesMax: 1 })
    const accusé = await remettreLÉdition({ ...remiseDe(production, { organisation: dossier.organisation.id, filiere: null }, 'decouverte', ctx.run.id, début), travail, session: ctx.run.id })
    return { accusé, acceptée: production.acceptée, coût: production.mesures.coût }
  },
})

const schémaDuBloc = z.object({
  lignes: z.array(z.string().max(160)).min(3).max(8).describe('Quatre à huit lignes « pour <organisation> » : un concurrent nommé, un fait daté le concernant, un dossier ouvert ; chaque ligne se lit seule'),
})

/** Palier 1 : le bloc personnalisé d'un prospect, à poser dans la lettre de filière qu'il reçoit. */
export const blocPersonnalisé = task({
  id: 'bloc-personnalise',
  maxDuration: 10 * 60,
  retry: { maxAttempts: 2 },
  run: async (payload: { prospect: string }, { ctx }) => {
    const url = process.env['PORTAIL_URL']?.replace(/\/$/, '')
    const jeton = process.env['ACTIVATION_SECRET']
    if (!url || !jeton) throw new Error('PORTAIL_URL et ACTIVATION_SECRET sont requis.')
    const réponse = await fetch(`${url}/api/veille/dossier?mode=prospect&prospect=${encodeURIComponent(payload.prospect)}`, { headers: { authorization: `Bearer ${jeton}` } })
    if (!réponse.ok) throw new Error(`GET /api/veille/dossier (prospect) : ${réponse.status}`)
    const dossier = (await réponse.json()) as { prospect: { id: string; organisation: string; site: string | null }; filière: { nom: string; référentiel: string | null } | null; dernièreLettreDeFilière: string | null }
    const anthropic = clientAnthropic()
    const extraits = dossier.prospect.site
      ? await collecterLesSources(
          { organisation: dossier.prospect.organisation, fiche: '', dossiersBruts: '', dossiers: [], axes: [{ numéro: 1, nom: 'site', sorte: 'thème', critères: '', sources: [{ libellé: 'site', url: dossier.prospect.site }], requêtes: [], acteurs: [] }] },
          { ouvrirNavigateur: () => navigateurPlaywright(), tailleExtrait: 8_000 },
        )
      : []
    const r = await anthropic.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 2_000,
      system:
        `Tu écris, pour un prospect, un bloc court de quatre à huit lignes qui montre ce que la lettre de filière ci-dessous signifie pour lui : ` +
        `un concurrent ou un acteur nommé, un fait daté de la lettre qui le concerne, un dossier ouvert à suivre. Phrases simples, ton sobre, rien d'inventé : ` +
        `tout vient de la lettre de filière et du site du prospect.`,
      messages: [
        {
          role: 'user',
          content: `<prospect>${dossier.prospect.organisation}</prospect>\n<site>\n${extraits.map((e) => e.texte).join('\n').slice(0, 8_000)}\n</site>\n<lettre_de_filiere>\n${dossier.dernièreLettreDeFilière ?? 'aucune'}\n</lettre_de_filiere>`,
        },
      ],
      output_format: zodOutputFormat(schémaDuBloc),
    })
    const bloc = r.parsed_output
    if (!bloc) throw new Error('Bloc personnalisé : aucune sortie structurée.')
    const remise = await fetch(`${url}/api/veille/prospects`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prospect: dossier.prospect.id, run: ctx.run.id, bloc: bloc.lignes }),
    })
    if (!remise.ok) throw new Error(`POST /api/veille/prospects : ${remise.status}`)
    return { lignes: bloc.lignes.length }
  },
})
