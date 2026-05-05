'use client'

import { useEffect, useState } from 'react'
import { DigestSummary } from '@/lib/digests'
import DigestCard from './DigestCard'

interface Props {
  summaries: DigestSummary[]
}

export default function DigestOverview({ summaries }: Props) {
  const [readDates, setReadDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = localStorage.getItem('digest-read')
      const read: Record<string, boolean> = stored ? JSON.parse(stored) : {}
      setReadDates(new Set(Object.keys(read).filter((k) => read[k])))
    } catch {}
  }, [])

  function markAllRead() {
    try {
      const read: Record<string, boolean> = {}
      for (const s of summaries) read[s.date] = true
      localStorage.setItem('digest-read', JSON.stringify(read))
      setReadDates(new Set(summaries.map((s) => s.date)))
    } catch {}
  }

  const unreadCount = summaries.filter((s) => !readDates.has(s.date)).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm text-gray-500 dark:text-gray-400">
          Last {summaries.length} digests
          {unreadCount > 0 && (
            <span className="ml-2 text-blue-500">{unreadCount} unread</span>
          )}
        </h2>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>
      <div>
        {summaries.map((summary) => (
          <DigestCard
            key={summary.date}
            summary={summary}
            isRead={readDates.has(summary.date)}
          />
        ))}
      </div>
    </div>
  )
}
