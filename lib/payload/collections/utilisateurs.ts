import type { CollectionConfig } from 'payload'
import { ACCÈS_AUTHENTIFIÉ } from '@/lib/payload/acces'

/**
 * Les utilisateurs de l'admin Payload : l'opératrice, et personne d'autre.
 *
 * Ce ne sont pas les lecteurs du portail : eux n'ont ni mot de passe ni
 * compte Payload, ils entrent par le lien magique. Le premier utilisateur se
 * crée sur /admin au premier démarrage, hors de tout contrôle d'accès.
 */
export const utilisateurs: CollectionConfig = {
  slug: 'utilisateurs',
  labels: { singular: 'Utilisateur', plural: 'Utilisateurs' },
  auth: true,
  admin: { useAsTitle: 'nom' },
  access: ACCÈS_AUTHENTIFIÉ,
  fields: [{ name: 'nom', type: 'text', label: 'Nom', required: true }],
}
