import Link from 'next/link'
import { DigestSummary } from '@/lib/digests'

interface Props {
  summary: DigestSummary
  isRead: boolean
}

const SECTION_COLORS = {
  Research: 'text-purple-600',
  Tools: 'text-blue-600',
  'Industry News': 'text-emerald-600',
}

export default function DigestCard({ summary, isRead }: Props) {
  const formatted = new Date(`${summary.date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const weekday = new Date(`${summary.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
  const displayDate = summary.edition === 'weekend' && summary.dateRange ? summary.dateRange : `${weekday}, ${formatted}`

  return (
    <Link href={`/digest/${summary.date}`} className="block group flex-shrink-0 w-64">
      <div
        className="relative h-40 rounded-md overflow-hidden transition-transform duration-200 group-hover:scale-105 group-hover:z-10 cursor-pointer"
        style={{ background: 'linear-gradient(135deg, #f4f4f5 0%, #e4e4e7 100%)' }}
      >
        {/* Top row */}
        <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 tracking-wide">{displayDate}</span>
          <div className="flex items-center gap-1.5">
            {summary.edition === 'weekend' && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">
                Weekend
              </span>
            )}
            {!isRead && (
              <span className="w-2 h-2 rounded-full bg-blue-500" aria-label="Unread" />
            )}
          </div>
        </div>

        {/* TL;DR preview */}
        <div className="absolute inset-0 flex items-center px-3 pt-8 pb-10">
          <p className="text-sm text-zinc-700 leading-snug line-clamp-3">
            {summary.tldr[0] ?? 'No summary available'}
          </p>
        </div>

        {/* Bottom: section counts */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex gap-3">
          {summary.counts.Research > 0 && (
            <span className={`text-xs font-medium ${SECTION_COLORS.Research}`}>
              {summary.counts.Research} Research
            </span>
          )}
          {summary.counts.Tools > 0 && (
            <span className={`text-xs font-medium ${SECTION_COLORS.Tools}`}>
              {summary.counts.Tools} Tools
            </span>
          )}
          {summary.counts['Industry News'] > 0 && (
            <span className={`text-xs font-medium ${SECTION_COLORS['Industry News']}`}>
              {summary.counts['Industry News']} News
            </span>
          )}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
      </div>
    </Link>
  )
}
