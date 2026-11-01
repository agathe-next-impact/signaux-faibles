/**
 * La clé de contexte Payload qui dit au crochet `afterChange` de la collection
 * `organisations` que le portail vient de lancer le run d'onboarding : il ne le
 * relance pas (lot 5 de `docs/proposition-onboarding-admin.md`). Seule dans ce
 * module, sans import : la collection et le registre l'importent tous deux, et
 * le registre importe la configuration Payload, qui importe la collection.
 */
export const CONTEXTE_LANCÉ_PAR_LE_PORTAIL = 'onboardingLancéParLePortail'
