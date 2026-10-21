import { NextResponse, type NextRequest } from 'next/server'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { schémaDeRemiseDÉdition } from '@/lib/moteur/remise'
import { enregistrerLÉdition } from '@/lib/payload/dispositif'
import { refuserSiNonAutorisé } from '@/lib/portail/garde-veille'
import { contrôlerLaLettre } from '@/lib/portail/lint'
import { envoyerLaLettreDeFilière, envoyerLaLettreAuxLecteurs } from '@/lib/portail/parution'

/**
 * La remise d'une édition par une tâche Trigger.dev (programme du 22 octobre
 * 2026, §3, étape 5). Le portail est le seul écrivain : il revalide la lettre
 * avec le validateur de production en forme unique, l'écrit dans Payload
 * (publiée si le moteur l'a acceptée et que la revalidation passe, brouillon
 * sinon, à relire dans l'admin), journalise le run, remplace le gel des
 * sources, puis fait partir les courriers : aux lecteurs actifs de
 * l'organisation, ou aux prospects de la filière avec leur bloc personnalisé.
 *
 *   POST /api/veille/editions   Authorization: Bearer <ACTIVATION_SECRET>
 *   corps : RemiseDÉdition (lib/moteur/remise.ts)
 *   → { edition, run, statut: "publiee" | "brouillon", courriers }
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

  try {
    const accusé = await enregistrerLÉdition(remise, statut)
    let courriers: unknown = null
    if (statut === 'publiee') {
      courriers = remise.organisation
        ? await envoyerLaLettreAuxLecteurs({ organisationPayload: remise.organisation, édition: { id: accusé.edition ?? '', titre: remise.proprietes.titre, numéro: remise.proprietes.numero, dateÉdition: remise.proprietes.dateEdition, périodeCouverte: remise.proprietes.periodeCouverte }, markdown: remise.markdown })
        : await envoyerLaLettreDeFilière({ filière: remise.filiere ?? '', édition: { id: accusé.edition ?? '', titre: remise.proprietes.titre, numéro: remise.proprietes.numero, dateÉdition: remise.proprietes.dateEdition, périodeCouverte: remise.proprietes.periodeCouverte }, markdown: remise.markdown })
    }
    return NextResponse.json({ ...accusé, ruptures: rapport.ruptures.map((r) => r.code), courriers })
  } catch (erreur) {
    console.error(`[veille/editions] run ${remise.run} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
    return NextResponse.json({ état: 'erreur' }, { status: 500 })
  }
}
