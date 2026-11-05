import Script from 'next/script'
import { CONTENEUR_GTM, mesureActive, scriptDInitialisation } from '@/lib/vitrine/mesure-audience'

/**
 * Le conteneur Google Tag Manager des pages vitrines (`lib/vitrine/mesure-audience.ts`).
 * Rien n'est rendu hors de la production Vercel.
 */
export function GoogleTagManager() {
  if (!mesureActive()) return null
  return (
    <>
      <Script id="gtm-initialisation" strategy="afterInteractive">
        {scriptDInitialisation()}
      </Script>
      <Script
        id="gtm"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtm.js?id=${CONTENEUR_GTM}`}
      />
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${CONTENEUR_GTM}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  )
}
