import type { CollectionConfig } from 'payload'
import { déclencherLeBlocPersonnalisé } from '@/lib/moteur/declencher'
import { ACCÈS_AUTHENTIFIÉ } from '@/lib/payload/acces'
import { ouvrirDansLePortail } from '@/lib/payload/portail'
import { identifiantDeRelation } from '@/lib/payload/relations'

/**
 * Les prospects : une organisation prospectée, rattachée à une filière, et
 * l'état de sa séquence. La création déclenche le bloc personnalisé de la
 * lettre de filière (palier 1), par Trigger.dev.
 */
export const STATUTS_DE_PROSPECT = [
  { label: 'À contacter', value: 'a_contacter' },
  { label: 'Lettre 1 envoyée', value: 'lettre_1_envoyee' },
  { label: 'Lettre 2 envoyée', value: 'lettre_2_envoyee' },
  { label: 'Visite', value: 'visite' },
  { label: 'Essai', value: 'essai' },
  { label: 'Abonné', value: 'abonne' },
  { label: 'Désinscrit', value: 'desinscrit' },
] as const

export const prospects: CollectionConfig = {
  slug: 'prospects',
  labels: { singular: 'Prospect', plural: 'Prospects' },
  admin: { defaultColumns: ['organisation', 'filiere', 'statut', 'derniereLettreLe'] },
  access: ACCÈS_AUTHENTIFIÉ,
  fields: [
    {
      name: 'organisation',
      type: 'relationship',
      label: 'Organisation',
      relationTo: 'organisations',
      required: true,
      index: true,
    },
    { name: 'filiere', type: 'relationship', label: 'Filière', relationTo: 'filieres', index: true },
    {
      name: 'statut',
      type: 'select',
      label: 'Statut',
      required: true,
      defaultValue: 'a_contacter',
      index: true,
      options: [...STATUTS_DE_PROSPECT],
    },
    {
      name: 'contact',
      type: 'group',
      label: 'Contact',
      fields: [
        { name: 'nom', type: 'text', label: 'Nom' },
        { name: 'email', type: 'email', label: 'Email' },
      ],
    },
    {
      name: 'bloc',
      type: 'json',
      label: 'Bloc personnalisé',
      admin: { readOnly: true, description: 'Les lignes « pour <organisation> » posées en tête de la lettre de filière ; écrites par la tâche, jamais saisies.' },
    },
    { name: 'blocLe', type: 'date', label: 'Bloc écrit le', admin: { readOnly: true } },
    {
      name: 'derniereLettreLe',
      type: 'date',
      label: 'Dernière lettre le',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' } },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        try {
          // Entrée par prospection : la ligne du portail existe dès maintenant,
          // l'essai n'ouvrira qu'à la première visite ; le lecteur est le contact.
          const organisationId = identifiantDeRelation(doc.organisation)
          const organisation = organisationId ? await req.payload.findByID({ collection: 'organisations', id: organisationId, depth: 0, disableErrors: true }) : null
          if (organisation) {
            await ouvrirDansLePortail(
              { id: String(organisation.id), nom: organisation.nom, slug: organisation.slug, contact: doc.contact?.email ? doc.contact : organisation.contact },
              { prospection: true },
            )
          }
          await déclencherLeBlocPersonnalisé(String(doc.id))
        } catch (erreur) {
          console.error(`[moteur] bloc personnalisé non déclenché pour ${String(doc.id)} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
        }
        return doc
      },
    ],
  },
}
