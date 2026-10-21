/**
 * L'identifiant que porte une relation Payload, quelle que soit sa profondeur.
 *
 * Selon `depth`, une relation est un identifiant nu (chaîne ou nombre) ou le
 * document peuplé. Les crochets reçoivent le document peuplé, la façade de
 * lecture demande `depth: 0` : la même fonction sert aux deux.
 */
export function identifiantDeRelation(valeur: unknown): string | null {
  if (typeof valeur === 'string') return valeur.length > 0 ? valeur : null
  if (typeof valeur === 'number') return String(valeur)
  if (typeof valeur === 'object' && valeur !== null) {
    const id = (valeur as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
    // Relation polymorphe : { relationTo, value }.
    const interne = (valeur as { value?: unknown }).value
    if (interne !== undefined) return identifiantDeRelation(interne)
  }
  return null
}

/**
 * Validation « exactement une des deux relations ».
 *
 * Un référentiel ou une édition appartient à une organisation ou à une
 * filière, jamais aux deux ni à aucune. La règle est posée sur chacun des deux
 * champs, pour que le message apparaisse quel que soit celui qu'on édite.
 */
export function exactementUneDesDeux(autreChamp: string, libellés: string) {
  return (
    valeur: unknown,
    { siblingData }: { siblingData?: Record<string, unknown> | undefined },
  ): string | true => {
    const celleCi = identifiantDeRelation(valeur) !== null
    const lAutre = identifiantDeRelation(siblingData?.[autreChamp]) !== null
    if (celleCi === lAutre) return `Renseigner exactement une des deux : ${libellés}.`
    return true
  }
}
