'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Bookmark {
  url: string
  title: string
  source: string
  digestDate: string
  bookmarkedAt: string
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('digest-bookmarks')
      setBookmarks(stored ? JSON.parse(stored) : [])
    } catch {
      setBookmarks([])
    }
  }, [])

  function remove(url: string) {
    try {
      const updated = (bookmarks ?? []).filter((b) => b.url !== url)
      localStorage.setItem('digest-bookmarks', JSON.stringify(updated))
      setBookmarks(updated)
    } catch {}
  }

  if (bookmarks === null) return null

  const sorted = [...bookmarks].sort(
    (a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime()
  )
  const grouped = groupBy(sorted, (b) => b.digestDate)
  const dates = Object.keys(grouped).sort().reverse()

  return (
    <main className="max-w-2xl mx-auto px-4 pt-20 pb-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold tracking-tight text-white">Bookmarks</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-200 transition-colors">
          ← Home
        </Link>
      </div>

      {bookmarks.length === 0 ? (
        <p className="text-sm text-gray-600 py-12 text-center">
          No bookmarks yet. Star items while reading a digest to save them here.
        </p>
      ) : (
        <div className="space-y-10">
          {dates.map((date) => (
            <section key={date}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">
                  {new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </h2>
                <Link href={`/digest/${date}`} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
                  View digest →
                </Link>
              </div>
              <div className="space-y-4">
                {grouped[date].map((bookmark) => (
                  <article key={bookmark.url} className="border-l-2 border-zinc-700 pl-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug text-gray-100">
                        <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
                          {bookmark.title}
                        </a>
                      </h3>
                      <button
                        onClick={() => remove(bookmark.url)}
                        aria-label="Remove bookmark"
                        className="shrink-0 text-gray-700 hover:text-red-400 transition-colors p-0.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                    <span className="text-xs text-gray-600 mt-0.5 block">{bookmark.source}</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
