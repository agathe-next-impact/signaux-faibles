import type { Metadata } from 'next'
import { IBM_Plex_Mono, Lora, Public_Sans } from 'next/font/google'
import './globals.css'

// Lora et Public Sans existent en version variable ; IBM Plex Mono non, d'où
// les graisses explicites — sans elles, next/font refuse la police.
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

const publicSans = Public_Sans({
  subsets: ['latin'],
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
  description: 'Vos éditions de veille, semaine après semaine.',
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
