import { XMLParser } from 'fast-xml-parser'

const FEEDS = [
  'https://export.arxiv.org/rss/cs.AI',
  'https://export.arxiv.org/rss/cs.CL',
  'https://export.arxiv.org/rss/cs.LG',
]

const DEFAULT_LOOKBACK_HOURS = 48
const MAX_PAPERS = 10

export async function collectArxiv(lookbackHours = DEFAULT_LOOKBACK_HOURS) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    trimValues: true,
  })

  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
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

  const papers = allItems.slice(0, MAX_PAPERS)
  if (papers.length === 0) return papers

  // Batch-fetch Atom API to get accurate author affiliations
  try {
    const idList = papers.map((p) => p.id).join(',')
    const atomRes = await fetch(
      `https://export.arxiv.org/api/query?id_list=${idList}&max_results=${MAX_PAPERS}`,
      { headers: { 'User-Agent': 'AI-Digest-Bot/1.0' }, signal: AbortSignal.timeout(20000) }
    )
    if (atomRes.ok) {
      const atomXml = await atomRes.text()
      const atomParsed = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        trimValues: true,
        isArray: (name) => ['entry', 'author'].includes(name),
      }).parse(atomXml)

      const entries = atomParsed?.feed?.entry ?? []
      const authorsByArxivId = new Map()
      for (const entry of entries) {
        const idUrl = typeof entry.id === 'string' ? entry.id : ''
        const arxivId = idUrl.match(/arxiv\.org\/abs\/([^\s?#v]+)/)?.[1]
        if (!arxivId) continue
        const authors = (entry.author ?? []).map((a) => ({
          name: typeof a.name === 'string' ? a.name.trim() : '',
          affiliation: typeof a['arxiv:affiliation'] === 'string' ? a['arxiv:affiliation'].trim() : '',
        })).filter((a) => a.name)
        authorsByArxivId.set(arxivId, authors)
      }

      for (const paper of papers) {
        const authors = authorsByArxivId.get(paper.id)
        if (authors) paper.authors = authors
      }
    }
  } catch (err) {
    console.error(`[arxiv] Atom API fetch failed: ${err.message}`)
  }

  return papers
}
