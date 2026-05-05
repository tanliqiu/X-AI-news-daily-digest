import Link from 'next/link'
import { DigestSummary } from '@/lib/digests'

interface Props {
  summary: DigestSummary
  isRead: boolean
}

export default function DigestCard({ summary, isRead }: Props) {
  const formatted = new Date(`${summary.date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const displayDate =
    summary.edition === 'weekend' && summary.dateRange ? summary.dateRange : formatted

  const total =
    summary.counts.Research + summary.counts.Tools + summary.counts['Industry News']

  return (
    <Link href={`/digest/${summary.date}`} className="block group">
      <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 -mx-2 px-2 rounded transition-colors">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {!isRead && (
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {displayDate}
            </span>
            {summary.edition === 'weekend' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Weekend
              </span>
            )}
          </div>
          {summary.tldr[0] && (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug line-clamp-2">
              {summary.tldr[0]}
            </p>
          )}
          <div className="flex gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {summary.counts.Research > 0 && (
              <span>{summary.counts.Research} research</span>
            )}
            {summary.counts.Tools > 0 && (
              <span>{summary.counts.Tools} tools</span>
            )}
            {summary.counts['Industry News'] > 0 && (
              <span>{summary.counts['Industry News']} news</span>
            )}
            {total === 0 && <span>No items</span>}
          </div>
        </div>
        <span className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 shrink-0 mt-1 transition-colors">
          →
        </span>
      </div>
    </Link>
  )
}
