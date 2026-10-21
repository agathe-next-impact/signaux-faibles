import type { CollectionConfig } from 'payload'
import { editions } from '@/lib/payload/collections/editions'
import { filieres } from '@/lib/payload/collections/filieres'
import { gels } from '@/lib/payload/collections/gels'
import { organisations } from '@/lib/payload/collections/organisations'
import { prospects } from '@/lib/payload/collections/prospects'
import { referentiels } from '@/lib/payload/collections/referentiels'
import { utilisateurs } from '@/lib/payload/collections/utilisateurs'

/**
 * Les sept collections, dans l'ordre de l'admin. Le journal des runs n'est
 * pas ici : c'est la table Drizzle `runs` de la file de travaux (décision du
 * 22 octobre 2026, un seul journal). Aucune ne s'appelle `media` :
 * Payload n'héberge aucun fichier, une image n'entre jamais dans une lettre.
 */
export const collections: CollectionConfig[] = [
  utilisateurs,
  organisations,
  filieres,
  referentiels,
  editions,
  prospects,
  gels,
]
