import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Daily Digest',
  description: 'Personalized daily AI news digest — research, tools, and industry news',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
