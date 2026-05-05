'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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

  const hero = summaries[0]
  const rest = summaries.slice(1)
  const unreadCount = summaries.filter((s) => !readDates.has(s.date)).length

  if (!hero) return null

  const heroDate = new Date(`${hero.date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  const heroDisplay = hero.edition === 'weekend' && hero.dateRange ? hero.dateRange : heroDate
  const heroTotal = hero.counts.Research + hero.counts.Tools + hero.counts['Industry News']

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-end pb-16 px-8 md:px-16"
        style={{
          background: 'linear-gradient(to bottom, #0a0a0a 0%, #1a1a2e 40%, #141414 100%)',
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #fff 40px, #fff 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, #fff 40px, #fff 41px)',
          }}
        />

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            {hero.edition === 'weekend' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 tracking-widest uppercase">
                Weekend Edition
              </span>
            )}
            <span className="text-xs font-bold tracking-widest uppercase text-gray-500">
              Latest Digest
            </span>
          </div>

          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest">
            {heroDisplay}
          </h2>

          <p className="text-2xl md:text-3xl font-bold text-white leading-snug mb-4">
            {hero.tldr[0]}
          </p>

          {hero.tldr.length > 1 && (
            <ul className="mb-6 space-y-1.5">
              {hero.tldr.slice(1).map((bullet, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-400 leading-snug">
                  <span className="text-gray-600 mt-0.5 shrink-0">·</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href={`/digest/${hero.date}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm bg-white text-black hover:bg-gray-200 transition-colors"
            >
              ▶ Read Now
            </Link>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="text-purple-400">{hero.counts.Research} Research</span>
              <span className="text-blue-400">{hero.counts.Tools} Tools</span>
              <span className="text-emerald-400">{hero.counts['Industry News']} News</span>
            </div>
          </div>
        </div>
      </section>

      {/* Card row */}
      {rest.length > 0 && (
        <section className="px-8 md:px-16 pb-16 -mt-6 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-300 tracking-wide uppercase">
              Previous Editions
            </h3>
            {unreadCount > 1 && (
              <span className="text-xs text-blue-400">{unreadCount - (readDates.has(hero.date) ? 0 : 1)} unread</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto scroll-row pb-2">
            {rest.map((summary) => (
              <DigestCard
                key={summary.date}
                summary={summary}
                isRead={readDates.has(summary.date)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
