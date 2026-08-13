import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Daily Digest',
  description: 'Personalized daily AI news digest — research, tools, and industry news',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen" style={{ background: '#ffffff', color: '#18181b' }}>
        <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-8 bg-gradient-to-b from-white/90 to-transparent pointer-events-none">
          <div className="flex items-center justify-between w-full pointer-events-auto">
            <Link href="/" className="text-base font-bold tracking-wide text-zinc-900 hover:text-zinc-600 transition-colors">
              AI DAILY DIGEST
            </Link>
            <Link href="/bookmarks" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Bookmarks
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
