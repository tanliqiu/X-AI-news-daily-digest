import { notFound } from 'next/navigation'
import { getDigest, getDigestDates } from '@/lib/digests'
import DigestHeader from '@/components/DigestHeader'
import SectionBlock from '@/components/SectionBlock'

export async function generateStaticParams() {
  return getDigestDates().map((date) => ({ date }))
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  return { title: `AI Digest — ${date}` }
}

export default async function DigestPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const dates = getDigestDates()
  const digest = getDigest(date)

  if (!digest) notFound()

  const currentIndex = dates.indexOf(date)
  const prevDate = dates[currentIndex + 1] ?? null
  const nextDate = dates[currentIndex - 1] ?? null

  const sections = [
    { key: 'Research', items: digest.sections.Research ?? [] },
    { key: 'Tools', items: digest.sections.Tools ?? [] },
    { key: 'Industry News', items: digest.sections['Industry News'] ?? [] },
  ]

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <DigestHeader
        date={date}
        tldr={digest.tldr}
        prevDate={prevDate}
        nextDate={nextDate}
      />
      <div className="mt-10 space-y-12">
        {sections.map(
          ({ key, items }) =>
            items.length > 0 && (
              <SectionBlock key={key} title={key} items={items} />
            )
        )}
      </div>
    </main>
  )
}
