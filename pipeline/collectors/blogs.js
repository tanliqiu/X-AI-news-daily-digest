import { XMLParser } from 'fast-xml-parser'

const LOOKBACK_HOURS = 72
const MAX_PER_SOURCE = 3

// RSS/Atom feeds for AI company blogs and newsletters
const FEEDS = [
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Google AI', url: 'https://research.google/blog/rss/' },
  { name: 'Import AI', url: 'https://importai.substack.com/feed' },
  { name: 'Latent Space', url: 'https://www.latent.space/feed' },
  { name: 'The Gradient', url: 'https://thegradient.pub/rss/' },
]

function extractText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return value['#text'] || value['_'] || ''
  return String(value)
}

function extractUrl(item) {
  if (!item.link) return ''
  if (typeof item.link === 'string') return item.link
  if (Array.isArray(item.link)) {
    // Atom: multiple <link> elements, pick rel=alternate or first with href
    const alternate = item.link.find((l) => l['@_rel'] === 'alternate' || l['@_href'])
    return alternate?.['@_href'] || ''
  }
  if (typeof item.link === 'object') {
    // Atom: single <link href="..."/>
    return item.link['@_href'] || item.link['#text'] || ''
  }
  return ''
}

export async function collectBlogs() {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    trimValues: true,
    isArray: (name) => ['item', 'entry'].includes(name),
  })

  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)
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

        // Handle RSS 2.0 (<item>) and Atom (<entry>)
        let items = []
        if (parsed?.rss?.channel?.item) {
          items = parsed.rss.channel.item
        } else if (parsed?.feed?.entry) {
          items = parsed.feed.entry
        }

        let count = 0
        for (const item of items) {
          if (count >= MAX_PER_SOURCE) break

          const itemUrl = extractUrl(item)
          if (!itemUrl) continue

          const dateStr = item.pubDate || item.published || item.updated || ''
          const pubDate = dateStr ? new Date(extractText(dateStr)) : null
          if (pubDate && !isNaN(pubDate) && pubDate < cutoff) continue

          const title = extractText(item.title).trim()
          const desc = item.description || item.summary || item.content || item['content:encoded'] || ''
          const cleanDesc = extractText(desc)
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 400)

          if (!title) continue

          allItems.push({
            type: 'article',
            id: itemUrl,
            title,
            summary: cleanDesc,
            url: itemUrl,
            source: name,
            published: pubDate && !isNaN(pubDate) ? pubDate.toISOString() : new Date().toISOString(),
          })
          count++
        }
      } catch (err) {
        console.error(`[blogs] Failed to fetch ${name}: ${err.message}`)
      }
    })
  )

  return allItems
}
