const DEFAULT_LOOKBACK_HOURS = 168  // 7 days; HN index has some delay
const MIN_POINTS = 20
const MAX_RESULTS = 8
const MAX_CONTENT_AGE_DAYS = 30  // skip articles whose URL reveals a publish date older than this

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'llama', 'machine learning',
  'neural', 'transformer', 'agent', 'rag', 'fine-tun', 'embedding',
  'anthropic', 'openai', 'mistral', 'deepmind', 'language model',
]

// Extract a publish date from common URL date patterns (e.g. /2026/02/, /2025-12-04/).
// Returns a Date if found and reliably year-level precise, otherwise null.
const MONTH_NAMES = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }

// Extract a publish date from common URL date patterns.
function contentDateFromUrl(url) {
  if (!url) return null
  // /YYYY/Mon/DD/ or /YYYY/Mon/ (e.g. simonwillison.net/2026/Feb/4/)
  const namedMonth = url.match(/\/(\d{4})\/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\/(\d{1,2}))?/i)
  if (namedMonth) {
    const [, y, m, d] = namedMonth
    const mm = String(MONTH_NAMES[m.toLowerCase()]).padStart(2, '0')
    return new Date(`${y}-${mm}-${d ? String(d).padStart(2, '0') : '01'}`)
  }
  // /YYYY/MM/ or /YYYY/MM/DD/
  const slashDate = url.match(/\/(\d{4})\/(\d{2})(?:\/(\d{2}))?/)
  if (slashDate) {
    const [, y, m, d] = slashDate
    return new Date(`${y}-${m}-${d ?? '01'}`)
  }
  // /YYYY-MM or /YYYY-MM-DD (in path or query)
  const dashDate = url.match(/[\/=](\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (dashDate) {
    const [, y, m, d] = dashDate
    return new Date(`${y}-${m}-${d ?? '01'}`)
  }
  return null
}

export async function collectHackerNews(lookbackHours = DEFAULT_LOOKBACK_HOURS) {
  const since = Math.floor((Date.now() - lookbackHours * 60 * 60 * 1000) / 1000)

  // Use search_by_date without a query param so Algolia sorts by date DESC.
  // The query param changes ranking and filters out recent items.
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${since},points>${MIN_POINTS}&hitsPerPage=50`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []

    const data = await res.json()
    const hits = data.hits || []

    const cutoff = Date.now() - MAX_CONTENT_AGE_DAYS * 24 * 60 * 60 * 1000

    return hits
      .filter((h) => {
        const text = `${h.title} ${h.url || ''}`.toLowerCase()
        if (!AI_KEYWORDS.some((k) => text.includes(k))) return false
        // Skip if URL reveals the content was published before the cutoff
        const contentDate = contentDateFromUrl(h.url)
        if (contentDate && contentDate.getTime() < cutoff) {
          console.log(`[hn] Skipping stale content (${contentDate.toISOString().slice(0, 10)}): ${h.url}`)
          return false
        }
        return true
      })
      .slice(0, MAX_RESULTS)
      .map((h) => ({
        type: 'hn',
        id: String(h.objectID),
        title: h.title,
        summary: '',
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: 'Hacker News',
        hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: h.points,
        comments: h.num_comments,
        published: new Date(h.created_at).toISOString(),
      }))
  } catch (err) {
    console.error(`[hn] Failed: ${err.message}`)
    return []
  }
}
