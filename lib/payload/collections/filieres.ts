import type { CollectionConfig } from 'payload'
import { ACCÈS_AUTHENTIFIÉ } from '@/lib/payload/acces'

/**
 * Les filières : une lettre partagée par les prospects d'un même secteur
 * (palier 1 du dispositif commercial). Une filière a son référentiel et ses
 * éditions, jamais publiées dans un espace client.
 */
export const filieres: CollectionConfig = {
  slug: 'filieres',
  labels: { singular: 'Filière', plural: 'Filières' },
  admin: { useAsTitle: 'nom', defaultColumns: ['nom', 'slug', 'active', 'cadence'] },
  access: ACCÈS_AUTHENTIFIÉ,
  fields: [
    { name: 'nom', type: 'text', label: 'Nom', required: true },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
      validate: (valeur: null | string | undefined) =>
        typeof valeur === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valeur)
          ? true
          : 'Minuscules, chiffres et tirets seulement.',
    },
    { name: 'description', type: 'textarea', label: 'Description' },
    { name: 'active', type: 'checkbox', label: 'Active', defaultValue: true },
    {
      name: 'cadence',
      type: 'select',
      label: 'Cadence',
      defaultValue: 'hebdomadaire',
      options: [
        { label: 'Hebdomadaire', value: 'hebdomadaire' },
        { label: 'Bimensuelle', value: 'bimensuelle' },
        { label: 'Mensuelle', value: 'mensuelle' },
      ],
    },
  ],
}
