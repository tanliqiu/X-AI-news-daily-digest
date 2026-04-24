const LOOKBACK_HOURS = 168  // 7 days; HN index has some delay
const MIN_POINTS = 20
const MAX_RESULTS = 8

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'llama', 'machine learning',
  'neural', 'transformer', 'agent', 'rag', 'fine-tun', 'embedding',
  'anthropic', 'openai', 'mistral', 'deepmind', 'language model',
]

export async function collectHackerNews() {
  const since = Math.floor((Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000) / 1000)

  // Use search_by_date without a query param so Algolia sorts by date DESC.
  // The query param changes ranking and filters out recent items.
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${since},points>${MIN_POINTS}&hitsPerPage=50`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []

    const data = await res.json()
    const hits = data.hits || []

    return hits
      .filter((h) => {
        const text = `${h.title} ${h.url || ''}`.toLowerCase()
        return AI_KEYWORDS.some((k) => text.includes(k))
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
