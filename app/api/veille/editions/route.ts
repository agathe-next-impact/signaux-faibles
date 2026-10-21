import { NextResponse, type NextRequest } from 'next/server'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { schémaDeRemiseDÉdition, type RemiseDÉdition } from '@/lib/moteur/remise'
import { enregistrerLÉdition } from '@/lib/payload/dispositif'
import { recevoirUneÉdition } from '@/lib/portail/file'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { envoyerLaLettreDeFilière, envoyerLaLettreAuxLecteurs } from '@/lib/portail/parution'

/**
 * La remise d'une édition par une tâche Trigger.dev (programme du 22 octobre
 * 2026, §3, étape 5). Le portail est le seul écrivain.
 *
 * Deux chemins, selon que la remise conclut un travail de la file ou non.
 *
 *   · **Une lettre d'organisation** porte `travail` et `session` : c'est la
 *     file qui décide (`recevoirUneÉdition`, `lib/portail/file.ts`). Les portes
 *     du portail (organisation du travail, numéro attribué, lint en forme
 *     unique) et le verdict du moteur sont confrontés, le travail est conclu
 *     et le run journalisé dans la table Drizzle `runs`, seul journal. Une
 *     édition acceptée est écrite dans Payload, publiée, le gel des sources
 *     remplacé, puis les courriers partent aux lecteurs actifs. Une édition
 *     refusée ou abandonnée n'est écrite **nulle part** : le travail redevient
 *     prenable (ou est abandonné à la troisième tentative), et la réponse porte
 *     les portes.
 *   · **Une lettre de filière** n'a pas de travail : elle est revalidée ici en
 *     forme unique, écrite publiée si le moteur l'a acceptée et que la
 *     revalidation passe, brouillon sinon, puis envoyée aux prospects de la
 *     filière avec leur bloc personnalisé.
 *
 *   POST /api/veille/editions   Authorization: Bearer <ACTIVATION_SECRET>
 *   corps : RemiseDÉdition (lib/moteur/remise.ts)
 *   → { edition, run, statut: "publiee" | "brouillon", courriers, ruptures }
 *   → { état: "refuse" | "abandonne", run, portes, tentatives }     (travail non accepté)
 *   → { état: "inconnu" | "pas-pris" | "autre-session" }, 409      (travail non conclu)
 */
export async function POST(requête: NextRequest): Promise<NextResponse> {
  const refus = refuserSiNonAutorisé(requête, 'editions')
  if (refus) return refus

  const lu = schémaDeRemiseDÉdition.safeParse(await requête.json().catch(() => null))
  if (!lu.success) return NextResponse.json({ état: 'invalide', détails: lu.error.issues }, { status: 400 })
  const remise = lu.data
  if ((remise.organisation === null) === (remise.filiere === null)) {
    return NextResponse.json({ état: 'invalide', détails: 'exactement une cible, organisation ou filiere' }, { status: 400 })
  }
  if ((remise.travail === undefined) !== (remise.session === undefined)) {
    return NextResponse.json({ état: 'invalide', détails: 'travail et session vont ensemble' }, { status: 400 })
  }
  if (remise.travail && remise.filiere) {
    return NextResponse.json({ état: 'invalide', détails: 'une lettre de filière ne conclut pas de travail' }, { status: 400 })
  }

  try {
    return remise.travail && remise.session ? await conclureLeTravailDeLaFile(remise, remise.travail, remise.session) : await remettreHorsFile(remise)
  } catch (erreur) {
    console.error(`[veille/editions] run ${remise.run} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 500 })
  }
}

const STATUT_DE_NON_CONCLUSION: Record<'inconnu' | 'pas-pris' | 'autre-session', number> = { inconnu: 404, 'pas-pris': 409, 'autre-session': 409 }

async function conclureLeTravailDeLaFile(remise: RemiseDÉdition, travail: string, session: string): Promise<NextResponse> {
  const réception = await recevoirUneÉdition({
    travailId: travail,
    session,
    organisationPayload: remise.organisation,
    titre: remise.proprietes.titre,
    numéro: remise.proprietes.numero,
    dateÉdition: remise.proprietes.dateEdition,
    markdown: remise.markdown,
    dossiersBruts: remise.proprietes.dossiersOuvertsSuivis,
    acceptéeParLeMoteur: remise.acceptee,
    exécuteur: `trigger:${remise.run}`,
    début: new Date(remise.debut),
    fin: new Date(remise.fin),
    résultat: { mode: remise.mode, run: remise.run, mesures: remise.mesures, controle: remise.controle },
    coût: { euros: remise.mesures.cout, modele: remise.mesures.modele, reprises: remise.mesures.reprises },
  })

  if (réception.sorte === 'inconnu' || réception.sorte === 'autre-session') {
    console.warn(`[veille/editions] run ${remise.run} : travail ${travail} ${réception.sorte}.`)
    return NextResponse.json({ état: réception.sorte, run: remise.run }, { status: STATUT_DE_NON_CONCLUSION[réception.sorte] })
  }
  if (réception.sorte === 'pas-pris') {
    console.warn(`[veille/editions] run ${remise.run} : travail ${travail} non pris (${réception.état}).`)
    return NextResponse.json({ état: 'pas-pris', travail: réception.état, run: remise.run }, { status: STATUT_DE_NON_CONCLUSION['pas-pris'] })
  }

  const codes = [...réception.portes.portail.map((p) => p.code), ...réception.portes.ruptures.map((r) => r.code)]
  const { conclusion } = réception
  if (conclusion.sorte !== 'accepté') {
    console.warn(`[veille/editions] run ${remise.run} : travail ${travail} ${conclusion.sorte} (${codes.join(', ') || 'refusée par le moteur'}).`)
    return NextResponse.json({
      état: conclusion.sorte === 'refusé' ? 'refuse' : 'abandonne',
      run: remise.run,
      tentatives: conclusion.tentatives,
      portes: réception.portes,
    })
  }

  const accusé = await enregistrerLÉdition(remise, 'publiee')
  const courriers = await envoyerLaLettreAuxLecteurs({
    organisationPayload: remise.organisation ?? '',
    édition: { id: accusé.edition ?? '', titre: remise.proprietes.titre, numéro: remise.proprietes.numero, dateÉdition: remise.proprietes.dateEdition, périodeCouverte: remise.proprietes.periodeCouverte },
    markdown: remise.markdown,
  })
  console.info(`[veille/editions] run ${remise.run} : travail ${travail} accepté, édition ${accusé.edition} publiée (n° ${conclusion.numéro ?? remise.proprietes.numero}).`)
  return NextResponse.json({ ...accusé, travail: 'accepte', ruptures: [], avertissements: réception.portes.avertissements.map((a) => a.code), courriers })
}

async function remettreHorsFile(remise: RemiseDÉdition): Promise<NextResponse> {
  // La porte du portail, indépendante de celle du moteur : la même lettre,
  // relue ici, doit passer le même contrat. Un écart entre les deux est une
  // dérive du moteur, pas un cas à tolérer.
  const rapport = contrôlerLaLettre({
    titre: remise.proprietes.titre,
    blocs: markdownVersBlocs(remise.markdown),
    dossiersBruts: remise.proprietes.dossiersOuvertsSuivis,
    numéro: remise.proprietes.numero,
    forme: 'unique',
  })
  const statut = remise.acceptee && rapport.conforme ? 'publiee' : 'brouillon'
  if (remise.acceptee && !rapport.conforme) {
    console.warn(`[veille/editions] run ${remise.run} : acceptée par le moteur, refusée par le portail (${rapport.ruptures.map((r) => r.code).join(', ')}) ; brouillon.`)
  }

  const accusé = await enregistrerLÉdition(remise, statut)
  const édition = { id: accusé.edition ?? '', titre: remise.proprietes.titre, numéro: remise.proprietes.numero, dateÉdition: remise.proprietes.dateEdition, périodeCouverte: remise.proprietes.periodeCouverte }
  let courriers: unknown = null
  if (statut === 'publiee') {
    courriers = remise.organisation
      ? await envoyerLaLettreAuxLecteurs({ organisationPayload: remise.organisation, édition, markdown: remise.markdown })
      : await envoyerLaLettreDeFilière({ filière: remise.filiere ?? '', édition, markdown: remise.markdown })
  }
  return NextResponse.json({ ...accusé, ruptures: rapport.ruptures.map((r) => r.code), courriers })
}
