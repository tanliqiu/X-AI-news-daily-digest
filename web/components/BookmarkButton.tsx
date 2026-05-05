'use client'

import { useEffect, useState } from 'react'

interface Bookmark {
  url: string
  title: string
  source: string
  digestDate: string
  bookmarkedAt: string
}

interface Props {
  url: string
  title: string
  source: string
  digestDate: string
}

export default function BookmarkButton({ url, title, source, digestDate }: Props) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('digest-bookmarks')
      const bookmarks: Bookmark[] = stored ? JSON.parse(stored) : []
      setBookmarked(bookmarks.some((b) => b.url === url))
    } catch {}
  }, [url])

  function toggle() {
    try {
      const stored = localStorage.getItem('digest-bookmarks')
      let bookmarks: Bookmark[] = stored ? JSON.parse(stored) : []
      if (bookmarked) {
        bookmarks = bookmarks.filter((b) => b.url !== url)
      } else {
        bookmarks.push({ url, title, source, digestDate, bookmarkedAt: new Date().toISOString() })
      }
      localStorage.setItem('digest-bookmarks', JSON.stringify(bookmarks))
      setBookmarked(!bookmarked)
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this item'}
      className={`shrink-0 p-0.5 rounded transition-colors ${
        bookmarked
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill={bookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 3a2 2 0 0 0-2 2v12l7-3 7 3V5a2 2 0 0 0-2-2H5z"
        />
      </svg>
    </button>
  )
}
