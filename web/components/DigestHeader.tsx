import Link from 'next/link'

interface Props {
  date: string
  tldr: string[]
  prevDate: string | null
  nextDate: string | null
}

export default function DigestHeader({ date, tldr, prevDate, nextDate }: Props) {
  // Add T12:00:00 to avoid timezone-driven off-by-one date display
  const formatted = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold tracking-tight">AI Daily Digest</h1>
        <nav className="flex gap-4 text-sm">
          {prevDate ? (
            <Link
              href={`/digest/${prevDate}`}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              ← Prev
            </Link>
          ) : (
            <span className="text-gray-300 dark:text-gray-700 select-none">← Prev</span>
          )}
          {nextDate ? (
            <Link
              href={`/digest/${nextDate}`}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Next →
            </Link>
          ) : (
            <span className="text-gray-300 dark:text-gray-700 select-none">Next →</span>
          )}
        </nav>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{formatted}</p>

      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          TL;DR
        </p>
        <ul className="space-y-1.5">
          {tldr.map((bullet, i) => (
            <li key={i} className="text-sm flex gap-2 leading-snug">
              <span className="text-gray-300 dark:text-gray-600 select-none mt-0.5">·</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}
