import type { CollectionConfig } from 'payload'
import { invaliderLÉdition } from '@/lib/documents/invalidation'
import { markdownVersBlocs } from '@/lib/domaine/markdown'
import { ACCÈS_AUTHENTIFIÉ } from '@/lib/payload/acces'
import { exactementUneDesDeux, identifiantDeRelation } from '@/lib/payload/relations'

/**
 * Les éditions : la lettre en Markdown, et ses blocs dérivés.
 *
 * `blocs` n'est jamais écrit à la main : le crochet `beforeChange` le recalcule
 * à chaque enregistrement par `markdownVersBlocs`, le même convertisseur que le
 * moteur et l'évaluation. Les écrans lisent ces blocs comme ils lisaient les
 * blocs Notion (`construireDocument`), et ne changent donc pas.
 *
 * L'invalidation du cache des écrans se fait ici, par `afterChange` et
 * `afterDelete`, à la place du webhook Notion : le tag de la page et celui de
 * la liste de l'organisation. Un retrait (`retiree`) ou un retour en brouillon
 * passe par le même chemin : la liste ne demande que les éditions `publiee`.
 */
export const STATUTS_D_ÉDITION = [
  { label: 'Brouillon', value: 'brouillon' },
  { label: 'Publiée', value: 'publiee' },
  { label: 'Retirée', value: 'retiree' },
] as const

export const editions: CollectionConfig = {
  slug: 'editions',
  labels: { singular: 'Édition', plural: 'Éditions' },
  admin: {
    useAsTitle: 'titre',
    defaultColumns: ['titre', 'organisation', 'filiere', 'numero', 'dateEdition', 'statut'],
  },
  access: ACCÈS_AUTHENTIFIÉ,
  indexes: [{ fields: ['organisation', 'statut', 'dateEdition'] }],
  fields: [
    { name: 'titre', type: 'text', label: 'Titre', required: true },
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
    { name: 'numero', type: 'number', label: 'Numéro', min: 1 },
    {
      name: 'dateEdition',
      type: 'date',
      label: 'Date d’édition',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
    },
    {
      name: 'statut',
      type: 'select',
      label: 'Statut',
      required: true,
      defaultValue: 'brouillon',
      index: true,
      options: [...STATUTS_D_ÉDITION],
    },
    { name: 'periodeCouverte', type: 'text', label: 'Période couverte' },
    { name: 'fenetreElargie', type: 'checkbox', label: 'Fenêtre élargie', defaultValue: false },
    { name: 'actionDeLaSemaine', type: 'text', label: 'Action de la semaine' },
    {
      name: 'dossiersOuvertsSuivis',
      type: 'text',
      label: 'Dossiers ouverts suivis',
      admin: { description: 'Format « nom (compteur, précision) · … », comme la propriété Notion.' },
    },
    { name: 'markdown', type: 'textarea', label: 'Markdown', required: true },
    {
      name: 'blocs',
      type: 'json',
      label: 'Blocs (dérivés du Markdown)',
      admin: { readOnly: true, description: 'Recalculé à chaque enregistrement, jamais saisi.' },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (typeof data.markdown === 'string') {
          data.blocs = markdownVersBlocs(data.markdown)
        }
        return data
      },
    ],
    afterChange: [
      ({ doc, previousDoc }) => {
        const organisation = identifiantDeRelation(doc?.organisation)
        invaliderLÉdition({ id: String(doc.id), organisation })
        // L'édition a changé d'organisation : l'ancienne liste la portait encore.
        const précédente = identifiantDeRelation(previousDoc?.organisation)
        if (précédente && précédente !== organisation) {
          invaliderLÉdition({ id: String(doc.id), organisation: précédente })
        }
        return doc
      },
    ],
    afterDelete: [
      ({ doc, id }) => {
        invaliderLÉdition({ id: String(id), organisation: identifiantDeRelation(doc?.organisation) })
        return doc
      },
    ],
  },
}
