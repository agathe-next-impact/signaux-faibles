/**
 * L'adresse de la base, avec la vérification TLS écrite en clair.
 *
 * L'intégration Neon de Vercel pose `DATABASE_URL` en `sslmode=require`, et la
 * variable est gérée par l'intégration : on ne la retouche pas dans Vercel.
 * `pg-connection-string` 2 traite déjà `prefer`, `require` et `verify-ca` comme
 * `verify-full`, et le dit à chaque connexion (« SECURITY WARNING »). Sa
 * version 3 leur rendra le sens de libpq, qui ne vérifie plus le certificat.
 * Écrire `verify-full` garde le comportement d'aujourd'hui, fait taire
 * l'avertissement et rend la mise à jour du pilote sans effet sur la sécurité.
 *
 * `disable`, `allow`, `verify-full` et `uselibpqcompat` sont laissés tels
 * quels : ce sont des choix explicites. Une adresse illisible est rendue
 * inchangée, le pilote dira lui-même ce qui ne va pas.
 */
const MODES_À_DURCIR = new Set(['prefer', 'require', 'verify-ca'])

export function adresseVérifiée(adresse: string): string {
  let url: URL
  try {
    url = new URL(adresse)
  } catch {
    return adresse
  }
  if (url.searchParams.has('uselibpqcompat')) return adresse
  const mode = url.searchParams.get('sslmode')
  if (!mode || !MODES_À_DURCIR.has(mode)) return adresse
  url.searchParams.set('sslmode', 'verify-full')
  return url.toString()
}
