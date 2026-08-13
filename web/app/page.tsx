import { getDigestSummaries } from '@/lib/digests'
import DigestOverview from '@/components/DigestOverview'

export default function Home() {
  const summaries = getDigestSummaries(14)

  if (summaries.length === 0) {
    return (
      <main className="flex items-center justify-center min-h-screen px-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-3 text-zinc-900">AI Daily Digest</h1>
          <p className="text-sm text-zinc-500 mb-6">
            No digests yet. Run the pipeline to generate your first digest.
          </p>
          <pre className="text-left text-xs bg-zinc-100 border border-zinc-300 rounded-lg p-4 overflow-x-auto text-zinc-600">
            {`cd pipeline && npm install\nnpm run run-all`}
          </pre>
        </div>
      </main>
    )
  }

  return <DigestOverview summaries={summaries} />
}
