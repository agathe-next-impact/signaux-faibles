import type { CollectionConfig } from 'payload'
import { déclencherLOnboarding } from '@/lib/moteur/declencher'
import { ACCÈS_AUTHENTIFIÉ } from '@/lib/payload/acces'

/**
 * Le registre des organisations, tenu dans Payload à la place de la base
 * Notion « Organisations, pipeline et activation ».
 *
 * Passer `etat` à « à onboarder » déclenche la tâche Trigger.dev d'onboarding
 * par le crochet `afterChange` : Payload ne porte jamais un run long, il le
 * confie. Si la clé Trigger.dev est absente, rien ne part et le déclencheur
 * le journalise ; l'enregistrement n'échoue jamais pour autant.
 */
export const ÉTATS_D_ORGANISATION = [
  { label: 'Prospect', value: 'prospect' },
  { label: 'À onboarder', value: 'a_onboarder' },
  { label: 'En onboarding', value: 'en_onboarding' },
  { label: 'Active', value: 'active' },
  { label: 'Suspendue', value: 'suspendue' },
  { label: 'Archivée', value: 'archivee' },
] as const

export const organisations: CollectionConfig = {
  slug: 'organisations',
  labels: { singular: 'Organisation', plural: 'Organisations' },
  admin: { useAsTitle: 'nom', defaultColumns: ['nom', 'slug', 'etat', 'filiere'] },
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
      admin: { description: 'Le segment de l’adresse de l’espace client : minuscules, chiffres et tirets.' },
      validate: (valeur: null | string | undefined) =>
        typeof valeur === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valeur)
          ? true
          : 'Minuscules, chiffres et tirets seulement.',
    },
    {
      name: 'site',
      type: 'text',
      label: 'Site',
      validate: (valeur: null | string | undefined) => {
        if (!valeur) return true
        try {
          const url = new URL(valeur)
          return url.protocol === 'https:' || url.protocol === 'http:' ? true : 'Adresse http(s) attendue.'
        } catch {
          return 'Adresse web invalide.'
        }
      },
    },
    { name: 'filiere', type: 'relationship', label: 'Filière', relationTo: 'filieres' },
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
      name: 'etat',
      type: 'select',
      label: 'État',
      required: true,
      defaultValue: 'prospect',
      index: true,
      options: [...ÉTATS_D_ORGANISATION],
    },
    { name: 'notes', type: 'textarea', label: 'Notes' },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation }) => {
        const passeÀOnboarder =
          doc?.etat === 'a_onboarder' && (operation === 'create' || previousDoc?.etat !== 'a_onboarder')
        if (!passeÀOnboarder) return doc
        try {
          await déclencherLOnboarding(String(doc.id))
        } catch (erreur) {
          console.error(`[moteur] onboarding non déclenché pour ${String(doc.id)} : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
        }
        return doc
      },
    ],
  },
}
