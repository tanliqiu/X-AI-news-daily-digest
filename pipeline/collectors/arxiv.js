import { XMLParser } from 'fast-xml-parser'

const FEEDS = [
  'https://export.arxiv.org/rss/cs.AI',
  'https://export.arxiv.org/rss/cs.CL',
  'https://export.arxiv.org/rss/cs.LG',
]

// arXiv announces in daily batches; use 48h window to catch weekend batches
const LOOKBACK_HOURS = 48
const MAX_PAPERS = 10

export async function collectArxiv() {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    trimValues: true,
  })

  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)
  const allItems = []
  const seen = new Set()

  await Promise.all(
    FEEDS.map(async (feedUrl) => {
      try {
        const res = await fetch(feedUrl, {
          headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) return

        const xml = await res.text()
        const parsed = parser.parse(xml)
        const rawItems = parsed?.rss?.channel?.item
        if (!rawItems) return

        const items = Array.isArray(rawItems) ? rawItems : [rawItems]

        for (const item of items) {
          const rawUrl = typeof item.link === 'string' ? item.link : String(item.link || '')
          const arxivId = rawUrl.match(/arxiv\.org\/abs\/([^\s?#]+)/)?.[1]
          if (!arxivId || seen.has(arxivId)) continue

          const pubDate = item.pubDate ? new Date(item.pubDate) : null
          if (pubDate && pubDate < cutoff) continue

          seen.add(arxivId)
          const title = String(item.title || '')
            .replace(/\[.*?\]\s*/, '')
            .trim()
          const description = String(item.description || '')
            .replace(/<[^>]+>/g, '')
            .trim()
            .slice(0, 500)

          allItems.push({
            type: 'paper',
            id: arxivId,
            title,
            summary: description,
            url: `https://arxiv.org/abs/${arxivId}`,
            source: 'arXiv',
            published: pubDate?.toISOString() ?? new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error(`[arxiv] Failed to fetch ${feedUrl}: ${err.message}`)
      }
    })
  )

  return allItems.slice(0, MAX_PAPERS)
}
