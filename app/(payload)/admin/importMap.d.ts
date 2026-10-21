/**
 * Déclaration de `importMap.js`, que `pnpm payload generate:importmap`
 * régénère en JavaScript : le dépôt n'autorise pas `allowJs`, ce fichier donne
 * son type au module sans toucher au fichier généré.
 */
import type { ImportMap } from 'payload'

export const importMap: ImportMap
