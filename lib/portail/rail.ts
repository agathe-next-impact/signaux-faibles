/**
 * Le cookie de préférence du rail latéral (30 octobre 2026) : `replie` ou
 * `ouvert`, posé par le bouton du rail, lu par le layout de l'espace pour rendre
 * le rail tel que le lecteur l'a laissé. Il ne porte rien d'identifiant.
 * Un module à part : une constante exportée d'un module client ne serait, côté
 * serveur, qu'une référence et non la chaîne.
 */
export const COOKIE_DU_RAIL = 'rail'
