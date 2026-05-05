import { getDigestSummaries } from '@/lib/digests'
import DigestOverview from '@/components/DigestOverview'
import Link from 'next/link'

export default function Home() {
  const summaries = getDigestSummaries(14)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight">AI Daily Digest</h1>
      </div>

      {summaries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            No digests yet. Run the pipeline to generate your first digest.
          </p>
          <pre className="text-left text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 overflow-x-auto">
            {`cd pipeline && npm install\nnpm run run-all`}
          </pre>
        </div>
      ) : (
        <DigestOverview summaries={summaries} />
      )}
    </main>
  )
}
