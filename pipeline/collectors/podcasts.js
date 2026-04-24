import { XMLParser } from 'fast-xml-parser'

const LOOKBACK_DAYS = 14
const MAX_PER_FEED = 2

const FEEDS = [
  { name: 'Latent Space', url: 'https://www.latent.space/feed' },
  { name: 'No Priors', url: 'https://feeds.simplecast.com/QMJ5WS7a' },
  { name: 'The MAD Podcast', url: 'https://feeds.buzzsprout.com/2108286.rss' },
  { name: 'Unsupervised Learning', url: 'https://feeds.simplecast.com/B4JXa7oa' },
  { name: 'Practical AI', url: 'https://changelog.com/practicalai/feed' },
]

function extractText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return value['#text'] || value['_'] || ''
  return String(value)
}

export async function collectPodcasts() {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    trimValues: true,
    isArray: (name) => ['item'].includes(name),
  })

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const allItems = []

  await Promise.all(
    FEEDS.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'AI-Digest-Bot/1.0' },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) return

        const xml = await res.text()
        const parsed = parser.parse(xml)
        const items = parsed?.rss?.channel?.item
        if (!items || !items.length) return

        let count = 0
        for (const item of items) {
          if (count >= MAX_PER_FEED) break

          const pubDate = item.pubDate ? new Date(item.pubDate) : null
          if (pubDate && pubDate < cutoff) continue

          const episodeUrl =
            item.enclosure?.['@_url'] ||
            (typeof item.link === 'string' ? item.link : '') ||
            ''
          const guid =
            typeof item.guid === 'object'
              ? item.guid['#text']
              : String(item.guid || episodeUrl)

          const desc =
            item['itunes:summary'] ||
            item.description ||
            item['content:encoded'] ||
            ''
          const cleanDesc = extractText(desc)
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 400)

          allItems.push({
            type: 'podcast',
            id: guid,
            title: extractText(item.title).trim(),
            summary: cleanDesc,
            url: typeof item.link === 'string' ? item.link : episodeUrl,
            source: name,
            published: pubDate?.toISOString() ?? new Date().toISOString(),
          })
          count++
        }
      } catch (err) {
        console.error(`[podcasts] Failed to fetch ${name}: ${err.message}`)
      }
    })
  )

  return allItems
}
