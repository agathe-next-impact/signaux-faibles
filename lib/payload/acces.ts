import type { Access } from 'payload'

/**
 * Contrôle d'accès des collections Payload.
 *
 * L'admin et l'API REST de Payload (/admin, /payload-api) sont réservés aux
 * utilisateurs Payload, c'est-à-dire à l'opératrice. Aucun client n'y entre :
 * le cloisonnement des espaces clients reste celui du portail (règle 2), qui
 * lit les documents par l'API locale de Payload, hors de ce contrôle.
 */
export const authentifié: Access = ({ req }) => Boolean(req.user)

export const jamais: Access = () => false

/** Lecture et écriture réservées aux utilisateurs authentifiés. */
export const ACCÈS_AUTHENTIFIÉ = {
  read: authentifié,
  create: authentifié,
  update: authentifié,
  delete: authentifié,
} as const

/**
 * Lecture seule dans l'admin : le portail écrit par l'API locale, qui passe
 * outre ce contrôle (`overrideAccess` par défaut), jamais une main.
 */
export const ACCÈS_LECTURE_SEULE = {
  read: authentifié,
  create: jamais,
  update: jamais,
  delete: jamais,
} as const
