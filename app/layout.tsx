import type { Metadata } from 'next'
import { IBM_Plex_Mono, Lora, Public_Sans } from 'next/font/google'
import './globals.css'

// Graisses de la charte : Lora 500 à 700 avec italique pour la voix
// éditoriale, Public Sans 400 à 600. Les deux existent en version variable,
// la plage suffit donc. IBM Plex Mono non : ses graisses sont explicites,
// sans quoi next/font refuse la police.
const lora = Lora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-public-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'signauxfaibles',
  // La baseline de la charte, telle quelle.
  description: 'Votre veille, rédigée.',
  // Le portail est privé : aucune page ne doit être indexée, et surtout pas
  // une URL d'accès.
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${lora.variable} ${publicSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
