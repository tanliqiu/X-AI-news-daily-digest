import { redirect } from 'next/navigation'
import { getDigestDates } from '@/lib/digests'

export default function Home() {
  const dates = getDigestDates()

  if (dates.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-3">AI Daily Digest</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No digests yet. Run the pipeline to generate your first digest.
        </p>
        <pre className="mt-6 text-left text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 overflow-x-auto">
          {`cd pipeline && npm install\nnpm run run-all`}
        </pre>
      </main>
    )
  }

  redirect(`/digest/${dates[0]}`)
}
