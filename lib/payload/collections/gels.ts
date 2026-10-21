import type { CollectionConfig } from 'payload'
import { ACCÈS_LECTURE_SEULE } from '@/lib/payload/acces'

/**
 * Le gel des sources (programme du 22 octobre 2026, §3, étape 2) : pour
 * chaque source nommée d'une organisation ou d'une filière, l'empreinte et
 * les phrases de la dernière lecture. C'est ce qui permet au moteur de dire,
 * à la parution suivante, ce qui a changé sans aucun modèle. Écrit par le
 * portail à la remise d'une édition, jamais à la main.
 */
export const gels: CollectionConfig = {
  slug: 'gels',
  labels: { singular: 'Gel de source', plural: 'Gels de sources' },
  admin: { defaultColumns: ['url', 'organisation', 'filiere', 'luLe'] },
  access: ACCÈS_LECTURE_SEULE,
  indexes: [{ fields: ['organisation', 'url'] }, { fields: ['filiere', 'url'] }],
  fields: [
    { name: 'organisation', type: 'relationship', label: 'Organisation', relationTo: 'organisations', index: true },
    { name: 'filiere', type: 'relationship', label: 'Filière', relationTo: 'filieres', index: true },
    { name: 'url', type: 'text', label: 'URL', required: true, index: true },
    { name: 'empreinte', type: 'text', label: 'Empreinte', required: true },
    { name: 'phrases', type: 'json', label: 'Phrases' },
    { name: 'luLe', type: 'date', label: 'Lu le' },
  ],
}
