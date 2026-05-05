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
      <body className="antialiased">
        <nav className="border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-2xl mx-auto px-4 h-10 flex items-center justify-between">
            <Link href="/" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              AI Daily Digest
            </Link>
            <Link href="/bookmarks" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
              Bookmarks
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
