import Link from 'next/link'
import { démonstration, documentDe } from '@/components/apercu-vitrine'
import { BadgeImpact } from '@/components/badge-impact'
import { Texte } from '@/components/document'
import { SurtitreAxe } from '@/components/titre-axe'
import { VidéoDeLEspace } from '@/components/video-espace'
import { BoutonDémo, ChiffresClés } from '@/components/vitrine'
import { fusionnerLesAxes } from '@/lib/domaine/document'
import { trierParImpact } from '@/lib/domaine/impact'
import { ESSENTIEL_LIGNES_MAX } from '@/lib/domaine/texte'
import { LETTRE_UNIQUE } from '@/lib/portail/lint'

/**
 * Quatre ouvertures candidates pour l'accueil (7 novembre 2026, demande de
 * l'opératrice : « moins chargées, plus explicites, visuellement rapidement
 * parlantes »). Chacune tient en un surtitre, un titre, un bouton et un seul
 * visuel ; aucune ne porte de chapeau long ni de chiffres au-delà de trois.
 * Rendues côte à côte sur la page de travail `/heros` (non indexée), le temps
 * d'en choisir une ; la retenue remplacera l'ouverture de
 * `components/vitrine-accueil.tsx`, et la page disparaîtra.
 */

function LienExemples({ négatif = false }: { négatif?: boolean }) {
  return (
    <Link href="/exemple" className={`group inline-flex items-center gap-1 ${négatif ? 'text-blanc' : 'text-encre'}`}>
      Voir des exemples
      <span aria-hidden="true" className="text-rose transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  )
}

function Actions({ négatif = false }: { négatif?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <BoutonDémo négatif={négatif} />
      <LienExemples négatif={négatif} />
    </div>
  )
}

/**
 * A. La vidéo. Une phrase, un bouton, et l'espace qui défile à droite,
 * muet et en boucle : le produit se montre lui-même. Bande encre.
 */
export function HéroVidéo() {
  return (
    <section className="grid grid-cols-1 border-b border-gris-ligne bg-encre lg:grid-cols-[1fr_minmax(0,32rem)]">
      <div className="flex items-center">
        <div className="flex flex-col gap-8 px-6 py-12 lg:px-12">
          <p className="label-mono text-gris-ligne">Veille hebdomadaire rédigée</p>
          <h1 className="font-titre text-h1 font-bold text-blanc">
            Votre marché bouge chaque semaine. Nous vous l’écrivons.
          </h1>
          <Actions négatif />
        </div>
      </div>
      <figure className="flex flex-col gap-3 p-6 lg:p-12">
        <VidéoDeLEspace className="aspect-square w-full border border-ardoise bg-blanc object-cover" />
        <figcaption className="label-mono text-gris-ligne">Votre espace, écran par écran · 1 min, sans son</figcaption>
      </figure>
    </section>
  )
}

/**
 * B. Trois chiffres. Une page blanche, un titre centré et trois chiffres en
 * grand : ce que vous recevez, combien de temps ça prend. La vidéo suit, en
 * pleine largeur, pour qui descend.
 */
export function HéroChiffres() {
  return (
    <section className="flex flex-col border-b border-gris-ligne">
      <div className="flex flex-col items-center gap-8 px-6 py-12 text-center lg:px-12">
        <p className="label-mono text-ardoise">Veille hebdomadaire rédigée</p>
        <h1 className="max-w-3xl font-titre text-h1 font-bold text-encre">
          Une lettre par semaine. Tout ce qui a bougé autour de vous.
        </h1>
        <Actions />
        <div className="w-full max-w-2xl">
          <ChiffresClés
            chiffres={[
              { valeur: '30 s', libellé: `l’essentiel, ${ESSENTIEL_LIGNES_MAX} lignes` },
              { valeur: `${LETTRE_UNIQUE.axesMin}–${LETTRE_UNIQUE.axesMax}`, libellé: 'axes suivis pour vous' },
              { valeur: '1', libellé: 'espace pour tout retrouver' },
            ]}
          />
        </div>
      </div>
      <figure className="flex flex-col items-center gap-3 border-t border-gris-ligne bg-fond-neutre px-6 py-8 lg:px-12">
        <VidéoDeLEspace className="aspect-square w-full max-w-md border border-gris-ligne bg-blanc object-cover" />
        <figcaption className="label-mono text-ardoise">Votre espace, écran par écran · 1 min, sans son</figcaption>
      </figure>
    </section>
  )
}

const ALERTES_BRUTES = [
  'Google Alerts · 47 nouveaux résultats',
  'Newsletter sectorielle · 12 non lues',
  'Veille juridique · 9 textes publiés',
  'LinkedIn · 31 notifications',
  'Presse régionale · 18 articles',
  'Appels d’offres · 6 avis',
] as const

/**
 * C. Avant, après. À gauche, le flux d'alertes que tout le monde reçoit déjà,
 * grisé et sans hiérarchie ; à droite, les trois axes de la lettre fictive avec
 * leur niveau d'impact. Le contraste porte le message, le titre le nomme.
 */
export function HéroAvantAprès() {
  const d = démonstration()
  const axes = trierParImpact(fusionnerLesAxes([documentDe(d)], 1)).slice(0, 3)
  return (
    <section className="flex flex-col border-b border-gris-ligne">
      <div className="flex flex-col gap-8 px-6 py-12 lg:px-12">
        <p className="label-mono text-ardoise">Veille hebdomadaire rédigée</p>
        <h1 className="max-w-3xl font-titre text-h1 font-bold text-encre">
          Des alertes, vous en avez déjà. Il vous manque la lecture.
        </h1>
        <Actions />
      </div>
      <div className="grid grid-cols-1 border-t border-gris-ligne lg:grid-cols-2">
        <figure className="flex flex-col gap-4 border-b border-gris-ligne bg-fond-neutre p-6 lg:border-r lg:border-b-0 lg:p-12">
          <figcaption className="label-mono text-ardoise">Sans · ce que vous recevez déjà</figcaption>
          <ul aria-label="Flux d’alertes, exemple" className="flex flex-col gap-2">
            {ALERTES_BRUTES.map((a) => (
              <li key={a} className="border border-dashed border-gris-ligne px-4 py-2 font-mono text-label text-ardoise/60">
                {a}
              </li>
            ))}
          </ul>
          <p className="label-mono text-ardoise">123 entrées, zéro décision</p>
        </figure>
        <figure className="flex flex-col gap-4 p-6 lg:p-12">
          <figcaption className="label-mono text-ardoise">Avec · la lettre de la semaine</figcaption>
          <ul aria-label={`Trois axes de la lettre de ${d.organisation}, organisation fictive`} className="flex flex-col divide-y divide-gris-ligne border border-gris-ligne bg-blanc">
            {axes.map((axe) => (
              <li key={axe.titre} className="flex flex-col gap-2 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SurtitreAxe axe={axe} />
                  <BadgeImpact niveau={axe.niveau} />
                </div>
                {axe.points[0] ? (
                  <p className="text-ardoise">
                    <Texte segments={axe.points[0].segments} />
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="label-mono text-ardoise">
            {LETTRE_UNIQUE.axesMin} à {LETTRE_UNIQUE.axesMax} axes, chacun avec son niveau · organisation fictive
          </p>
        </figure>
      </div>
    </section>
  )
}

/**
 * D. Trois niveaux. La promesse réduite à ce que le lecteur fait de chaque
 * axe : décider, suivre, ou passer. Trois cases sur bande encre, chacune avec
 * son badge et le fait de la lettre fictive qui l'illustre.
 */
export function HéroTroisNiveaux() {
  const d = démonstration()
  const axes = trierParImpact(fusionnerLesAxes([documentDe(d)], 1))
  const parNiveau = (['FORT', 'MOYEN', 'RAS'] as const).map((niveau) => ({
    niveau,
    axe: axes.find((a) => a.niveau === niveau),
    geste: niveau === 'FORT' ? 'Une décision à prendre' : niveau === 'MOYEN' ? 'Un mouvement à suivre' : 'Vérifié, rien de neuf',
  }))
  return (
    <section className="flex flex-col gap-12 border-b border-gris-ligne bg-encre px-6 py-12 lg:px-12">
      <div className="flex flex-col gap-8">
        <p className="label-mono text-gris-ligne">Veille hebdomadaire rédigée</p>
        <h1 className="max-w-3xl font-titre text-h1 font-bold text-blanc">
          Chaque semaine, chaque sujet, une réponse : décider, suivre, ou passer.
        </h1>
        <Actions négatif />
      </div>
      <ul aria-label="Les trois niveaux d’impact, sur la lettre d’une organisation fictive" className="grid grid-cols-1 gap-px bg-ardoise lg:grid-cols-3">
        {parNiveau.map(({ niveau, axe, geste }) => (
          <li key={niveau} className="flex flex-col gap-4 bg-blanc p-6">
            <p className="self-start">
              <BadgeImpact niveau={niveau} />
            </p>
            <p className="font-titre text-h3 font-semibold text-encre">{geste}.</p>
            {axe ? (
              <div className="flex flex-col gap-2 border-t border-gris-ligne pt-4">
                <SurtitreAxe axe={axe} />
                {axe.points[0] ? (
                  <p className="text-ardoise">
                    <Texte segments={axe.points[0].segments} />
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="label-mono text-gris-ligne">Organisation fictive · forme réelle</p>
    </section>
  )
}
