/**
 * La marque signauxfaibles.
 *
 * Le motif est vectoriel plutôt qu'une image : il reste net à toute taille,
 * pèse quelques centaines d'octets, et ses couleurs sont celles de la charte
 * par les tokens, sans valeur en dur. Le mot-symbole est du texte composé en
 * Lora, la police de la charte, et non une image de texte : il reste
 * sélectionnable, lisible par un lecteur d'écran, et net sur tout écran.
 *
 * Trois interdits de la charte tenus ici : pas de capitales ni d'espace dans le
 * mot, pas d'autre police, et jamais d'inversion des couleurs du mot et du
 * curseur — le curseur reste rose, seul le mot change sur fond encre.
 */

/**
 * Le motif : un axe gris, quatre impulsions. La plus haute est rose, signal
 * fort ; les autres sont ardoise, signal secondaire.
 */
export function MarqueIcone({
  className = 'h-6 w-6',
  négatif = false,
}: {
  className?: string
  négatif?: boolean
}) {
  // Sur fond encre, l'ardoise et le gris ligne s'effondrent. Les deux rôles
  // remontent d'un cran : l'axe prend l'ardoise, les impulsions secondaires
  // prennent le gris ligne. Le rose ne bouge pas — la charte interdit d'inverser
  // les couleurs du signal. Elle n'illustre pas de version négative du motif :
  // c'est une extrapolation, à confirmer si un écran sombre apparaît.
  const axe = négatif ? 'var(--color-ardoise)' : 'var(--color-gris-ligne)'
  const secondaire = négatif ? 'var(--color-gris-ligne)' : 'var(--color-ardoise)'

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="signauxfaibles"
      focusable="false"
    >
      <rect x="6" y="34.2" width="36" height="2.6" rx="1.3" fill={axe} />
      <rect x="9.8" y="26" width="4.4" height="9.6" rx="2.2" fill={secondaire} />
      <rect x="17.8" y="20" width="4.4" height="15.6" rx="2.2" fill={secondaire} />
      <rect x="25.8" y="10" width="4.4" height="25.6" rx="2.2" fill="var(--color-rose)" />
      <rect x="33.8" y="23" width="4.4" height="12.6" rx="2.2" fill={secondaire} />
    </svg>
  )
}

/** Le mot-symbole seul : « signauxfaibles » soudé, suivi du curseur rose. */
function MotSymbole({ négatif }: { négatif: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline font-titre font-bold tracking-tight ${
        négatif ? 'text-blanc' : 'text-encre'
      }`}
    >
      signauxfaibles
      <span
        aria-hidden="true"
        className="ml-[0.06em] inline-block h-[0.92em] w-[0.08em] translate-y-[0.06em] bg-rose"
      />
    </span>
  )
}

/**
 * Le verrouillage horizontal : motif à gauche, mot-symbole à droite.
 * C'est la forme des en-têtes. Taille minimale de la charte : 120 px de large.
 */
export function Logo({
  négatif = false,
  className = 'text-h3',
}: {
  négatif?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <MarqueIcone className="h-[1.15em] w-[1.15em] shrink-0" négatif={négatif} />
      <MotSymbole négatif={négatif} />
    </span>
  )
}

/**
 * Le verrouillage empilé : motif au-dessus, mot-symbole, puis la baseline en
 * italique Lora — la voix éditoriale, seul emploi que la charte lui autorise.
 * C'est la forme des pages d'entrée.
 */
export function LogoEmpile({ négatif = false }: { négatif?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <MarqueIcone className="h-12 w-12" négatif={négatif} />
      <span className="text-h1 leading-none">
        <MotSymbole négatif={négatif} />
      </span>
      <p className="voix text-h3">Votre veille, rédigée.</p>
    </div>
  )
}
