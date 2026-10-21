import type { CollectionConfig } from 'payload'
import { ACCÈS_AUTHENTIFIÉ } from '@/lib/payload/acces'
import { exactementUneDesDeux } from '@/lib/payload/relations'

/**
 * Les référentiels : le Markdown est la source de vérité, lu par le moteur
 * (`lib/moteur/referentiel.ts`). Un référentiel appartient à une organisation
 * ou à une filière, exactement une des deux.
 */
export const referentiels: CollectionConfig = {
  slug: 'referentiels',
  labels: { singular: 'Référentiel', plural: 'Référentiels' },
  admin: { useAsTitle: 'titre', defaultColumns: ['titre', 'organisation', 'filiere', 'version', 'actif'] },
  access: ACCÈS_AUTHENTIFIÉ,
  fields: [
    { name: 'titre', type: 'text', label: 'Titre', required: true },
    {
      name: 'markdown',
      type: 'code',
      label: 'Markdown',
      required: true,
      admin: { language: 'markdown' },
    },
    { name: 'version', type: 'number', label: 'Version', defaultValue: 1, min: 1 },
    {
      name: 'organisation',
      type: 'relationship',
      label: 'Organisation',
      relationTo: 'organisations',
      index: true,
      validate: exactementUneDesDeux('filiere', 'organisation ou filière'),
    },
    {
      name: 'filiere',
      type: 'relationship',
      label: 'Filière',
      relationTo: 'filieres',
      index: true,
      validate: exactementUneDesDeux('organisation', 'organisation ou filière'),
    },
    { name: 'actif', type: 'checkbox', label: 'Actif', defaultValue: true },
  ],
}
