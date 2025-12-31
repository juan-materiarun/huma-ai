import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Huma.io - AI that actually listens',
  description: 'AI that actually listens',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}





