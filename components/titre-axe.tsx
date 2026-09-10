/**
 * Le titre d'un axe, son numéro composé en indice.
 *
 * Les référentiels numérotent les axes avec des chiffres cerclés — ①, ②, ③ —
 * que ni Lora ni Public Sans ne dessinent : le navigateur va les chercher dans
 * une police de secours, et le titre se retrouve composé en deux fontes, avec
 * un chiffre trop lourd et mal aligné. Le numéro est donc détaché à la lecture
 * et recomposé ici, en mono, petit, abaissé sur la ligne de base — la place
 * qu'un indice occupe.
 *
 * Le titre reste lisible d'un lecteur d'écran comme « 2, Cadre français » : le
 * numéro est du texte, pas une décoration.
 */
export function TitreAxe({
  axe,
  className,
}: {
  axe: { readonly titre: string; readonly numéro: number | null }
  className?: string
}) {
  return (
    <span className={className}>
      {axe.numéro !== null ? (
        <span className="mr-1.5 align-sub font-mono text-label font-medium text-ardoise">
          {axe.numéro}
        </span>
      ) : null}
      {axe.titre}
    </span>
  )
}

/**
 * Le surtitre d'une case d'axe : son numéro, puis son nom.
 *
 * Ici le numéro n'est pas mis en indice, contrairement au titre d'une note.
 * L'indice existe parce que Lora ne dessine pas les chiffres cerclés ; en mono,
 * un chiffre ordinaire se compose très bien, et un indice à cette taille ne
 * serait plus lisible.
 *
 * Encre plutôt qu'ardoise, à l'inverse des autres surtitres : c'est ici
 * l'identité de la case, pas une mention de service — elle doit rester lue en
 * premier.
 */
export function SurtitreAxe({
  axe,
}: {
  axe: { readonly titre: string; readonly numéro: number | null }
}) {
  return (
    <p className="label-mono text-encre">
      {axe.numéro !== null ? (
        <>
          {axe.numéro}
          <span aria-hidden="true" className="mx-1.5 text-ardoise">
            ·
          </span>
        </>
      ) : null}
      {axe.titre}
    </p>
  )
}
