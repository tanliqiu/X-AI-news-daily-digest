import Link from 'next/link'

interface Props {
  date: string
  tldr: string[]
  prevDate: string | null
  nextDate: string | null
  edition?: 'weekend'
  dateRange?: string
}

export default function DigestHeader({ date, tldr, prevDate, nextDate, edition, dateRange }: Props) {
  const formatted = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="mb-10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {edition === 'weekend' && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-500/20 text-amber-400">
              Weekend Edition
            </span>
          )}
        </div>
        <nav className="flex gap-4 text-sm">
          {prevDate ? (
            <Link href={`/digest/${prevDate}`} className="text-gray-500 hover:text-gray-200 transition-colors">
              ← Prev
            </Link>
          ) : (
            <span className="text-gray-700 select-none">← Prev</span>
          )}
          {nextDate ? (
            <Link href={`/digest/${nextDate}`} className="text-gray-500 hover:text-gray-200 transition-colors">
              Next →
            </Link>
          ) : (
            <span className="text-gray-700 select-none">Next →</span>
          )}
        </nav>
      </div>

      <p className="text-sm text-gray-500 mb-5">
        {edition === 'weekend' && dateRange ? dateRange : formatted}
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-2">TL;DR</p>
        <ul className="space-y-1.5">
          {tldr.map((bullet, i) => (
            <li key={i} className="text-sm flex gap-2 leading-snug">
              <span className="text-gray-600 select-none mt-0.5">·</span>
              <span className="text-gray-300">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}
