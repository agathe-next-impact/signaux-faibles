import type { CollectionConfig } from 'payload'
import { editions } from '@/lib/payload/collections/editions'
import { filieres } from '@/lib/payload/collections/filieres'
import { gels } from '@/lib/payload/collections/gels'
import { organisations } from '@/lib/payload/collections/organisations'
import { prospects } from '@/lib/payload/collections/prospects'
import { referentiels } from '@/lib/payload/collections/referentiels'
import { runs } from '@/lib/payload/collections/runs'
import { utilisateurs } from '@/lib/payload/collections/utilisateurs'

/**
 * Les huit collections, dans l'ordre de l'admin. Aucune ne s'appelle `media` :
 * Payload n'héberge aucun fichier, une image n'entre jamais dans une lettre.
 */
export const collections: CollectionConfig[] = [
  utilisateurs,
  organisations,
  filieres,
  referentiels,
  editions,
  prospects,
  runs,
  gels,
]
