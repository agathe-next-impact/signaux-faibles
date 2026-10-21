import type { CollectionConfig } from 'payload'
import { ACCÈS_LECTURE_SEULE } from '@/lib/payload/acces'

/**
 * Le journal des runs, écrit par le portail (`POST /api/veille/editions`) à
 * la remise d'un résultat Trigger.dev. Lecture seule dans l'admin : ni
 * création, ni modification, ni suppression à la main.
 */
export const runs: CollectionConfig = {
  slug: 'runs',
  labels: { singular: 'Run', plural: 'Runs' },
  admin: { defaultColumns: ['type', 'organisation', 'filiere', 'accepte', 'debut', 'fin'] },
  access: ACCÈS_LECTURE_SEULE,
  fields: [
    {
      name: 'type',
      type: 'select',
      label: 'Type',
      required: true,
      index: true,
      options: [
        { label: 'Parution', value: 'parution' },
        { label: 'Onboarding', value: 'onboarding' },
        { label: 'Filière', value: 'filiere' },
        { label: 'Bloc personnalisé', value: 'bloc' },
        { label: 'Édition de découverte', value: 'decouverte' },
      ],
    },
    { name: 'organisation', type: 'relationship', label: 'Organisation', relationTo: 'organisations', index: true },
    { name: 'filiere', type: 'relationship', label: 'Filière', relationTo: 'filieres', index: true },
    {
      name: 'tache',
      type: 'text',
      label: 'Tâche',
      admin: { description: 'Identifiant du run Trigger.dev.' },
    },
    { name: 'accepte', type: 'checkbox', label: 'Accepté', defaultValue: false },
    { name: 'portes', type: 'json', label: 'Portes' },
    { name: 'cout', type: 'json', label: 'Coût' },
    { name: 'edition', type: 'relationship', label: 'Édition', relationTo: 'editions' },
    { name: 'debut', type: 'date', label: 'Début' },
    { name: 'fin', type: 'date', label: 'Fin' },
  ],
}
