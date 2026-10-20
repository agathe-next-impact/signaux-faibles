/**
 * Régénère les trois emails de la séquence lemlist (`docs/emails/lemlist/`)
 * depuis le gabarit du portail. À relancer après toute retouche du gabarit,
 * puis recoller les fichiers dans les étapes de la campagne.
 *
 *   pnpm emails:lemlist
 *
 * La racine du portail et l'adresse postale viennent de l'environnement
 * (`PORTAIL_URL`, `ADRESSE_POSTALE`), avec www.signauxfaibles.io par défaut :
 * l'apex redirige, et une redirection de plus dans un email froid coûte en
 * délivrabilité.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { étapesLemlist, fichierLemlist, texteLemlist } from '@/lib/email/lemlist'

const dossier = join(process.cwd(), 'docs', 'emails', 'lemlist')
mkdirSync(dossier, { recursive: true })

const racine = process.env['PORTAIL_URL']?.trim() || 'https://www.signauxfaibles.io'
const adresse = process.env['ADRESSE_POSTALE']?.trim() || null

for (const étape of étapesLemlist(racine, adresse)) {
  writeFileSync(join(dossier, étape.fichier), fichierLemlist(étape))
  writeFileSync(join(dossier, étape.fichier.replace(/\.html$/, '.txt')), `${texteLemlist(étape)}\n`)
  console.info(`${étape.fichier} : ${étape.étape}`)
}
if (!adresse) console.warn('ADRESSE_POSTALE absente : le pied ne porte pas d’adresse postale, obligatoire avant tout envoi.')
